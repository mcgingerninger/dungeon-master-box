// Phase 5a of the architecture migration (see docs/MIGRATION_PLAN.md, docs/ARCHITECTURE.md):
// WebSocket replacement for ONLY multiplayer-sync.js's core state push/listen loop
// (pushOwnState/startPlayerListener) and its three cross-player writes (applyHpDelta,
// giftItemToPlayer, setPlayerInventoryFields). Firebase Auth, loot-claim race arbitration,
// battlefield/puzzle-log broadcast, the DM roster listener, and the login/account UI are all
// explicitly OUT of scope for this slice — see docs/ARCHITECTURE.md for why the full replacement
// was broken into sub-phases and what each remaining piece needs.
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
//   server -> client:
//     { type: 'identified', state, rev }         -- ack, plus whatever was already persisted for this account
//     { type: 'state_update', state, rev }       -- this account's state changed (a DM cross-write landed)
//     { type: 'error', message }
//
// Self-echo (Firestore's onSnapshot always echoing a client's own writes back to it, which
// multiplayer-sync.js's rev/extRev counters exist specifically to filter back out) simply isn't
// a problem here: the server is stateful and knows exactly which connection sent a push, so it
// never sends that connection a state_update for its own push. What's left is a much smaller
// problem — genuinely out-of-order delivery of rapid successive pushes from the SAME client —
// handled by the `rev` staleness check below.

import { WebSocketServer } from 'ws';
import { getCampaign, savePlayerState, loadPlayerState } from '../db/database.js';

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export function createWebSocketServer(db, httpServer) {
  const wss = new WebSocketServer({ server: httpServer });
  // campaignId -> Map<accountUid, ws> — for the DM to reach a specific player's live connection
  // on a cross-player write. Rebuilt from scratch on every connect/close rather than trying to
  // keep a separate reverse index in sync.
  const rooms = new Map();

  function roomFor(campaignId) {
    if (!rooms.has(campaignId)) rooms.set(campaignId, new Map());
    return rooms.get(campaignId);
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
        roomFor(campaignId).set(msg.accountUid, ws);
        const existing = loadPlayerState(db, campaignId, msg.accountUid);
        send(ws, { type: 'identified', state: existing ? existing.state : null, rev: existing ? existing.rev : 0 });
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
        if (existing && rev <= existing.rev) return;
        savePlayerState(db, identity.campaignId, identity.accountUid, msg.state, rev);
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
        const targetWs = roomFor(identity.campaignId).get(targetUid);
        if (targetWs) send(targetWs, { type: 'state_update', state: nextState, rev: nextRev });
        return;
      }

      send(ws, { type: 'error', message: `Unknown message type "${msg.type}"` });
    });

    ws.on('close', () => {
      if (identity) {
        const room = rooms.get(identity.campaignId);
        if (room && room.get(identity.accountUid) === ws) room.delete(identity.accountUid);
      }
    });
  });

  return wss;
}
