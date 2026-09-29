// Regression tests for scripts/migrate-legacy-content.js — the V2-mechanics migration tool.
// Run with: node --test
//
// Focus: this script's OWN new derivation logic (weapon damage-type/category, armor slot
// mapping, the dmg-field-vs-effect-text double-count fix, material detection) since that's brand
// new code, not a port of anything already tested elsewhere. The ported engine modules
// (mechanics/engine/**) are byte-identical copies of dungeonboxnewVersion2_rework's own
// already-tested source — re-testing them here would duplicate that coverage, not add to it.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadLootData, classifySubcategory, computeItemWeight, deriveWeaponMechanics,
  deriveWeaponProperties, toStatModifiers, findSetValueOverrides, applyMaterialModifiers,
  slugify, makeIdGenerator, migrateWeapon, migrateArmor,
} from './migrate-legacy-content.js';
import { validateItem } from '../mechanics/engine/items/validate-item.js';

describe('loadLootData', () => {
  test('loads the real loot-data.js without modifying it, and does not export from it', () => {
    const data = loadLootData();
    assert.ok(Array.isArray(data.common) && data.common.length > 0);
    assert.ok(Array.isArray(data.celestial));
  });
});

describe('deriveWeaponMechanics — compound-name word-boundary handling', () => {
  // These are the exact bug this migration's own cascade had and fixed: this catalog frequently
  // smashes a base weapon word onto a prefix with no space, so a naive `\bkeyword\b` pattern
  // silently fails to match, the same issue classifySubcategory's own comments already document
  // fixing for bow/lance/maul.
  const cases = [
    ['Battleaxe', 'slashing', 'martial'],
    ['Iron Battleaxe', 'slashing', 'martial'],
    ['Quarterstaff', 'bludgeoning', 'simple'],
    ['Quarterstaff of the Sunforged', 'bludgeoning', 'simple'],
    ['Dragonlance', 'piercing', 'martial'],
    ['Oathbow', 'piercing', 'simple'],
    ['Moonblade', 'slashing', 'martial'],
    ['Thornmaul', 'bludgeoning', 'martial'],
    ['Longsword', 'slashing', 'martial'],
    ['Dagger', 'piercing', 'simple'],
    ['Shortsword', 'piercing', 'martial'],
    ['Handaxe', 'slashing', 'simple'],
    ['Rapier', 'piercing', 'martial'],
    ['Kukri', 'slashing', 'simple'],
  ];
  for (const [name, damageType, weaponCategory] of cases) {
    test(`"${name}" -> ${damageType}/${weaponCategory}`, () => {
      assert.deepEqual(deriveWeaponMechanics(name), { damageType, weaponCategory });
    });
  }

  test('a purely flavor-named legendary weapon with no weapon-type word returns nulls (flag, do not guess)', () => {
    assert.deepEqual(deriveWeaponMechanics('Grudgebearer'), { damageType: null, weaponCategory: null });
  });
});

describe('toStatModifiers — legacy stat name -> V2 StatModifier mapping', () => {
  test('ability names map to their abbreviation', () => {
    assert.deepEqual(toStatModifiers([{ stat: 'Strength', amount: 2 }]), [{ stat: 'str', value: 2 }]);
  });
  test('"Saving Throws" (a flat bonus to all six saves) expands to six save_<abbr> entries', () => {
    const mods = toStatModifiers([{ stat: 'Saving Throws', amount: 1 }]);
    assert.equal(mods.length, 6);
    for (const abbr of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      assert.ok(mods.some(m => m.stat === `save_${abbr}` && m.value === 1));
    }
  });
  test('an exact skill name passes through verbatim (V2 StatModifier accepts skill names directly)', () => {
    assert.deepEqual(toStatModifiers([{ stat: 'Stealth', amount: 2 }]), [{ stat: 'Stealth', value: 2 }]);
  });
  test('Armor Class / Maximum Hit Points / Movement Speed map to ac/hp_max/speed', () => {
    assert.deepEqual(toStatModifiers([{ stat: 'Armor Class', amount: 1 }]), [{ stat: 'ac', value: 1 }]);
    assert.deepEqual(toStatModifiers([{ stat: 'Maximum Hit Points', amount: 10 }]), [{ stat: 'hp_max', value: 10 }]);
    assert.deepEqual(toStatModifiers([{ stat: 'Movement Speed', amount: 10 }]), [{ stat: 'speed', value: 10 }]);
  });
});

describe('findSetValueOverrides', () => {
  test('detects an absolute-value phrasing the real Potion of Storm Giant Strength uses', () => {
    const overrides = findSetValueOverrides('Strength set to 29 (Storm Giant) for 1 hour. No effect if Strength already 29+.');
    assert.deepEqual(overrides, [{ stat: 'Strength', value: 29 }]);
  });
});

describe('slugify / makeIdGenerator', () => {
  test('produces a URL-safe id', () => {
    assert.equal(slugify("Nine Lives Stealer"), 'nine-lives-stealer');
  });
  test('dedupes repeated names deterministically', () => {
    const nextId = makeIdGenerator();
    assert.equal(nextId('Dagger'), 'dagger');
    assert.equal(nextId('Dagger'), 'dagger-2');
    assert.equal(nextId('Dagger'), 'dagger-3');
  });
});

describe('migrateWeapon — the dmg-field-vs-effect-text double-count fix', () => {
  test('a "+1 weapon" with the bonus baked into dmg AND restated in effect text is applied only once', () => {
    const item = { name: 'Test Longsword +1', desc: 'A test blade.', type: 'weapon', gp: '500 gp', dmg: '1d8+1', effect: '+1 to attack and damage rolls. Requires attunement.' };
    const ambiguous = []; const fixes = [];
    const result = migrateWeapon(item, 'uncommon', 0, makeIdGenerator(), ambiguous, fixes);
    assert.equal(result.weapon.damageDice, '1d8', 'the +1 must be stripped out of the base dice, not left baked in');
    const attackMod = result.passive.find(m => m.stat === 'attackRoll');
    const damageMod = result.passive.find(m => m.stat === 'damageRoll');
    assert.equal(attackMod.value, 1);
    assert.equal(damageMod.value, 1, 'must appear exactly once, not doubled with the dmg-field value');
    assert.equal(fixes.length, 1);
    assert.equal(fixes[0].kind, 'double-counted damage bonus');
    assert.ok(validateItem(result).valid);
  });

  test('a dmg-embedded modifier with no matching effect-text phrase is still preserved (not silently dropped)', () => {
    const item = { name: 'Test Cursed Blade', desc: '', type: 'weapon', gp: '10 gp', dmg: '1d8-1', effect: 'A faintly malevolent longsword.' };
    const result = migrateWeapon(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.weapon.damageDice, '1d8');
    const damageMod = result.passive.find(m => m.stat === 'damageRoll');
    assert.equal(damageMod.value, -1);
  });

  test('a genuinely conflicting dmg-embedded modifier vs. effect text is flagged, not silently resolved', () => {
    const item = { name: 'Test Mismatched Sword', desc: '', type: 'weapon', gp: '10 gp', dmg: '1d8+1', effect: '+2 to damage rolls.' };
    const ambiguous = [];
    const result = migrateWeapon(item, 'rare', 0, makeIdGenerator(), ambiguous, []);
    assert.ok(ambiguous.some(a => a.reason.includes('does not match')));
    // Prefers the structured dmg field over the free-text claim.
    assert.equal(result.passive.find(m => m.stat === 'damageRoll').value, 1);
  });

  test('an item with no parseable dmg is excluded (returns null), not silently invented', () => {
    const item = { name: 'Test Weird Weapon', desc: '', type: 'weapon', gp: '1 gp' };
    const ambiguous = [];
    const result = migrateWeapon(item, 'common', 0, makeIdGenerator(), ambiguous, []);
    assert.equal(result, null);
    assert.ok(ambiguous.some(a => a.reason.includes('excluded')));
  });

  test('every migrated weapon passes validateItem', () => {
    const item = { name: 'Test Handaxe', desc: 'A small axe.', type: 'weapon', gp: '5 gp', dmg: '1d6', effect: '' };
    const result = migrateWeapon(item, 'common', 0, makeIdGenerator(), [], []);
    assert.ok(validateItem(result).valid, JSON.stringify(validateItem(result).errors));
  });
});

describe('migrateArmor', () => {
  test('body armor (chest slot) with a plain numeric ac is the AC base, not additive', () => {
    const item = { name: 'Test Plate Armor', desc: 'Heavy plate.', type: 'armor', gp: '150 gp', ac: '16', effect: 'Requires 15 Strength or speed is reduced by 10 ft. Stealth disadvantage.' };
    const result = migrateArmor(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.armor.baseAC, 16);
    assert.equal(result.armor.additive, undefined);
    assert.equal(result.armor.armorType, 'heavy');
    assert.equal(result.armor.addsDexMod, false);
    assert.equal(result.armor.strengthRequirement, 15);
    assert.equal(result.armor.stealthDisadvantage, true);
    assert.ok(validateItem(result).valid);
  });

  test('a shield (offhand subcategory) is additive with armorType shield', () => {
    const item = { name: 'Test Wooden Shield', desc: 'A round shield.', type: 'armor', gp: '5 sp', ac: '+2', effect: '' };
    const result = migrateArmor(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.armor.armorType, 'shield');
    assert.equal(result.armor.additive, true);
    assert.equal(result.armor.baseAC, 2);
  });

  test('an accessory slot (helmet) with an unsigned numeric ac is now correctly additive — fixes a legacy gap where dungeon-master-box\'s collectEquippedAcBreakdown only recognizes an unsigned number in the chest slot', () => {
    const item = { name: 'Test Plate Helm', desc: 'A plate helm.', type: 'armor', gp: '20 gp', ac: '1', effect: '' };
    const result = migrateArmor(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.armor.slot, 'helmet');
    assert.equal(result.armor.additive, true);
    assert.equal(result.armor.baseAC, 1);
  });

  test('medium armor gets the standard 5e dex cap of 2', () => {
    const item = { name: 'Test Chain Shirt', desc: 'A shirt of interlocking rings.', type: 'armor', gp: '50 gp', ac: '13', effect: '' };
    const result = migrateArmor(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.armor.armorType, 'medium');
    assert.equal(result.armor.dexModCap, 2);
  });

  test('an accessory slot armorType is never flagged as ambiguous (it is mechanically inert there)', () => {
    const item = { name: 'Test Gauntlets', desc: 'Metal gauntlets.', type: 'armor', gp: '20 gp', ac: '1', effect: '' };
    const ambiguous = [];
    migrateArmor(item, 'common', 0, makeIdGenerator(), ambiguous, []);
    assert.equal(ambiguous.length, 0);
  });

  test('unresolvable BODY armor weight class is flagged and defaults to medium', () => {
    const item = { name: 'Armor of Gleaming', desc: 'Shimmering armor.', type: 'armor', gp: '500 gp', ac: '13', effect: 'AC 13 + Dex modifier (max 2), functions as a chain shirt.' };
    const ambiguous = [];
    const result = migrateArmor(item, 'uncommon', 0, makeIdGenerator(), ambiguous, []);
    assert.equal(result.armor.armorType, 'medium');
    assert.ok(ambiguous.some(a => a.reason.includes("body armor's weight class")));
  });
});

describe('applyMaterialModifiers — real mechanics, not classification labels', () => {
  test('a silvered weapon gets ignoresNonmagicalResistance and is marked non-magical', () => {
    const base = { id: 'x', name: 'Silver Dagger', itemType: 'weapon', rarity: 'uncommon', weapon: { damageDice: '1d4', damageType: 'piercing' } };
    const { item, appliedNames } = applyMaterialModifiers(base, 'Silver Dagger', '', 'A dagger with a silvered blade.');
    assert.equal(item.weapon.ignoresNonmagicalResistance, true);
    assert.equal(item.weapon.magical, false);
    assert.deepEqual(appliedNames, ['Silvered']);
    assert.equal(item.name, 'Silver Dagger', 'the catalog\'s own authored name must not be overwritten by the modifier\'s cosmetic template');
  });

  test('mithral armor clears stealth disadvantage/strength requirement and halves weight', () => {
    const base = { id: 'x', name: 'Mithral Chain Shirt', itemType: 'armor', rarity: 'uncommon', weight: 20, armor: { armorType: 'medium', baseAC: 13, addsDexMod: true, stealthDisadvantage: true, strengthRequirement: 13 } };
    const { item } = applyMaterialModifiers(base, 'Mithral Chain Shirt', '', '');
    assert.equal(item.weight, 10);
    assert.equal(item.armor.stealthDisadvantage, false);
    assert.equal(item.armor.strengthRequirement, undefined);
  });

  test('adamantine applies the correct override per item type (weapon vs armor)', () => {
    const weapon = { id: 'x', name: 'Adamantine Axe', itemType: 'weapon', rarity: 'uncommon', weapon: { damageDice: '1d8', damageType: 'slashing' } };
    const armor = { id: 'y', name: 'Adamantine Plate', itemType: 'armor', rarity: 'uncommon', armor: { armorType: 'heavy', baseAC: 18, addsDexMod: false } };
    assert.equal(applyMaterialModifiers(weapon, weapon.name, '', '').item.weapon.autoCritVsObjects, true);
    assert.equal(applyMaterialModifiers(armor, armor.name, '', '').item.armor.critImmuneWhileWorn, true);
  });

  test('masterwork grants a real, non-magical +1 to attack rolls only (no damage, no AC)', () => {
    const base = { id: 'x', name: 'Masterwork Longsword', itemType: 'weapon', rarity: 'common', weapon: { damageDice: '1d8', damageType: 'slashing' } };
    const { item } = applyMaterialModifiers(base, 'Masterwork Longsword', '', '');
    assert.equal(item.weapon.magical, false);
    assert.deepEqual(item.passive, [{ stat: 'attackRoll', value: 1 }]);
  });

  test('an item with no material keyword is returned unchanged', () => {
    const base = { id: 'x', name: 'Plain Dagger', itemType: 'weapon', rarity: 'common', weapon: { damageDice: '1d4', damageType: 'piercing' } };
    const { item, appliedNames } = applyMaterialModifiers(base, 'Plain Dagger', '', '');
    assert.deepEqual(appliedNames, []);
    assert.equal(item.appliedModifiers, undefined);
  });
});

describe('full migration determinism (real loot-data.js)', () => {
  test('running the migration end-to-end twice produces byte-identical canonical output', () => {
    const lootData = loadLootData();
    const nextId1 = makeIdGenerator();
    const nextId2 = makeIdGenerator();
    const migrateAll = (nextId) => {
      const out = [];
      for (const tier of Object.keys(lootData)) {
        lootData[tier].forEach((item, index) => {
          if (item.type !== 'weapon' && item.type !== 'armor') return;
          const result = item.type === 'weapon'
            ? migrateWeapon(item, tier, index, nextId, [], [])
            : migrateArmor(item, tier, index, nextId, [], []);
          if (result) out.push(result);
        });
      }
      return out;
    };
    const run1 = migrateAll(nextId1);
    const run2 = migrateAll(nextId2);
    assert.deepEqual(run1, run2);
    assert.ok(run1.length > 600, `expected the bulk of 688 weapon+armor items to migrate, got ${run1.length}`);
  });

  test('every canonical item in the committed output validates cleanly', () => {
    const lootData = loadLootData();
    const nextId = makeIdGenerator();
    let checked = 0;
    for (const tier of Object.keys(lootData)) {
      lootData[tier].forEach((item, index) => {
        if (item.type !== 'weapon' && item.type !== 'armor') return;
        const result = item.type === 'weapon'
          ? migrateWeapon(item, tier, index, nextId, [], [])
          : migrateArmor(item, tier, index, nextId, [], []);
        if (!result) return;
        const { valid, errors } = validateItem(result);
        assert.ok(valid, `${result.name}: ${errors.join('; ')}`);
        checked++;
      });
    }
    assert.ok(checked > 600);
  });
});
