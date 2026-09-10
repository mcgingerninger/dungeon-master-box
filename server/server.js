// Phase 3 of the architecture migration (see docs/MIGRATION_PLAN.md, docs/ARCHITECTURE.md):
// a real Node.js server process, exposing Phase 2's SQLite persistence layer (db/database.js)
// over a small REST API. Plain Node `http` module, zero external dependencies — consistent
// with game-engine.js and the db layer, both dependency-free.
//
// Scope, confirmed before building: server + persistence API only. NOT wired into the live
// browser app yet (it still uses localStorage, untouched) — that's Phase 4's job
// ("server-authoritative game state"), once the server is trusted to actually own game truth
// rather than just store/retrieve it on request. This phase proves the server process itself
// works and correctly exposes what Phase 2 built.
//
// createServer(db) takes an already-open database (see db/database.js's openDatabase) rather
// than opening one itself, so tests can pass an in-memory db and production code can pass a
// real file — same dependency-injection shape Phase 1/2 already established.

import { createServer as createHttpServer } from 'node:http';
import {
  createCampaign, getCampaign, listCampaigns,
  upsertCharacter, getCharacter, listCharacters,
  saveSubsystemState, loadSubsystemState, loadAllSubsystemState,
} from '../db/database.js';
import { SUBSYSTEMS } from '../db/schema.js';
import { handleGamblingAction } from './gambling.js';

// The solo/guest character slot has a null account_uid in the database (see db/schema.js) —
// URL path segments can't carry a literal null, so a fixed token stands in for it. Chosen to be
// unambiguous rather than reusing the string "null", which a real account_uid could theoretically
// collide with.
const SOLO_TOKEN = '_solo';
function accountUidFromParam(param) { return param === SOLO_TOKEN ? null : param; }

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}
function sendError(res, status, message) { sendJson(res, status, { error: message }); }

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
      catch (e) { reject(new Error('Malformed JSON body')); }
    });
    req.on('error', reject);
  });
}

// Routes are matched against a small fixed set of path patterns rather than a general router
// library — the whole point of "plain http, no framework" is that this stays small enough not
// to need one. Segments are matched positionally after splitting on '/'.
export function createServer(db) {
  return createHttpServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); }
    catch { return sendError(res, 400, 'Malformed URL'); }
    const segments = url.pathname.split('/').filter(Boolean); // '/campaigns/3/characters' -> ['campaigns','3','characters']

    try {
      // POST /campaigns  |  GET /campaigns
      if (segments.length === 1 && segments[0] === 'campaigns') {
        if (req.method === 'POST') {
          const body = await readJsonBody(req);
          if (!body.name || typeof body.name !== 'string') return sendError(res, 400, '"name" is required');
          return sendJson(res, 201, createCampaign(db, body.name));
        }
        if (req.method === 'GET') return sendJson(res, 200, listCampaigns(db));
        return sendError(res, 405, `Method ${req.method} not allowed on /campaigns`);
      }

      // GET /campaigns/:id
      if (segments.length === 2 && segments[0] === 'campaigns') {
        const id = Number(segments[1]);
        if (!Number.isInteger(id)) return sendError(res, 400, 'Campaign id must be an integer');
        if (req.method !== 'GET') return sendError(res, 405, `Method ${req.method} not allowed`);
        const campaign = getCampaign(db, id);
        if (!campaign) return sendError(res, 404, `No campaign with id ${id}`);
        return sendJson(res, 200, campaign);
      }

      // GET /campaigns/:id/characters
      if (segments.length === 3 && segments[0] === 'campaigns' && segments[2] === 'characters') {
        const id = Number(segments[1]);
        if (!Number.isInteger(id)) return sendError(res, 400, 'Campaign id must be an integer');
        if (!getCampaign(db, id)) return sendError(res, 404, `No campaign with id ${id}`);
        if (req.method !== 'GET') return sendError(res, 405, `Method ${req.method} not allowed`);
        return sendJson(res, 200, listCharacters(db, id));
      }

      // GET/PUT /campaigns/:id/characters/:accountUid  (accountUid may be the SOLO_TOKEN)
      if (segments.length === 4 && segments[0] === 'campaigns' && segments[2] === 'characters') {
        const id = Number(segments[1]);
        if (!Number.isInteger(id)) return sendError(res, 400, 'Campaign id must be an integer');
        if (!getCampaign(db, id)) return sendError(res, 404, `No campaign with id ${id}`);
        const accountUid = accountUidFromParam(segments[3]);
        if (req.method === 'GET') {
          const character = getCharacter(db, id, accountUid);
          if (!character) return sendError(res, 404, 'No character for that account in this campaign');
          return sendJson(res, 200, character);
        }
        if (req.method === 'PUT') {
          const body = await readJsonBody(req);
          return sendJson(res, 200, upsertCharacter(db, id, accountUid, body));
        }
        return sendError(res, 405, `Method ${req.method} not allowed`);
      }

      // GET /campaigns/:id/state
      if (segments.length === 3 && segments[0] === 'campaigns' && segments[2] === 'state') {
        const id = Number(segments[1]);
        if (!Number.isInteger(id)) return sendError(res, 400, 'Campaign id must be an integer');
        if (!getCampaign(db, id)) return sendError(res, 404, `No campaign with id ${id}`);
        if (req.method !== 'GET') return sendError(res, 405, `Method ${req.method} not allowed`);
        return sendJson(res, 200, loadAllSubsystemState(db, id));
      }

      // GET/PUT /campaigns/:id/state/:subsystem
      if (segments.length === 4 && segments[0] === 'campaigns' && segments[2] === 'state') {
        const id = Number(segments[1]);
        if (!Number.isInteger(id)) return sendError(res, 400, 'Campaign id must be an integer');
        if (!getCampaign(db, id)) return sendError(res, 404, `No campaign with id ${id}`);
        const subsystem = segments[3];
        if (!SUBSYSTEMS[subsystem]) return sendError(res, 400, `Unknown subsystem "${subsystem}" — must be one of: ${Object.keys(SUBSYSTEMS).join(', ')}`);
        if (req.method === 'GET') {
          const state = loadSubsystemState(db, id, subsystem);
          if (state === null) return sendError(res, 404, `No "${subsystem}" state saved for this campaign yet`);
          return sendJson(res, 200, state);
        }
        if (req.method === 'PUT') {
          const body = await readJsonBody(req);
          saveSubsystemState(db, id, subsystem, body);
          return sendJson(res, 200, { ok: true });
        }
        return sendError(res, 405, `Method ${req.method} not allowed`);
      }

      // GET /campaigns/:id/gambling  |  POST /campaigns/:id/gambling/:subpath
      // Phase 4: the server itself decides gambling outcomes (see server/gambling.js) rather
      // than just storing whatever a client sends — distinct from the still-present, still-
      // unchanged Phase 3 route above (PUT /campaigns/:id/state/gambling), which still lets a
      // client overwrite the raw blob directly. Both exist; nothing in the live app calls
      // either yet.
      if (segments.length >= 3 && segments[0] === 'campaigns' && segments[2] === 'gambling') {
        const id = Number(segments[1]);
        if (!Number.isInteger(id)) return sendError(res, 400, 'Campaign id must be an integer');
        if (!getCampaign(db, id)) return sendError(res, 404, `No campaign with id ${id}`);
        const subpath = segments[3] || '';
        const body = req.method === 'POST' ? await readJsonBody(req) : {};
        const result = await handleGamblingAction(db, id, subpath, req.method, body);
        return sendJson(res, result.status, result.body);
      }

      return sendError(res, 404, `No route for ${req.method} ${url.pathname}`);
    } catch (e) {
      if (e.message === 'Malformed JSON body') return sendError(res, 400, e.message);
      return sendError(res, 500, 'Internal server error');
    }
  });
}
