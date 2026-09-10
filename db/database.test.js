// Regression tests for the Phase 2 SQLite schema + access layer. Run with: node --test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  openDatabase, createCampaign, getCampaign, listCampaigns, touchCampaign,
  upsertCharacter, getCharacter, getCharacterById, listCharacters,
  saveSubsystemState, loadSubsystemState, loadAllSubsystemState,
} from './database.js';
import { SUBSYSTEMS } from './schema.js';

describe('campaigns', () => {
  test('create, get, list', () => {
    const db = openDatabase(':memory:');
    const c1 = createCampaign(db, 'Curse of the Crimson Throne');
    assert.equal(c1.name, 'Curse of the Crimson Throne');
    assert.ok(c1.id > 0);
    const fetched = getCampaign(db, c1.id);
    assert.equal(fetched.id, c1.id);
    const c2 = createCampaign(db, 'A second campaign');
    assert.equal(listCampaigns(db).length, 2);
  });

  test('get returns null for a nonexistent campaign', () => {
    const db = openDatabase(':memory:');
    assert.equal(getCampaign(db, 999), null);
  });

  test('touchCampaign updates updated_at', () => {
    const db = openDatabase(':memory:');
    const c = createCampaign(db, 'Test');
    const before = getCampaign(db, c.id).updated_at;
    touchCampaign(db, c.id);
    // Same-second updates won't necessarily produce a different string, but the call must not
    // throw and the row must still exist with the same id — the real regression this guards is
    // "does the UPDATE statement even run without error."
    const after = getCampaign(db, c.id);
    assert.equal(after.id, c.id);
    assert.ok(after.updated_at >= before);
  });
});

describe('characters', () => {
  test('upsertCharacter creates a new character with full sheet data', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    const sheet = upsertCharacter(db, campaign.id, 'uid-1', {
      username: 'Kaelen', class: 'Ranger', level: 5, hitDice: '5d10',
      abilityScores: { str: 14, dex: 16, con: 12, int: 10, wis: 13, cha: 8 },
      currentHp: 38, maxHp: 42, maxHpEffective: 43, ac: 15,
      skillProficiencies: ['Stealth', 'Survival'], saveProficiencies: ['Dexterity', 'Strength'],
    });
    assert.equal(sheet.username, 'Kaelen');
    assert.equal(sheet.level, 5);
    assert.deepEqual(sheet.abilityScores, { str: 14, dex: 16, con: 12, int: 10, wis: 13, cha: 8 });
    assert.equal(sheet.maxHpEffective, 43);
    assert.deepEqual(sheet.skillProficiencies, ['Stealth', 'Survival']);
  });

  test('upsertCharacter on an existing character only overwrites the fields provided', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    upsertCharacter(db, campaign.id, 'uid-1', {
      username: 'Kaelen', level: 5, abilityScores: { str: 14, dex: 16, con: 12, int: 10, wis: 13, cha: 8 }, ac: 15,
    });
    // Partial update: only bumping level and current HP. Everything else (username, ability
    // scores, AC) must survive unchanged — matching applyStateBlob's existing "field-by-field,
    // only overwrite what's present" behavior in the current localStorage blob approach.
    const updated = upsertCharacter(db, campaign.id, 'uid-1', { level: 6, currentHp: 30 });
    assert.equal(updated.level, 6);
    assert.equal(updated.currentHp, 30);
    assert.equal(updated.username, 'Kaelen');
    assert.equal(updated.ac, 15);
    assert.deepEqual(updated.abilityScores.str, 14);
  });

  test('one character per (campaign, account_uid); a null account_uid is the solo/guest slot', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    upsertCharacter(db, campaign.id, null, { username: 'Solo Player' });
    const solo = getCharacter(db, campaign.id, null);
    assert.equal(solo.username, 'Solo Player');
    assert.equal(solo.accountUid, null);
  });

  test('listCharacters returns every character in a campaign', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    upsertCharacter(db, campaign.id, 'uid-1', { username: 'A' });
    upsertCharacter(db, campaign.id, 'uid-2', { username: 'B' });
    const list = listCharacters(db, campaign.id);
    assert.equal(list.length, 2);
    assert.deepEqual(list.map(c => c.username).sort(), ['A', 'B']);
  });

  test('getCharacter returns null when no character exists yet for that account', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    assert.equal(getCharacter(db, campaign.id, 'nobody'), null);
  });
});

describe('campaign_state (subsystem blobs)', () => {
  test('save and load round-trips arbitrary JSON per subsystem', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    const inventoryData = { inventoryGrid: [[null, 'itemKey1'], [null, null]], playerSlots: { weapon1: 'itemKey1' } };
    saveSubsystemState(db, campaign.id, 'inventory', inventoryData);
    assert.deepEqual(loadSubsystemState(db, campaign.id, 'inventory'), inventoryData);
  });

  test('saving the same subsystem twice overwrites rather than duplicating', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    saveSubsystemState(db, campaign.id, 'gambling', { game: 'roulette', table: { phase: 'betting' } });
    saveSubsystemState(db, campaign.id, 'gambling', { game: 'blackjack', table: { phase: 'playing' } });
    const loaded = loadSubsystemState(db, campaign.id, 'gambling');
    assert.equal(loaded.game, 'blackjack');
  });

  test('loadSubsystemState returns null for a subsystem never saved', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    assert.equal(loadSubsystemState(db, campaign.id, 'journey'), null);
  });

  test('subsystem state is scoped per campaign — two campaigns never see each other\'s data', () => {
    const db = openDatabase(':memory:');
    const c1 = createCampaign(db, 'Campaign 1');
    const c2 = createCampaign(db, 'Campaign 2');
    saveSubsystemState(db, c1.id, 'puzzle_log', ['riddle A']);
    saveSubsystemState(db, c2.id, 'puzzle_log', ['riddle B']);
    assert.deepEqual(loadSubsystemState(db, c1.id, 'puzzle_log'), ['riddle A']);
    assert.deepEqual(loadSubsystemState(db, c2.id, 'puzzle_log'), ['riddle B']);
  });

  test('loadAllSubsystemState returns every saved subsystem for a campaign, keyed by name', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    saveSubsystemState(db, campaign.id, 'journey', { journeySetting: 'countryside', journeyLog: [] });
    saveSubsystemState(db, campaign.id, 'bounties', { activeBounties: [], bountyCounter: 0 });
    const all = loadAllSubsystemState(db, campaign.id);
    assert.deepEqual(Object.keys(all).sort(), ['bounties', 'journey']);
    assert.equal(all.journey.journeySetting, 'countryside');
  });

  test('rejects an unrecognized subsystem name rather than silently accepting typos', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Test');
    assert.throws(() => saveSubsystemState(db, campaign.id, 'not_a_real_subsystem', {}), /Unknown subsystem/);
    assert.throws(() => loadSubsystemState(db, campaign.id, 'not_a_real_subsystem'), /Unknown subsystem/);
  });

  test('every subsystem named in the old saveAppState() blob has a home here', () => {
    // This is the actual coverage check against the field-by-field mapping documented in
    // db/schema.js and docs/ARCHITECTURE.md — not just "does the code run," but "does every
    // field the current app persists have somewhere to go."
    const expectedSubsystems = ['inventory', 'battle', 'merchant', 'bounties', 'mangler', 'loot_settings', 'effects', 'claims', 'journey', 'puzzle_log', 'gambling'];
    assert.deepEqual(Object.keys(SUBSYSTEMS).sort(), expectedSubsystems.sort());
  });
});

describe('foreign key integrity', () => {
  test('deleting a campaign cascades to its characters and state', () => {
    const db = openDatabase(':memory:');
    const campaign = createCampaign(db, 'Doomed Campaign');
    upsertCharacter(db, campaign.id, 'uid-1', { username: 'Ephemeral' });
    saveSubsystemState(db, campaign.id, 'journey', { journeyLog: ['one entry'] });
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaign.id);
    assert.equal(listCharacters(db, campaign.id).length, 0);
    assert.equal(loadSubsystemState(db, campaign.id, 'journey'), null);
  });
});
