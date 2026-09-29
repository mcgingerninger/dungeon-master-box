// The scalable base-item + modifier system — ported from dungeonboxnewVersion2_rework's
// src/engine/items/modifiers.js and extended to implement the override mechanism its own header
// comment proposed but left unbuilt ("PENDING: real modifier pool"). See
// docs/V2_MECHANICS_MIGRATION.md for the full materials-mechanics ruleset this exists to serve.
//
// A base item is a plain Item (item-schema.js) with no appliedModifiers. A Modifier is a
// standalone, rarity-tagged bundle of effects that can be layered onto any compatible base item at
// generation OR migration time — applyModifierToItem clones the base and merges the modifier in.
//
// ============================== Materials modifiers (this migration) =========================
// dungeon-master-box's existing catalog has ZERO mechanical implementation of Silvered/Mithral/
// Adamantine/Masterwork today (mithral/adamantine are classification labels only; silvered and
// masterwork don't exist as mechanics anywhere in the code) — this migration was explicitly
// confirmed to author REAL mechanics for these rather than carry the no-op forward. The four
// modifiers themselves live in mechanics/data/material-modifiers.js; what's new HERE is
// applyModifierToItem's support for the non-numeric effect kinds they need, beyond the
// passiveMods/grantedAbilities/weaponBonusDamage V2 already had:
//   - weaponOverrides / armorOverrides — direct field patches onto item.weapon / item.armor (e.g.
//     Mithral clearing armor.stealthDisadvantage/strengthRequirement; Adamantine setting
//     weapon.autoCritVsObjects/armor.critImmuneWhileWorn).
//   - weightMultiplier — scales item.weight (Mithral: 0.5).
//   - magical — sets item.weapon.magical / item.armor.magical (Masterwork, plain Silvered: false).
// Elemental damage-type add-ons, recurring named/triggered powers (Fortune, Bloodletting,
// Swiftness, Warding, Echoing/Wild), and Hidden Power unlocks remain explicitly OUT of this
// migration phase's modifier pool — V2's own audit already flagged the open question of how to
// represent triggered-on-hit/on-crit effects, and this migration doesn't decide that unilaterally;
// see docs/V2_MECHANICS_MIGRATION.md's "Deferred" section.
// ===============================================================================================

/**
 * @typedef {Object} Modifier
 * @property {string} id
 * @property {string} name              // e.g. "+1", "of Flaming", "Mithral"
 * @property {('weapon'|'armor')[]} appliesTo
 * @property {string} rarity            // the rarity tier this modifier is drawn from
 * @property {import('./item-schema.js').StatModifier[]} [passiveMods]
 * @property {import('./item-schema.js').Ability[]} [grantedAbilities]
 * @property {{dice: string, type: string}} [weaponBonusDamage]  // additive extra dice, e.g. +1d6 fire
 * @property {Object} [weaponOverrides]   // shallow-merged onto item.weapon
 * @property {Object} [armorOverrides]    // shallow-merged onto item.armor
 * @property {number} [weightMultiplier]  // item.weight *= this
 * @property {boolean} [magical]          // sets item.weapon.magical / item.armor.magical when false
 * @property {string} nameTemplate      // '{base} +1' / '{base} of Flaming' / '{base} (Mithral)'
 */

export function formatModifiedName(nameTemplate, baseName) {
  return nameTemplate.replace('{base}', baseName);
}

/**
 * @param {import('./item-schema.js').Item} baseItem
 * @param {Modifier} modifier
 * @returns {import('./item-schema.js').Item|null}  null if the modifier doesn't apply to this item's type
 */
export function applyModifierToItem(baseItem, modifier) {
  if (!modifier.appliesTo.includes(baseItem.itemType)) return null;

  const item = structuredClone(baseItem);
  item.passive = [...(item.passive || []), ...(modifier.passiveMods || [])];
  item.abilities = [...(item.abilities || []), ...(modifier.grantedAbilities || [])];
  if (modifier.weaponBonusDamage && item.weapon) {
    item.weapon = { ...item.weapon, bonusDamage: [...(item.weapon.bonusDamage || []), modifier.weaponBonusDamage] };
  }
  if (modifier.weaponOverrides && item.weapon) {
    item.weapon = { ...item.weapon, ...modifier.weaponOverrides };
  }
  if (modifier.armorOverrides && item.armor) {
    item.armor = { ...item.armor, ...modifier.armorOverrides };
  }
  if (typeof modifier.weightMultiplier === 'number' && typeof item.weight === 'number') {
    item.weight = item.weight * modifier.weightMultiplier;
  }
  if (modifier.magical === false) {
    if (item.weapon) item.weapon = { ...item.weapon, magical: false };
    if (item.armor) item.armor = { ...item.armor, magical: false };
  }
  item.name = formatModifiedName(modifier.nameTemplate, baseItem.name);
  item.appliedModifiers = [...(item.appliedModifiers || []), modifier.id];
  return item;
}

/**
 * Applies several modifiers in sequence (order matters for name stacking — each modifier's
 * nameTemplate wraps the previous result's name). Skips (and reports) any modifier that doesn't
 * apply to this item's itemType rather than throwing.
 * @returns {{item: import('./item-schema.js').Item, skipped: string[]}}
 */
export function applyModifiers(baseItem, modifiers) {
  let item = baseItem;
  const skipped = [];
  for (const modifier of modifiers) {
    const next = applyModifierToItem(item, modifier);
    if (next) item = next;
    else skipped.push(modifier.id);
  }
  return { item, skipped };
}
