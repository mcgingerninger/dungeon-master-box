// Phase 2 of the architecture migration (see docs/MIGRATION_PLAN.md, docs/ARCHITECTURE.md):
// SQLite schema, replacing the current app's single localStorage JSON blob
// (saveAppState/loadAppState/applyStateBlob in the monolithic HTML file) with durable,
// queryable storage. NOT wired into the live browser app yet — this phase is schema + access
// layer only, establishing what Phase 3's Node.js server will build on.
//
// Design approach: partial normalization, not a full relational redesign. The one piece of
// state that's genuinely relational and benefits from real columns — the character sheet — gets
// its own table with real columns (str/dex/con/etc, level, hp, ac...), matching
// game-engine.js's computeCharacterSheetFor inputs directly. Everything else the current app
// persists (inventory, battle roster/log, merchant state, mangler state, loot-rarity settings,
// timed effects, journey log, puzzle log, gambling state, bounties, claim-dedup lists) keeps its
// current JSON shape for now, but moves from one flat blob into `campaign_state` rows scoped by
// (campaign, subsystem) — a real improvement (each subsystem is independently readable/
// writable, no more read-modify-write-the-whole-blob for one small change) without speculatively
// inventing a large relational schema for data whose future query patterns aren't known yet.
// Each subsystem row is a natural seam for a later phase to peel out into its own fully
// normalized table, one at a time, without touching the others.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per character. account_uid is the multiplayer identity (see multiplayer-sync.js's
-- own uid concept) and is NULL for solo/guest play, matching gamblingSelfUid()'s existing
-- 'solo' convention in spirit (a NULL account_uid IS the solo character for its campaign).
-- Column names match game-engine.js's ABILITY_NAMES full names (Strength, Dexterity, ...)
-- rather than the app's str/dex/con abbreviations, so the mapping to computeCharacterSheetFor's
-- abilityScores argument is unambiguous.
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_uid TEXT,
  username TEXT,
  class TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  hit_dice TEXT,
  strength INTEGER NOT NULL DEFAULT 10,
  dexterity INTEGER NOT NULL DEFAULT 10,
  constitution INTEGER NOT NULL DEFAULT 10,
  intelligence INTEGER NOT NULL DEFAULT 10,
  wisdom INTEGER NOT NULL DEFAULT 10,
  charisma INTEGER NOT NULL DEFAULT 10,
  current_hp INTEGER NOT NULL DEFAULT 10,
  max_hp INTEGER NOT NULL DEFAULT 10,
  max_hp_effective INTEGER NOT NULL DEFAULT 10,
  ac INTEGER NOT NULL DEFAULT 10,
  skill_proficiencies TEXT NOT NULL DEFAULT '[]',
  save_proficiencies TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, account_uid)
);

-- Generic per-subsystem state bucket. 'subsystem' is one of: inventory, battle, merchant,
-- bounties, mangler, loot_settings, effects, claims, journey, puzzle_log, gambling — see
-- docs/ARCHITECTURE.md for the exact field-by-field mapping from the old localStorage blob's
-- top-level keys to these subsystem buckets.
CREATE TABLE IF NOT EXISTS campaign_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  subsystem TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, subsystem)
);

-- Added in Phase 5a (see docs/ARCHITECTURE.md) for the WebSocket sync layer. Unlike
-- campaign_state (one row per campaign+subsystem, meant for campaign-wide DM settings), a
-- player's full save-state blob (inventory, equipped gear, generated items, etc.) is inherently
-- per-PLAYER, not per-campaign — this mirrors exactly what the original Firestore model already
-- did (rooms/{code}/players/{uid} held one player's entire state), which campaign_state alone
-- had no way to represent since Phase 2 only ever needed to model a single DM's own data.
-- rev is a client-supplied monotonic counter, same purpose as the original's ordering guard,
-- but WebSocket's server-mediated broadcast means the SELF-echo half of the original problem
-- (Firestore's onSnapshot always echoing a client's own writes back to it) doesn't exist here —
-- the server simply never sends a state_update back to the connection that sent the push. This
-- column still guards against genuinely out-of-order delivery of rapid successive pushes.
CREATE TABLE IF NOT EXISTS player_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  account_uid TEXT NOT NULL,
  state TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, account_uid)
);

-- Added in Phase 5b (see docs/ARCHITECTURE.md) for real-time loot-claim arbitration. The
-- original design relied on Firestore's create-vs-update security rules: a claim doc write at a
-- deterministic id (monsterUid_itemId) either succeeds as a "create" (first writer) or fails as
-- a denied "update" (everyone after) — true first-write-wins with zero custom arbitration code.
-- The UNIQUE constraint below is the direct SQL equivalent of that same guarantee: an INSERT for
-- a (campaign_id, claim_id) pair that already exists fails outright rather than overwriting, so
-- database.js's createLootClaim can distinguish "you won" from "someone already claimed this"
-- by whether the INSERT itself succeeded — no read-then-write race window, same as the original.
-- Deliberately does NOT store the actual item data (see the module comment in
-- server/websocket.js) — only who won the race for a given claim id, matching the original's own
-- separation between claim arbitration and item delivery.
CREATE TABLE IF NOT EXISTS loot_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  claimed_by_uid TEXT NOT NULL,
  claimed_by_username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(campaign_id, claim_id)
);

CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_state_campaign ON campaign_state(campaign_id);
CREATE INDEX IF NOT EXISTS idx_player_states_campaign ON player_states(campaign_id);
CREATE INDEX IF NOT EXISTS idx_loot_claims_campaign ON loot_claims(campaign_id);
`;

// Every valid subsystem name, and the exact top-level saveAppState() field(s) each one replaces
// — kept here (not just in a comment) so database.js and its tests can validate against a single
// source of truth rather than a hardcoded string list duplicated in multiple places.
export const SUBSYSTEMS = {
  inventory:     ['inventoryGrid', 'inventoryPlacements', 'inventoryPlacementCounter', 'savedGeneratedItems', 'playerSlots', 'tokenSlotOverrides', 'recentlyLooted', 'savedLoadouts'],
  battle:        ['battleRoster', 'battleLog', 'battleUidCounter', '_battleActionTextMap', '_battleActionCounter'],
  merchant:      ['currentMerchant', 'merchantDailyItems', 'merchantDailySold', 'merchantStapleStock', 'merchantTills'],
  bounties:      ['activeBounties', 'bountyCounter'],
  mangler:       ['manglerFinishedWork', 'manglerPartKey', 'manglerItemKey', 'manglerFocus'],
  loot_settings: ['combatLootSettings', 'chestLootSettings', 'corpseLootSettings', 'modWeights', 'fleshModWeights'],
  effects:       ['activeTimedEffects', 'activeEffectCounter'],
  claims:        ['appliedLootClaimIds', 'appliedGamblingPayoutIds'],
  journey:       ['journeySetting', 'journeyLog', 'journeyLogCounter', 'journeySettingWeights'],
  puzzle_log:    ['puzzleLog'],
  gambling:      ['gamblingState'],
};
