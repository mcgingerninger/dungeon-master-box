// Regression tests for the Phase 3 HTTP server. Run with: node --test
// Uses real HTTP requests (Node's built-in fetch) against a real server instance listening on
// an OS-assigned ephemeral port (port 0) — not mocked request/response objects — so these tests
// exercise the actual routing, JSON parsing, and status-code logic exactly as a real client
// would hit it.
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { openDatabase } from '../db/database.js';
import { createServer } from './server.js';

let db, server, baseUrl;

beforeEach(async () => {
  db = openDatabase(':memory:');
  server = createServer(db);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
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

describe('campaigns', () => {
  test('POST creates a campaign, returns 201', async () => {
    const { status, body } = await req('POST', '/campaigns', { name: 'Test Campaign' });
    assert.equal(status, 201);
    assert.equal(body.name, 'Test Campaign');
    assert.ok(body.id > 0);
  });

  test('POST without a name returns 400', async () => {
    const { status, body } = await req('POST', '/campaigns', {});
    assert.equal(status, 400);
    assert.match(body.error, /name/);
  });

  test('GET /campaigns lists everything created', async () => {
    await req('POST', '/campaigns', { name: 'A' });
    await req('POST', '/campaigns', { name: 'B' });
    const { status, body } = await req('GET', '/campaigns');
    assert.equal(status, 200);
    assert.equal(body.length, 2);
  });

  test('GET /campaigns/:id returns one campaign', async () => {
    const created = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const { status, body } = await req('GET', `/campaigns/${created.id}`);
    assert.equal(status, 200);
    assert.equal(body.id, created.id);
  });

  test('GET /campaigns/:id returns 404 for a nonexistent campaign', async () => {
    const { status, body } = await req('GET', '/campaigns/999999');
    assert.equal(status, 404);
    assert.match(body.error, /999999/);
  });

  test('GET /campaigns/:id rejects a non-numeric id with 400, not a crash', async () => {
    const { status } = await req('GET', '/campaigns/not-a-number');
    assert.equal(status, 400);
  });

  test('POST /campaigns returns a join code', async () => {
    const { body } = await req('POST', '/campaigns', { name: 'Test' });
    assert.match(body.code, /^[A-Z0-9]{5}$/);
  });

  test('GET /campaigns/by-code/:code resolves to the campaign, case-insensitively', async () => {
    const created = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const { status, body } = await req('GET', `/campaigns/by-code/${created.code.toLowerCase()}`);
    assert.equal(status, 200);
    assert.equal(body.id, created.id);
  });

  test('GET /campaigns/by-code/:code returns 404 for an unknown code', async () => {
    const { status, body } = await req('GET', '/campaigns/by-code/ZZZZZ');
    assert.equal(status, 404);
    assert.match(body.error, /ZZZZZ/);
  });
});

describe('characters', () => {
  test('PUT creates a character, GET retrieves it', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const putResult = await req('PUT', `/campaigns/${campaign.id}/characters/uid-1`, {
      username: 'Kaelen', level: 5, abilityScores: { str: 14, dex: 16, con: 12, int: 10, wis: 13, cha: 8 },
    });
    assert.equal(putResult.status, 200);
    assert.equal(putResult.body.username, 'Kaelen');
    const getResult = await req('GET', `/campaigns/${campaign.id}/characters/uid-1`);
    assert.equal(getResult.status, 200);
    assert.equal(getResult.body.level, 5);
  });

  test('the _solo token maps to the null-account-uid character slot', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    await req('PUT', `/campaigns/${campaign.id}/characters/_solo`, { username: 'Solo Player' });
    const { status, body } = await req('GET', `/campaigns/${campaign.id}/characters/_solo`);
    assert.equal(status, 200);
    assert.equal(body.username, 'Solo Player');
    assert.equal(body.accountUid, null);
  });

  test('GET returns 404 for a character that was never created', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const { status } = await req('GET', `/campaigns/${campaign.id}/characters/nobody`);
    assert.equal(status, 404);
  });

  test('GET /campaigns/:id/characters lists every character in the campaign', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    await req('PUT', `/campaigns/${campaign.id}/characters/uid-1`, { username: 'A' });
    await req('PUT', `/campaigns/${campaign.id}/characters/uid-2`, { username: 'B' });
    const { status, body } = await req('GET', `/campaigns/${campaign.id}/characters`);
    assert.equal(status, 200);
    assert.equal(body.length, 2);
  });

  test('character routes 404 when the campaign itself does not exist', async () => {
    const { status } = await req('GET', '/campaigns/999999/characters/uid-1');
    assert.equal(status, 404);
  });
});

describe('subsystem state', () => {
  test('PUT then GET round-trips a subsystem\'s state', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const putResult = await req('PUT', `/campaigns/${campaign.id}/state/gambling`, { game: 'roulette', table: { phase: 'betting' } });
    assert.equal(putResult.status, 200);
    const getResult = await req('GET', `/campaigns/${campaign.id}/state/gambling`);
    assert.equal(getResult.status, 200);
    assert.equal(getResult.body.game, 'roulette');
  });

  test('GET on a subsystem never saved returns 404', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const { status } = await req('GET', `/campaigns/${campaign.id}/state/journey`);
    assert.equal(status, 404);
  });

  test('an unrecognized subsystem name returns 400, not a silent typo', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const putResult = await req('PUT', `/campaigns/${campaign.id}/state/not_a_real_subsystem`, {});
    assert.equal(putResult.status, 400);
    const getResult = await req('GET', `/campaigns/${campaign.id}/state/not_a_real_subsystem`);
    assert.equal(getResult.status, 400);
  });

  test('GET /campaigns/:id/state returns every saved subsystem keyed by name', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    await req('PUT', `/campaigns/${campaign.id}/state/journey`, { journeySetting: 'countryside' });
    await req('PUT', `/campaigns/${campaign.id}/state/bounties`, { activeBounties: [] });
    const { status, body } = await req('GET', `/campaigns/${campaign.id}/state`);
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body).sort(), ['bounties', 'journey']);
  });
});

describe('error handling', () => {
  test('an unknown route returns 404', async () => {
    const { status } = await req('GET', '/not-a-real-route');
    assert.equal(status, 404);
  });

  test('a disallowed method on a real route returns 405, not a crash or a wrong match', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const { status } = await req('DELETE', `/campaigns/${campaign.id}`);
    assert.equal(status, 405);
  });

  test('malformed JSON body returns 400 rather than crashing the server', async () => {
    const campaign = (await req('POST', '/campaigns', { name: 'Test' })).body;
    const res = await fetch(`${baseUrl}/campaigns/${campaign.id}/characters/uid-1`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{not valid json',
    });
    assert.equal(res.status, 400);
    // Confirms the server is still alive and responsive after the bad request, not just that
    // this one request got a 400 — a real crash would fail the NEXT request too.
    const stillAlive = await req('GET', '/campaigns');
    assert.equal(stillAlive.status, 200);
  });
});

describe('static file serving (Phase 6a)', () => {
  let staticRoot, staticDb, staticServer, staticBaseUrl;

  beforeEach(async () => {
    staticRoot = mkdtempSync(path.join(tmpdir(), 'dmbox-static-'));
    writeFileSync(path.join(staticRoot, 'index.html'), '<html>home</html>');
    writeFileSync(path.join(staticRoot, 'app.js'), 'console.log("app");');
    writeFileSync(path.join(staticRoot, 'secret.db'), 'not for the network');
    mkdirSync(path.join(staticRoot, 'sub'));
    writeFileSync(path.join(staticRoot, 'sub', 'nested.css'), 'body{}');
    // A sibling directory OUTSIDE staticRoot, to confirm a '..' pathname can't escape it.
    writeFileSync(path.join(staticRoot, '..', `${path.basename(staticRoot)}-escape.txt`), 'should never be servable');

    staticDb = openDatabase(':memory:');
    staticServer = createServer(staticDb, { staticRoot });
    await new Promise(resolve => staticServer.listen(0, resolve));
    staticBaseUrl = `http://localhost:${staticServer.address().port}`;
  });

  afterEach(async () => {
    await new Promise(resolve => staticServer.close(resolve));
    rmSync(staticRoot, { recursive: true, force: true });
    rmSync(path.join(staticRoot, '..', `${path.basename(staticRoot)}-escape.txt`), { force: true });
  });

  test('GET / serves index.html', async () => {
    const res = await fetch(staticBaseUrl + '/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(await res.text(), '<html>home</html>');
  });

  test('GET /app.js serves it with a JS content type', async () => {
    const res = await fetch(staticBaseUrl + '/app.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    assert.equal(await res.text(), 'console.log("app");');
  });

  test('serves a file in a subdirectory', async () => {
    const res = await fetch(staticBaseUrl + '/sub/nested.css');
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'body{}');
  });

  test('a real file with a non-allowlisted extension (.db) is not served', async () => {
    const res = await fetch(staticBaseUrl + '/secret.db');
    assert.equal(res.status, 404);
  });

  test('a path-traversal attempt cannot escape staticRoot', async () => {
    const res = await fetch(staticBaseUrl + `/../${path.basename(staticRoot)}-escape.txt`);
    assert.equal(res.status, 404);
  });

  test('a missing file returns 404, not a crash', async () => {
    const res = await fetch(staticBaseUrl + '/does-not-exist.js');
    assert.equal(res.status, 404);
  });

  test('static serving does not shadow a real API route', async () => {
    const res = await fetch(staticBaseUrl + '/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }) });
    assert.equal(res.status, 201);
  });

  test('with no staticRoot configured, an unknown GET path still 404s (existing behavior preserved)', async () => {
    const res = await fetch(baseUrl + '/app.js'); // baseUrl is the outer describe's staticRoot-less server
    assert.equal(res.status, 404);
  });
});
