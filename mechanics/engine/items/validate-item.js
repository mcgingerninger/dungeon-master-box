// Ported from dungeonboxnewVersion2_rework's src/engine/items/validate-item.js — see
// docs/V2_MECHANICS_MIGRATION.md. V2's own weapon/armor/consumable/material/tool rules are
// unchanged; this migration's Phase 3 adds the `wondrous` type (rings/amulets/cloaks/attuned
// trinkets — see item-schema.js's header comment for why it's a new type rather than forcing this
// content into 'tool' or 'armor'). Remaining legacy-only types (companion/treasure/questitem/
// document) are still correctly rejected by "unknown or unsupported itemType" until a later phase
// adds them, per Section 18's "extend the validator, don't force content into the wrong shape".

const FACET_KEYS = ['weapon', 'armor', 'consumable', 'material', 'tool', 'wondrous', 'passive', 'abilities', 'grants'];

const RULES = {
  weapon: { required: ['weapon'], allowed: ['weapon', 'passive', 'abilities', 'grants'] },
  armor: { required: ['armor'], allowed: ['armor', 'passive', 'abilities', 'grants'] },
  consumable: { required: ['consumable'], allowed: ['consumable'] },
  material: { required: ['material'], allowed: ['material'] },
  tool: { required: ['tool'], allowed: ['tool', 'passive'] },
  wondrous: { required: ['wondrous'], allowed: ['wondrous', 'passive', 'abilities', 'grants'] },
};

function presentFacets(item) {
  return FACET_KEYS.filter(k => item[k] !== undefined);
}

/**
 * @param {import('./item-schema.js').Item} item
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateItem(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return { valid: false, errors: ['item must be an object'] };
  if (!item.name) errors.push('name is required');

  const rules = RULES[item.itemType];
  if (!rules) {
    errors.push(`unknown or unsupported itemType "${item.itemType}" — only weapon/armor/consumable/material/tool/wondrous are modeled so far`);
    return { valid: false, errors };
  }

  const present = presentFacets(item);
  for (const req of rules.required) {
    if (!present.includes(req)) errors.push(`itemType "${item.itemType}" requires a "${req}" facet`);
  }
  for (const facet of present) {
    if (!rules.allowed.includes(facet)) errors.push(`itemType "${item.itemType}" cannot have a "${facet}" facet`);
  }

  if (item.itemType === 'weapon' && item.weapon) {
    if (!item.weapon.damageDice) errors.push('weapon.damageDice is required');
    if (!item.weapon.damageType) errors.push('weapon.damageType is required');
  }
  if (item.itemType === 'armor' && item.armor) {
    if (typeof item.armor.baseAC !== 'number') errors.push('armor.baseAC must be a number');
  }
  if (item.itemType === 'consumable' && item.consumable) {
    if (!Array.isArray(item.consumable.effects) || !item.consumable.effects.length) {
      errors.push('consumable.effects must be a non-empty array');
    } else {
      item.consumable.effects.forEach((effect, i) => {
        if (effect.kind === 'heal' && !effect.healDice) errors.push(`consumable.effects[${i}] is kind "heal" but has no healDice`);
        if (effect.kind === 'damage' && (!effect.damageDice || !effect.damageType)) errors.push(`consumable.effects[${i}] is kind "damage" but is missing damageDice/damageType`);
      });
    }
    if (!item.consumable.uses || typeof item.consumable.uses.max !== 'number' || item.consumable.uses.max < 1) {
      errors.push('consumable.uses.max must be a number >= 1');
    }
    if (typeof item.consumable.usesLeft !== 'number') errors.push('consumable.usesLeft must be a number');
  }
  if (item.itemType === 'material' && item.material) {
    if (!Array.isArray(item.material.materialTags)) errors.push('material.materialTags must be an array');
  }
  if (item.itemType === 'tool' && item.tool) {
    if (!item.tool.toolCategory) errors.push('tool.toolCategory is required');
  }

  return { valid: errors.length === 0, errors };
}
