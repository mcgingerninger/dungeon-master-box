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
// A real bug this file's own Phase 5c tests hit and needed this fix for: nextMessage's .once()
// listener is only attached at the moment it's CALLED — if a message can arrive on a connection
// before the test gets around to calling nextMessage on it (e.g. a broadcast triggered by a
// DIFFERENT connection's action, while this test is still busy awaiting something else first),
// Node's EventEmitter does not buffer it for a listener that attaches later; the message just
// fires into the void and is gone. messageQueue starts capturing every message the instant it's
// called (a persistent .on('message', ...), not .once()), queuing anything that arrives before
// next() is called for it — so it genuinely cannot lose a message to this race, regardless of
// how much other work happens between "this connection might receive something" and "the test
// actually checks for it."
function messageQueue(ws) {
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (waiters.length) waiters.shift()(msg);
    else queue.push(msg);
  });
  return function next(timeoutMs = 500) {
    if (queue.length) return Promise.resolve(queue.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for a queued message')), timeoutMs);
      waiters.push((msg) => { clearTimeout(timer); resolve(msg); });
    });
  };
}
// Phase 5d added automatic roster_update broadcasts to the DM's connection any time a player
// connects, pushes state, or is affected by a cross-write — real, correct behavior, but it means
// any test with both a dm and a player connection can now see a roster_update interleaved with
// whatever else the DM's connection receives, in an order this file has no reason to pin down
// (and shouldn't need to, since these tests aren't testing roster behavior). Rather than
// asserting an exact message order that would make every such test fragile against an
// implementation detail, this skips past any roster_update noise to find the message actually
// being tested for — the same "don't lose messages to timing" discipline as messageQueue, just
// also permissive about a message type known to be expected-but-irrelevant here.
async function nextNonRosterMessage(queueNext) {
  let msg = await queueNext();
  while (msg.type === 'roster_update') msg = await queueNext();
  return msg;
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

// Shared by every describe block below that needs a connected+identified socket. Uses
// messageQueue internally (not the fragile nextMessage) so nothing arriving during identify can
// be lost, and attaches the resulting next() as ws.next so callers can keep reading this
// connection's later messages just as robustly. A DM's own identify unconditionally sends an
// initial roster_update and attack_request_list (Phase 5d catch-up) right after 'identified' —
// drained here so a connection returned by connectAs always starts with an empty queue, matching
// what every existing caller already assumes.
async function connectAs(accountUid, role) {
  const ws = await connect();
  const next = messageQueue(ws);
  send(ws, { type: 'identify', campaignId, accountUid, role, username: accountUid });
  const identified = await next();
  assert.equal(identified.type, 'identified');
  if (role === 'dm') {
    await next(); // roster_update
    await next(); // attack_request_list
  }
  ws.next = next;
  return ws;
}
// Counterpart to assertNoMessage, for connections using the messageQueue/connectAs pattern.
function assertNoQueuedMessage(next, timeoutMs = 300) {
  return assert.rejects(next(timeoutMs), /Timed out waiting for a queued message/);
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
    const ack = await dm.next();
    assert.equal(ack.type, 'cross_write_ack');

    const ws2 = await connect();
    send(ws2, { type: 'identify', campaignId, accountUid: 'uid-offline-player', role: 'player' });
    const identified = await nextMessage(ws2);
    assert.equal(identified.state.characterCurrentHp, 0);
  });
});

describe('loot claims (Phase 5b — first-write-wins arbitration)', () => {
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
    // Alice's own connectAs() just triggered a roster_update to the DM (Phase 5d) — skip past
    // that noise to find the loot_claim_update actually being tested for here.
    const dmUpdate = await nextNonRosterMessage(dm.next);
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

describe('battlefield broadcast (Phase 5c)', () => {
  const sampleEntry = {
    uid: 'monster-1', monster: 'Goblin', displayName: 'Goblin', variant: null, traits: [], chaosGearList: [],
    hp: 5, maxHp: 7, hpRoll: '2d6', ac: 13, statLines: [], lastResult: null, defeated: true, isCorpse: false,
    lootRevealed: true,
    loot: { tier: 'common', gold: 12, items: [{ id: 'item1', name: 'Rusty Dagger' }, { id: 'item2', name: 'Reserved Sword', reserved: true }, { id: 'item3', name: 'Claimed Shield', claimedBy: 'uid-someone' }] },
    // A field NOT on the allowlist, to confirm it's actually stripped, not just "happens to be absent."
    dmOnlySecretNotes: 'this should never reach a player',
  };

  test('a battlefield push reaches every connected player, never the DM', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    const playerNext = messageQueue(player); // capture from here, before the DM's push can arrive
    send(dm, { type: 'push_battlefield', battleRoster: [sampleEntry], battleLog: ['Goblin defeated.'] });
    // Alice's connectAs() above triggered a roster_update to the DM (Phase 5d) — skip past it to
    // find the actual push ack being tested for here.
    const ack = await nextNonRosterMessage(dm.next);
    assert.equal(ack.type, 'push_battlefield_ack');
    await assertNoQueuedMessage(dm.next); // no battlefield_update for the DM itself

    const update = await playerNext();
    assert.equal(update.type, 'battlefield_update');
    assert.equal(update.battleRoster.length, 1);
  });

  test('unrevealed loot is never sent at all', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    const playerNext = messageQueue(player);
    const hidden = { ...sampleEntry, lootRevealed: false };
    send(dm, { type: 'push_battlefield', battleRoster: [hidden], battleLog: [] });
    await nextNonRosterMessage(dm.next);
    const update = await playerNext();
    assert.equal(update.battleRoster[0].loot, undefined);
  });

  test('revealed loot strips reserved and already-claimed items, keeps the rest', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    const playerNext = messageQueue(player);
    send(dm, { type: 'push_battlefield', battleRoster: [sampleEntry], battleLog: [] });
    await nextNonRosterMessage(dm.next);
    const update = await playerNext();
    const loot = update.battleRoster[0].loot;
    assert.equal(loot.tier, 'common');
    assert.equal(loot.gold, 12);
    assert.deepEqual(loot.items.map(i => i.id), ['item1']); // reserved and claimed items both stripped
  });

  test('only allowlisted fields reach the player — anything else (e.g. DM-only notes) is stripped', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    const playerNext = messageQueue(player);
    send(dm, { type: 'push_battlefield', battleRoster: [sampleEntry], battleLog: [] });
    await nextNonRosterMessage(dm.next);
    const update = await playerNext();
    assert.equal(update.battleRoster[0].dmOnlySecretNotes, undefined);
    assert.equal(update.battleRoster[0].monster, 'Goblin'); // a real allowlisted field does survive
  });

  test('battleLog is truncated to the last 50 entries', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    const playerNext = messageQueue(player);
    const longLog = Array.from({ length: 60 }, (_, i) => `Event ${i}`);
    send(dm, { type: 'push_battlefield', battleRoster: [], battleLog: longLog });
    await nextNonRosterMessage(dm.next);
    const update = await playerNext();
    assert.equal(update.battleLog.length, 50);
    assert.equal(update.battleLog[0], 'Event 10'); // the oldest 10 were dropped, not the newest
  });

  test('a player who identifies AFTER a push already happened catches up immediately', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    send(dm, { type: 'push_battlefield', battleRoster: [sampleEntry], battleLog: ['already happened'] });
    await nextMessage(dm);

    const ws = await connect();
    const wsNext = messageQueue(ws); // capture both 'identified' and the catch-up push, in order
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-late-player', role: 'player' });
    const identified = await wsNext();
    assert.equal(identified.type, 'identified');
    const catchUp = await wsNext(); // should NOT require a new push
    assert.equal(catchUp.type, 'battlefield_update');
    assert.equal(catchUp.battleLog[0], 'already happened');
  });

  test('a non-DM cannot push battlefield state', async () => {
    const player = await connectAs('uid-alice', 'player');
    send(player, { type: 'push_battlefield', battleRoster: [], battleLog: [] });
    const msg = await nextMessage(player);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /DM/);
  });
});

describe('puzzle log broadcast (Phase 5c)', () => {
  test('a puzzle log push reaches every connected player, never the DM', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    const playerNext = messageQueue(player);
    send(dm, { type: 'push_puzzle_log', puzzleLog: [{ riddle: 'What has keys but no locks?', answer: 'A piano' }] });
    // Alice's connectAs() above triggered a roster_update to the DM (Phase 5d) — skip past it to
    // find the actual push ack being tested for here.
    const ack = await nextNonRosterMessage(dm.next);
    assert.equal(ack.type, 'push_puzzle_log_ack');
    await assertNoQueuedMessage(dm.next);

    const update = await playerNext();
    assert.equal(update.type, 'puzzle_log_update');
    assert.equal(update.puzzleLog.length, 1);
    assert.equal(update.puzzleLog[0].answer, 'A piano');
  });

  test('a player who identifies AFTER a push already happened catches up immediately', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    send(dm, { type: 'push_puzzle_log', puzzleLog: [{ riddle: 'Already published', answer: '...' }] });
    await nextMessage(dm);

    const ws = await connect();
    const wsNext = messageQueue(ws);
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-late-player', role: 'player' });
    const identified = await wsNext();
    assert.equal(identified.type, 'identified');
    const catchUp = await wsNext();
    assert.equal(catchUp.type, 'puzzle_log_update');
    assert.equal(catchUp.puzzleLog[0].riddle, 'Already published');
  });

  test('a non-DM cannot push the puzzle log', async () => {
    const player = await connectAs('uid-alice', 'player');
    send(player, { type: 'push_puzzle_log', puzzleLog: [] });
    const msg = await nextMessage(player);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /DM/);
  });
});

describe('DM roster listener (Phase 5d)', () => {
  test('the DM gets an empty roster and empty attack list immediately on identify', async () => {
    const ws = await connect();
    const next = messageQueue(ws);
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-dm', role: 'dm', username: 'DM' });
    const identified = await next();
    assert.equal(identified.type, 'identified');
    const roster = await next();
    assert.equal(roster.type, 'roster_update');
    assert.deepEqual(roster.roster, []);
    const requests = await next();
    assert.equal(requests.type, 'attack_request_list');
    assert.deepEqual(requests.requests, []);
  });

  test('a player connecting adds them to the DM\'s roster; pushing state updates their stats', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-player', 'player');
    const joinRoster = await dm.next();
    assert.equal(joinRoster.type, 'roster_update');
    assert.equal(joinRoster.roster.length, 1);
    assert.equal(joinRoster.roster[0].uid, 'uid-player');

    await pushState(player, 1, { characterCurrentHp: 18, characterMaxHpEffective: 25, characterAc: 16 });
    const statsRoster = await dm.next();
    assert.equal(statsRoster.type, 'roster_update');
    assert.equal(statsRoster.roster[0].currentHp, 18);
    assert.equal(statsRoster.roster[0].maxHp, 25);
    assert.equal(statsRoster.roster[0].ac, 16);
  });

  test('roster current HP is clamped to max HP, matching startRosterListener\'s own clamp', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-player', 'player');
    await dm.next(); // join roster_update

    await pushState(player, 1, { characterCurrentHp: 999, characterMaxHpEffective: 30 });
    const roster = await dm.next();
    assert.equal(roster.roster[0].currentHp, 30); // clamped, not 999
  });

  test('a DM cross-write (hp_delta) landing also refreshes the roster', async () => {
    const player = await connectAs('uid-player', 'player');
    await pushState(player, 1, { characterCurrentHp: 20, characterMaxHpEffective: 30 });
    // connectAs already drains the DM's own initial roster_update (which reflects the player
    // connected above, since it's built fresh on every identify) as part of identify catch-up —
    // nothing extra to consume here before the cross-write itself.
    const dm = await connectAs('uid-dm', 'dm');

    send(dm, { type: 'hp_delta', targetUid: 'uid-player', delta: -5 });
    await nextMessage(player); // consume the target's state_update
    // Order on the DM's own connection: cross_write_ack first, then the roster refresh.
    const ack = await dm.next();
    assert.equal(ack.type, 'cross_write_ack');
    const roster = await dm.next();
    assert.equal(roster.type, 'roster_update');
    assert.equal(roster.roster[0].currentHp, 15);
  });

  test('a disconnecting player drops off the DM\'s roster', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-player', 'player');
    await dm.next(); // join roster_update, player present

    player.close();
    const roster = await dm.next();
    assert.equal(roster.type, 'roster_update');
    assert.deepEqual(roster.roster, []);
  });

  test('players never receive roster_update — it is DM-only', async () => {
    const player = await connectAs('uid-player', 'player');
    const playerNext = messageQueue(player);
    await connectAs('uid-dm', 'dm');
    await connectAs('uid-other-player', 'player'); // triggers a roster_update, but only to the DM
    await assertNoQueuedMessage(playerNext, 300);
  });
});

describe('attack-request review queue (Phase 5d)', () => {
  test('submitting an attack acks the player and sends the DM the full list', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    await dm.next(); // Alice's connect-triggered roster_update

    send(player, { type: 'submit_attack_request', attack: { toHit: 15, damage: 8, targetUid: 'monster-1' } });
    const ack = await nextMessage(player);
    assert.equal(ack.type, 'attack_request_submitted');
    assert.equal(typeof ack.requestId, 'number');

    const list = await dm.next();
    assert.equal(list.type, 'attack_request_list');
    assert.equal(list.requests.length, 1);
    assert.equal(list.requests[0].playerUid, 'uid-alice');
    assert.equal(list.requests[0].playerUsername, 'uid-alice'); // connectAs uses accountUid as username
    assert.deepEqual(list.requests[0].attackData, { toHit: 15, damage: 8, targetUid: 'monster-1' });
  });

  test('multiple pending requests all appear, oldest first', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const alice = await connectAs('uid-alice', 'player');
    const bob = await connectAs('uid-bob', 'player');
    await dm.next(); // alice's join roster_update
    await dm.next(); // bob's join roster_update

    send(alice, { type: 'submit_attack_request', attack: { move: 'first' } });
    await nextMessage(alice);
    await dm.next(); // list with 1 entry

    send(bob, { type: 'submit_attack_request', attack: { move: 'second' } });
    await nextMessage(bob);
    const list = await dm.next(); // list with 2 entries
    assert.equal(list.requests.length, 2);
    assert.equal(list.requests[0].attackData.move, 'first');
    assert.equal(list.requests[1].attackData.move, 'second');
  });

  test('resolving a request (DM only) removes it and re-sends the updated full list', async () => {
    const dm = await connectAs('uid-dm', 'dm');
    const player = await connectAs('uid-alice', 'player');
    await dm.next(); // join roster_update

    send(player, { type: 'submit_attack_request', attack: { move: 'x' } });
    await nextMessage(player);
    const list1 = await dm.next();
    const requestId = list1.requests[0].id;

    send(dm, { type: 'resolve_attack_request', requestId });
    const resolved = await dm.next();
    assert.equal(resolved.type, 'attack_request_resolved');
    assert.equal(resolved.requestId, requestId);
    const list2 = await dm.next();
    assert.equal(list2.type, 'attack_request_list');
    assert.deepEqual(list2.requests, []);
  });

  test('a non-DM cannot resolve an attack request', async () => {
    const player = await connectAs('uid-alice', 'player');
    send(player, { type: 'resolve_attack_request', requestId: 1 });
    const msg = await nextMessage(player);
    assert.equal(msg.type, 'error');
    assert.match(msg.message, /DM/);
  });

  test('a DM connecting after requests already exist catches up via attack_request_list on identify', async () => {
    const player = await connectAs('uid-alice', 'player');
    send(player, { type: 'submit_attack_request', attack: { move: 'already pending' } });
    await nextMessage(player); // ack — no DM connected yet to receive the list broadcast

    const ws = await connect();
    const wsNext = messageQueue(ws);
    send(ws, { type: 'identify', campaignId, accountUid: 'uid-dm', role: 'dm', username: 'DM' });
    const identified = await wsNext();
    assert.equal(identified.type, 'identified');
    const roster = await wsNext();
    assert.equal(roster.type, 'roster_update');
    const list = await wsNext();
    assert.equal(list.type, 'attack_request_list');
    assert.equal(list.requests.length, 1);
    assert.equal(list.requests[0].attackData.move, 'already pending');
  });
});
