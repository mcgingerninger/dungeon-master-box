// Phases 5a-5d of the architecture migration (see docs/MIGRATION_PLAN.md, docs/ARCHITECTURE.md):
// WebSocket replacement for multiplayer-sync.js's core state push/listen loop
// (pushOwnState/startPlayerListener), its three cross-player writes (applyHpDelta,
// giftItemToPlayer, setPlayerInventoryFields), real-time loot-claim arbitration
// (createLootClaim/startLootClaimListener), DM-to-players battlefield/puzzle-log broadcast
// (pushBattlefieldState/startBattlefieldListener, pushPuzzleLogState/startPuzzleLogListener),
// the DM roster listener (startRosterListener), and the attack-request review queue
// (submitBattlefieldAttack/startAttackRequestListener/resolveAttackRequest).
//
// Phase 6e added the DM's per-player viewed-player spectator subscription
// (startViewedPlayerListener/stopViewedPlayerListener) and Phase 6f added player removal
// (removePlayer/removeAllPlayers) — both gaps the original Phase 5 audit missed (see
// docs/ARCHITECTURE.md's Phase 6 section). Firebase Auth and the login/account UI were replaced
// by Phase 6b/6c's room-code identity model, not by this file — see docs/ARCHITECTURE.md.
//
// Loot claims deliberately do NOT carry the actual item data over this layer, matching the
// original design exactly: a claim only records who won the race for a given claim id (see
// db/schema.js's loot_claims table) — delivering the actual item to the winner is a separate
// concern (battlefield state), same as the original split between createLootClaim (just the
// claim doc) and the reactive listener that applies an ALREADY locally-known item once a player
// learns they won.
//
// Deliberate, documented gap: this server does NOT cryptographically verify a client's claimed
// identity (accountUid/role) — it trusts whatever the `identify` message says, the same trust
// model Phase 4 already established for gambling. Real verification would mean pulling in
// Firebase Admin SDK to check ID tokens server-side, which is a separate concern from what this
// slice is about (sync-loop correctness, not authentication).
//
// Message protocol (JSON over the WebSocket connection):
//   client -> server:
//     { type: 'identify', campaignId, accountUid, role, username }   -- must be sent first
//     { type: 'push_state', rev, state }                              -- persists the sender's own state
//     { type: 'hp_delta', targetUid, delta }                          -- DM only
//     { type: 'gift_item', targetUid, item }                          -- DM only
//     { type: 'set_inventory_fields', targetUid, fields }             -- DM only
//     { type: 'create_loot_claim', claimId, claimedByUid, claimedByUsername }
//       -- claimedByUid must equal the sender's own accountUid (self-loot), UNLESS the sender is
//       -- the DM claiming on someone else's behalf (a gift) — matching dmGiveLootItem's own
//       -- permission check in the original.
//     { type: 'push_battlefield', battleRoster, battleLog }        -- DM only
//     { type: 'push_puzzle_log', puzzleLog }                       -- DM only
//     { type: 'submit_attack_request', attack }                    -- any player, their own attack
//     { type: 'resolve_attack_request', requestId }                -- DM only (apply/dismiss both
//       -- resolve the same way in the original: delete the request doc — this file doesn't need
//       -- to know which)
//     { type: 'subscribe_player', targetUid }                      -- DM only (Phase 6e); only one
//       -- active subscription per DM connection — a later subscribe_player silently replaces the
//       -- previous target, matching startViewedPlayerListener's own "only ever one of these
//       -- active at a time" in the original
//     { type: 'unsubscribe_player' }                                -- DM only (Phase 6e)
//     { type: 'kick_player', targetUid }                            -- DM only (Phase 6f); cannot
//       -- target the DM's own accountUid
//   server -> client:
//     { type: 'identified', state, rev }             -- ack, plus whatever was already persisted for this account
//     { type: 'push_ack', rev }                       -- confirms a push_state was actually persisted
//     { type: 'push_rejected', reason, rev }          -- a push_state was dropped as stale (see the rev check below)
//     { type: 'cross_write_ack', targetUid, rev }     -- confirms hp_delta/gift_item/set_inventory_fields landed (sent to the DM)
//     { type: 'state_update', state, rev }            -- this account's state changed (a DM cross-write landed) (sent to the target)
//     { type: 'loot_claim_result', claimId, won, claimedByUid, claimedByUsername }
//       -- sent back to whoever sent create_loot_claim: won=true if THEY won the race, false (with
//       -- the actual winner's identity) if someone already claimed it first
//     { type: 'loot_claim_update', claimId, claimedByUid, claimedByUsername }
//       -- sent to the DM's live connection (if they weren't the one claiming) so their roster
//       -- can mark the item claimed, matching markLootClaimOnRoster's role in the original
//     { type: 'push_battlefield_ack' } / { type: 'push_puzzle_log_ack' } -- confirms the DM's push landed
//     { type: 'battlefield_update', battleRoster, battleLog }     -- broadcast to every connected
//       -- PLAYER (never the DM) on a push, AND sent once on identify if something was already
//       -- published, so a reconnecting/late-joining player catches up immediately rather than
//       -- waiting for the next DM action — matching what Firestore's onSnapshot already did by
//       -- firing immediately with whatever the doc already held on subscribe.
//     { type: 'puzzle_log_update', puzzleLog }                    -- same broadcast/catch-up shape
//     { type: 'roster_update', roster }                           -- sent to the DM's live connection
//       -- only, whenever a connected player's stats might have changed (their own push, or a
//       -- cross-write landing) or a player connects/disconnects, AND once immediately when the
//       -- DM themselves identifies — see buildRoster below for what it contains and the one
//       -- real simplification versus the original (connected players only, not every player
//       -- who's ever joined).
//     { type: 'attack_request_list', requests }                   -- sent to the DM's live
//       -- connection with the FULL current pending list (never a diff), on every submit/resolve
//       -- — matching startAttackRequestListener's own "hands the main file the full current
//       -- list... on every change" behavior in the original.
//     { type: 'attack_request_submitted', requestId }             -- ack to the submitting player
//     { type: 'attack_request_resolved', requestId }               -- ack to the DM after resolving
//     { type: 'player_state_update', targetUid, state }            -- Phase 6e: sent to whichever
//       -- DM connection is currently subscribed (via subscribe_player) to targetUid, on every
//       -- push_state or cross-write affecting that target, AND once immediately on subscribe
//       -- (catch-up, same "fire immediately with whatever's already there" spirit as
//       -- battlefield_update/puzzle_log_update above) — state is null if the target has never
//       -- pushed anything yet
//     { type: 'kicked' }                                           -- Phase 6f: sent to a removed
//       -- player's live connection just before the server closes it
//     { type: 'kick_ack', targetUid }                               -- Phase 6f: ack to the DM
//     { type: 'error', message }
//
// The ack types matter for more than bookkeeping: the original Firestore design lets a caller
// await pushOwnState's/applyHpDelta's own promise to know a write actually landed. Without an
// equivalent signal here, any caller (including this file's own tests) has no way to know a
// write has actually been persisted except guessing a fixed delay — which is genuinely unsafe
// under variable load, and was confirmed to cause real, if infrequent, test flakiness before
// these acks were added.
//
// Self-echo (Firestore's onSnapshot always echoing a client's own writes back to it, which
// multiplayer-sync.js's rev/extRev counters exist specifically to filter back out) simply isn't
// a problem here: the server is stateful and knows exactly which connection sent a push, so it
// never sends that connection a state_update for its own push. What's left is a much smaller
// problem — genuinely out-of-order delivery of rapid successive pushes from the SAME client —
// handled by the `rev` staleness check below.
//
// Battlefield loot-visibility filtering (push_battlefield) replicates the original's
// pushBattlefieldState exactly: an ALLOWLIST of safe fields (never a blacklist of sensitive
// ones — "there is nothing for a player to find via devtools that the DM hasn't chosen to
// share," per the original's own comment), loot entirely absent until lootRevealed is set, and
// even after reveal, reserved/already-claimed items stripped individually. See
// filterBattleRosterForPlayers below.
//
// Deliberate simplification: the original debounced both battlefield/puzzle-log pushes
// client-side by 400ms, purely to limit Firestore WRITE FREQUENCY (a real cost/quota concern
// for a cloud database billed per write). That reasoning doesn't transfer to a local SQLite file
// the DM's own server process writes to — there's no per-write cost to amortize — so this phase
// does not replicate the debounce. Noted here explicitly as a considered omission.
//
// Deliberate simplification: the DM roster (buildRoster) reflects CURRENTLY CONNECTED players
// only, derived from this file's own in-memory `rooms` map plus their persisted player_states
// row for stats. The original tracked every player who had EVER joined the campaign (Firestore's
// collection listener sees every doc regardless of whether that browser is currently open),
// including a last-known username/role even for someone offline. Replicating that fully would
// mean persisting username/role alongside player_states (today it only stores the state blob +
// rev) — a real, if small, schema change judged not worth it for this final sub-phase given the
// roster's main practical use (targeting a live player in combat) only matters for players who
// are actually connected right now. Noted here as a genuine, deliberate scope reduction, not an
// oversight.

import { WebSocketServer } from 'ws';
import {
  getCampaign, savePlayerState, loadPlayerState, deletePlayerState, createLootClaim,
  saveSubsystemState, loadSubsystemState,
  createAttackRequest, listAttackRequests, deleteAttackRequest,
} from '../db/database.js';

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// Mirrors pushBattlefieldState's own destructuring exactly — same allowlisted field set, same
// loot-reveal/reservation/claim filtering.
function filterBattleRosterForPlayers(battleRoster) {
  return (battleRoster || []).map((entry) => {
    const { uid, monster, displayName, variant, traits, chaosGearList, hp, maxHp, hpRoll, ac, statLines, lastResult, defeated, loot, lootRevealed, isCorpse } = entry;
    const out = { uid, monster, displayName, variant, traits, chaosGearList, hp, maxHp, hpRoll, ac, statLines, lastResult, defeated, isCorpse };
    if (loot && lootRevealed) out.loot = { tier: loot.tier, gold: loot.gold, items: (loot.items || []).filter(it => !it.reserved && !it.claimedBy) };
    return out;
  });
}

export function createWebSocketServer(db, httpServer) {
  const wss = new WebSocketServer({ server: httpServer });
  // campaignId -> Map<accountUid, {ws, role, username}> — for the DM to reach a specific
  // player's live connection on a cross-player write, and (Phase 5b) for a player's loot claim
  // to reach the DM's live connection regardless of the DM's own uid. Rebuilt from scratch on
  // every connect/close rather than trying to keep a separate reverse index in sync.
  const rooms = new Map();

  function roomFor(campaignId) {
    if (!rooms.has(campaignId)) rooms.set(campaignId, new Map());
    return rooms.get(campaignId);
  }
  function findDmConnection(campaignId) {
    for (const entry of roomFor(campaignId).values()) {
      if (entry.role === 'dm') return entry.ws;
    }
    return null;
  }
  // Phase 5c: every connected PLAYER (never the DM — matching startBattlefieldListener/
  // startPuzzleLogListener only ever being started for role !== 'dm' in the original).
  function broadcastToPlayers(campaignId, msg) {
    for (const entry of roomFor(campaignId).values()) {
      if (entry.role !== 'dm') send(entry.ws, msg);
    }
  }

  // Phase 5d. See the module comment above for the one real simplification versus the original
  // (connected players only). Clamping mirrors startRosterListener's own clamp exactly.
  //
  // Found during Phase 6e's browser testing (the first sub-phase to actually exercise the
  // monolith's Players tab live): this was missing a `role` field on every entry. The original's
  // own roster entries always carried `role: d.role` (see startRosterListener), and the
  // monolith's renderPlayersTab() filters on exactly `p.role === 'player'` — without it, every
  // entry was silently excluded, so the Players tab has shown "No players have joined yet." since
  // Phase 5d, undetected because nothing exercised that specific consumer until now. Every entry
  // here is already known to be a player (the `dm` check above), so this is just `'player'`.
  function buildRoster(campaignId) {
    const roster = [];
    for (const [accountUid, entry] of roomFor(campaignId).entries()) {
      if (entry.role === 'dm') continue;
      const stateEntry = loadPlayerState(db, campaignId, accountUid);
      const s = stateEntry ? stateEntry.state : {};
      const maxHp = typeof s.characterMaxHpEffective === 'number' ? s.characterMaxHpEffective : s.characterMaxHp;
      const currentHp = typeof s.characterCurrentHp === 'number' && typeof maxHp === 'number'
        ? Math.max(0, Math.min(s.characterCurrentHp, maxHp)) : s.characterCurrentHp;
      roster.push({ uid: accountUid, username: entry.username || 'Unnamed', role: 'player', currentHp, maxHp, ac: s.characterAc });
    }
    return roster;
  }
  function broadcastRoster(campaignId) {
    const dmWs = findDmConnection(campaignId);
    if (dmWs) send(dmWs, { type: 'roster_update', roster: buildRoster(campaignId) });
  }

  // Phase 6e: the DM's Players-tab spectator view — a live, read-only look at ONE specific
  // player's full state, separate from buildRoster (which only ever extracts a thin HP/AC
  // summary for every player at once). Only ever one DM connection could plausibly be viewing at
  // a time in practice, but this checks every connection in the room rather than assuming a
  // single DM, same defensive shape findDmConnection already uses.
  function notifyViewers(campaignId, targetUid, state) {
    for (const entry of roomFor(campaignId).values()) {
      if (entry.viewingUid === targetUid) send(entry.ws, { type: 'player_state_update', targetUid, state });
    }
  }

  wss.on('connection', (ws) => {
    let identity = null; // { campaignId, accountUid, role, username }

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { return send(ws, { type: 'error', message: 'Malformed JSON message' }); }

      if (msg.type === 'identify') {
        const campaignId = Number(msg.campaignId);
        if (!Number.isInteger(campaignId) || !getCampaign(db, campaignId)) {
          return send(ws, { type: 'error', message: `No campaign with id ${msg.campaignId}` });
        }
        if (!msg.accountUid || typeof msg.accountUid !== 'string') {
          return send(ws, { type: 'error', message: '"accountUid" is required' });
        }
        // Phase 6c found this the hard way: a second connection identifying with an accountUid
        // that's already live (e.g. the DM opening a second tab, or a page reload racing its own
        // still-closing old connection) would otherwise silently REPLACE the map entry without
        // touching the old connection at all. The old tab looks connected (its socket is still
        // open) but is now untracked — no roster/battlefield/puzzle broadcasts reach it, and if
        // it's the DM, findDmConnection stops finding them entirely. Worse: if that orphaned old
        // connection later closes, its own close handler's `room.get(uid)?.ws === ws` check
        // correctly no-ops (the map already points at the new ws) — so this wasn't crashing
        // anything, it was just going quietly deaf, which is harder to notice than a crash.
        // Explicitly closing the old connection (with a reason) converts an invisible zombie
        // connection into a visible, honest "you're connected elsewhere now."
        const room = roomFor(campaignId);
        const displaced = room.get(msg.accountUid);
        if (displaced && displaced.ws !== ws && displaced.ws.readyState === displaced.ws.OPEN) {
          send(displaced.ws, { type: 'error', message: 'Connected from another tab or device — this connection is being closed.' });
          displaced.ws.close();
        }
        identity = { campaignId, accountUid: msg.accountUid, role: msg.role, username: msg.username };
        // viewingUid: Phase 6e — which OTHER player's live state this connection is currently
        // subscribed to (DM only; null for everyone else, and null here until subscribe_player).
        room.set(msg.accountUid, { ws, role: msg.role, username: msg.username, viewingUid: null });
        const existing = loadPlayerState(db, campaignId, msg.accountUid);
        send(ws, { type: 'identified', state: existing ? existing.state : null, rev: existing ? existing.rev : 0 });
        if (msg.role !== 'dm') {
          // Phase 5c: a player who just (re)connected should see whatever the DM already
          // published, not wait for the next push — matching Firestore's onSnapshot firing
          // immediately with the doc's current contents the moment a listener subscribes.
          const battlefield = loadSubsystemState(db, campaignId, 'battlefield_broadcast');
          if (battlefield) send(ws, { type: 'battlefield_update', battleRoster: battlefield.battleRoster, battleLog: battlefield.battleLog });
          const puzzleLog = loadSubsystemState(db, campaignId, 'puzzle_log_broadcast');
          if (puzzleLog) send(ws, { type: 'puzzle_log_update', puzzleLog: puzzleLog.puzzleLog });
          // Phase 5d: this player joining/reconnecting changes what the DM's roster should show.
          broadcastRoster(campaignId);
        } else {
          // Phase 5d: the DM gets an immediate initial roster and pending-attack list on their
          // own identify, same catch-up spirit as the player-facing broadcasts above.
          send(ws, { type: 'roster_update', roster: buildRoster(campaignId) });
          send(ws, { type: 'attack_request_list', requests: listAttackRequests(db, campaignId) });
        }
        return;
      }

      if (!identity) return send(ws, { type: 'error', message: 'Send "identify" before anything else' });

      if (msg.type === 'push_state') {
        const rev = Number(msg.rev) || 0;
        const existing = loadPlayerState(db, identity.campaignId, identity.accountUid);
        // Out-of-order guard: a rapid second push whose network round-trip finishes before an
        // even-newer push's does not get to clobber the newer one. This is the one piece of the
        // original's rev logic that's still needed — the self-echo half is gone by construction
        // (see the module comment above).
        if (existing && rev <= existing.rev) return send(ws, { type: 'push_rejected', reason: 'stale rev', rev });
        savePlayerState(db, identity.campaignId, identity.accountUid, msg.state, rev);
        // The original Firestore design lets a caller know a push actually landed — pushOwnState
        // returns the promise from `await setDoc(...)`. This ack is that same guarantee over
        // WebSocket: a caller (or a test) can wait for confirmation instead of assuming a fixed
        // delay was long enough, which is genuinely unsafe under variable system load.
        send(ws, { type: 'push_ack', rev });
        if (identity.role !== 'dm') broadcastRoster(identity.campaignId); // Phase 5d: stats may have changed
        notifyViewers(identity.campaignId, identity.accountUid, msg.state); // Phase 6e
        return;
      }

      if (msg.type === 'subscribe_player') {
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can view a player.' });
        const entry = roomFor(identity.campaignId).get(identity.accountUid);
        if (entry) entry.viewingUid = msg.targetUid;
        // Catch-up, matching the original's onSnapshot firing immediately with whatever the doc
        // already held the moment a listener subscribes — the DM shouldn't have to wait for the
        // target's NEXT action just to see their current state.
        const existingTarget = loadPlayerState(db, identity.campaignId, msg.targetUid);
        send(ws, { type: 'player_state_update', targetUid: msg.targetUid, state: existingTarget ? existingTarget.state : null });
        return;
      }

      if (msg.type === 'unsubscribe_player') {
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can do that.' });
        const entry = roomFor(identity.campaignId).get(identity.accountUid);
        if (entry) entry.viewingUid = null;
        return;
      }

      if (msg.type === 'hp_delta' || msg.type === 'gift_item' || msg.type === 'set_inventory_fields') {
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can do that' });
        const targetUid = msg.targetUid;
        const existing = loadPlayerState(db, identity.campaignId, targetUid) || { state: {}, rev: 0 };
        const nextState = { ...existing.state };

        if (msg.type === 'hp_delta') {
          const current = typeof nextState.characterCurrentHp === 'number' ? nextState.characterCurrentHp : 0;
          const max = typeof nextState.characterMaxHpEffective === 'number' ? nextState.characterMaxHpEffective
            : (typeof nextState.characterMaxHp === 'number' ? nextState.characterMaxHp : undefined);
          const proposed = current + (Number(msg.delta) || 0);
          nextState.characterCurrentHp = max != null ? Math.max(0, Math.min(proposed, max)) : Math.max(0, proposed);
        } else if (msg.type === 'gift_item') {
          const saved = { ...msg.item, id: Date.now() + '_' + Math.random().toString(36).slice(2) };
          nextState.savedGeneratedItems = [...(nextState.savedGeneratedItems || []), saved];
          nextState.recentlyLooted = [...(nextState.recentlyLooted || []), 'gen:' + saved.id];
        } else if (msg.type === 'set_inventory_fields') {
          Object.assign(nextState, msg.fields || {});
        }

        const nextRev = existing.rev + 1;
        savePlayerState(db, identity.campaignId, targetUid, nextState, nextRev);
        const target = roomFor(identity.campaignId).get(targetUid);
        if (target) send(target.ws, { type: 'state_update', state: nextState, rev: nextRev });
        // Acks the DM's OWN connection, separately from the target's state_update above — lets
        // the DM's client (or a test) know the write actually landed, the same guarantee
        // push_ack gives a player pushing their own state. Same reasoning: a client shouldn't
        // have to guess how long "probably done by now" is.
        send(ws, { type: 'cross_write_ack', targetUid, rev: nextRev });
        broadcastRoster(identity.campaignId); // Phase 5d: the target's stats (e.g. HP) may have changed
        notifyViewers(identity.campaignId, targetUid, nextState); // Phase 6e
        return;
      }

      if (msg.type === 'create_loot_claim') {
        const claimedByUid = msg.claimedByUid;
        if (claimedByUid !== identity.accountUid && identity.role !== 'dm') {
          return send(ws, { type: 'error', message: 'Only the DM can create a claim on someone else\'s behalf' });
        }
        const result = createLootClaim(db, identity.campaignId, msg.claimId, claimedByUid, msg.claimedByUsername);
        send(ws, { type: 'loot_claim_result', claimId: msg.claimId, ...result });
        // Matches the original's two listener roles exactly: the winning player needs to know
        // they won (loot_claim_result above already tells THEM, whether they won or not), and
        // the DM needs to know a claim happened at all so their roster can mark it claimed —
        // regardless of whether the DM was the one who sent this message. No one else is
        // notified, because no one else's listener in the original did anything in response
        // (a losing OTHER player's own claimedBy !== mp.uid check was always a no-op for them).
        if (identity.role !== 'dm') {
          const dmWs = findDmConnection(identity.campaignId);
          if (dmWs) send(dmWs, { type: 'loot_claim_update', claimId: msg.claimId, claimedByUid: result.claimedByUid, claimedByUsername: result.claimedByUsername });
        }
        return;
      }

      if (msg.type === 'push_battlefield') {
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can push battlefield state' });
        const battleRoster = filterBattleRosterForPlayers(msg.battleRoster);
        const battleLog = (msg.battleLog || []).slice(-50);
        saveSubsystemState(db, identity.campaignId, 'battlefield_broadcast', { battleRoster, battleLog });
        broadcastToPlayers(identity.campaignId, { type: 'battlefield_update', battleRoster, battleLog });
        send(ws, { type: 'push_battlefield_ack' });
        return;
      }

      if (msg.type === 'push_puzzle_log') {
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can push the puzzle log' });
        const puzzleLog = msg.puzzleLog || [];
        saveSubsystemState(db, identity.campaignId, 'puzzle_log_broadcast', { puzzleLog });
        broadcastToPlayers(identity.campaignId, { type: 'puzzle_log_update', puzzleLog });
        send(ws, { type: 'push_puzzle_log_ack' });
        return;
      }

      if (msg.type === 'submit_attack_request') {
        // Any connected player may submit their own attack — matching submitBattlefieldAttack's
        // own lack of a role check (any authenticated user could create one; it's always their
        // own uid/username the server stamps on it here, same as the original spreading
        // {...attack, playerUid: mp.uid, playerUsername: mp.username}).
        const request = createAttackRequest(db, identity.campaignId, identity.accountUid, identity.username, msg.attack);
        send(ws, { type: 'attack_request_submitted', requestId: request.id });
        const dmWs = findDmConnection(identity.campaignId);
        // Full current list, not a diff — matching startAttackRequestListener's own "hands the
        // main file the full current list of pending requests on every change" behavior.
        if (dmWs) send(dmWs, { type: 'attack_request_list', requests: listAttackRequests(db, identity.campaignId) });
        return;
      }

      if (msg.type === 'resolve_attack_request') {
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can resolve attack requests' });
        deleteAttackRequest(db, identity.campaignId, msg.requestId);
        send(ws, { type: 'attack_request_resolved', requestId: msg.requestId });
        send(ws, { type: 'attack_request_list', requests: listAttackRequests(db, identity.campaignId) });
        return;
      }

      if (msg.type === 'kick_player') {
        // Phase 6f. Matches the original removePlayer's own scope exactly: deletes this
        // campaign's character/inventory progress for the target, nothing about their identity
        // (there's no separate login to revoke in this identity model — see deletePlayerState's
        // own comment) — they can rejoin fresh with the same device uid and campaign code any
        // time, a known, deliberately-simple limitation carried forward from the original.
        if (identity.role !== 'dm') return send(ws, { type: 'error', message: 'Only the DM can remove a player.' });
        const targetUid = msg.targetUid;
        if (targetUid === identity.accountUid) return send(ws, { type: 'error', message: "You can't remove yourself." });
        deletePlayerState(db, identity.campaignId, targetUid);
        const room = roomFor(identity.campaignId);
        const target = room.get(targetUid);
        if (target) {
          // Told explicitly (not just disconnected) so their client shows a real reason instead
          // of silently reconnecting and looking like nothing happened — same spirit as the
          // Phase 6c displaced-connection fix above.
          send(target.ws, { type: 'kicked' });
          target.ws.close();
          room.delete(targetUid);
        }
        send(ws, { type: 'kick_ack', targetUid });
        broadcastRoster(identity.campaignId);
        return;
      }

      send(ws, { type: 'error', message: `Unknown message type "${msg.type}"` });
    });

    ws.on('close', () => {
      if (identity) {
        const room = rooms.get(identity.campaignId);
        if (room && room.get(identity.accountUid)?.ws === ws) {
          const wasPlayer = identity.role !== 'dm';
          room.delete(identity.accountUid);
          // Phase 5d: a disconnected player should drop off the DM's live roster.
          if (wasPlayer) broadcastRoster(identity.campaignId);
        }
      }
    });
  });

  return wss;
}
