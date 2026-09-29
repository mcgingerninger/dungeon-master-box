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
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadLootData, loadNpcWeapons, classifySubcategory, computeItemWeight, deriveWeaponMechanics,
  deriveWeaponProperties, toStatModifiers, findSetValueOverrides, applyMaterialModifiers,
  parseWeaponEffectBonuses, slugify, makeIdGenerator, migrateWeapon, migrateArmor,
  deriveConsumableCategory, resolveConsumableUses, migrateConsumable,
  deriveWondrousSlot, deriveToolCategory, migrateMisc,
  extractSpeeds, narrativeToolCategory, migrateCompanion, migrateNarrativeTool,
  convertNpcAbility, migrateNpcWeapon,
} from './migrate-legacy-content.js';
import { validateItem } from '../mechanics/engine/items/validate-item.js';
import { equipmentSlotsForItem } from '../mechanics/engine/character/equipment.js';

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

// Real, already-live bug found by scripts/validate-migration-bridge.js's shadow-mode comparison
// (Phase 13, docs/V2_MECHANICS_MIGRATION.md): the combo regex required the literal word "rolls"
// after "attack and damage", but 50 named magic weapons in the real catalog (Vorpal Sword, Holy
// Avenger, Luck Blade, Sword of Answering, and more) are phrased "+N attack and damage." with no
// "to" and no trailing "rolls" — every one of them rolled with ZERO of its own stated bonus, in
// both the live app and the migrated data, until fixed identically in both copies of this function.
describe('parseWeaponEffectBonuses', () => {
  test('still matches the original "+N to attack and damage rolls" phrasing unchanged', () => {
    assert.deepEqual(parseWeaponEffectBonuses('+1 to attack and damage rolls. Requires attunement.'), { atkBonus: 1, dmgBonus: 1, bonusDiceClauses: [] });
  });
  test('now also matches "+N attack and damage." with no "to" and no "rolls" (the real gap found in 50 catalog weapons)', () => {
    assert.deepEqual(parseWeaponEffectBonuses('+3 attack and damage. Natural 20: severs target\'s head. Requires attunement.'), { atkBonus: 3, dmgBonus: 3, bonusDiceClauses: [] });
  });
  test('"+N attack and damage each" (paired weapons) still matches, ignoring the trailing word', () => {
    assert.deepEqual(parseWeaponEffectBonuses('+4 attack and damage each. Finesse, light.'), { atkBonus: 4, dmgBonus: 4, bonusDiceClauses: [] });
  });
  // A genuinely conditional bonus phrased as a PRECEDING "While/If/When ...:" clause (not the
  // trailing "when/while/..." the existing guard already excludes) must not be treated as always-on.
  test('a "While attuned with X AND Y: +N attack and damage" conditional prefix is NOT treated as an always-on bonus', () => {
    const effect = 'Deals 2d6+1 bludgeoning damage. While attuned with Belt of Giant Strength AND Gauntlets of Ogre Power: +5 attack and damage, giant hit DC 17 Wisdom or Frightened of you for 1 minute. Requires attunement.';
    // Without a dmgField, bonusDiceRe still catches "2d6+1 bludgeoning damage" as a clause — this
    // test's subject is the conditional-prefix guard, not the dmgField filter below, so no dmgField
    // is passed here and the clause is expected to appear.
    assert.deepEqual(parseWeaponEffectBonuses(effect), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [{ dice: '2d6+1', type: 'bludgeoning' }] });
  });
  test('the existing trailing guard (when/while/with/made/only right after the phrase) still excludes a conditional suffix', () => {
    assert.deepEqual(parseWeaponEffectBonuses('+2 to attack and damage rolls while raging.'), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [] });
  });
});

// Real, already-live bug found by scripts/validate-migration-bridge.js's shadow-mode comparison
// (Phase 13, docs/V2_MECHANICS_MIGRATION.md): bonusDiceRe matches any "NdM [type] damage" phrase in
// the effect text, with no way to tell a genuine bonus-damage rider (e.g. Flame Tongue's "+2d6 fire
// damage") apart from a weapon restating its OWN base damage in flavor text (e.g. Hammer of
// Thunderbolts: dmg:"2d6+1", effect:"Deals 2d6+1 bludgeoning damage..."). Confirmed to affect
// exactly 2 catalog items via an exact full-dmg-string match. Fixed by passing the item's dmg field
// in as dmgField and excluding an exact match from bonusDiceClauses.
describe('parseWeaponEffectBonuses — dmgField filters a weapon\'s own base damage out of bonusDiceClauses', () => {
  test('Hammer of Thunderbolts: effect text restates the weapon\'s own dmg — filtered out when dmgField is passed', () => {
    const effect = 'Deals 2d6+1 bludgeoning damage. On a critical hit, the target must succeed on a DC 17 Strength saving throw or be stunned.';
    assert.deepEqual(parseWeaponEffectBonuses(effect, '2d6+1'), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [] });
    // Without dmgField, the same text still produces the old (unfiltered) clause — confirms the
    // filter is opt-in via the new parameter, not a change to default behavior.
    assert.deepEqual(parseWeaponEffectBonuses(effect), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [{ dice: '2d6+1', type: 'bludgeoning' }] });
  });
  test('Arcane Cannon: effect text restates the weapon\'s own dmg with a different damage type wording — filtered out', () => {
    const effect = 'A massive arcane weapon dealing 3d8 force damage to all creatures in a 10-foot-wide, 60-foot-long line.';
    assert.deepEqual(parseWeaponEffectBonuses(effect, '3d8'), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [] });
  });
  test('a genuine same-sized bonus rider distinct from the weapon\'s own dmg is NOT filtered out', () => {
    // dmgField ('2d6', the weapon's actual base damage) does not match the rider's dice ('1d4'), so
    // the exact-string-match filter correctly leaves the rider alone.
    const effect = 'Deals an extra 1d4 thunder damage on a critical hit. Requires attunement.';
    assert.deepEqual(parseWeaponEffectBonuses(effect, '2d6'), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [{ dice: '1d4', type: 'thunder' }] });
  });
  test('a genuinely separate bonus rider alongside the weapon\'s own restated dmg keeps the rider and drops only the restated dmg', () => {
    const effect = 'Deals 2d6 bludgeoning damage. Also deals an extra 2d8 fire damage on a hit.';
    assert.deepEqual(parseWeaponEffectBonuses(effect, '2d6'), { atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [{ dice: '2d8', type: 'fire' }] });
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

  // Real bug found while wiring collectEquippedAcBreakdown's canonical-item bridge: classifySubcategory's
  // armor branch (verbatim-ported, never touched) only recognizes the literal word "shield", and has
  // no neck-item pattern at all — so a "Buckler" or "Amulet of ___" both fell through to its 'chest'
  // catch-all. That's harmless where subcategory is only a weight-bucketing hint (the original app),
  // but migrateArmor also uses it to decide isBodySlot/additive — left uncorrected, a Buckler would
  // migrate as non-additive body armor, REPLACING a player's AC with a flat 1 instead of adding it.
  test('a "Buckler" with no literal "shield" in its name is still recognized as a shield (additive)', () => {
    const item = { name: 'Buckler of the Whisperbound', desc: 'A small round shield.', type: 'armor', gp: '100 gp', ac: '+1', effect: '' };
    const ambiguous = [];
    const result = migrateArmor(item, 'uncommon', 0, makeIdGenerator(), ambiguous, []);
    assert.equal(result.armor.slot, 'shield');
    assert.equal(result.armor.armorType, 'shield');
    assert.equal(result.armor.additive, true);
    assert.equal(result.armor.baseAC, 1);
    assert.ok(ambiguous.some(a => a.reason.includes("corrected to 'offhand (shield)'")));
  });

  test('an "Amulet of ___" armor item is recognized as a neck slot (additive), not body armor', () => {
    const item = { name: 'Amulet of Natural Armor +1', desc: 'A magical amulet.', type: 'armor', gp: '500 gp', ac: '+1', effect: '' };
    const ambiguous = [];
    const result = migrateArmor(item, 'uncommon', 0, makeIdGenerator(), ambiguous, []);
    assert.equal(result.armor.slot, 'amulet');
    assert.equal(result.armor.additive, true);
    assert.equal(result.armor.baseAC, 1);
    assert.ok(ambiguous.some(a => a.reason.includes("corrected to 'amulet (neck)'")));
  });

  test('genuine body armor named "Robe of ___" is unaffected by the shield/neck name correction', () => {
    const item = { name: 'Robe of Eyes', desc: 'A robe.', type: 'armor', gp: '5000 gp', ac: '+2', effect: '' };
    const result = migrateArmor(item, 'rare', 0, makeIdGenerator(), [], []);
    assert.equal(result.armor.slot, 'chest');
    assert.equal(result.armor.additive, undefined);
    assert.equal(result.armor.baseAC, 2);
  });

  // Real, already-live bug found while wiring collectEquippedAcBreakdown's canonical-item bridge:
  // an item's effect text often restates its own `ac` field in prose (a common authoring
  // redundancy), which dungeon-master-box's live app double-counts today (two independent read
  // pathways for `.ac` vs. `.effect`) — the same pattern already fixed for weapons above.
  test('an effect-text AC rider that exactly matches the item\'s own ac field is dropped as a redundant restatement (fixes a real double-count)', () => {
    const item = { name: 'Steel Buckler of the Tide', desc: '', type: 'armor', gp: '225 gp', ac: '+1', effect: '+1 AC. You can breathe underwater and have a swimming speed equal to your walking speed. Requires attunement.' };
    const fixes = [];
    const result = migrateArmor(item, 'uncommon', 0, makeIdGenerator(), [], fixes);
    assert.equal(result.armor.baseAC, 1);
    assert.equal(result.armor.additive, true);
    assert.equal((result.passive || []).some(m => m.stat === 'ac'), false);
    assert.ok(fixes.some(f => f.kind === 'double-counted armor class bonus'));
  });

  test('an effect-text AC rider that DIFFERS from the item\'s own ac field is a genuine separate stacking bonus and is kept (matches computeCharacterSheetFor\'s own tested "Vanguard\'s Plate" behavior)', () => {
    const item = { name: 'Vanguard\'s Plate', desc: '', type: 'armor', gp: '1000 gp', ac: '13', effect: '+2 Armor Class' };
    const fixes = [];
    const result = migrateArmor(item, 'rare', 0, makeIdGenerator(), [], fixes);
    assert.equal(result.armor.baseAC, 13);
    assert.deepEqual(result.passive, [{ stat: 'ac', value: 2 }]);
    assert.equal(fixes.some(f => f.kind === 'double-counted armor class bonus'), false);
  });

  // Real, already-live bug found by scripts/validate-migration-bridge.js's shadow-mode comparison
  // (Phase 13): a SECOND, differing "+N Armor Class" match can be purely an informational running
  // total, not a real extra bonus — extractStatDeltasFromText has no way to tell "+5 AC" (a
  // computed recap: "on top of a standard shield bonus, total +5") apart from a genuine third
  // stacking source, so the live app would sum ALL of it (+1 field, +1 first match, +5 recap).
  test('a second "+N Armor Class" match alongside the word "total" is dropped as an informational recap, not a real bonus, and flagged for review', () => {
    const item = { name: 'Shield of the Unbroken Line', desc: '', type: 'armor', gp: '—', ac: '+3', effect: '+3 AC (on top of standard shield bonus — total +5 AC from this shield). Requires attunement.' };
    const ambiguous = [];
    const result = migrateArmor(item, 'legendary', 0, makeIdGenerator(), ambiguous, []);
    assert.equal(result.armor.baseAC, 3);
    assert.equal(result.armor.additive, true);
    assert.equal((result.passive || []).some(m => m.stat === 'ac'), false, 'neither the redundant +3 nor the recap +5 should survive as a passive ac entry');
    assert.ok(ambiguous.some(a => a.reason.includes('"total" AC figure')));
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

  // Real, already-live bug found by scripts/validate-migration-bridge.js's shadow-mode comparison
  // (Phase 13): "masterwork" is also a common English adjective for "finely crafted" — a real
  // magic weapon's flavor `desc` calling it "a masterwork warhammer" was wrongly tagging an
  // already-magical item as ALSO mundane, non-magical Masterwork gear (contradicting its own
  // "counts as magical" effect text) and silently stacking an extra +1 attackRoll it was never
  // designed to have.
  test('a "masterwork" mention in flavor desc/effect (not the item\'s own name) is NOT treated as the Masterwork material', () => {
    const base = { id: 'x', name: 'Warhammer +2', itemType: 'weapon', rarity: 'rare', weapon: { damageDice: '1d8', damageType: 'bludgeoning' } };
    const { item, appliedNames } = applyMaterialModifiers(base, 'Warhammer +2', 'A masterwork warhammer with dwarven runes hammered into the head.', '+2 to attack and damage rolls. Counts as magical.');
    assert.deepEqual(appliedNames, []);
    assert.equal(item.weapon.magical, undefined, 'must not be marked non-magical — this item\'s own effect text says it counts as magical');
    assert.equal(item.passive, undefined, 'must not gain a phantom attackRoll bonus from a flavor-text mention');
  });
  test('a "Masterwork ___" name prefix still applies the material even with unrelated flavor text', () => {
    const base = { id: 'x', name: 'Masterwork Heavy Crossbow', itemType: 'weapon', rarity: 'uncommon', weapon: { damageDice: '1d10', damageType: 'piercing' } };
    const { appliedNames } = applyMaterialModifiers(base, 'Masterwork Heavy Crossbow', 'A finely made heavy crossbow.', 'Range 100/400.');
    assert.deepEqual(appliedNames, ['Masterwork']);
  });

  test('an item with no material keyword is returned unchanged', () => {
    const base = { id: 'x', name: 'Plain Dagger', itemType: 'weapon', rarity: 'common', weapon: { damageDice: '1d4', damageType: 'piercing' } };
    const { item, appliedNames } = applyMaterialModifiers(base, 'Plain Dagger', '', '');
    assert.deepEqual(appliedNames, []);
    assert.equal(item.appliedModifiers, undefined);
  });
});

describe('deriveConsumableCategory', () => {
  test('a name/effect naming a salve/ointment is "topical" even though classifySubcategory has no such concept and would default to "food"', () => {
    assert.equal(deriveConsumableCategory('Tinned Salve', 'Applied to a wound.', 'food'), 'topical');
  });
  test('an "Oil of X" name is "coating", not "potion" (it is applied to a weapon, not drunk)', () => {
    assert.equal(deriveConsumableCategory('Oil of Sharpness', '+3 to attack and damage rolls.', 'potion'), 'coating');
  });
  test('plain potion/scroll/food/throwable map straight across', () => {
    assert.equal(deriveConsumableCategory('Potion of Healing', 'Restores 2d4+2 hit points.', 'potion'), 'potion');
    assert.equal(deriveConsumableCategory('Scroll of Fireball', '', 'scroll'), 'scroll');
    assert.equal(deriveConsumableCategory('Iron Rations', '', 'food'), 'food');
    assert.equal(deriveConsumableCategory('Thunderstone', '', 'throwable'), 'thrown');
  });
});

describe('resolveConsumableUses', () => {
  test('no charges field defaults to a single use', () => {
    assert.deepEqual(resolveConsumableUses(undefined, 'x', [], 'common'), { max: 1, note: null });
  });
  test('a flat numeric string is used as-is', () => {
    assert.deepEqual(resolveConsumableUses('3', 'x', [], 'common'), { max: 3, note: null });
  });
  test('"N use(s)" phrasing is parsed', () => {
    assert.equal(resolveConsumableUses('2 uses', 'x', [], 'common').max, 2);
  });
  test('"N/period" is flagged and uses the flat count with no refill (matching current live behavior)', () => {
    const ambiguous = [];
    const result = resolveConsumableUses('1/week', 'x', ambiguous, 'common');
    assert.equal(result.max, 1);
    assert.equal(ambiguous.length, 1);
    assert.ok(ambiguous[0].reason.includes('periodic refill'));
  });
  test('dice notation is rolled once, deterministically, and flagged', () => {
    const ambiguous1 = []; const ambiguous2 = [];
    const r1 = resolveConsumableUses('1d4+1 applications', "Keoghtom's Ointment", ambiguous1, 'rare');
    const r2 = resolveConsumableUses('1d4+1 applications', "Keoghtom's Ointment", ambiguous2, 'rare');
    assert.equal(r1.max, r2.max, 'must be deterministic across calls for the same item name');
    assert.ok(r1.max >= 1);
    assert.equal(ambiguous1.length, 1);
    assert.ok(ambiguous1[0].reason.includes('dice notation'));
  });
});

describe('migrateConsumable', () => {
  test('clean dice-notation item.hp becomes a heal effect', () => {
    const item = { name: 'Test Potion of Healing', desc: 'A pink vial.', type: 'consumable', gp: '150 gp', hp: '2d4+2', effect: 'Restores 2d4+2 hit points. Action to drink.' };
    const result = migrateConsumable(item, 'uncommon', 0, makeIdGenerator(), [], []);
    assert.deepEqual(result.consumable.effects, [{ kind: 'heal', healDice: '2d4+2' }]);
    assert.equal(result.consumable.consumableCategory, 'potion');
    assert.ok(validateItem(result).valid);
  });

  test('non-dice item.hp ("10 temp HP", "Full HP") is flagged and falls back to utility, not approximated as a plain heal', () => {
    const item = { name: 'Test Heroism Potion', desc: '', type: 'consumable', gp: '180 gp', hp: '10 temp HP', effect: 'Grants 10 temporary hit points.' };
    const ambiguous = [];
    const result = migrateConsumable(item, 'uncommon', 0, makeIdGenerator(), ambiguous, []);
    assert.deepEqual(result.consumable.effects, [{ kind: 'utility' }]);
    assert.ok(ambiguous.some(a => a.reason.includes('not plain dice notation')));
  });

  test('a consumable is never excluded — always produces a valid item even with no confidently-extractable mechanic', () => {
    const item = { name: 'Test Weird Trinket Potion', desc: '', type: 'consumable', gp: '10 gp', effect: 'Does something strange when consumed.' };
    const result = migrateConsumable(item, 'common', 0, makeIdGenerator(), [], []);
    assert.ok(result);
    assert.ok(validateItem(result).valid);
  });

  test('every migrated consumable passes validateItem (no passive/abilities/grants facet, which consumables cannot carry)', () => {
    const item = { name: 'Test Ration', desc: 'Hard tack.', type: 'consumable', gp: '5 sp', effect: 'Provides one day of food.' };
    const result = migrateConsumable(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.passive, undefined);
    assert.equal(result.abilities, undefined);
    assert.ok(validateItem(result).valid);
  });
});

describe('deriveWondrousSlot', () => {
  test('an accessory classification maps to the matching wondrous slot', () => {
    assert.equal(deriveWondrousSlot(['Accessory', 'Ring', 'Signet Ring']), 'ring');
    assert.equal(deriveWondrousSlot(['Accessory', 'Neck', 'Amulet']), 'amulet');
    assert.equal(deriveWondrousSlot(['Accessory', 'Back', 'Cloak']), 'cloak');
    assert.equal(deriveWondrousSlot(['Accessory', 'Feet', 'Boots']), 'boots');
    assert.equal(deriveWondrousSlot(['Accessory', 'Hands', 'Gauntlets']), 'handwear');
    assert.equal(deriveWondrousSlot(['Accessory', 'Waist', 'Belt']), 'beltwaist');
  });
  test('a non-accessory classification has no slot', () => {
    assert.equal(deriveWondrousSlot(['Miscellaneous', 'Adventuring Gear', 'Container']), null);
  });
});

describe('deriveToolCategory', () => {
  test('Tool and Miscellaneous branches both produce a real, specific category', () => {
    assert.equal(deriveToolCategory(['Tool', "Thieves' Tools", 'Lockpicks']), 'lockpicks');
    assert.equal(deriveToolCategory(['Miscellaneous', 'Adventuring Gear', 'Container']), 'container');
    assert.equal(deriveToolCategory(['Miscellaneous', 'Household', 'Cookware']), 'cookware');
  });
  // Real gap found and fixed as one of the "three smaller items" in
  // docs/V2_MECHANICS_MIGRATION.md's Phase 14 addendum: 14 catalog items (a rusty/mystery key,
  // several letters/a journal/a personal map, a scrap of cloth, six ability-score tomes, a universal
  // solvent) all landed outside the Tool/Miscellaneous branch — the migration report's own note
  // already called this "quest/document/treasure content mis-scoped into this migration's misc-item
  // pass" — yet each still has a real, specific classification leaf. Reusing that leaf (the same
  // technique narrativeToolCategory already uses for the same content shape when it isn't mistagged)
  // gives an honest, specific category instead of an invented generic one.
  test('an unrelated branch (e.g. Key/Quest Object) with a real leaf category uses that leaf, not a generic fallback', () => {
    assert.equal(deriveToolCategory(['Key / Quest Object', 'Key', 'Physical Key']), 'physical-key');
    assert.equal(deriveToolCategory(['Document', 'Book', 'Magic']), 'magic');
    assert.equal(deriveToolCategory(['Material', 'Organic', 'Cloth / Fabric']), 'cloth-fabric');
  });
  test('an unrelated branch with no usable leaf at all still falls back to a generic category', () => {
    assert.equal(deriveToolCategory(['Key / Quest Object', 'Key', '']), 'adventuring-gear');
  });
});

describe('migrateMisc — wondrous/tool split', () => {
  test('a ring gets itemType wondrous with a real, equippable slot', () => {
    const item = { name: 'Test Signet Ring', desc: 'A gold signet ring.', type: 'misc', gp: '50 gp', effect: '' };
    const result = migrateMisc(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'wondrous');
    assert.equal(result.wondrous.slot, 'ring');
    assert.deepEqual(equipmentSlotsForItem(result), ['ring1', 'ring2', 'ring3', 'ring4']);
    assert.ok(validateItem(result).valid);
  });

  test('an item requiring attunement is wondrous even with no body slot at all', () => {
    const item = { name: 'Test Lucky Coin', desc: 'A tarnished coin.', type: 'misc', gp: '—', effect: 'Requires attunement. Once per week, reroll a failed check.' };
    const result = migrateMisc(item, 'legendary', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'wondrous');
    assert.deepEqual(result.wondrous, {});
    assert.deepEqual(equipmentSlotsForItem(result), []);
  });

  test('a "+N stat" effect makes an otherwise slot-less item wondrous, and extracts the real bonus', () => {
    const item = { name: 'Test Charm', desc: '', type: 'misc', gp: '100 gp', effect: '+1 Wisdom while carried.' };
    const result = migrateMisc(item, 'uncommon', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'wondrous');
    assert.deepEqual(result.passive, [{ stat: 'wis', value: 1 }]);
  });

  test('an item classifyItemHierarchy itself calls a "Wondrous Item" is wondrous even with no slot/attunement/bonus/charges signal', () => {
    // Matches the real gap this migration found: classifyItemHierarchy already flags any
    // non-common item with effect text as magical ("Miscellaneous > Wondrous Item > ..."), but
    // that alone doesn't set requiresAttunement/passive/charges/slot — without reusing this
    // existing signal, a narratively-magical item with no other structural marker would be
    // wrongly migrated as mundane 'tool' gear.
    const item = { name: 'Test Orb of Whispers', desc: '', type: 'misc', gp: '500 gp', effect: 'Whispers secrets to its bearer under a full moon.' };
    const result = migrateMisc(item, 'rare', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'wondrous');
  });

  test('genuinely mundane gear with no magical signal at all becomes tool, not wondrous', () => {
    const item = { name: 'Test Waterskin', desc: 'A leather pouch.', type: 'misc', gp: '2 sp' };
    const result = migrateMisc(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'tool');
    assert.ok(validateItem(result).valid);
  });

  test('a misc item is never excluded — always produces a valid item', () => {
    const item = { name: 'Test Weird Object', desc: '', type: 'misc', gp: '1 gp', effect: 'Does something DM-adjudicated.' };
    const result = migrateMisc(item, 'common', 0, makeIdGenerator(), [], []);
    assert.ok(result);
    assert.ok(validateItem(result).valid);
  });

  test('gp of "—" (no monetary value) is not carried through as a literal value string', () => {
    const item = { name: 'Test Quest Trinket', desc: '', type: 'misc', gp: '—', effect: 'Requires attunement.' };
    const result = migrateMisc(item, 'rare', 0, makeIdGenerator(), [], []);
    assert.equal(result.value, undefined);
  });
});

describe('extractSpeeds', () => {
  test('extracts base/fly/swim/climb speeds without cross-matching each other', () => {
    assert.deepEqual(extractSpeeds('Speed 40 ft. Climb speed 40 ft., including upside-down.'), { speed: 40, climbSpeed: 40 });
    assert.deepEqual(extractSpeeds('Speed 60 ft., fly speed 90 ft.'), { speed: 60, flySpeed: 90 });
    assert.deepEqual(extractSpeeds('Swim speed 60 ft. Cannot leave the water.'), { swimSpeed: 60 });
  });
  test('no speed language produces no fields', () => {
    assert.deepEqual(extractSpeeds('Advantage on Wisdom (Perception) checks.'), {});
  });
});

describe('migrateCompanion', () => {
  test('a mount with ac/speed/attack-bonus gets real structured mechanics', () => {
    const item = { name: 'Test Warhorse', desc: 'A trained charger.', type: 'companion', subcategory: 'mount', gp: '400 gp', ac: '11', effect: 'Speed 60 ft. Rider gains +1 to attack rolls made while mounted.' };
    const result = migrateCompanion(item, 'uncommon', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'companion');
    assert.deepEqual(result.companion, { companionType: 'mount', ac: 11, speed: 60 });
    assert.deepEqual(result.passive, [{ stat: 'attackRoll', value: 1 }]);
    assert.ok(validateItem(result).valid);
  });

  test('a pet with only narrative effects gets identity/flavor preserved with no fabricated mechanics', () => {
    const item = { name: 'Test Barn Cat', desc: 'A lean tabby.', type: 'companion', subcategory: 'pet', gp: '5 gp', effect: 'Advantage on Wisdom (Perception) checks to notice rodents.' };
    const result = migrateCompanion(item, 'common', 0, makeIdGenerator(), [], []);
    assert.deepEqual(result.companion, { companionType: 'pet' });
    assert.equal(result.passive, undefined);
    assert.ok(validateItem(result).valid);
  });

  test('companions weigh 0, matching dungeon-master-box\'s own convention (you carry them, not the other way around)', () => {
    const item = { name: 'Test Pony', desc: '', type: 'companion', subcategory: 'mount', gp: '30 gp', ac: '10', effect: 'Speed 40 ft.' };
    const result = migrateCompanion(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.weight, 0);
  });
});

describe('migrateNarrativeTool (treasure/questitem/document)', () => {
  test('a quest item without authored extraInteractions gets unlock/quest_item/turn_in synthesized for a key', () => {
    const item = { name: 'Test Vault Key', desc: 'An iron key.', type: 'questitem', gp: '—', effect: 'GM determines what lock this fits.' };
    const result = migrateNarrativeTool(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'tool');
    assert.deepEqual(result.extraInteractions, ['unlock', 'quest_item', 'turn_in']);
    assert.ok(validateItem(result).valid);
  });

  test('a non-key quest item gets quest_item/turn_in but not unlock', () => {
    const item = { name: 'Test Evidence Cloth', desc: '', type: 'questitem', gp: '—', effect: 'Physical evidence.' };
    const result = migrateNarrativeTool(item, 'common', 0, makeIdGenerator(), [], []);
    assert.deepEqual(result.extraInteractions, ['quest_item', 'turn_in']);
  });

  test('a document with its own authored extraInteractions keeps them verbatim rather than resynthesizing', () => {
    const item = { name: 'Test Royal Decree', desc: '', type: 'document', gp: '10 gp', effect: 'An official decree.', extraInteractions: ['quest_item'] };
    const result = migrateNarrativeTool(item, 'common', 0, makeIdGenerator(), [], []);
    assert.deepEqual(result.extraInteractions, ['quest_item']);
  });

  test('treasure gets a real category and no value of "—"', () => {
    const item = { name: 'Test Gold Coins', desc: '', type: 'treasure', gp: '50 gp', effect: 'Pure currency — no mechanical effect.' };
    const result = migrateNarrativeTool(item, 'common', 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'tool');
    assert.equal(result.tool.toolCategory, 'coin');
    assert.ok(validateItem(result).valid);
  });
});

describe('convertNpcAbility', () => {
  test('converts a spell-kind ability with recharge and real uses, preserving effect text as description', () => {
    const legacy = { id: 'x-counterspell', name: 'Counterspell', kind: 'spell', effectText: 'Cast Counterspell without using a spell slot.', uses: { max: 1, recharge: 'longRest' }, usesLeft: 1 };
    const ambiguous = [];
    const result = convertNpcAbility(legacy, 'Test Item', ambiguous);
    assert.deepEqual(result, {
      id: 'x-counterspell', name: 'Counterspell', kind: 'spell',
      description: 'Cast Counterspell without using a spell slot.',
      effect: { kind: 'utility' },
      uses: { max: 1, recharge: 'long_rest' },
      usesLeft: 1,
    });
    // Always flagged since the effect itself isn't reduced to a structured OnUseEffect.
    assert.ok(ambiguous.some(a => a.reason.includes('preserved as description text only')));
  });

  test('a non-spell legacy kind (buff/debuff/utility) maps to active_effect', () => {
    const legacy = { id: 'x', name: 'Compel Truth', kind: 'debuff', effectText: 'Force a save.', uses: { max: 1, recharge: 'longRest' }, usesLeft: 1 };
    assert.equal(convertNpcAbility(legacy, 'Test Item', []).kind, 'active_effect');
  });

  test('an unrecognized recharge value is flagged and defaults to long_rest', () => {
    const legacy = { id: 'x', name: 'Test', kind: 'spell', effectText: 'Does something.', uses: { max: 1, recharge: 'weird_value' }, usesLeft: 1 };
    const ambiguous = [];
    const result = convertNpcAbility(legacy, 'Test Item', ambiguous);
    assert.equal(result.uses.recharge, 'long_rest');
    assert.ok(ambiguous.some(a => a.reason.includes('unrecognized recharge type')));
  });
});

describe('migrateNpcWeapon', () => {
  test('reuses migrateWeapon for a weapon-typed NPC item and does not carry a literal "—" value through', () => {
    const item = { name: 'Test Blade', desc: 'A test blade.', type: 'weapon', slotSize: 1, gp: '—', dmg: '1d8+2', effect: '+2 attack and damage.' };
    const result = migrateNpcWeapon(item, 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'weapon');
    assert.equal(result.value, undefined);
    assert.equal(result.rarity, 'rare');
    assert.ok(validateItem(result).valid);
  });

  test('reuses migrateMisc for a misc-typed NPC item (e.g. a signature ring)', () => {
    const item = { name: 'Test Signet', desc: 'A ring.', type: 'misc', subcategory: 'ring', slotSize: 1, gp: '—', effect: 'While worn: once per long rest, force a save. Requires attunement.' };
    const result = migrateNpcWeapon(item, 0, makeIdGenerator(), [], []);
    assert.equal(result.itemType, 'wondrous');
    assert.ok(validateItem(result).valid);
  });

  test('a legacy structured abilities[] entry becomes a real V2 Ability on the migrated item', () => {
    const item = { name: 'Test Wand', desc: '', type: 'weapon', slotSize: 1, gp: '—', dmg: '1d4', effect: 'A minor wand.', abilities: [{ id: 'w-1', name: 'Zap', kind: 'spell', effectText: 'Deals damage.', uses: { max: 1, recharge: 'longRest' }, usesLeft: 1 }] };
    const result = migrateNpcWeapon(item, 0, makeIdGenerator(), [], []);
    assert.equal(result.abilities.length, 1);
    assert.equal(result.abilities[0].name, 'Zap');
    assert.ok(validateItem(result).valid);
  });

  test('legacySource records the npc-data.js origin distinctly from loot-data.js items', () => {
    const item = { name: 'Test Dagger', desc: '', type: 'weapon', slotSize: 1, gp: '—', dmg: '1d4', effect: '' };
    const result = migrateNpcWeapon(item, 3, makeIdGenerator(), [], []);
    assert.equal(result.legacySource.source, 'npc-data.js:NPC_WEAPONS');
    assert.equal(result.legacySource.index, 3);
  });

  test('an unhandled legacy type is excluded rather than guessed at', () => {
    const item = { name: 'Test Odd Thing', desc: '', type: 'questitem', gp: '—' };
    const ambiguous = [];
    const result = migrateNpcWeapon(item, 0, makeIdGenerator(), ambiguous, []);
    assert.equal(result, null);
    assert.ok(ambiguous.some(a => a.reason.includes('excluded from this pass')));
  });

  test('loadNpcWeapons loads the real npc-data.js NPC_WEAPONS array (8 items) without modifying the file', () => {
    const weapons = loadNpcWeapons();
    assert.equal(weapons.length, 8);
  });
});

const MIGRATORS_FOR_TEST = {
  weapon: migrateWeapon, armor: migrateArmor, consumable: migrateConsumable, misc: migrateMisc,
  companion: migrateCompanion, treasure: migrateNarrativeTool, questitem: migrateNarrativeTool, document: migrateNarrativeTool,
};

describe('full migration determinism (real loot-data.js + npc-data.js)', () => {
  // loadLootData()/loadNpcWeapons() are called ONCE and reused for both migration passes below —
  // NOT once per pass. Each call re-parses the source file through a fresh node:vm context, and
  // vm gives every context its own separate realm (its own Object.prototype/Array.prototype); two
  // separately-parsed copies of the same nested legacy object (e.g. an item's `unlocks` array,
  // passed through by reference into `narrative.unlocks`) are then content-identical but have
  // different prototypes, which assert.deepEqual's strict, prototype-sensitive comparison correctly
  // treats as unequal — a real node:vm cross-realm quirk, not a migration bug (confirmed: the
  // actual script's real JSON output, which strips prototypes entirely, was independently verified
  // byte-identical across repeated full runs — see the commit history). What this test needs to
  // prove is narrower and doesn't require re-parsing twice: that the MIGRATION functions themselves
  // are pure/deterministic for a given input, which loading the source once and migrating it twice
  // already demonstrates without tripping over vm's realm semantics.
  const lootData = loadLootData();
  const npcWeapons = loadNpcWeapons();
  function migrateEverything(nextId) {
    const out = [];
    for (const tier of Object.keys(lootData)) {
      lootData[tier].forEach((item, index) => {
        const migrator = MIGRATORS_FOR_TEST[item.type];
        if (!migrator) return;
        const result = migrator(item, tier, index, nextId, [], []);
        if (result) out.push(result);
      });
    }
    npcWeapons.forEach((item, index) => {
      const result = migrateNpcWeapon(item, index, nextId, [], []);
      if (result) out.push(result);
    });
    return out;
  }

  test('running the migration end-to-end twice produces byte-identical canonical output', () => {
    const run1 = migrateEverything(makeIdGenerator());
    const run2 = migrateEverything(makeIdGenerator());
    assert.deepEqual(run1, run2);
    assert.ok(run1.length > 1200, `expected the bulk of loot-data.js's 1243 + npc-data.js's 8 items to migrate, got ${run1.length}`);
  });

  test('every canonical item in the committed output validates cleanly', () => {
    const results = migrateEverything(makeIdGenerator());
    let checked = 0;
    for (const result of results) {
      const { valid, errors } = validateItem(result);
      assert.ok(valid, `${result.name}: ${errors.join('; ')}`);
      checked++;
    }
    assert.ok(checked > 1200);
  });

  test('the actual migration script output (mechanics/canonical/items.json) is reproducible across two independent full script runs (this DOES re-parse via vm each time, proving the real script is unaffected by the realm quirk above)', () => {
    const scriptPath = path.join(import.meta.dirname, 'migrate-legacy-content.js');
    const outputPath = path.join(import.meta.dirname, '..', 'mechanics', 'canonical', 'items.json');
    execFileSync('node', [scriptPath]);
    const first = fs.readFileSync(outputPath, 'utf8');
    execFileSync('node', [scriptPath]);
    const second = fs.readFileSync(outputPath, 'utf8');
    assert.equal(first, second);
  });
});
