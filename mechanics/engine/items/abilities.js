// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/items/abilities.js — see
// docs/V2_MECHANICS_MIGRATION.md. Activates one of an item's Ability entries (the weapon/armor
// `abilities[]` facet — activatable, charge-gated effects). Reuses consume.js's
// resolveConsumableEffect for the actual effect resolution rather than duplicating it. No
// rest/time-passage system exists in this ported engine yet, so recharge isn't enforced here —
// usesLeft only ever goes down. Not wired into the live app yet.

import { resolveConsumableEffect } from './consume.js';

/**
 * @param {import('./item-schema.js').Item} item
 * @param {number} abilityIndex
 * @param {{currentHp: number, maxHp?: number}} target
 * @param {Function} [rand]
 */
export function activateAbility(item, abilityIndex, target, rand = Math.random) {
  const ability = item.abilities?.[abilityIndex];
  if (!ability) throw new Error(`No ability at index ${abilityIndex} on "${item.name}"`);
  const result = resolveConsumableEffect(ability.effect, target, rand);
  const currentUsesLeft = ability.usesLeft ?? ability.uses.max;
  const usesLeft = Math.max(0, currentUsesLeft - 1);
  return { result, usesLeft, exhausted: usesLeft <= 0 };
}
