// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/combat/attack.js — see
// docs/V2_MECHANICS_MIGRATION.md. A single, unified attack-resolution pipeline, structurally
// driven (weapon damage dice/type/attack ability come from the canonical Item schema, never
// regexed out of item.effect the way dungeon-master-box's existing computeWeaponAttackRoll/
// parseWeaponEffectBonuses (the monolith HTML) do it today). Not wired into the live app yet —
// see docs/V2_MECHANICS_MIGRATION.md for the integration phase this becomes load-bearing in.

import { rollD20, rollDamage } from '../dice/dice.js';
import { abilityModifier } from '../character/ability-scores.js';

// Matches dungeon-master-box's own existing "1d6 + STR" unarmed strike convention (see
// computeUnarmedAttackRoll in the monolith) rather than strict RAW 5e's flat 1 + STR — kept for
// continuity since this is a house convention, not a rules-accuracy question.
export const UNARMED_STRIKE_ACTION = {
  name: 'Unarmed Strike',
  damageDice: '1d6',
  damageType: 'bludgeoning',
  attackAbility: 'str',
};

function getAbilityModifierFor(entity, abbr) {
  if (entity.abilityModifiers) return entity.abilityModifiers[abbr] ?? 0;
  return abilityModifier(entity.abilityScores?.[abbr] ?? 10);
}

// weaponOrAction.toHitBonus, present, is used as-is — a monster stat block's flat "+9 to hit" —
// bypassing ability-score math entirely. A PC-like attacker instead derives its bonus from the
// action's attackAbility (defaults to 'str') plus proficiency, unless the action explicitly opts
// out via `proficient: false` (everyone is always proficient with an unarmed strike, matching 5e).
export function getAttackBonus(attacker, weaponOrAction) {
  if (weaponOrAction.toHitBonus != null) return weaponOrAction.toHitBonus;
  const abbr = weaponOrAction.attackAbility || 'str';
  const abilityMod = getAbilityModifierFor(attacker, abbr);
  const prof = weaponOrAction.proficient === false ? 0 : (attacker.proficiencyBonus ?? 2);
  return abilityMod + prof;
}

export function getDamageBonus(attacker, weaponOrAction) {
  if (weaponOrAction.damageBonus != null) return weaponOrAction.damageBonus;
  const abbr = weaponOrAction.attackAbility || 'str';
  return getAbilityModifierFor(attacker, abbr);
}

/**
 * Standard d20-plus-modifiers vs. AC: roll d20 + attack bonus, compare to the target's AC. AC
 * acts as a MODIFIER: on an ordinary hit, however far the roll cleared AC (`margin`) is added
 * straight onto damage, instead of snapping into discrete named tiers. A natural 1 always
 * fumbles/misses and a natural 20 always crits (doubles damage dice, the standard rule) regardless
 * of margin, matching 5e.
 *
 * @param {Object} params
 * @param {Object} params.attacker  // {abilityScores|abilityModifiers, proficiencyBonus}
 * @param {Object} params.target    // {ac}
 * @param {Object} params.weaponOrAction  // {damageDice, damageType, attackAbility?, proficient?, toHitBonus?, damageBonus?}
 * @param {'advantage'|'disadvantage'|undefined} [params.advantage]
 * @param {Function} [rand]  // injectable random source, defaults to Math.random
 */
export function resolveAttack({ attacker, target, weaponOrAction, advantage }, rand = Math.random) {
  const toHitRoll = rollD20(advantage, rand);
  const isFumble = toHitRoll === 1;
  const isCrit = toHitRoll === 20;
  const toHitTotal = toHitRoll + getAttackBonus(attacker, weaponOrAction);
  const margin = toHitTotal - target.ac;
  const isHit = !isFumble && (isCrit || margin >= 0);
  const outcome = isFumble ? 'Fumble' : isCrit ? 'Critical Hit' : isHit ? 'Hit' : 'Miss';

  let damage = null;
  if (isHit) {
    const base = rollDamage(weaponOrAction.damageDice, isCrit, rand);
    const abilityBonus = getDamageBonus(attacker, weaponOrAction);
    const marginBonus = isCrit ? 0 : margin;
    const total = Math.max(0, (base?.total ?? 0) + marginBonus + abilityBonus);
    damage = { rolls: base?.rolls ?? [], marginBonus, abilityBonus, total };
  }

  return {
    toHitRoll, toHitTotal, margin, outcome,
    isCrit, isFumble, isHit,
    damage, damageType: weaponOrAction.damageType,
  };
}
