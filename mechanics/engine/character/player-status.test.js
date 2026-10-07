import test from 'node:test';
import assert from 'node:assert/strict';
import * as PS from './player-status.js';

const CLOAK = 'Resistance to poison damage. Immune to Poisoned condition. Spider Climb (walls/ceilings). Immune to webs (magical and mundane). Cast Web (DC 13) once per day. Requires attunement.';

test('parseDefenses reads resistances, immunities and ignores offensive clauses', () => {
  const d = PS.parseDefenses(CLOAK);
  assert.deepEqual(d.resist.map(r => r.type), ['poison']);
  assert.ok(d.immune.some(i => i.kind === 'condition' && i.what === 'poisoned'));
  assert.ok(d.immune.some(i => i.kind === 'other' && /webs/.test(i.what)));
  const off = PS.parseDefenses('The target must succeed on a saving throw or take fire damage. The creature is resistant to fire.');
  assert.equal(off.resist.length, 0);
});

test('parseDefenses reads vulnerability, senses, movement, regeneration, restrictions', () => {
  const d = PS.parseDefenses('You have darkvision out to 60 feet. You gain a fly speed of 30. You are vulnerable to radiant damage. You regain 2 hit points at the start of each turn. You cannot cast spells.');
  assert.deepEqual(d.senses, [{ name: 'Darkvision', feet: 60 }]);
  assert.deepEqual(d.movement, [{ mode: 'fly', feet: 30 }]);
  assert.deepEqual(d.vulnerable, [{ type: 'radiant' }]);
  assert.deepEqual(d.regeneration, [{ hp: 2 }]);
  assert.equal(d.restrictions.length, 1);
});

test('classifyEffect sorts buffs, debuffs, conditions and transformations', () => {
  assert.equal(PS.classifyEffect('+2 AC for 1 hour.', 'Shield Potion').category, 'buff');
  assert.equal(PS.classifyEffect('You turn into a wolf for 10 minutes.', 'Wolf Brew').category, 'transformation');
  assert.equal(PS.classifyEffect('You are Poisoned and have -2 to Dexterity.', 'Bad Brew').category, 'condition');
  assert.equal(PS.classifyEffect('-2 Strength for 1 hour.', 'Weakened').category, 'debuff');
  assert.equal(PS.classifyEffect('Immune to Poisoned condition. Resistance to poison.', 'Antidote').category, 'buff');
});

test('buildPlayerStatus merges gear, timed effects and expiry', () => {
  const items = { cloak: { name: 'Cloak of Arachnida', effect: CLOAK }, ring: { name: 'Ring of Fire Ward', effect: 'Resistance to fire damage.' } };
  const now = 1000000;
  const st = PS.buildPlayerStatus({
    sheet: null,
    slots: { cloak: 'cloak', ring1: 'ring', ring2: 'ring' },
    resolveItem: k => ({ item: items[k], rarity: 'rare' }),
    timedEffects: [
      { id: 'a', name: 'Haste Potion', text: '+10 speed for 1 minute. Advantage on Dexterity saves.', expiresAt: now + 61000 },
      { id: 'b', name: 'Old Potion', text: '+1 AC.', expiresAt: now - 1 },
      { id: 'c', name: 'Poison Curse', text: 'You are Poisoned.', expiresAt: now + 5000 },
      { id: 'd', name: 'Wolf Brew', text: 'You turn into a wolf for 10 minutes.', expiresAt: now + 9000 },
    ],
    feats: [{ name: 'Tough', text: 'Resistance to cold damage.' }],
    unlocks: [], now,
  });
  assert.equal(st.gear.length, 2);
  assert.deepEqual(st.defenses.resist.map(r => r.type).sort(), ['cold', 'fire', 'poison']);
  assert.deepEqual(st.buffs.map(b => b.name), ['Haste Potion']);
  assert.deepEqual(st.debuffs.map(b => b.name), ['Poison Curse']);
  assert.deepEqual(st.transformations.map(b => b.name), ['Wolf Brew']);
  assert.equal(st.always.length, 1);
  assert.ok(st.defenses.advantage.length >= 1);
  assert.equal(st.empty, false);
  assert.equal(PS.buildPlayerStatus({ slots: {}, timedEffects: [] }).empty, true);
});

test('formatRemaining', () => {
  assert.equal(PS.formatRemaining(null), 'until next day');
  assert.equal(PS.formatRemaining(5000), '5s');
  assert.equal(PS.formatRemaining(61000), '1m 1s');
  assert.equal(PS.formatRemaining(3700000), '1h 1m');
});
