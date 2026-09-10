// Phase 2 data-access layer — see db/schema.js for the schema itself and the reasoning behind
// its shape, and docs/ARCHITECTURE.md for how this fits into the migration as a whole.
//
// Uses node:sqlite (built into Node.js — see docs/ARCHITECTURE.md for why this was chosen over
// an npm package like better-sqlite3). Still marked experimental by Node itself as of this
// writing; noted as a real risk in the Phase 2 report, not glossed over.
//
// Not wired into the live browser app in this phase — this module only runs under Node (the
// future Phase 3 server, and this phase's own regression tests). openDatabase(':memory:') is
// the pattern the tests use; a real deployment would pass a file path instead.

import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL, SUBSYSTEMS } from './schema.js';

export function openDatabase(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  return db;
}

// ---------- Campaigns ----------

export function createCampaign(db, name) {
  const stmt = db.prepare('INSERT INTO campaigns (name) VALUES (?)');
  const info = stmt.run(name);
  return getCampaign(db, Number(info.lastInsertRowid));
}

export function getCampaign(db, id) {
  return db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) || null;
}

export function listCampaigns(db) {
  return db.prepare('SELECT * FROM campaigns ORDER BY updated_at DESC').all();
}

export function touchCampaign(db, id) {
  db.prepare("UPDATE campaigns SET updated_at = datetime('now') WHERE id = ?").run(id);
}

// ---------- Characters ----------
// `sheet` mirrors the shape of the relevant slice of the old localStorage blob: abilityScores
// ({str,dex,con,int,wis,cha}), level, skillProficiencies, saveProficiencies, currentHp, maxHp,
// maxHpEffective, hitDice, ac, class. Every field is optional and falls back to the schema's
// column default, matching applyStateBlob's existing "only overwrite what's actually present"
// behavior rather than requiring a full sheet on every call.
const ABILITY_COLUMN = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };

export function upsertCharacter(db, campaignId, accountUid, sheet = {}) {
  const existing = getCharacter(db, campaignId, accountUid);
  const abilityScores = sheet.abilityScores || {};
  const fields = {
    username: sheet.username,
    class: sheet.class,
    level: sheet.level,
    hit_dice: sheet.hitDice,
    strength: abilityScores.str,
    dexterity: abilityScores.dex,
    constitution: abilityScores.con,
    intelligence: abilityScores.int,
    wisdom: abilityScores.wis,
    charisma: abilityScores.cha,
    current_hp: sheet.currentHp,
    max_hp: sheet.maxHp,
    max_hp_effective: sheet.maxHpEffective,
    ac: sheet.ac,
    skill_proficiencies: sheet.skillProficiencies ? JSON.stringify(sheet.skillProficiencies) : undefined,
    save_proficiencies: sheet.saveProficiencies ? JSON.stringify(sheet.saveProficiencies) : undefined,
  };
  if (existing) {
    const sets = [];
    const values = [];
    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) { sets.push(`${col} = ?`); values.push(val); }
    }
    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      values.push(existing.id);
      db.prepare(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }
    return getCharacterById(db, existing.id);
  }
  const cols = ['campaign_id', 'account_uid'];
  const placeholders = ['?', '?'];
  const values = [campaignId, accountUid ?? null];
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) { cols.push(col); placeholders.push('?'); values.push(val); }
  }
  const stmt = db.prepare(`INSERT INTO characters (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`);
  const info = stmt.run(...values);
  return getCharacterById(db, Number(info.lastInsertRowid));
}

function rowToSheet(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    accountUid: row.account_uid,
    username: row.username,
    class: row.class,
    level: row.level,
    hitDice: row.hit_dice,
    abilityScores: {
      str: row.strength, dex: row.dexterity, con: row.constitution,
      int: row.intelligence, wis: row.wisdom, cha: row.charisma,
    },
    currentHp: row.current_hp,
    maxHp: row.max_hp,
    maxHpEffective: row.max_hp_effective,
    ac: row.ac,
    skillProficiencies: JSON.parse(row.skill_proficiencies),
    saveProficiencies: JSON.parse(row.save_proficiencies),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getCharacter(db, campaignId, accountUid) {
  const row = accountUid == null
    ? db.prepare('SELECT * FROM characters WHERE campaign_id = ? AND account_uid IS NULL').get(campaignId)
    : db.prepare('SELECT * FROM characters WHERE campaign_id = ? AND account_uid = ?').get(campaignId, accountUid);
  return rowToSheet(row);
}

export function getCharacterById(db, id) {
  return rowToSheet(db.prepare('SELECT * FROM characters WHERE id = ?').get(id));
}

export function listCharacters(db, campaignId) {
  return db.prepare('SELECT * FROM characters WHERE campaign_id = ?').all(campaignId).map(rowToSheet);
}

// ---------- Campaign state (subsystem blobs) ----------

function assertValidSubsystem(subsystem) {
  if (!SUBSYSTEMS[subsystem]) {
    throw new Error(`Unknown subsystem "${subsystem}" — must be one of: ${Object.keys(SUBSYSTEMS).join(', ')}`);
  }
}

export function saveSubsystemState(db, campaignId, subsystem, data) {
  assertValidSubsystem(subsystem);
  const json = JSON.stringify(data);
  db.prepare(`
    INSERT INTO campaign_state (campaign_id, subsystem, data)
    VALUES (?, ?, ?)
    ON CONFLICT(campaign_id, subsystem) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
  `).run(campaignId, subsystem, json);
}

export function loadSubsystemState(db, campaignId, subsystem) {
  assertValidSubsystem(subsystem);
  const row = db.prepare('SELECT data FROM campaign_state WHERE campaign_id = ? AND subsystem = ?').get(campaignId, subsystem);
  return row ? JSON.parse(row.data) : null;
}

export function loadAllSubsystemState(db, campaignId) {
  const rows = db.prepare('SELECT subsystem, data FROM campaign_state WHERE campaign_id = ?').all(campaignId);
  const out = {};
  rows.forEach(r => { out[r.subsystem] = JSON.parse(r.data); });
  return out;
}

// ---------- Player states (Phase 5a — see db/schema.js's comment on player_states) ----------

export function savePlayerState(db, campaignId, accountUid, state, rev) {
  const json = JSON.stringify(state);
  db.prepare(`
    INSERT INTO player_states (campaign_id, account_uid, state, rev)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(campaign_id, account_uid) DO UPDATE SET state = excluded.state, rev = excluded.rev, updated_at = datetime('now')
  `).run(campaignId, accountUid, json, rev || 0);
}

export function loadPlayerState(db, campaignId, accountUid) {
  const row = db.prepare('SELECT state, rev FROM player_states WHERE campaign_id = ? AND account_uid = ?').get(campaignId, accountUid);
  return row ? { state: JSON.parse(row.state), rev: row.rev } : null;
}

export function loadAllPlayerStates(db, campaignId) {
  const rows = db.prepare('SELECT account_uid, state, rev FROM player_states WHERE campaign_id = ?').all(campaignId);
  return rows.map(r => ({ accountUid: r.account_uid, state: JSON.parse(r.state), rev: r.rev }));
}
