// Regression tests for Phase 4's server-authoritative gambling routes. Run with: node --test
// Uses real HTTP requests against a real listening server, same pattern as server.test.js.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db/database.js';
import { createServer } from './server.js';
import { ROULETTE_WHEEL_ORDER } from '../game-engine.js';

let db, server, baseUrl, campaignId;

beforeEach(async () => {
  db = openDatabase(':memory:');
  server = createServer(db);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
  campaignId = (await req('POST', '/campaigns', { name: 'Test' })).body.id;
});

afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
});

async function req(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const gambling = (path, method = 'GET', body) => req(method, `/campaigns/${campaignId}/gambling${path}`, body);

describe('hosting', () => {
  test('GET before anything is hosted returns the empty state, not a 404', async () => {
    const { status, body } = await gambling('');
    assert.equal(status, 200);
    assert.deepEqual(body, { game: null, table: null });
  });

  test('hosting an unknown game returns 400', async () => {
    const { status, body } = await gambling('/host', 'POST', { game: 'craps' });
    assert.equal(status, 400);
    assert.match(body.error, /Unknown game/);
  });

  test('host creates a fresh table for the requested game, GET reflects it', async () => {
    const hostResult = await gambling('/host', 'POST', { game: 'roulette' });
    assert.equal(hostResult.status, 201);
    assert.equal(hostResult.body.game, 'roulette');
    assert.equal(hostResult.body.table.phase, 'betting');
    const getResult = await gambling('');
    assert.deepEqual(getResult.body, hostResult.body);
  });

  test('close clears the hosted table back to empty', async () => {
    await gambling('/host', 'POST', { game: 'slots' });
    const closeResult = await gambling('/close', 'POST');
    assert.equal(closeResult.status, 200);
    assert.deepEqual(closeResult.body, { game: null, table: null });
  });

  test('an action or resolve call before anything is hosted returns 400, not a crash', async () => {
    const actionResult = await gambling('/action', 'POST', { type: 'spin' });
    assert.equal(actionResult.status, 400);
    const resolveResult = await gambling('/resolve', 'POST', { step: 'spin' });
    assert.equal(resolveResult.status, 400);
  });
});

describe('roulette — server decides the outcome, not the client', () => {
  test('place a bet, then resolve a spin: server lands on a real wheel number, not one a client supplies', async () => {
    await gambling('/host', 'POST', { game: 'roulette' });
    const betResult = await gambling('/action', 'POST', { type: 'place_bet', playerUid: 'p1', playerUsername: 'Alice', amount: 100, betType: 'red', betValue: null });
    assert.equal(betResult.status, 200);
    assert.ok(betResult.body.table.bets['p1']);

    // The request body includes an extra field a malicious/buggy client might hope influences
    // the outcome — resolveRouletteSpin never reads the request body at all (see
    // server/gambling.js: it's called as resolveRouletteSpin(state.table), no second argument),
    // so this can only ever be ignored, not honored.
    const spinResult = await gambling('/resolve', 'POST', { step: 'spin', number: 0 });
    assert.equal(spinResult.status, 200);
    assert.equal(spinResult.body.table.phase, 'result');
    assert.ok(ROULETTE_WHEEL_ORDER.includes(spinResult.body.table.lastResult.number));
    assert.deepEqual(spinResult.body.table.bets, {});
  });

  test('spinning with no bets down is rejected', async () => {
    await gambling('/host', 'POST', { game: 'roulette' });
    const { status, body } = await gambling('/resolve', 'POST', { step: 'spin' });
    assert.equal(status, 400);
    assert.match(body.error, /Nothing to spin/);
  });

  test('the "deal" step (a Blackjack step) is rejected when Roulette is hosted', async () => {
    await gambling('/host', 'POST', { game: 'roulette' });
    const { status, body } = await gambling('/resolve', 'POST', { step: 'deal' });
    assert.equal(status, 400);
    assert.match(body.error, /Blackjack step/);
  });
});

describe('blackjack — full round through the server', () => {
  test('place a bet, deal, stand, dealer plays — server drives every step', async () => {
    await gambling('/host', 'POST', { game: 'blackjack' });
    await gambling('/action', 'POST', { type: 'place_bet', playerUid: 'p1', playerUsername: 'Alice', amount: 50 });
    const dealResult = await gambling('/resolve', 'POST', { step: 'deal' });
    assert.equal(dealResult.status, 200);
    assert.equal(dealResult.body.table.phase, 'playing');
    assert.equal(dealResult.body.table.players['p1'].hand.length, 2);

    // Stand immediately regardless of hand value, to keep this test deterministic about phase
    // transitions without needing to know what was actually dealt.
    const standResult = await gambling('/action', 'POST', { type: 'stand', playerUid: 'p1' });
    assert.equal(standResult.status, 200);

    const dealerPlayResult = await gambling('/resolve', 'POST', { step: 'dealerPlay' });
    assert.equal(dealerPlayResult.status, 200);
    assert.equal(dealerPlayResult.body.table.phase, 'result');
    assert.ok(dealerPlayResult.body.table.lastResult.outcomes['p1']);
  });

  test('dealerPlay is rejected while a hand is still mid-play', async () => {
    // This test needs a hand that's genuinely still 'playing' (not stood/busted/blackjack) —
    // resolveBlackjackDeal uses real, non-seeded randomness at this HTTP layer (the server
    // exposes no way to inject a deterministic rand over the API), so roughly 1 deal in ~20 is
    // a natural blackjack, which immediately sets status to 'blackjack' instead of 'playing' and
    // would make dealerPlay legitimately succeed instead of being rejected — not a bug in the
    // app, but a precondition this test needs to actually hold rather than just hope for. Retries
    // a fresh deal (closing and re-hosting) until the real precondition is confirmed true; this
    // was caught as genuine, if infrequent, flakiness (~5% failure rate) across repeated runs,
    // not a hypothetical.
    let dealt;
    for (let attempt = 0; attempt < 20; attempt++) {
      await gambling('/host', 'POST', { game: 'blackjack' });
      await gambling('/action', 'POST', { type: 'place_bet', playerUid: 'p1', playerUsername: 'Alice', amount: 50 });
      dealt = await gambling('/resolve', 'POST', { step: 'deal' });
      if (dealt.body.table.players['p1'].status === 'playing') break;
    }
    assert.equal(dealt.body.table.players['p1'].status, 'playing', 'Could not get a non-blackjack deal in 20 attempts — something other than bad luck is likely wrong');

    const { status, body } = await gambling('/resolve', 'POST', { step: 'dealerPlay' });
    assert.equal(status, 400);
    assert.match(body.error, /done playing/);
  });
});

describe('slots and poker — fully resolve inside a single action call', () => {
  test('a slots spin resolves immediately, using the server\'s own randomness', async () => {
    await gambling('/host', 'POST', { game: 'slots' });
    const { status, body } = await gambling('/action', 'POST', { type: 'spin', playerUid: 'p1', playerUsername: 'Alice', amount: 10 });
    assert.equal(status, 200);
    assert.equal(body.table.results.length, 1);
    assert.equal(body.table.results[0].reels.length, 3);
  });

  test('a poker deal-then-draw resolves through two action calls', async () => {
    await gambling('/host', 'POST', { game: 'poker' });
    const dealResult = await gambling('/action', 'POST', { type: 'deal', playerUid: 'p1', playerUsername: 'Alice', amount: 10 });
    assert.equal(dealResult.body.table.hands['p1'].hand.length, 5);
    const drawResult = await gambling('/action', 'POST', { type: 'draw', playerUid: 'p1', heldIndexes: [0, 1, 2, 3, 4] });
    assert.equal(drawResult.status, 200);
    assert.equal(drawResult.body.table.results.length, 1);
    assert.ok(!drawResult.body.table.hands['p1']);
  });
});

describe('the Phase 3 raw-blob route still works unchanged, alongside these new ones', () => {
  test('PUT /state/gambling still lets a client overwrite the raw blob directly', async () => {
    const putResult = await req('PUT', `/campaigns/${campaignId}/state/gambling`, { game: 'roulette', table: { phase: 'betting', bets: {}, lastResult: null, roundCounter: 0 } });
    assert.equal(putResult.status, 200);
    // The new authoritative GET route reads from the exact same underlying storage.
    const getResult = await gambling('');
    assert.equal(getResult.body.game, 'roulette');
  });
});
