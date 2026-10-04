// Tests for the Item Rules engine (item-rules.js) and its default config.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ITEM_RULES } from '../../data/item-rules-default.js';
import { scoreText, scoreItem, rarityForWeight, priceForWeight, evaluateItem, mergeItemRules, plainText, RARITY_ORDER } from './item-rules.js';

const cfg = DEFAULT_ITEM_RULES;
const total = t => scoreText(t, cfg).total;

describe('scoring', () => {
  test('numeric stats score points × the stat\'s weight, scaled down for temporary activations', () => {
    assert.equal(total('+2 Strength.'), 2);
    assert.equal(total('+1 Armor Class.'), 1.5);
    assert.ok(total('Grants +2 Strength to the bearer for 1 hour (3× per day).') < total('+2 Strength.'));
    assert.ok(total('Grants +2 Strength to the bearer for 1 hour (3× per day).') > total('Grants +2 Strength to the bearer for 1 minute (1× per long rest).'));
  });
  test('drawbacks are negative and cost less than the matching benefit gains', () => {
    const r = scoreText('Reckless: +5 Damage Dealt, -3 Armor Class', cfg);
    assert.ok(r.good > 0 && r.bad < 0);
    assert.equal(r.total, r.good + r.bad);
    assert.ok(scoreText('While attuned, the bearer suffers Cannot Regain Hit Points from Resting.', cfg).total < 0);
  });
  test('weapon phrases split into attack (flagged) and damage components', () => {
    const r = scoreText('+1 to attack and damage rolls. Once per turn on a hit, deal an extra 2d6 fire damage.', cfg);
    assert.ok(r.components.some(c => c.touches === 'attack'));
    assert.ok(r.components.some(c => c.kind === 'damage'));
  });
  test('inflicting a condition on a target is a benefit; the stronger the condition the higher', () => {
    const para = total('Usable 1× per day: inflicts Paralyzed on one target for 10 minutes (Constitution saving throw to resist, DC 14).');
    const pois = total('Usable 1× per day: inflicts Poisoned on one target for 10 minutes (Constitution saving throw to resist, DC 14).');
    assert.ok(para > pois && pois > 0);
  });
  test('structured mods are scored instead of effect text (no double counting)', () => {
    const item = { name: 'X', effect: '+3 Strength.', mods: [{ type: 'Buff', text: '+3 Strength.' }] };
    assert.equal(scoreItem(item, cfg).total, 3);
  });
  test('affixes without a number score by name', () => {
    const item = { name: 'X', mods: [{ type: 'Affix', prefix: true, name: 'Adamantine', text: 'Critical hits with this weapon automatically maximize their damage dice.' }] };
    assert.equal(scoreItem(item, cfg).total, cfg.weights.affixes.Adamantine);
  });
  test('plainText strips tags and entities', () => {
    assert.equal(plainText('<b>+2</b> Strength &amp; it&#39;s &quot;fine&quot;'), '+2 Strength & it\'s "fine"');
  });
});

describe('rarity and price from weight', () => {
  test('rarity rises with weight and every weight maps to exactly one rarity', () => {
    let last = -1;
    for (let w = 0; w <= 40; w += 0.5) {
      const idx = RARITY_ORDER.indexOf(rarityForWeight(w, cfg));
      assert.ok(idx >= last, `weight ${w}`);
      last = idx;
    }
    assert.equal(rarityForWeight(0.5, cfg), 'common');
    assert.equal(rarityForWeight(6, cfg), 'rare');
    assert.equal(rarityForWeight(50, cfg), 'celestial');
  });
  test('price rises with weight inside a rarity, stays in its band and never passes the caps', () => {
    for (const r of RARITY_ORDER) {
      const [wl, wh] = cfg.rarityBands[r];
      const hi = Math.min(wh, wl + 20);
      const [pl, ph] = cfg.priceBands[r];
      let prev = 0;
      for (let k = 0; k <= 10; k++) {
        const p = priceForWeight(wl + (hi - wl) * k / 10, r, cfg);
        assert.ok(p >= pl && p <= ph && p <= 100000, `${r} ${p}`);
        assert.ok(p >= prev); prev = p;
      }
    }
    assert.ok(priceForWeight(5.5, 'rare', cfg) <= 1000);
    assert.ok(priceForWeight(1e6, 'celestial', cfg) <= 100000);
  });
});

describe('rules', () => {
  const ids = v => v.map(x => x.rule);
  test('no attack-roll modifiers', () => {
    assert.ok(ids(evaluateItem({ name: 'Sword', rarity: 'uncommon', effect: '+1 to attack and damage rolls.' }, cfg, { exempt: true })).includes('no-attack-roll-modifiers'));
    assert.ok(ids(evaluateItem({ name: 'Sword', rarity: 'uncommon', effect: '+1 to damage rolls.' }, cfg, { exempt: true })).every(r => r !== 'no-attack-roll-modifiers'));
    assert.ok(ids(evaluateItem({ name: 'Ring', rarity: 'rare', mods: [{ type: 'Buff', text: 'Grants +2 Attack Bonus to the bearer for 1 hour (1× per day).' }] }, cfg, { exempt: true })).includes('no-attack-roll-modifiers'));
  });
  test('no items with only bad modifiers', () => {
    const bad = { name: 'Cursed', rarity: 'common', mods: [{ type: 'Debuff', text: 'While attuned, the bearer suffers Cannot Regain Hit Points from Resting.' }] };
    assert.ok(ids(evaluateItem(bad, cfg, { exempt: true })).includes('no-only-bad-modifiers'));
    const mixed = { name: 'Reckless', rarity: 'rare', mods: [{ type: 'Trait', text: 'Reckless: +5 Damage Dealt, -3 Armor Class' }] };
    assert.ok(!ids(evaluateItem(mixed, cfg, { exempt: true })).includes('no-only-bad-modifiers'));
  });
  test('modifier count cap by rarity', () => {
    const mods = Array.from({ length: 4 }, (_, i) => ({ type: 'Buff', text: `+1 ${['Strength', 'Dexterity', 'Wisdom', 'Charisma'][i]}.` }));
    assert.ok(ids(evaluateItem({ name: 'Many', rarity: 'common', mods }, cfg, { exempt: true })).includes('max-modifiers-by-rarity'));
    assert.ok(!ids(evaluateItem({ name: 'Many', rarity: 'rare', mods }, cfg, { exempt: true })).includes('max-modifiers-by-rarity'));
  });
  test('no duplicate stat boosts', () => {
    const it = { name: 'Dup', rarity: 'rare', mods: [{ type: 'Buff', text: '+2 Strength.' }, { type: 'Trait', text: 'Mighty: +1 Strength' }] };
    assert.ok(ids(evaluateItem(it, cfg, { exempt: true })).includes('no-duplicate-stat-boost'));
  });
  test('proficiency boost cap', () => {
    assert.ok(ids(evaluateItem({ name: 'P', rarity: 'celestial', effect: '+5 to your proficiency bonus.' }, cfg, { exempt: true })).includes('proficiency-boost-cap'));
    assert.ok(!ids(evaluateItem({ name: 'P', rarity: 'celestial', effect: '+4 to your proficiency bonus.' }, cfg, { exempt: true })).includes('proficiency-boost-cap'));
  });
  test('rarity must follow weight, gp must follow weight, prices are capped', () => {
    const light = { name: 'Light', rarity: 'legendary', effect: '+1 Strength.', gp: '40000 gp' };
    assert.ok(ids(evaluateItem(light, cfg)).includes('rarity-matches-weight'));
    const ok = { name: 'Ok', rarity: 'common', effect: '+1 Strength.', gp: `${priceForWeight(1, 'common', cfg)} gp` };
    assert.deepEqual(ids(evaluateItem(ok, cfg)), []);
    assert.ok(ids(evaluateItem({ name: 'Pricey', rarity: 'rare', effect: '+6 Strength.', gp: '5000 gp' }, cfg)).includes('price-caps'));
    assert.ok(ids(evaluateItem({ name: 'Pricey', rarity: 'celestial', effect: '+6 Strength.', gp: '200000 gp' }, cfg)).includes('price-caps'));
  });
  test('a disabled rule reports nothing', () => {
    const c = mergeItemRules({ rules: [{ id: 'no-attack-roll-modifiers', enabled: false }] });
    assert.ok(!ids(evaluateItem({ name: 'S', rarity: 'uncommon', effect: '+1 to attack rolls.' }, c, { exempt: true })).includes('no-attack-roll-modifiers'));
  });
});

describe('config merging', () => {
  test('partial overrides merge over the defaults; junk is ignored', () => {
    const c = mergeItemRules({ weights: { scalar: { Strength: 2, Dexterity: 'lots', Nonsense: 9 } }, rarityBands: { rare: [4, 9] }, rules: [{ id: 'proficiency-boost-cap', params: { max: 2 } }, { id: 'unknown-rule', enabled: false }], priceBands: { celestial: [1, 999999999] } });
    assert.equal(c.weights.scalar.Strength, 2);
    assert.equal(c.weights.scalar.Dexterity, DEFAULT_ITEM_RULES.weights.scalar.Dexterity);
    assert.deepEqual(c.rarityBands.rare, [4, 9]);
    assert.equal(c.rules.find(r => r.id === 'proficiency-boost-cap').params.max, 2);
    assert.ok(c.priceBands.celestial[1] <= 100000);
    assert.equal(mergeItemRules(null).rules.length, DEFAULT_ITEM_RULES.rules.length);
  });
  test('the default config round-trips through JSON', () => {
    const c = mergeItemRules(JSON.parse(JSON.stringify(DEFAULT_ITEM_RULES)));
    assert.equal(c.weights.scalar.Strength, 1);
    assert.equal(c.rarityBands.celestial[0], 18);
  });
});
