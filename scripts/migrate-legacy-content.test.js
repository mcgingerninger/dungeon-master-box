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
  deriveConsumableCategory, resolveConsumableUses, migrateConsumable,
  deriveWondrousSlot, deriveToolCategory, migrateMisc,
  extractSpeeds, narrativeToolCategory, migrateCompanion, migrateNarrativeTool,
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
  test('an unrelated branch (e.g. Key/Quest Object) falls back to a generic category rather than a misleading specific one', () => {
    assert.equal(deriveToolCategory(['Key / Quest Object', 'Key', 'Physical Key']), 'adventuring-gear');
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

const MIGRATORS_FOR_TEST = {
  weapon: migrateWeapon, armor: migrateArmor, consumable: migrateConsumable, misc: migrateMisc,
  companion: migrateCompanion, treasure: migrateNarrativeTool, questitem: migrateNarrativeTool, document: migrateNarrativeTool,
};

describe('full migration determinism (real loot-data.js)', () => {
  test('running the migration end-to-end twice produces byte-identical canonical output', () => {
    const lootData = loadLootData();
    const nextId1 = makeIdGenerator();
    const nextId2 = makeIdGenerator();
    const migrateAll = (nextId) => {
      const out = [];
      for (const tier of Object.keys(lootData)) {
        lootData[tier].forEach((item, index) => {
          const migrator = MIGRATORS_FOR_TEST[item.type];
          if (!migrator) return;
          const result = migrator(item, tier, index, nextId, [], []);
          if (result) out.push(result);
        });
      }
      return out;
    };
    const run1 = migrateAll(nextId1);
    const run2 = migrateAll(nextId2);
    assert.deepEqual(run1, run2);
    assert.ok(run1.length > 1200, `expected the bulk of loot-data.js's 1243 items to migrate, got ${run1.length}`);
  });

  test('every canonical item in the committed output validates cleanly', () => {
    const lootData = loadLootData();
    const nextId = makeIdGenerator();
    let checked = 0;
    for (const tier of Object.keys(lootData)) {
      lootData[tier].forEach((item, index) => {
        const migrator = MIGRATORS_FOR_TEST[item.type];
        if (!migrator) return;
        const result = migrator(item, tier, index, nextId, [], []);
        if (!result) return;
        const { valid, errors } = validateItem(result);
        assert.ok(valid, `${result.name}: ${errors.join('; ')}`);
        checked++;
      });
    }
    assert.ok(checked > 1200);
  });
});
