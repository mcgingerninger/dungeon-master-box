// Regression tests for the Phase 5a WebSocket sync layer. Run with: node --test
// Uses the 'ws' package as a real client connecting to a real WebSocket server (attached to a
// real http.Server on an OS-assigned port), same "real requests, not mocks" philosophy as
// server.test.js and gambling.test.js.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { WebSocket } from 'ws';
import { openDatabase, createCampaign } from '../db/database.js';
import { createWebSocketServer } from './websocket.js';

let db, httpServer, port, campaignId;
const sockets = []; // opened during a test, force-closed in afterEach even if a test fails early

beforeEach(async () => {
  db = openDatabase(':memory:');
  httpServer = createHttpServer();
  createWebSocketServer(db, httpServer);
  await new Promise(resolve => httpServer.listen(0, resolve));
  port = httpServer.address().port;
  campaignId = createCampaign(db, 'Test').id;
});

afterEach(async () => {
  sockets.forEach(ws => ws.close());
  sockets.length = 0;
  await new Promise(resolve => httpServer.close(resolve));
});

function connect() {
  const ws = new WebSocket(`ws://localhost:${port}`);
  sockets.push(ws);
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
function send(ws, msg) { ws.send(JSON.stringify(msg)); }
// Waits for the next message, with a short timeout so a test that wrongly expects a message
// (e.g. checking self-echo never arrives) fails fast rather than hanging.
function nextMessage(ws, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for a message')), timeoutMs);
    ws.once('message', (raw) => { clearTimeout(timer); resolve(JSON.parse(raw.toString())); });
  });
}
// Confirms NO message arrives within the window — used specifically to prove self-echo doesn't
// happen, which is the main behavioral difference from the original Firestore-based design.
function assertNoMessage(ws, timeoutMs = 300) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, timeoutMs);
    ws.once('message', (raw) => { clearTimeout(timer); reject(new Error('Expected no message, got: ' + raw.toString())); });
  });
}
// Sends push_state and waits for the server's push_ack before returning — replaces an earlier
// version of this file that used a fixed setTimeout("give the server a moment to process")
// instead. That produced real, if infrequent, flaky failures under variable system load: a
// fixed delay is never actually guaranteed to be long enough. Waiting for the real
// confirmation the server now sends (see server/websocket.js's push_ack) is what the original
// Firestore-based pushOwnState() could already do by awaiting its own setDoc() promise — this
// closes the same gap over WebSocket.
async function pushState(ws, rev, state) {
  send(ws, { type: 'push_state', rev, state });
  const ack = await nextMessage(ws);
  assert.equal(ack.type, 'push_ack');
  return ack;
}

describe('identify', () => {
  test('identifying with a real campaign acks with null state the first time', async () => {
    const ws = await connect();
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-1', role: 'player', username: 'Alice' });
    const msg = await nextMessage(ws);
    assert.equal(msg.type, 'identified');
    assert.equal(msg.state, null);
    assert.equal(msg.rev, 0);
  });

  test('identifying with an unknown campaign returns an error', async () => {
    const ws = await connect();
    send(ws, { type: 'identify', campaignId: 999999, accountUid: 'uid-1', role: 'player' });
    const msg = await nextMessage(ws);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /999999/);
  });

  test('any message before identify is rejected', async () => {
    const ws = await connect();
    send(ws, { type: 'push_state', rev: 1, state: { characterCurrentHp: 10 } });
    const msg = await nextMessage(ws);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /identify/);
  });

  test('malformed JSON does not crash the connection', async () => {
    const ws = await connect();
    ws.send('{not valid json');
    const msg = await nextMessage(ws);
    assert.equal(msg.type, 'error');
  });
});

describe('push_state and reconnect', () => {
  test('a pushed state is persisted and visible to a fresh identify (reconnect)', async () => {
    const ws1 = await connect();
    send(ws1, { type: 'identify', campaignId, accountUid: 'uid-1', role: 'player', username: 'Alice' });
    await nextMessage(ws1);
    await pushState(ws1, 1, { characterCurrentHp: 25 });

    // Now simulate a reconnect with a fresh connection — the push above is confirmed persisted
    // (pushState awaited its ack) before this happens, not just assumed to have had "enough time."
    const ws2 = await connect();
    send(ws2, { type: 'identify', campaignId, accountUid: 'uid-1', role: 'player', username: 'Alice' });
    const msg = await nextMessage(ws2);
    assert.equal(msg.type, 'identified');
    assert.equal(msg.state.characterCurrentHp, 25);
    assert.equal(msg.rev, 1);
  });

  test('the pushing connection never receives its own push back (no self-echo)', async () => {
    const ws = await connect();
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-1', role: 'player' });
    await nextMessage(ws);
    send(ws, { type: 'push_state', rev: 1, state: { characterCurrentHp: 25 } });
    // Deliberately NOT using pushState here — the whole point is to prove the ONLY message this
    // connection receives is its own push_ack, never a state_update. Consume the ack explicitly,
    // then confirm nothing else follows.
    const ack = await nextMessage(ws);
    assert.equal(ack.type, 'push_ack');
    await assertNoMessage(ws);
  });

  test('a stale (out-of-order) push is dropped, newer state is not clobbered', async () => {
    const ws = await connect();
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-1', role: 'player' });
    await nextMessage(ws);
    await pushState(ws, 5, { characterCurrentHp: 40 });
    send(ws, { type: 'push_state', rev: 3, state: { characterCurrentHp: 1 } }); // arrives "late" with an older rev
    const rejection = await nextMessage(ws);
    assert.equal(rejection.type, 'push_rejected');

    const ws2 = await connect();
    send(ws2, { type: 'identify', campaignId, accountUid: 'uid-1', role: 'player' });
    const msg = await nextMessage(ws2);
    assert.equal(msg.state.characterCurrentHp, 40); // the newer push wins, the stale one was rejected
  });
});

describe('cross-player writes (DM -> player)', () => {
  async function connectAs(accountUid, role) {
    const ws = await connect();
    send(ws, { type: 'identify', campaignId, accountUid, role, username: accountUid });
    await nextMessage(ws); // consume the 'identified' ack
    return ws;
  }

  test('hp_delta reaches the target player live, clamped to their max HP', async () => {
    const player = await connectAs('uid-player', 'player');
    await pushState(player, 1, { characterCurrentHp: 20, characterMaxHpEffective: 30 });

    const dm = await connectAs('uid-dm', 'dm');
    send(dm, { type: 'hp_delta', targetUid: 'uid-player', delta: -5 });
    const update = await nextMessage(player);
    assert.equal(update.type, 'state_update');
    assert.equal(update.state.characterCurrentHp, 15);

    // Now push past the max and confirm it clamps rather than exceeding it.
    send(dm, { type: 'hp_delta', targetUid: 'uid-player', delta: 100 });
    const clamped = await nextMessage(player);
    assert.equal(clamped.state.characterCurrentHp, 30);
  });

  test('gift_item adds the item to the target\'s savedGeneratedItems and recentlyLooted', async () => {
    const player = await connectAs('uid-player', 'player');
    const dm = await connectAs('uid-dm', 'dm');
    send(dm, { type: 'gift_item', targetUid: 'uid-player', item: { name: 'Flametongue Sword', type: 'weapon' } });
    const update = await nextMessage(player);
    assert.equal(update.state.savedGeneratedItems.length, 1);
    assert.equal(update.state.savedGeneratedItems[0].name, 'Flametongue Sword');
    assert.equal(update.state.recentlyLooted.length, 1);
    assert.match(update.state.recentlyLooted[0], /^gen:/);
  });

  test('set_inventory_fields overwrites only the fields provided', async () => {
    const player = await connectAs('uid-player', 'player');
    await pushState(player, 1, { characterCurrentHp: 20, characterClass: 'Ranger' });

    const dm = await connectAs('uid-dm', 'dm');
    send(dm, { type: 'set_inventory_fields', targetUid: 'uid-player', fields: { playerSlots: { weapon1: 'itemKey1' } } });
    const update = await nextMessage(player);
    assert.deepEqual(update.state.playerSlots, { weapon1: 'itemKey1' });
    assert.equal(update.state.characterCurrentHp, 20); // untouched
    assert.equal(update.state.characterClass, 'Ranger'); // untouched
  });

  test('a non-DM cannot perform cross-player writes', async () => {
    const player1 = await connectAs('uid-player-1', 'player');
    await connectAs('uid-player-2', 'player');
    send(player1, { type: 'hp_delta', targetUid: 'uid-player-2', delta: -5 });
    const msg = await nextMessage(player1);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /DM/);
  });

  test('a cross-player write to a target with no live connection still persists (delivered on next identify)', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    // No prior state exists for this uid, so current HP defaults to 0 and the write floor-clamps
    // to 0 even without a known max — this is the correct, if slightly non-obvious, behavior of
    // the same clamp logic exercised elsewhere, not a special case for the offline path.
    //
    // The target isn't connected, so there's no state_update to wait on — but the DM's OWN
    // connection still gets cross_write_ack once the write actually lands, which is exactly the
    // confirmation needed here instead of assuming the write is "probably done by now."
    send(dm, { type: 'hp_delta', targetUid: 'uid-offline-player', delta: -5 });
    const ack = await nextMessage(dm);
    assert.equal(ack.type, 'cross_write_ack');

    const ws2 = await connect();
    send(ws2, { type: 'identify', campaignId, accountUid: 'uid-offline-player', role: 'player' });
    const identified = await nextMessage(ws2);
    assert.equal(identified.state.characterCurrentHp, 0);
  });
});

describe('loot claims (Phase 5b — first-write-wins arbitration)', () => {
  async function connectAs(accountUid, role) {
    const ws = await connect();
    send(ws, { type: 'identify', campaignId, accountUid, role, username: accountUid });
    await nextMessage(ws);
    return ws;
  }

  test('a self-loot claim on an unclaimed id wins', async () => {
    const player = await connectAs('uid-alice', 'player');
    send(player, { type: 'create_loot_claim', claimId: 'monster1_item1', claimedByUid: 'uid-alice', claimedByUsername: 'Alice' });
    const result = await nextMessage(player);
    assert.equal(result.type, 'loot_claim_result');
    assert.equal(result.won, true);
    assert.equal(result.claimedByUid, 'uid-alice');
  });

  test('two players racing for the SAME claim: exactly one wins, the loser learns who actually won', async () => {
    const alice = await connectAs('uid-alice', 'player');
    const bob = await connectAs('uid-bob', 'player');
    // Fired without awaiting between them — the point is to not control ordering, since the real
    // arbitration guarantee (the UNIQUE constraint in db/schema.js) has to hold regardless of
    // which one the server happens to process first.
    send(alice, { type: 'create_loot_claim', claimId: 'monster1_item1', claimedByUid: 'uid-alice', claimedByUsername: 'Alice' });
    send(bob, { type: 'create_loot_claim', claimId: 'monster1_item1', claimedByUid: 'uid-bob', claimedByUsername: 'Bob' });
    const [aliceResult, bobResult] = await Promise.all([nextMessage(alice), nextMessage(bob)]);

    const winners = [aliceResult, bobResult].filter(r => r.won);
    const losers = [aliceResult, bobResult].filter(r => !r.won);
    assert.equal(winners.length, 1, 'exactly one side should win the race');
    assert.equal(losers.length, 1);
    // The loser must be told who ACTUALLY won, not just that they lost — matching the original's
    // own claim doc, which is always readable regardless of who created it.
    assert.equal(losers[0].claimedByUid, winners[0].claimedByUid);
  });

  test('the DM\'s live connection is notified when a player wins a claim (for their roster)', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    send(player, { type: 'create_loot_claim', claimId: 'monster1_item1', claimedByUid: 'uid-alice', claimedByUsername: 'Alice' });
    await nextMessage(player); // consume the player's own loot_claim_result
    const dmUpdate = await nextMessage(dm);
    assert.equal(dmUpdate.type, 'loot_claim_update');
    assert.equal(dmUpdate.claimedByUid, 'uid-alice');
  });

  test('the DM claiming on a player\'s behalf (a gift) does not send itself a duplicate notification', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    send(dm, { type: 'create_loot_claim', claimId: 'monster1_item1', claimedByUid: 'uid-alice', claimedByUsername: 'Alice' });
    const result = await nextMessage(dm);
    assert.equal(result.type, 'loot_claim_result');
    assert.equal(result.won, true);
    // No second message should follow — the DM already knows via loot_claim_result above, and
    // this file's server code explicitly skips the separate DM notification when the DM was the
    // one who sent the claim in the first place.
    await assertNoMessage(dm);
  });

  test('a non-DM cannot create a claim on someone else\'s behalf', async () => {
    const alice = await connectAs('uid-alice', 'player');
    send(alice, { type: 'create_loot_claim', claimId: 'monster1_item1', claimedByUid: 'uid-bob', claimedByUsername: 'Bob' });
    const msg = await nextMessage(alice);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /DM/);
  });
});
