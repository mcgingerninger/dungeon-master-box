// Regression tests for game-engine.js — Phase 1 of the architecture migration.
// Run with: node --test
//
// Goal: prove the extracted module produces the exact same output the monolith's original,
// in-place code produced for the same inputs. Every expected value here was hand-derived by
// tracing the original implementation (see docs/ARCHITECTURE.md), not invented to make testing
// convenient.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as GE from './game-engine.js';

describe('classifyItemFull', () => {
  test('sword: classification, properties, tags, interactions', () => {
    const sword = { name: 'Flametongue Sword', type: 'weapon', desc: '', effect: 'This magical blade deals +1d6 fire damage.', rarity: 'rare' };
    GE.classifyItemFull(sword, 'rare');
    assert.deepEqual(sword.classification, ['Weapon', 'Melee', 'One-Handed', 'Sword']);
    assert.ok(sword.properties.includes('Magical'));
    assert.ok(sword.properties.includes('Fire'));
    assert.ok(sword.properties.includes('Rare'));
    assert.ok(sword.tags.includes('weapon'));
    assert.ok(sword.tags.includes('fire'));
    assert.ok(sword.interactions.includes('equip'));
    assert.ok(sword.interactions.includes('enchant'));
    assert.ok(sword.interactions.includes('salvage'));
  });

  test('healing potion classification and interactions', () => {
    const potion = { name: 'Potion of Healing', type: 'consumable', subcategory: 'potion', hp: 10, desc: '', effect: 'Restores 2d4+2 hit points.', rarity: 'common' };
    GE.classifyItemFull(potion, 'common');
    assert.deepEqual(potion.classification, ['Consumable', 'Potion', 'Healing']);
    assert.ok(potion.interactions.includes('consume'));
    assert.ok(potion.interactions.includes('apply')); // broadened beyond just named oils/salves
  });

  test('a lootable Chest item (coffer/casket/strongbox synonyms) classifies as a mundane Container, not a Wondrous Item', () => {
    // Found while authoring the 6 tiered Chest items: classifyItemHierarchy's container check
    // only recognized "chest"/"crate"/"barrel"/"container" in the name, so "Coffer"/"Casket"/
    // "Strongbox" fell through to the generic magic-item guess (any non-common rarity + any
    // effect string) and got wrongly classified as a Wondrous Item.
    const coffer = { name: 'Sealed Reliquary Coffer', type: 'misc', desc: 'A stone-lidded coffer.', effect: 'Open to find a haul of rare-tier loot and coin.', rarity: 'rare' };
    GE.classifyItemFull(coffer, 'rare');
    assert.deepEqual(coffer.classification, ['Miscellaneous', 'Household', 'Container']);
    assert.ok(!coffer.tags.includes('wondrousitem'));

    const casket = { name: "The Sovereign's Casket", type: 'misc', desc: 'A gilded casket.', effect: 'Open to find a haul of legendary-tier loot and coin.', rarity: 'legendary' };
    GE.classifyItemFull(casket, 'legendary');
    assert.deepEqual(casket.classification, ['Miscellaneous', 'Household', 'Container']);

    const strongbox = { name: 'Weathered Strongbox', type: 'misc', desc: 'A dented wooden box.', effect: 'Open to find a haul of common-tier loot and coin.', rarity: 'common' };
    GE.classifyItemFull(strongbox, 'common');
    assert.deepEqual(strongbox.classification, ['Miscellaneous', 'Household', 'Container']);
  });

  test('open_chest is an explicit-opt-in interaction only, never auto-detected from text', () => {
    // Deliberately mirrors the word-boundary bug fix above: a Chest item's own default must
    // stay false so a keyword match on unrelated flavor text (e.g. some other item's "treasure
    // chest" mention) could never silently make it openable.
    const mentionsChestInText = { name: 'Old Map', type: 'misc', desc: 'Marks the way to a hidden treasure chest.', effect: '' };
    assert.ok(!GE.canInteract(mentionsChestInText, 'open_chest'));
    const realChest = { name: 'Iron-Banded Chest', type: 'misc', desc: '', effect: '', chestRarity: 'uncommon', extraInteractions: ['open_chest'] };
    assert.ok(GE.canInteract(realChest, 'open_chest'));
  });

  test('idempotent: does not overwrite an existing classification', () => {
    const item = { name: 'Test', type: 'misc', classification: ['Already', 'Set'] };
    GE.classifyItemFull(item);
    assert.deepEqual(item.classification, ['Already', 'Set']);
  });

  test('signet ring classification and attunement interaction', () => {
    const ring = { name: 'Signet Ring of the Lich', type: 'misc', subcategory: 'ring', desc: '', effect: 'requires attunement. Grants necrotic resistance.', rarity: 'legendary' };
    GE.classifyItemFull(ring, 'legendary');
    assert.deepEqual(ring.classification, ['Accessory', 'Ring', 'Signet Ring']);
    assert.ok(GE.canInteract(ring, 'attune'));
    assert.ok(GE.canInteract(ring, 'socket')); // rings/amulets, not just weapon/armor
  });
});

describe('computeCharacterSheetFor', () => {
  const abilityScores = { str: 14, dex: 16, con: 12, int: 10, wis: 13, cha: 8 };
  const slots = { armor: 'chestKey', ring1: 'ringKey' };
  const items = {
    chestKey: { item: { name: 'Studded Leather +1', ac: '13', effect: '+1 Dexterity' } },
    ringKey: { item: { name: 'Ring of Protection', effect: '+1 Saving Throws +1 Maximum Hit Points' } },
  };
  const resolveItem = key => items[key];
  const sheet = GE.computeCharacterSheetFor(abilityScores, 5, ['Stealth'], ['Dexterity'], slots, resolveItem, 40);

  test('ability score gear bonus flows through to total and modifier', () => {
    assert.equal(sheet.abilities.dex.total, 17); // 16 base + 1 from armor
    assert.equal(sheet.abilities.dex.mod, 3);     // floor((17-10)/2)
  });
  test('there is no built-in proficiency bonus — not by level, not flat', () => {
    assert.equal(sheet.profBonus, 0); // level 5, nothing equipped that raises it
    assert.equal(GE.proficiencyBonusForLevel(1), 0);
    assert.equal(GE.proficiencyBonusForLevel(20), 0);
  });
  test('the proficiency bonus is only what gear and feats say they add', () => {
    const items = { ring: { item: { name: 'Ring of the Duelist', effect: '+1 to your proficiency bonus. Requires attunement.' } }, dup: null };
    const boost = GE.collectProficiencyBoost({ ring1: 'ring', ring2: 'ring', neck: 'dup' }, k => items[k], [{ name: 'Prodigy (feat)', text: '+2 proficiency bonus.' }]);
    assert.equal(boost.total, 3);                       // the same ring in two slots counts once
    assert.deepEqual(boost.sources.map(s => s.source), ['Ring of the Duelist', 'Prodigy (feat)']);
    assert.equal(GE.collectProficiencyBoost({}, () => null, []).total, 0);
    // an item carrying the same text as both `effect` and `mods` counts once, not twice
    const both = { masterful: { item: { name: 'Masterful Dagger', effect: '+3 to your proficiency bonus while wielded.', mods: [{ text: '+3 to your proficiency bonus while wielded.' }] } } };
    assert.equal(GE.collectProficiencyBoost({ weapon1: 'masterful' }, k => both[k], []).total, 3);
  });
  test('"+N to your proficiency bonus" text is read from gear and feats', () => {
    assert.equal(GE.parseProficiencyBonusBoost('You gain a +1 bonus to your proficiency bonus with weapons.'), 0); // wording must match
    assert.equal(GE.parseProficiencyBonusBoost('+1 to your proficiency bonus. Requires attunement.'), 1);
    assert.equal(GE.parseProficiencyBonusBoost('+1 proficiency bonus. Also +2 to proficiency bonus when...'), 3);
    assert.equal(GE.parseProficiencyBonusBoost('Proficiency with longbows.'), 0);
  });
  test('save total = mod + prof (if proficient) + flat bonus sources', () => {
    assert.equal(sheet.saves.dex.total, sheet.abilities.dex.mod + 0 + 1); // proficient, but proficiency adds nothing by itself
  });
  test('skill total = ability mod + prof (if proficient) + direct sources', () => {
    assert.equal(sheet.skills['Stealth'].total, sheet.abilities.dex.mod + 0);
  });
  test('AC = armor base + dex mod, no double-counting the gear dex bonus', () => {
    assert.equal(sheet.ac.total, 13 + sheet.abilities.dex.mod);
  });
  test('max HP = base + flat gear bonus', () => {
    assert.equal(sheet.maxHp.total, 41); // 40 base + 1 from Ring of Protection
  });
  test('speed defaults to 30 with no bonus sources', () => {
    assert.deepEqual(sheet.speed, { base: 30, bonus: 0, total: 30, sources: [], status: '', tooltip: '' });
  });
});

describe('computeCharacterSheetFor / collectEquippedAcBreakdown: Dex-mod cap by armor weight class', () => {
  // Real gap found by direct audit: migrateArmor computes and stores armorType/addsDexMod/
  // dexModCap on every canonical armor item, but nothing previously read them back out in live AC
  // math (confirmed by a full-repo grep) — Dex was added to AC unconditionally and uncapped for
  // every armor weight, heavy included. These tests cover both legacy items (via the new
  // `armorStyle` field) and already-migrated canonical items (via the existing `armor.armorType`
  // field, which this fix makes live for the first time with no migration re-run needed).
  const highDexScores = { dex: 18 }; // mod +4

  test('light armor: full, uncapped Dex mod (legacy item, armorStyle field)', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Leather Armor', ac: '11', armorStyle: 'light' } } };
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 11 + 4);
  });
  test('medium armor: Dex mod capped at +2 (legacy item)', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Breastplate', ac: '14', armorStyle: 'medium' } } };
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 14 + 2); // capped, not +4
  });
  test('heavy armor: no Dex mod at all (legacy item)', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Plate Armor', ac: '18', armorStyle: 'heavy' } } };
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 18 + 0);
  });
  test('no armorStyle field (existing/not-yet-rebalanced item): unchanged prior behavior, full uncapped Dex', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Old-Style Plate', ac: '18' } } };
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 18 + 4); // no cap applied -- field absent, not zero
  });
  test('no body armor equipped: unaffected, base 10 + full Dex mod', () => {
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], {}, () => null, 10, 30);
    assert.equal(sheet.ac.total, 10 + 4);
  });
  test('canonical (already-migrated) heavy armor item: cap applies via armor.armorType, no migration re-run needed', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Plate Armor', __canonical: { armor: { armorType: 'heavy', baseAC: 18, additive: false } } } } };
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 18 + 0);
  });
  test('canonical medium armor item: capped at +2 via armor.armorType', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Breastplate', __canonical: { armor: { armorType: 'medium', baseAC: 14, additive: false } } } } };
    const sheet = GE.computeCharacterSheetFor(highDexScores, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 14 + 2);
  });
  test('effectiveDexModForArmorStyle directly: light/medium/heavy/null', () => {
    assert.equal(GE.effectiveDexModForArmorStyle('light', 4), 4);
    assert.equal(GE.effectiveDexModForArmorStyle('medium', 4), 2);
    assert.equal(GE.effectiveDexModForArmorStyle('medium', 1), 1); // below the cap, unaffected
    assert.equal(GE.effectiveDexModForArmorStyle('heavy', 4), 0);
    assert.equal(GE.effectiveDexModForArmorStyle(null, 4), 4);
  });
});

describe('computeCharacterSheetFor: text-driven Armor Class / Movement Speed (named traits, DM-attached modifiers)', () => {
  test('a "+N Armor Class" effect layers on top of the item\'s own .ac field rather than replacing it', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Vanguard\'s Plate', ac: '13', effect: '+2 Armor Class' } } };
    const sheet = GE.computeCharacterSheetFor({ dex: 10 }, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 15); // 13 base + 0 dex mod + 2 text bonus
    assert.equal(sheet.ac.status, 'buff');
  });
  test('a "-N Movement Speed" effect reduces total speed below the given base', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Vanguard\'s Plate', effect: '-10 Movement Speed' } } };
    const sheet = GE.computeCharacterSheetFor({}, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.speed.total, 20);
    assert.equal(sheet.speed.status, 'debuff');
  });
  test('"AC"/"Speed" short aliases resolve to the same canonical stats as the full names', () => {
    assert.deepEqual(GE.extractStatDeltasFromText('+1 AC and -5 Speed'), [
      { stat: 'Armor Class', amount: 1 },
      { stat: 'Movement Speed', amount: -5 },
    ]);
  });
  test('an active timed effect (a temporary buff) can also grant Armor Class/Movement Speed', () => {
    const sheet = GE.computeCharacterSheetFor({}, 1, [], [], {}, () => null, 10, 30, [{ name: 'Rune of Warding', text: '+1 Armor Class for 1 hour.' }]);
    assert.equal(sheet.ac.total, 11); // 10 base + 0 dex mod + 1 text bonus
  });
});

describe('migrated-item bridge: computeCharacterSheetFor reads a canonical `passive`/`armor` facet instead of regexing .effect/.ac', () => {
  test('canonicalPassiveDeltas maps ability/hp/speed/ac stat keys onto the same breakdown labels extractStatDeltasFromText produces', () => {
    const canonical = { passive: [{ stat: 'str', value: 2 }, { stat: 'hp_max', value: 5 }, { stat: 'speed', value: -10 }, { stat: 'ac', value: 1 }] };
    assert.deepEqual(GE.canonicalPassiveDeltas(canonical), [
      { stat: 'Strength', amount: 2 },
      { stat: 'Maximum Hit Points', amount: 5 },
      { stat: 'Movement Speed', amount: -10 },
      { stat: 'Armor Class', amount: 1 },
    ]);
  });
  test('canonicalPassiveDeltas passes an exact skill name through unchanged', () => {
    assert.deepEqual(GE.canonicalPassiveDeltas({ passive: [{ stat: 'Stealth', value: 3 }] }), [{ stat: 'Stealth', amount: 3 }]);
  });
  test('canonicalPassiveDeltas collapses all six save_<abbr> entries (how the migration always emits a "Saving Throws" bonus) into one "Saving Throws" source, not six', () => {
    const canonical = { passive: [{ stat: 'save_str', value: 1 }, { stat: 'save_dex', value: 1 }, { stat: 'save_con', value: 1 }, { stat: 'save_int', value: 1 }, { stat: 'save_wis', value: 1 }, { stat: 'save_cha', value: 1 }] };
    assert.deepEqual(GE.canonicalPassiveDeltas(canonical), [{ stat: 'Saving Throws', amount: 1 }]);
  });
  test('canonicalPassiveDeltas ignores attackRoll/damageRoll (a separate weapon-attack concern) and an incomplete save group', () => {
    const canonical = { passive: [{ stat: 'attackRoll', value: 1 }, { stat: 'damageRoll', value: 1 }, { stat: 'save_str', value: 1 }] };
    assert.deepEqual(GE.canonicalPassiveDeltas(canonical), []);
  });

  test('a migrated body-armor item (armor.additive absent) replaces the AC base exactly like an old unsigned .ac string would', () => {
    const slots = { armor: 'chestKey' };
    const items = { chestKey: { item: { name: 'Test Plate', __canonical: { armor: { baseAC: 16 } } } } };
    const sheet = GE.computeCharacterSheetFor({ dex: 10 }, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 16);
    assert.equal(sheet.ac.sources[0].itemName, 'Test Plate');
  });
  test('a migrated shield/accessory item (armor.additive true) stacks as a flat AC bonus, never replacing the base', () => {
    const slots = { armor: 'chestKey', ring1: 'shieldKey' };
    const items = {
      chestKey: { item: { name: 'Test Plate', __canonical: { armor: { baseAC: 16 } } } },
      shieldKey: { item: { name: 'Test Buckler', __canonical: { armor: { baseAC: 1, additive: true } } } },
    };
    const sheet = GE.computeCharacterSheetFor({ dex: 10 }, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 17); // 16 base + 1 additive, not replaced down to 1
  });
  test('a migrated item\'s canonical passive ability bonus flows into total/mod exactly like a legacy "+N Stat" effect would', () => {
    const slots = { ring1: 'ringKey' };
    const items = { ringKey: { item: { name: 'Test Ring', __canonical: { passive: [{ stat: 'str', value: 2 }] } } } };
    const sheet = GE.computeCharacterSheetFor({ str: 14 }, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.abilities.str.total, 16);
    assert.equal(sheet.abilities.str.mod, 3);
  });
  test('a migrated item ignores its own still-present legacy .effect/.ac text once __canonical is attached (no double-counting from both sources)', () => {
    const slots = { armor: 'chestKey' };
    // Legacy fields deliberately left on the item (as buildTokenIndex does in the live app) —
    // if the bridge read both the old text AND the new structured facet, this would double-count.
    const items = { chestKey: { item: { name: 'Test Plate', ac: '16', effect: '+4 Strength', __canonical: { armor: { baseAC: 16 }, passive: [{ stat: 'str', value: 2 }] } } } };
    const sheet = GE.computeCharacterSheetFor({ str: 14, dex: 10 }, 1, [], [], slots, k => items[k], 10, 30);
    assert.equal(sheet.ac.total, 16);
    assert.equal(sheet.abilities.str.total, 16); // +2 from canonical passive, not +4 from the stale .effect text
  });
});

describe('migrated-item bridge: canonicalWeaponAttackData (feeds computeWeaponAttackRoll in the monolith, not tested here directly — see game-engine.js\'s header comment on why the monolith stays outside this file)', () => {
  test('sums attackRoll/damageRoll passive mods and passes bonusDamage/finesse through from the weapon facet', () => {
    const canonical = {
      weapon: { damageDice: '1d8', bonusDamage: [{ dice: '2d6', type: 'fire' }], properties: ['finesse'] },
      passive: [{ stat: 'attackRoll', value: 1 }, { stat: 'damageRoll', value: 1 }],
    };
    assert.deepEqual(GE.canonicalWeaponAttackData(canonical), {
      damageDice: '1d8', atkBonus: 1, dmgBonus: 1,
      bonusDiceClauses: [{ dice: '2d6', type: 'fire' }],
      finesse: true,
    });
  });
  test('never double-counts: a weapon.dmg field embedding a "+1" (dungeon-master-box\'s own live bug) is not how a migrated item carries its bonus — damageDice is base dice only, the +1 lives solely in the damageRoll passive entry', () => {
    // This is the exact "Longsword +1" shape the migration itself reconciles (dmg:"1d8+1",
    // effect:"+1 to attack and damage rolls...") — by the time it's canonical, the dice string no
    // longer carries the modifier at all, so there is nothing left to double.
    const canonical = { weapon: { damageDice: '1d8' }, passive: [{ stat: 'attackRoll', value: 1 }, { stat: 'damageRoll', value: 1 }] };
    const bridged = GE.canonicalWeaponAttackData(canonical);
    assert.equal(bridged.damageDice, '1d8');
    assert.equal(bridged.dmgBonus, 1); // applied once, not baked into damageDice AND counted again
  });
  test('a weapon with no attackRoll/damageRoll/bonusDamage/finesse returns all-zero/empty defaults, not undefined', () => {
    assert.deepEqual(GE.canonicalWeaponAttackData({ weapon: { damageDice: '1d6' } }), {
      damageDice: '1d6', atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [], finesse: false,
    });
  });
  test('degrades gracefully (empty damageDice, no crash) for a canonical item with no weapon facet at all', () => {
    assert.deepEqual(GE.canonicalWeaponAttackData({ itemType: 'wondrous' }), {
      damageDice: '', atkBonus: 0, dmgBonus: 0, bonusDiceClauses: [], finesse: false,
    });
  });
});

describe('migrated-item bridge: canonicalConsumableHealDice (feeds applyHealFromItem in the monolith)', () => {
  test('returns the healDice string from a real heal-kind effect', () => {
    const canonical = { consumable: { effects: [{ kind: 'heal', healDice: '2d4+2' }] } };
    assert.equal(GE.canonicalConsumableHealDice(canonical), '2d4+2');
  });
  test('returns null for a utility-only placeholder (the common case — no structured heal effect)', () => {
    assert.equal(GE.canonicalConsumableHealDice({ consumable: { effects: [{ kind: 'utility' }] } }), null);
  });
  test('returns null for a consumable with no effects at all, and for a non-consumable canonical item', () => {
    assert.equal(GE.canonicalConsumableHealDice({ consumable: {} }), null);
    assert.equal(GE.canonicalConsumableHealDice({ itemType: 'weapon' }), null);
  });
});

describe('battle: parsing, damage, effectiveness', () => {
  test('parses to-hit, multiple damage clauses with types, and save DC', () => {
    const parsed = GE.battleParseAttack('Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 19 (2d10+8) piercing damage plus 11 (2d10) psychic damage. If the target is a creature, it must succeed on a DC 15 Constitution saving throw.');
    assert.equal(parsed.toHit, 7);
    assert.deepEqual(parsed.damageClauses, [{ dice: '2d10+8', type: 'piercing' }, { dice: '2d10', type: 'psychic' }]);
    assert.equal(parsed.saveDC, 15);
  });

  test('text with no attack numbers returns nulls/empty array', () => {
    assert.deepEqual(GE.battleParseAttack('A vague trait with no numbers.'), { toHit: null, damageClauses: [], saveDC: null });
  });

  test('deterministic rand produces predictable rolls and total', () => {
    const fixedRand = () => 0.5; // for d10: floor(0.5*10)+1 = 6 on every die
    const dmg = GE.battleRollDamage('2d10+8', false, fixedRand);
    assert.deepEqual(dmg, { rolls: [6, 6], mod: 8, total: 20 });
  });

  test('crit doubles the dice count and applies the flat modifier once', () => {
    const fixedRand = () => 0.5;
    const critDmg = GE.battleRollDamage('2d10+8', true, fixedRand);
    assert.equal(critDmg.rolls.length, 4);
    assert.equal(critDmg.total, 6 * 4 + 8);
  });

  test('effectiveness label boundaries', () => {
    assert.deepEqual(GE.battleEffectivenessLabel(20), { label: 'Devastating', cls: 'crit' });
    assert.deepEqual(GE.battleEffectivenessLabel(15), { label: 'Strong', cls: 'hit' });
    assert.deepEqual(GE.battleEffectivenessLabel(10), { label: 'Moderate', cls: 'hit' });
    assert.deepEqual(GE.battleEffectivenessLabel(2), { label: 'Weak', cls: 'miss' });
    assert.deepEqual(GE.battleEffectivenessLabel(1), { label: 'Critical Failure', cls: 'miss' });
  });
});

describe('gambling: roulette', () => {
  test('color lookups', () => {
    assert.equal(GE.rouletteColor(0), 'green');
    assert.equal(GE.rouletteColor(1), 'red');
    assert.equal(GE.rouletteColor(2), 'black');
  });

  test('multiplier table', () => {
    assert.equal(GE.rouletteMultiplier({ betType: 'straight', betValue: 17 }, 17), 36);
    assert.equal(GE.rouletteMultiplier({ betType: 'straight', betValue: 17 }, 18), 0);
    assert.equal(GE.rouletteMultiplier({ betType: 'red' }, 1), 2);
    assert.equal(GE.rouletteMultiplier({ betType: 'dozen1' }, 12), 3);
  });

  test('applyRouletteAction: place_bet records a bet; a second bet from the same player is ignored', () => {
    const table = GE.newRouletteTable();
    GE.applyRouletteAction(table, { type: 'place_bet', playerUid: 'p1', playerUsername: 'Alice', amount: 100, betType: 'red', betValue: null });
    assert.deepEqual(Object.keys(table.bets), ['p1']);
    GE.applyRouletteAction(table, { type: 'place_bet', playerUid: 'p1', playerUsername: 'Alice', amount: 50, betType: 'black', betValue: null });
    assert.equal(table.bets.p1.amount, 100);
  });

  test('resolveRouletteSpin: deterministic rand, phase/bets update', () => {
    const table = GE.newRouletteTable();
    GE.applyRouletteAction(table, { type: 'place_bet', playerUid: 'p1', playerUsername: 'Alice', amount: 100, betType: 'red', betValue: null });
    const spun = GE.resolveRouletteSpin(table, () => 0);
    assert.equal(spun.lastResult.number, GE.ROULETTE_WHEEL_ORDER[0]);
    assert.equal(spun.phase, 'result');
    assert.deepEqual(spun.bets, {});
  });
});

describe('gambling: blackjack', () => {
  test('hand value, including soft-ace adjustment and bust', () => {
    assert.equal(GE.blackjackHandValue([{ r: 'A', s: '♠' }, { r: 'K', s: '♥' }]), 21);
    assert.equal(GE.blackjackHandValue([{ r: 'A', s: '♠' }, { r: 'A', s: '♥' }, { r: '9', s: '♦' }]), 21);
    assert.equal(GE.blackjackHandValue([{ r: '10', s: '♠' }, { r: '9', s: '♥' }, { r: '5', s: '♦' }]), 24);
  });

  test('natural blackjack requires exactly 2 cards totaling 21', () => {
    assert.ok(GE.isBlackjackHand([{ r: 'A', s: '♠' }, { r: 'K', s: '♥' }]));
    assert.ok(!GE.isBlackjackHand([{ r: 'A', s: '♠' }, { r: 'A', s: '♥' }, { r: '9', s: '♦' }]));
  });

  test('resolveBlackjackDealerPlay: dealer AI + win/lose/push/blackjack outcomes', () => {
    const table = GE.newBlackjackTable();
    table.players = {
      p1: { username: 'Win', bet: 100, hand: [{ r: '10', s: '♠' }, { r: '9', s: '♥' }], status: 'stand' }, // 19
      p2: { username: 'Bust', bet: 50, hand: [{ r: '10', s: '♠' }, { r: '9', s: '♥' }, { r: '5', s: '♦' }], status: 'bust' }, // 24
      p3: { username: 'BJ', bet: 20, hand: [{ r: 'A', s: '♠' }, { r: 'K', s: '♥' }], status: 'blackjack' },
    };
    table.dealerHand = [{ r: '10', s: '♣' }, { r: '7', s: '♦' }]; // 17 — dealer stands, no draw needed
    table.deck = [];
    const resolved = GE.resolveBlackjackDealerPlay(table);
    assert.equal(resolved.lastResult.dealerTotal, 17);
    assert.equal(resolved.lastResult.outcomes.p1.result, 'win');
    assert.equal(resolved.lastResult.outcomes.p2.result, 'lose');
    assert.equal(resolved.lastResult.outcomes.p3.result, 'blackjack');
    assert.equal(resolved.lastResult.payouts.p1, 200);   // win pays 2x
    assert.equal(resolved.lastResult.payouts.p3, 50);    // blackjack pays 2.5x
    assert.ok(!('p2' in resolved.lastResult.payouts));   // bust: no payout entry
  });
});

describe('gambling: slots', () => {
  test('applySlotsAction: deterministic rand always picks the first symbol -> triple match', () => {
    const table = GE.newSlotsTable();
    GE.applySlotsAction(table, { type: 'spin', playerUid: 'p1', playerUsername: 'Alice', amount: 10 }, () => 0);
    assert.deepEqual(table.results[0].reels, ['potion', 'potion', 'potion']);
    assert.equal(table.results[0].mult, 3);
    assert.equal(table.results[0].payouts.p1, 30);
  });
});

describe('gambling: poker', () => {
  test('hand evaluation across rank tiers', () => {
    assert.equal(GE.evaluatePokerHand([{ r: '10', s: '♠' }, { r: 'J', s: '♠' }, { r: 'Q', s: '♠' }, { r: 'K', s: '♠' }, { r: 'A', s: '♠' }]).rank, 'royalFlush');
    assert.equal(GE.evaluatePokerHand([{ r: 'A', s: '♠' }, { r: '2', s: '♥' }, { r: '3', s: '♦' }, { r: '4', s: '♣' }, { r: '5', s: '♠' }]).rank, 'straight'); // wheel
    assert.equal(GE.evaluatePokerHand([{ r: 'K', s: '♠' }, { r: 'K', s: '♥' }, { r: 'K', s: '♦' }, { r: '2', s: '♣' }, { r: '2', s: '♠' }]).rank, 'fullHouse');
    assert.equal(GE.evaluatePokerHand([{ r: 'J', s: '♠' }, { r: 'J', s: '♥' }, { r: '2', s: '♦' }, { r: '5', s: '♣' }, { r: '9', s: '♠' }]).rank, 'jacksOrBetter');
    assert.equal(GE.evaluatePokerHand([{ r: '9', s: '♠' }, { r: '9', s: '♥' }, { r: '2', s: '♦' }, { r: '5', s: '♣' }, { r: 'J', s: '♠' }]).rank, 'lowPair');
  });

  test('applyPokerAction: deal gives 5 cards; holding all 5 on draw keeps the same hand', () => {
    const table = GE.newPokerTable();
    GE.applyPokerAction(table, { type: 'deal', playerUid: 'p1', playerUsername: 'Alice', amount: 10 }, () => 0.999);
    assert.equal(table.hands.p1.hand.length, 5);
    const beforeDraw = table.hands.p1.hand.slice();
    GE.applyPokerAction(table, { type: 'draw', playerUid: 'p1', heldIndexes: [0, 1, 2, 3, 4] }, () => 0.999);
    assert.deepEqual(table.results[0].hand, beforeDraw);
    assert.ok(!table.hands.p1); // in-progress hand cleared once resolved
  });
});

describe('wearable vs unwearable monster parts', () => {
  test('a Claw is a wearable Fleshmancer part; a Venom Sac and a Bone are not', () => {
    const claw = { name: "Wolf's Claw", type: 'craftable', subcategory: 'monsterpart', partType: 'claw' };
    const venomsac = { name: "Serpent's Venom Sac", type: 'craftable', subcategory: 'monsterpart', partType: 'venomsac' };
    const bone = { name: "Giant's Bone", type: 'craftable', subcategory: 'monsterpart', partType: 'bone' };
    GE.classifyItemFull(claw, 'common'); GE.classifyItemFull(venomsac, 'common'); GE.classifyItemFull(bone, 'common');
    assert.ok(GE.canInteract(claw, 'fleshmancer_input'));
    assert.ok(GE.canInteract(claw, 'wearable_part'));
    assert.ok(!GE.canInteract(claw, 'unwearable_part'));
    assert.ok(GE.canInteract(venomsac, 'fleshmancer_input')); // still usable in the Fleshmancer...
    assert.ok(!GE.canInteract(venomsac, 'wearable_part'));    // ...just not as a worn graft
    assert.ok(GE.canInteract(venomsac, 'unwearable_part'));
    assert.ok(GE.canInteract(bone, 'unwearable_part'));
    assert.ok(!GE.canInteract(bone, 'wearable_part'));
  });
});

describe('long rest / "Simulate a Day"', () => {
  test('isPerDayCharge recognizes /day and per-long-rest phrasing, not a flat "1 use" or "7"', () => {
    assert.ok(GE.isPerDayCharge('3/day'));
    assert.ok(GE.isPerDayCharge('1d4+1/day'));
    assert.ok(GE.isPerDayCharge('Sunbeam 1/day; Call the Dawn 1/day'));
    assert.ok(GE.isPerDayCharge('1x per long rest'));
    assert.ok(!GE.isPerDayCharge('1 use'));
    assert.ok(!GE.isPerDayCharge('7'));
    assert.ok(!GE.isPerDayCharge(''));
  });

  test('refillDailyItemCharges resets a flat "/day" item back to its pristine chargesFormat', () => {
    const wand = { name: 'Wand of Sparks', charges: '0/day', chargesFormat: '3/day' };
    GE.refillDailyItemCharges(wand);
    assert.equal(wand.charges, '3/day');
  });

  test('refillDailyItemCharges re-rolls a dice-based "/day" template rather than reusing a stale roll', () => {
    const item = { name: 'Beads of Fury', charges: '0/day', chargesFormat: '1d4+1/day' };
    GE.refillDailyItemCharges(item, () => 0.999); // rolls the die at its max
    assert.equal(item.charges, '5/day'); // 1d4 maxes at 4, +1
  });

  test('refillDailyItemCharges leaves a non-per-day item untouched even if it has charges left', () => {
    const potion = { name: 'Healing Potion', charges: '1 use' };
    GE.refillDailyItemCharges(potion);
    assert.equal(potion.charges, '1 use');
  });

  test('refillDailyItemCharges infers chargesFormat from the current charges the first time (no prior template)', () => {
    const item = { name: 'Rod of Fire', charges: '2/day' }; // never decremented yet, no chargesFormat
    GE.refillDailyItemCharges(item);
    assert.equal(item.charges, '2/day');
    assert.equal(item.chargesFormat, '2/day');
  });

  test('applyLongRestToPlayerState: full HP, cleared effects, and only per-day charges recharge', () => {
    const state = {
      characterCurrentHp: 4, characterMaxHp: 20, characterMaxHpEffective: 25,
      activeTimedEffects: [{ id: 'a1', name: 'Haste' }],
      deathSaveSuccesses: 2, deathSaveFailures: 1,
      savedGeneratedItems: [
        { id: 'g1', charges: '0/day', chargesFormat: '2/day' },
        { id: 'g2', charges: '0', chargesFormat: '1 use' },
      ],
      characterClass: 'Wizard', // untouched fields should survive
    };
    const rested = GE.applyLongRestToPlayerState(state);
    assert.equal(rested.characterCurrentHp, 25); // effective max, not the raw base
    assert.deepEqual(rested.activeTimedEffects, []);
    assert.equal(rested.deathSaveSuccesses, 0);
    assert.equal(rested.deathSaveFailures, 0);
    assert.equal(rested.savedGeneratedItems.find(i => i.id === 'g1').charges, '2/day');
    assert.equal(rested.savedGeneratedItems.find(i => i.id === 'g2').charges, '0'); // 1-use item stays spent
    assert.equal(rested.characterClass, 'Wizard');
    // The input state itself is never mutated — a fresh object comes back.
    assert.equal(state.characterCurrentHp, 4);
  });

  test('applyLongRestToPlayerState falls back to characterMaxHp when no effective max is recorded', () => {
    const rested = GE.applyLongRestToPlayerState({ characterCurrentHp: 1, characterMaxHp: 12 });
    assert.equal(rested.characterCurrentHp, 12);
  });
});

describe('applyItemEffectToState', () => {
  test('rolls item.hp and heals, clamped to the effective max', () => {
    const state = { characterCurrentHp: 3, characterMaxHpEffective: 10 };
    const potion = { name: 'Potion of Healing', hp: '2d4+2' };
    const next = GE.applyItemEffectToState(state, potion, () => 0); // lowest possible roll: 1+1+2=4
    assert.equal(next.characterCurrentHp, 7);
    assert.equal(state.characterCurrentHp, 3); // input state untouched
  });

  test('clamps healing at the effective max instead of overhealing', () => {
    const state = { characterCurrentHp: 9, characterMaxHpEffective: 10 };
    const potion = { name: 'Potion of Healing', hp: '2d4+2' };
    const next = GE.applyItemEffectToState(state, potion, () => 0.99); // highest roll: 4+4+2=10
    assert.equal(next.characterCurrentHp, 10);
  });

  test('a sub-day duration ("for 10 minutes") starts a normal expiring timed effect', () => {
    const state = { characterCurrentHp: 10, activeTimedEffects: [] };
    const item = { name: 'Potion of Giant Strength', effect: '+4 Strength for 10 minutes.' };
    const next = GE.applyItemEffectToState(state, item);
    assert.equal(next.activeTimedEffects.length, 1);
    const effect = next.activeTimedEffects[0];
    assert.equal(effect.permanent, false);
    assert.equal(effect.durationMs, 10 * 60 * 1000);
    assert.ok(effect.expiresAt > Date.now());
    assert.equal(effect.text, '+4 Strength for 10 minutes.');
  });

  test('a day-or-longer duration ("for 7 days") is flagged permanent instead of getting a wall-clock expiry', () => {
    const state = { characterCurrentHp: 10, activeTimedEffects: [] };
    const item = { name: 'Ointment of Insight', effect: '+1 Insight for 7 days.' };
    const next = GE.applyItemEffectToState(state, item);
    assert.equal(next.activeTimedEffects.length, 1);
    const effect = next.activeTimedEffects[0];
    assert.equal(effect.permanent, true);
    assert.equal(effect.durationMs, undefined);
    assert.equal(effect.expiresAt, undefined);
  });

  test('an item with no duration/heal text is a no-op on activeTimedEffects', () => {
    const state = { characterCurrentHp: 10, activeTimedEffects: [{ id: 'a1' }] };
    const item = { name: 'Plain Rock', effect: 'It is a rock.' };
    const next = GE.applyItemEffectToState(state, item);
    assert.deepEqual(next.activeTimedEffects, [{ id: 'a1' }]);
    assert.equal(next.characterCurrentHp, 10);
  });
});

describe('applyTrapEffectToState', () => {
  const trap = { name: 'Sundering Pendulum', damage: '6d10', condition: null, conditionDuration: null };

  test('a failed save deals full rolled damage, clamped at 0', () => {
    const state = { characterCurrentHp: 10 };
    const next = GE.applyTrapEffectToState(state, trap, false, () => 0.99); // max roll: 60
    assert.equal(next.characterCurrentHp, 0);
    assert.equal(state.characterCurrentHp, 10); // input state untouched
  });

  test('a successful save halves the damage', () => {
    const state = { characterCurrentHp: 50 };
    // 6d10 at rand()=0 rolls all 1s -> 6 total; halved -> 3
    const next = GE.applyTrapEffectToState(state, trap, true, () => 0);
    assert.equal(next.characterCurrentHp, 47);
  });

  test('a failed save against a conditional trap adds a timed-effect entry with sub-day duration', () => {
    const gasTrap = { name: 'Sablesting Cloud Vent', damage: '2d8', condition: 'Poisoned', conditionDuration: '10 minutes' };
    const state = { characterCurrentHp: 20, activeTimedEffects: [] };
    const next = GE.applyTrapEffectToState(state, gasTrap, false, () => 0);
    assert.equal(next.activeTimedEffects.length, 1);
    const effect = next.activeTimedEffects[0];
    assert.equal(effect.permanent, false);
    assert.equal(effect.durationMs, 10 * 60 * 1000);
    assert.match(effect.text, /Poisoned/);
  });

  test('a successful save against a conditional trap skips the condition entirely', () => {
    const gasTrap = { name: 'Sablesting Cloud Vent', damage: '2d8', condition: 'Poisoned', conditionDuration: '10 minutes' };
    const state = { characterCurrentHp: 20, activeTimedEffects: [] };
    const next = GE.applyTrapEffectToState(state, gasTrap, true, () => 0);
    assert.deepEqual(next.activeTimedEffects, []);
  });

  test('a condition with no parseable duration ("until cured") is flagged permanent', () => {
    const netTrap = { name: 'Gravebind Snare', damage: null, condition: 'Restrained', conditionDuration: 'until cured' };
    const state = { characterCurrentHp: 20, activeTimedEffects: [] };
    const next = GE.applyTrapEffectToState(state, netTrap, false, () => 0);
    const effect = next.activeTimedEffects[0];
    assert.equal(effect.permanent, true);
    assert.equal(effect.durationMs, undefined);
  });

  test('a trap with neither damage nor condition (a pure alarm) is a complete no-op', () => {
    const alarmTrap = { name: 'Screaming Ward Glyph', damage: null, condition: null, conditionDuration: null };
    const state = { characterCurrentHp: 20, activeTimedEffects: [] };
    const next = GE.applyTrapEffectToState(state, alarmTrap, false, () => 0);
    assert.equal(next.characterCurrentHp, 20);
    assert.deepEqual(next.activeTimedEffects, []);
  });
});

describe('deriveItemProperties/deriveItemTags — word-boundary regression guard', () => {
  // Found via a direct audit (a "Tattered Treasure Map" with "edges burnt" in its description
  // earned a Fire badge purely because "burn" is a substring of "burnt"). A full catalog scan
  // found the same bug class elsewhere: bare "ice"/"king"/"elder"/"toxic" matching fragments of
  // unrelated words. Fixed with word boundaries where a real bug was confirmed (royal: 109
  // false positives across the catalog, cold: 77, ancient: 13, poison: 1); left bare where
  // audited and found correct (lightning/necrotic/radiant, and dragon/ancient's own root words,
  // including compound names like "Dragonhide"/"Dragonlance" that a strict \bdragon\b boundary
  // would have wrongly excluded).
  test('a burnt/charred physical description no longer earns a Fire badge', () => {
    const map = { name: 'Tattered Treasure Map', desc: 'A hand-drawn map, edges burnt, marking an X in a location that may or may not still be accurate.', type: 'document', effect: "Marks the location of a specific cache of treasure." };
    assert.deepEqual(GE.deriveItemProperties(map, 'uncommon'), []);
  });
  test('"marking"/"cooking"/"working"/"drinking" no longer earn the royal tag (bare "king" substring)', () => {
    ['marking', 'cooking', 'working', 'drinking'].forEach(word => {
      const item = { name: `Item for ${word}`, desc: `Used for ${word} things.` };
      const props = GE.deriveItemProperties(item);
      assert.ok(!GE.deriveItemTags(item, [], props).includes('royal'), `"${word}" should not trigger royal`);
    });
  });
  test('"service"/"device"/"dice"/"twice" no longer earn a Cold badge (bare "ice" substring)', () => {
    ['serviceable', 'device', 'dice', 'twice'].forEach(word => {
      const item = { name: `Item`, desc: `A thing described as ${word}.` };
      assert.ok(!GE.deriveItemProperties(item).includes('Cold'), `"${word}" should not trigger Cold`);
    });
  });
  test('"wielder" no longer earns the ancient tag (bare "elder" substring)', () => {
    const item = { name: 'Some Weapon', desc: 'Heals the wielder for half that amount.' };
    const props = GE.deriveItemProperties(item);
    assert.ok(!GE.deriveItemTags(item, [], props).includes('ancient'));
  });
  test('"intoxicating" no longer earns a Poison badge (bare "toxic" substring)', () => {
    const tankard = { name: 'Tankard of Sobriety', desc: 'A plain clay tankard.', effect: 'Produces no intoxicating effect.' };
    assert.ok(!GE.deriveItemProperties(tankard).includes('Poison'));
  });
  test('true positives still work: real fire/poison/royal/ancient mentions are still tagged', () => {
    const torch = { name: 'Torch', effect: 'Burns for about an hour and casts bright light.' };
    assert.ok(GE.deriveItemProperties(torch).includes('Fire'));
    const antitoxin = { name: 'Vial of Antitoxin', effect: 'Neutralizes common poisons.' };
    assert.ok(GE.deriveItemProperties(antitoxin).includes('Poison'));
    const crown = { name: 'Royal Seal', desc: 'Bears the mark of the king.' };
    const crownProps = GE.deriveItemProperties(crown);
    assert.ok(GE.deriveItemTags(crown, [], crownProps).includes('royal'));
    const relic = { name: 'Elder Rune', desc: 'An ancient relic.' };
    const relicProps = GE.deriveItemProperties(relic);
    assert.ok(GE.deriveItemTags(relic, [], relicProps).includes('ancient'));
    const lance = { name: 'Dragonlance', desc: 'A lance forged to slay dragons.' };
    const lanceProps = GE.deriveItemProperties(lance);
    assert.ok(GE.deriveItemTags(lance, [], lanceProps).includes('dragon'));
  });
});

describe('weapon stat scaling', () => {
  const mods = { str: 3, dex: 1, con: 0, int: -1, wis: 0, cha: 0 };
  const w = (name, extra = {}) => ({ name, type: 'weapon', slotSize: 1, ...extra });

  test('defaults come from the weapon kind, found by name keywords (not just the breadcrumb)', () => {
    assert.equal(GE.weaponScalingKind(w('Oaken Handaxe')), 'axe');
    assert.equal(GE.weaponScalingKind(w('Iron Warhammer')), 'hammer');
    assert.equal(GE.weaponScalingKind(w('Kukri of the Verdant')), 'dagger');
    assert.equal(GE.weaponScalingKind(w('Steel Quarterstaff')), 'quarterstaff');
    assert.equal(GE.weaponScalingKind(w('Thunderbolt Mace')), 'hammer'); // "bolt" in a name is not a bow
    assert.deepEqual(GE.inferWeaponScaling(w('Iron Longsword')), { str: 'B', dex: 'D' });
    assert.deepEqual(GE.inferWeaponScaling(w('Mithral Dagger')), { dex: 'B', str: 'D' });
    assert.deepEqual(GE.inferWeaponScaling(w('Shortbow')), { dex: 'A', str: 'E' });
  });

  test('a named unique falls back to the weapon its description names, then to hands', () => {
    assert.equal(GE.weaponScalingKind(w('Frosthowl', { desc: 'A greatsword of blue-white steel.' })), 'greatweapon');
    assert.equal(GE.weaponScalingKind(w('Mystery', { slotSize: 2 })), 'twohanded');
    assert.equal(GE.weaponScalingKind(w('Mystery')), 'onehanded');
  });

  test('rarity lifts grades: Super Rare the main stat, Legendary/Celestial the best two', () => {
    assert.deepEqual(GE.inferWeaponScaling(w('Greataxe'), 'superrare'), { str: 'S', dex: 'E' });
    assert.deepEqual(GE.inferWeaponScaling(w('Greataxe'), 'legendary'), { str: 'S', dex: 'D' });
    assert.deepEqual(GE.inferWeaponScaling(w('Greataxe'), 'rare'), { str: 'A', dex: 'E' });
  });

  test('authored scaling wins, and invalid entries are dropped', () => {
    const s = GE.inferWeaponScaling(w('Longsword', { scaling: { str: 'a', int: 'S', cha: 'Z', luck: 'S' } }), 'legendary');
    assert.deepEqual(s, { str: 'A', int: 'S' });
  });

  test('a finesse weapon is at least DEX B', () => {
    assert.equal(GE.inferWeaponScaling(w('Longsword', { effect: 'Finesse.' })).dex, 'B');
  });

  test('scaling damage: multiplier x modifier, rounded; only the primary stat can go negative', () => {
    assert.equal(GE.computeScalingDamage({ str: 'B', dex: 'D' }, mods).total, 3);   // 2.25 + 0.25 = 2.5 -> 3
    assert.equal(GE.computeScalingDamage({ dex: 'B', str: 'D' }, mods).total, 2);   // 0.75 + 0.75 = 1.5 -> 2
    assert.equal(GE.computeScalingDamage({ str: 'A', dex: 'E' }, { ...mods, str: -2 }).total, -2); // primary hurts
    assert.equal(GE.computeScalingDamage({ str: 'A', int: 'B' }, { ...mods, int: -3 }).total, 3); // primary STR A=3; a secondary INT can't subtract
    assert.equal(GE.computeScalingDamage({ str: 'B', int: 'A' }, { ...mods, int: -3 }).total, -1); // INT is the primary here, so its penalty counts
    const parts = GE.computeScalingDamage({ str: 'B', dex: 'D' }, mods).parts;
    assert.deepEqual(parts.map(p => p.stat), ['str', 'dex']);
    assert.equal(parts[0].primary, true);
  });

  test('to-hit uses the best Str/Dex among stats graded C or better; ranged weapons use DEX', () => {
    assert.deepEqual(GE.weaponToHitStat({ str: 'B', dex: 'D' }, mods), { stat: 'str', mod: 3 });
    assert.deepEqual(GE.weaponToHitStat({ dex: 'B', str: 'D' }, mods), { stat: 'dex', mod: 1 });
    assert.deepEqual(GE.weaponToHitStat({ str: 'C', dex: 'C' }, { ...mods, dex: 4 }), { stat: 'dex', mod: 4 });
    assert.deepEqual(GE.weaponToHitStat({ dex: 'A', str: 'E' }, { str: 5, dex: 0 }), { stat: 'dex', mod: 0 });
  });

  test('spell focus: only staves/wands that deal with spells, stat from attunement classes', () => {
    assert.equal(GE.isSpellFocusWeapon(w('Steel Quarterstaff', { effect: '+1 to attack and damage rolls.' })), false);
    assert.equal(GE.isSpellFocusWeapon(w('Wand Blade of Fortune', { effect: 'Cast a spell.' })), false);
    const staff = w('Staff of Healing', { effect: '10 charges. Cure Wounds (1). Requires attunement by a cleric or druid.', rarity: 'rare' });
    assert.equal(GE.isSpellFocusWeapon(staff), true);
    const f = GE.inferSpellFocus(staff);
    assert.equal(f.stat, 'wis');
    assert.equal(f.grade, 'B');
    assert.ok(['damage', 'attack', 'both'].includes(f.buff));
    assert.deepEqual(GE.inferSpellFocus(staff), f); // stable for the same staff
  });

  test('spell focus buff comes from the staff itself when it says so', () => {
    const sharp = w('Staff of Sight', { effect: '5 charges. Cast Detect Magic. +3 to spell attack rolls.', rarity: 'rare' });
    assert.deepEqual(GE.inferSpellFocus(sharp), { stat: 'int', grade: 'B', buff: 'attack', attackBonus: 3 });
    const authored = w('Odd Staff', { effect: 'spells', spellFocus: { stat: 'cha', grade: 'A', buff: 'damage' } });
    assert.deepEqual(GE.inferSpellFocus(authored, 'common'), { stat: 'cha', grade: 'A', buff: 'damage', attackBonus: 1 });
  });

  test('spell focus bonus: damage scales with the stat, attack is flat, "both" splits them', () => {
    const m = { int: 4, wis: 0, cha: 0 };
    assert.deepEqual(GE.computeSpellFocusBonus({ stat: 'int', grade: 'A', buff: 'damage', attackBonus: 2 }, m), { damage: 4, attack: 0 });
    assert.deepEqual(GE.computeSpellFocusBonus({ stat: 'int', grade: 'A', buff: 'attack', attackBonus: 2 }, m), { damage: 0, attack: 2 });
    assert.deepEqual(GE.computeSpellFocusBonus({ stat: 'int', grade: 'A', buff: 'both', attackBonus: 3 }, m), { damage: 2, attack: 2 });
    assert.deepEqual(GE.computeSpellFocusBonus({ stat: 'int', grade: 'A', buff: 'damage', attackBonus: 2 }, { int: -2 }), { damage: 0, attack: 0 });
  });

  test('every weapon in the real catalog resolves to a valid scaling', async () => {
    const fs = await import('node:fs');
    const lootData = new Function(fs.readFileSync(new URL('./loot-data.js', import.meta.url), 'utf8') + '; return lootData')();
    let n = 0;
    for (const [rarity, items] of Object.entries(lootData)) {
      for (const item of items.filter(i => i.type === 'weapon')) {
        const s = GE.inferWeaponScaling(item, rarity);
        assert.ok(Object.keys(s).length >= 1, item.name);
        Object.entries(s).forEach(([stat, g]) => { assert.ok(GE.SCALING_STATS.includes(stat) && GE.SCALING_GRADE_MULT[g] != null, `${item.name}: ${stat} ${g}`); });
        n++;
      }
    }
    assert.ok(n > 300);
  });
});

describe('weapon proficiency', () => {
  const w = name => ({ name, type: 'weapon' });
  test('weapon names map to a base weapon and its simple/martial category', () => {
    assert.deepEqual(GE.weaponProficiencyInfo(w('Iron Battleaxe of the Deep Frost')), { id: 'battleaxe', label: 'Battleaxe', category: 'martial' });
    assert.equal(GE.weaponProficiencyInfo(w('Oaken Handaxe')).category, 'simple');
    assert.equal(GE.weaponProficiencyInfo(w('Mithral Dagger')).id, 'dagger');
    assert.equal(GE.weaponProficiencyInfo(w('Steel Quarterstaff')).category, 'simple');
    assert.equal(GE.weaponProficiencyInfo(w('Thornmaul')).category, 'martial');
    assert.equal(GE.weaponProficiencyInfo(w('Frosthowl')).category, 'martial');      // unknown custom weapon = martial
    assert.equal(GE.weaponProficiencyInfo(w('Wyvern Claw')).category, 'natural');
    assert.equal(GE.weaponProficiencyInfo({ name: 'Frosthowl', weaponCategory: 'simple' }).category, 'simple');
  });

  test('class tables: Artificer is simple-only; Fighter both; Wizard a short list; multiclass unions', () => {
    const art = GE.classWeaponProficiencies('Artificer');
    assert.deepEqual([...art.categories], ['simple']);
    assert.deepEqual([...GE.classWeaponProficiencies('fighter').categories].sort(), ['martial', 'simple']);
    assert.ok(GE.classWeaponProficiencies('Wizard').weapons.has('light crossbow'));
    const multi = GE.classWeaponProficiencies('Rogue / Wizard');
    assert.deepEqual(multi.classes, ['rogue', 'wizard']);
    assert.ok(multi.categories.has('simple') && multi.weapons.has('rapier') && multi.weapons.has('sling'));
    assert.equal(GE.classWeaponProficiencies('Gunslinger').classes.length, 0);
  });

  test('gear/feat text grants: categories, all weapons, and named weapon types', () => {
    assert.deepEqual(GE.parseWeaponProficiencyGrants('Proficiency with longbows and shortbows. +2 to ranged attack rolls.'), { all: false, categories: [], weapons: ['longbow', 'shortbow'] });
    assert.deepEqual(GE.parseWeaponProficiencyGrants('You gain proficiency with martial weapons.'), { all: false, categories: ['martial'], weapons: [] });
    assert.equal(GE.parseWeaponProficiencyGrants('Proficient with all weapons while worn.').all, true);
    assert.deepEqual(GE.parseWeaponProficiencyGrants('Proficiency with a cartographer\'s tools lets you map.'), { all: false, categories: [], weapons: [] });
    assert.deepEqual(GE.parseWeaponProficiencyGrants('+1 to AC. Requires attunement by a creature proficient with shields.'), { all: false, categories: [], weapons: [] });
  });

  test('the check: class first, then manual, then gear; unproficient otherwise', () => {
    const axe = { name: 'Iron Battleaxe of the Deep Frost', type: 'weapon' };
    const dag = { name: 'Dagger', type: 'weapon' };
    const art = GE.weaponProficiencyCheck(axe, { classText: 'Artificer' });
    assert.equal(art.proficient, false);
    assert.equal(art.via, 'none');
    assert.equal(GE.weaponProficiencyCheck(dag, { classText: 'Artificer' }).via, 'class');
    assert.equal(GE.weaponProficiencyCheck(axe, { classText: 'Artificer', manual: { weapons: ['battleaxe'] } }).via, 'manual');
    assert.equal(GE.weaponProficiencyCheck(axe, { classText: 'Artificer', manual: { categories: ['martial'] } }).proficient, true);
    const withGear = GE.weaponProficiencyCheck(axe, { classText: 'Artificer', grants: [{ source: 'Gauntlets of Might', categories: ['martial'] }] });
    assert.deepEqual([withGear.proficient, withGear.via, withGear.source], [true, 'gear', 'Gauntlets of Might']);
    const bow = GE.weaponProficiencyCheck({ name: 'Longbow', type: 'weapon' }, { classText: 'Artificer', grants: [{ source: 'Bracers of Archery', weapons: ['longbow', 'shortbow'] }] });
    assert.equal(bow.proficient, true);
  });

  test('an unset sheet is proficient with nothing (natural weapons aside)', () => {
    const r = GE.weaponProficiencyCheck({ name: 'Greataxe', type: 'weapon' }, { classText: '' });
    assert.deepEqual([r.proficient, r.via], [false, 'none']);
    assert.equal(GE.weaponProficiencyCheck({ name: 'Greataxe', type: 'weapon' }, { classText: '', manual: { weapons: ['dagger'] } }).proficient, false);
    assert.equal(GE.weaponProficiencyCheck({ name: 'Wyvern Claw', type: 'weapon' }, { classText: 'Wizard' }).via, 'natural');
  });
});

describe('generated-item effects reach the character sheet', () => {
  const gen = {
    name: 'Wise Handaxe of Storm', rarity: 'rare', type: 'weapon',
    mods: [
      { type: 'Affix', key: 'affix:Wise', text: '+2 Wisdom.' },
      { type: 'Trait', key: 'trait:Bloody', text: '<strong>Bloody</strong>: +2 Strength, -1 Armor Class' },
      { type: 'Debuff', key: 'debuff:Initiative', text: 'While attuned, the bearer suffers <strong>-1 Initiative</strong>.' },
      { type: 'Skill', key: 'skill:Stealth', text: 'Grants exceptional aptitude in <strong>Stealth</strong>, providing a <strong>+3</strong> bonus to related checks.' },
      { type: 'Buff', key: 'buff:Charisma', text: 'Grants <strong>+3 Charisma</strong> to <strong>the bearer</strong> for <strong>1 hour</strong> (<strong>1× per day</strong>).' },
      { type: 'Power/Spell', key: 'power:Fly', text: 'Grants the ability to cast <strong>Fly</strong> (<strong>1× per day</strong>).' },
    ],
  };
  test('only passive mods become sheet text; activated ones stay on the ability bar', () => {
    const t = GE.itemMechanicsText(gen);
    assert.match(t, /\+2 Wisdom/);
    assert.match(t, /\+3 Stealth/);
    assert.doesNotMatch(t, /Charisma/);
    assert.doesNotMatch(t, /Fly/);
  });
  test('a catalog item keeps using its own effect text', () => {
    assert.equal(GE.itemMechanicsText({ effect: '+1 AC', mods: [{ type: 'Power/Spell', text: 'cast Fly, +9 Strength' }] }), '+1 AC');
    assert.equal(GE.itemMechanicsText({ effect: 'Infused with a Talon: x', mods: [{ type: 'Affix', text: '+2 Wisdom.' }] }), 'Infused with a Talon: x +2 Wisdom.');
  });
  test('equipping it changes the sheet: abilities, AC, skills and other stats', () => {
    const sheet = GE.computeCharacterSheetFor({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, 1, [], [], { charm1: 'k' }, () => ({ item: gen, rarity: 'rare' }), 10, 30, []);
    assert.equal(sheet.abilities.wis.bonus, 2);
    assert.equal(sheet.abilities.str.bonus, 2);
    assert.equal(sheet.abilities.cha.bonus, 0);
    assert.equal(sheet.ac.total, 10 - 1);
    assert.equal(sheet.skills.Stealth.total, 0 + 3);
    assert.equal(sheet.otherStats.Initiative.total, -1);
  });
  test('extra stats parse, including ones whose name ends in a parenthesis', () => {
    const d = GE.extractStatDeltasFromText('+2 Initiative. +1 Spell Save DC. +30 Fly Speed (feet). +50 Carrying Capacity (lbs).');
    assert.deepEqual(d.map(x => x.stat), ['Initiative', 'Spell Save DC', 'Fly Speed (feet)', 'Carrying Capacity (lbs)']);
  });
});
