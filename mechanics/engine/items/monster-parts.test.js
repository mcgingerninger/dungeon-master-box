// Regression tests for mechanics/engine/items/monster-parts.js — run with: node --test
//
// Scope: only buildMonsterPartWondrous/generateMonsterPartWondrous, the genuinely NEW code this
// migration adds (completing the equip-mode pathway V2 itself left unwired). The rest of this file
// is a verified byte-for-byte port of dungeonboxnewVersion2_rework's already-tested source (see the
// file's own header comment for the fidelity check performed before porting) — re-testing that
// ported logic here would duplicate coverage, not add to it. A couple of sanity checks on the
// ported buildMonsterPartMaterial are included since this is the one module where fidelity could be
// verified directly against dungeon-master-box's own original source, not just trusted.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MONSTER_PARTS, PART_THEMES, getCreatureFamily,
  buildMonsterPartMaterial, generateMonsterPartMaterial,
  buildMonsterPartWondrous, generateMonsterPartWondrous,
} from './monster-parts.js';
import { validateItem } from './validate-item.js';

// Deterministic, non-Math.random rand source for reproducible tests.
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Deliberately a name that matches none of the 'beast' family's own subtype keywords
// (wolf/bear/spider/snake/serpent) so it falls through to the family's baseTheme, not a subtype's.
const BEAST = { name: 'Giant Boar', type: 'beast', traits: [], actions: [{ name: 'Gore', text: 'tusks gore' }] };
const CONSTRUCT = { name: 'Stone Golem', type: 'construct', traits: [], actions: [] };
const UNDEAD_ZOMBIE = { name: 'Shambling Zombie', type: 'undead', traits: [], actions: [] };

const heartstone = MONSTER_PARTS.find(p => p.id === 'heartstone');
const core = MONSTER_PARTS.find(p => p.id === 'core');
const claw = MONSTER_PARTS.find(p => p.id === 'claw');

describe('buildMonsterPartMaterial (ported, sanity check only)', () => {
  test('produces a valid material item from a combine-mode part', () => {
    const item = buildMonsterPartMaterial(BEAST, 'common', claw, seededRand(1));
    assert.equal(item.itemType, 'material');
    assert.ok(validateItem(item).valid, JSON.stringify(validateItem(item).errors));
  });

  test('throws when given an equip-mode part (wrong builder)', () => {
    assert.throws(() => buildMonsterPartMaterial(BEAST, 'common', heartstone));
  });

  test('generateMonsterPartMaterial is deterministic for a given rand sequence', () => {
    const a = generateMonsterPartMaterial(BEAST, 'rare', seededRand(42));
    const b = generateMonsterPartMaterial(BEAST, 'rare', seededRand(42));
    assert.deepEqual(a, b);
  });
});

describe('buildMonsterPartWondrous (new — completes the equip-mode pathway V2 left unwired)', () => {
  test('throws when given a combine-mode part (wrong builder)', () => {
    assert.throws(() => buildMonsterPartWondrous(BEAST, 'common', claw));
  });

  test('a beast (primal_strength theme, via family baseTheme fallback) grants a real Strength bonus', () => {
    assert.equal(getCreatureFamily(BEAST).baseTheme, 'primal_strength');
    const item = buildMonsterPartWondrous(BEAST, 'common', heartstone, seededRand(7));
    assert.equal(item.itemType, 'wondrous');
    assert.equal(item.wondrous.slot, 'charm');
    assert.equal(item.requiresAttunement, true);
    assert.deepEqual(item.passive, [{ stat: 'str', value: 1 }]); // common tier magnitude = 1
    assert.ok(validateItem(item).valid, JSON.stringify(validateItem(item).errors));
  });

  test('a construct (armored_construct theme) grants AC instead of an ability score', () => {
    const item = buildMonsterPartWondrous(CONSTRUCT, 'rare', core, seededRand(3));
    assert.deepEqual(item.passive, [{ stat: 'ac', value: 2 }]); // rare tier magnitude = 2
  });

  test('the necrotic_resilience theme (Max HP, mult: 2) scales correctly', () => {
    // Undead family's baseTheme is necrotic_resilience; "Shambling Zombie" doesn't match the
    // 'zombie' subtype keyword's exact family lookup path here since undead subtypes ARE keyed
    // by name — confirm zombie resolves to its OWN subtype (still necrotic_resilience) either way.
    assert.equal(PART_THEMES.necrotic_resilience.equip.stat, 'Maximum Hit Points');
    assert.equal(PART_THEMES.necrotic_resilience.equip.mult, 2);
    const item = buildMonsterPartWondrous(UNDEAD_ZOMBIE, 'legendary', heartstone, seededRand(9));
    assert.deepEqual(item.passive, [{ stat: 'hp_max', value: 6 }]); // legendary magnitude 3 * mult 2
  });

  test('generateMonsterPartWondrous only ever picks equip-mode parts, and is deterministic', () => {
    const a = generateMonsterPartWondrous(BEAST, 'uncommon', seededRand(11));
    const b = generateMonsterPartWondrous(BEAST, 'uncommon', seededRand(11));
    assert.deepEqual(a, b);
    assert.ok(validateItem(a).valid);
  });

  test('every equip-mode part produces a valid wondrous item for an eligible monster', () => {
    for (const partDef of MONSTER_PARTS.filter(p => p.mode === 'equip')) {
      const item = buildMonsterPartWondrous(BEAST, 'common', partDef, seededRand(5));
      const { valid, errors } = validateItem(item);
      assert.ok(valid, `${partDef.id}: ${errors.join('; ')}`);
    }
  });
});
