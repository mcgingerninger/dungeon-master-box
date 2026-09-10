// Phase 4 of the architecture migration (see docs/MIGRATION_PLAN.md, docs/ARCHITECTURE.md):
// the server becomes the actual decision-maker for gambling outcomes, rather than just storing
// whatever state a client hands it (Phase 3's /campaigns/:id/state/gambling PUT route still
// exists and still works exactly as before — this is new, additional routes alongside it, not a
// replacement of it).
//
// The key difference from Phase 3: every resolution step here (resolveRouletteSpin,
// resolveBlackjackDeal, resolveBlackjackDealerPlay, applySlotsAction, applyPokerAction) is
// called with NO rand argument, so it defaults to the SERVER's own Math.random — never a value
// a client could supply or influence. A client can ask the server to spin the wheel; it cannot
// tell the server what number to land on. That is what "authoritative" means in this phase.
//
// Scope, confirmed before building: server-side only. dungeon_loot_wheel_v96...html does not
// call any of this yet and keeps resolving gambling locally exactly as it does today — these
// routes exist and are tested, but nothing in the live app depends on them yet. That wiring
// (and the real question of what replaces a client's direct Firestore push) is Phase 5's job.

import {
  newRouletteTable, applyRouletteAction, resolveRouletteSpin,
  newBlackjackTable, applyBlackjackAction, resolveBlackjackDeal, resolveBlackjackDealerPlay, blackjackAllDone,
  newSlotsTable, applySlotsAction,
  newPokerTable, applyPokerAction,
} from '../game-engine.js';
import { saveSubsystemState, loadSubsystemState } from '../db/database.js';

const TABLE_FACTORIES = { roulette: newRouletteTable, blackjack: newBlackjackTable, slots: newSlotsTable, poker: newPokerTable };
const ACTION_HANDLERS = { roulette: applyRouletteAction, blackjack: applyBlackjackAction, slots: applySlotsAction, poker: applyPokerAction };
const GAME_NAMES = Object.keys(TABLE_FACTORIES);

function emptyGamblingState() { return { game: null, table: null }; }

function loadGamblingState(db, campaignId) {
  return loadSubsystemState(db, campaignId, 'gambling') || emptyGamblingState();
}
function persistGamblingState(db, campaignId, state) {
  saveSubsystemState(db, campaignId, 'gambling', state);
}

// Returns a small { status, body } result rather than writing to `res` directly, so
// server.js's existing sendJson/sendError helpers stay the single place that actually touches
// the response — this module only decides outcomes, not how they're transmitted.
export async function handleGamblingAction(db, campaignId, subpath, method, body) {
  const state = loadGamblingState(db, campaignId);

  if (subpath === '' && method === 'GET') {
    return { status: 200, body: state };
  }

  if (subpath === 'host' && method === 'POST') {
    const game = body.game;
    if (!TABLE_FACTORIES[game]) return { status: 400, body: { error: `Unknown game "${game}" — must be one of: ${GAME_NAMES.join(', ')}` } };
    const newState = { game, table: TABLE_FACTORIES[game]() };
    persistGamblingState(db, campaignId, newState);
    return { status: 201, body: newState };
  }

  if (subpath === 'close' && method === 'POST') {
    persistGamblingState(db, campaignId, emptyGamblingState());
    return { status: 200, body: emptyGamblingState() };
  }

  // Everything below requires a table already hosted.
  if (!state.game || !state.table) return { status: 400, body: { error: 'No gambling table is currently hosted for this campaign — POST .../gambling/host first' } };

  if (subpath === 'action' && method === 'POST') {
    const handler = ACTION_HANDLERS[state.game];
    // Slots and Poker fully resolve inside applyAction itself (including their own randomness,
    // defaulted to the server's Math.random since no rand argument is passed here) — Roulette
    // and Blackjack's applyAction only ever handles bet/hit/stand; their actual outcome needs a
    // separate /resolve call, matching exactly how Phase 1 documented this split in
    // game-engine.js and docs/ARCHITECTURE.md.
    handler(state.table, body);
    persistGamblingState(db, campaignId, state);
    return { status: 200, body: state };
  }

  if (subpath === 'resolve' && method === 'POST') {
    const step = body.step;
    if (step === 'spin') {
      if (state.game !== 'roulette') return { status: 400, body: { error: `"spin" is a Roulette step, but the hosted game is ${state.game}` } };
      if (state.table.phase !== 'betting' || !Object.keys(state.table.bets).length) return { status: 400, body: { error: 'Nothing to spin — no bets placed, or the round is not in the betting phase' } };
      resolveRouletteSpin(state.table);
    } else if (step === 'deal') {
      if (state.game !== 'blackjack') return { status: 400, body: { error: `"deal" is a Blackjack step, but the hosted game is ${state.game}` } };
      if (state.table.phase !== 'betting' || !Object.keys(state.table.players).length) return { status: 400, body: { error: 'Nothing to deal — no bets placed, or the round is not in the betting phase' } };
      resolveBlackjackDeal(state.table);
    } else if (step === 'dealerPlay') {
      if (state.game !== 'blackjack') return { status: 400, body: { error: `"dealerPlay" is a Blackjack step, but the hosted game is ${state.game}` } };
      if (state.table.phase !== 'playing' || !blackjackAllDone(state.table)) return { status: 400, body: { error: 'Not every hand is done playing yet' } };
      resolveBlackjackDealerPlay(state.table);
    } else {
      return { status: 400, body: { error: `Unknown resolve step "${step}" — must be one of: spin, deal, dealerPlay` } };
    }
    persistGamblingState(db, campaignId, state);
    return { status: 200, body: state };
  }

  return { status: 404, body: { error: `No gambling route for ${method} .../gambling/${subpath}` } };
}
