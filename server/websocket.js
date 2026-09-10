// Phases 5a-5c of the architecture migration (see docs/MIGRATION_PLAN.md, docs/ARCHITECTURE.md):
// WebSocket replacement for multiplayer-sync.js's core state push/listen loop
// (pushOwnState/startPlayerListener), its three cross-player writes (applyHpDelta,
// giftItemToPlayer, setPlayerInventoryFields), real-time loot-claim arbitration
// (createLootClaim/startLootClaimListener), and DM-to-players battlefield/puzzle-log broadcast
// (pushBattlefieldState/startBattlefieldListener, pushPuzzleLogState/startPuzzleLogListener).
// Firebase Auth, the DM roster listener, and the login/account UI are all still explicitly OUT
// of scope — see docs/ARCHITECTURE.md for why the full replacement was broken into sub-phases
// and what each remaining piece needs.
//
// Loot claims deliberately do NOT carry the actual item data over this layer, matching the
// original design exactly: a claim only records who won the race for a given claim id (see
// db/schema.js's loot_claims table) — delivering the actual item to the winner is a separate
// concern (battlefield state, a later sub-phase), same as the original split between
// createLootClaim (just the claim doc) and the reactive listener that applies an ALREADY
// locally-known item once a player learns they won.
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
//     { type: 'error', message }
//
// The two ack types matter for more than bookkeeping: the original Firestore design lets a
// caller await pushOwnState's/applyHpDelta's own promise to know a write actually landed.
// Without an equivalent signal here, any caller (including this file's own tests) has no way to
// know a write has actually been persisted except guessing a fixed delay — which is genuinely
// unsafe under variable load, and was confirmed to cause real, if infrequent, test flakiness
// before these acks were added.
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
// Deliberate simplification: the original debounced both pushes client-side by 400ms, purely to
// limit Firestore WRITE FREQUENCY (a real cost/quota concern for a cloud database billed per
// write). That reasoning doesn't transfer to a local SQLite file the DM's own server process
// writes to — there's no per-write cost to amortize — so this phase does not replicate the
// debounce. Noted here explicitly as a considered omission, not a missed detail.

import { WebSocketServer } from 'ws';
import {
  getCampaign, savePlayerState, loadPlayerState, createLootClaim,
  saveSubsystemState, loadSubsystemState,
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
        identity = { campaignId, accountUid: msg.accountUid, role: msg.role, username: msg.username };
        roomFor(campaignId).set(msg.accountUid, { ws, role: msg.role, username: msg.username });
        const existing = loadPlayerState(db, campaignId, msg.accountUid);
        send(ws, { type: 'identified', state: existing ? existing.state : null, rev: existing ? existing.rev : 0 });
        // Phase 5c: a player who just (re)connected should see whatever the DM already
        // published, not wait for the next push — matching Firestore's onSnapshot firing
        // immediately with the doc's current contents the moment a listener subscribes.
        if (msg.role !== 'dm') {
          const battlefield = loadSubsystemState(db, campaignId, 'battlefield_broadcast');
          if (battlefield) send(ws, { type: 'battlefield_update', battleRoster: battlefield.battleRoster, battleLog: battlefield.battleLog });
          const puzzleLog = loadSubsystemState(db, campaignId, 'puzzle_log_broadcast');
          if (puzzleLog) send(ws, { type: 'puzzle_log_update', puzzleLog: puzzleLog.puzzleLog });
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

      send(ws, { type: 'error', message: `Unknown message type "${msg.type}"` });
    });

    ws.on('close', () => {
      if (identity) {
        const room = rooms.get(identity.campaignId);
        if (room && room.get(identity.accountUid)?.ws === ws) room.delete(identity.accountUid);
      }
    });
  });

  return wss;
}
