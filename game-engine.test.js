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
  test('proficiency bonus scales with level', () => {
    assert.equal(sheet.profBonus, 3); // level 5 -> +3
  });
  test('save total = mod + prof (if proficient) + flat bonus sources', () => {
    assert.equal(sheet.saves.dex.total, sheet.abilities.dex.mod + 3 + 1);
  });
  test('skill total = ability mod + prof (if proficient) + direct sources', () => {
    assert.equal(sheet.skills['Stealth'].total, sheet.abilities.dex.mod + 3);
  });
  test('AC = armor base + dex mod, no double-counting the gear dex bonus', () => {
    assert.equal(sheet.ac.total, 13 + sheet.abilities.dex.mod);
  });
  test('max HP = base + flat gear bonus', () => {
    assert.equal(sheet.maxHp.total, 41); // 40 base + 1 from Ring of Protection
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
