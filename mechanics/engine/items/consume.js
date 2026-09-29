// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/items/consume.js — see
// docs/V2_MECHANICS_MIGRATION.md. Applies a consumable's OnUseEffect to a target. Pure and
// side-effect-free — takes a target's CURRENT numbers and returns what the result WOULD be; it
// never mutates `item` or `target`. Persisting the result is the caller's job.
//
// buff/debuff effects are reported (their statMods/durationMs passed through) but not applied to
// any persistent "this is currently active" tracker — that system doesn't exist in this ported
// engine yet, matching item-schema.js's OnUseEffect comment on durationMs. Not wired into the live
// app yet.

import { rollDamage } from '../dice/dice.js';

/**
 * @param {import('./item-schema.js').OnUseEffect} effect
 * @param {{currentHp: number, maxHp?: number}} target
 * @param {Function} [rand]  // injectable random source, defaults to Math.random
 */
export function resolveConsumableEffect(effect, target, rand = Math.random) {
  if (effect.kind === 'heal') {
    const roll = rollDamage(effect.healDice, false, rand);
    const maxHp = target.maxHp ?? Infinity;
    const newCurrentHp = Math.min(maxHp, (target.currentHp ?? 0) + (roll?.total ?? 0));
    return { kind: 'heal', rolls: roll?.rolls ?? [], amount: roll?.total ?? 0, newCurrentHp };
  }
  if (effect.kind === 'damage') {
    const roll = rollDamage(effect.damageDice, false, rand);
    const newCurrentHp = Math.max(0, (target.currentHp ?? 0) - (roll?.total ?? 0));
    return { kind: 'damage', rolls: roll?.rolls ?? [], amount: roll?.total ?? 0, damageType: effect.damageType, newCurrentHp };
  }
  if (effect.kind === 'buff' || effect.kind === 'debuff') {
    return { kind: effect.kind, statMods: effect.statMods || [], durationMs: effect.durationMs };
  }
  return { kind: 'utility' };
}

/**
 * Full "use this item" flow: resolves one of the item's effects and reports the item's new
 * usesLeft (never below 0) and whether it's now fully spent.
 * @param {import('./item-schema.js').Item} item
 * @param {number} effectIndex
 * @param {{currentHp: number, maxHp?: number}} target
 * @param {Function} [rand]
 */
export function useConsumable(item, effectIndex, target, rand = Math.random) {
  const effect = item.consumable?.effects?.[effectIndex];
  if (!effect) throw new Error(`No effect at index ${effectIndex} on "${item.name}"`);
  const result = resolveConsumableEffect(effect, target, rand);
  const currentUsesLeft = item.consumable.usesLeft ?? item.consumable.uses.max;
  const usesLeft = Math.max(0, currentUsesLeft - 1);
  return { result, usesLeft, consumed: usesLeft <= 0 };
}
