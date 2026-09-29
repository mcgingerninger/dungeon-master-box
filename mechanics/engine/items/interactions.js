// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/items/interactions.js — see
// docs/V2_MECHANICS_MIGRATION.md. "What can this item be used FOR" — layered separately from the
// item's type/facets (what it IS/HAS). Re-derived against the structured schema instead of
// dungeon-master-box's existing INTERACTIONS table (game-engine.js), for two reasons:
//   1. Field names differ (itemType/weapon/armor/consumable facets, not type/subcategory/effect).
//   2. Several of the existing rules match free text with regex (attune checks /requires
//      attunement/i against flavor text; spell_focus/place/weapon_coating similarly regex
//      names/descriptions) — exactly the pattern this migration exists to eliminate. Every rule
//      here reads only structured fields.
// Narrowed to weapon/armor/consumable/material/tool (this migration's Phase 1 scope is
// weapon/armor only; consumable/material/tool interactions are carried over from V2 unchanged for
// when those item types are migrated in a later phase). Legacy-only interactions this table does
// NOT yet cover (socket/spell_focus/ritual_component/summon_component/monster_material/
// fleshmancer_input/wearable_part/unwearable_part/component/sell/place/harvest/unlock/combine/wear)
// are tracked as an explicit gap in docs/V2_MECHANICS_MIGRATION.md, not silently dropped — they
// apply to item types (wondrous/quest/treasure/craftable monster parts) not yet in scope.

export const INTERACTIONS = {
  equip: {
    cat: 'Equipment', label: 'Equip',
    default: it => it.itemType === 'weapon' || it.itemType === 'armor',
  },
  attune: {
    cat: 'Equipment', label: 'Attune',
    default: it => (it.itemType === 'weapon' || it.itemType === 'armor') && !!it.requiresAttunement,
  },
  enchant: {
    cat: 'Modification', label: 'Enchant',
    default: it => it.itemType === 'weapon' || it.itemType === 'armor',
  },
  repair: {
    cat: 'Modification', label: 'Repair',
    default: it => it.itemType === 'weapon' || it.itemType === 'armor',
  },
  salvage: {
    cat: 'Processing', label: 'Salvage',
    default: it => it.itemType === 'weapon' || it.itemType === 'armor',
  },
  consume: {
    cat: 'Consumable', label: 'Consume',
    default: it => it.itemType === 'consumable' && ['potion', 'food'].includes(it.consumable?.consumableCategory),
  },
  apply: {
    cat: 'Consumable', label: 'Apply',
    default: it => it.itemType === 'consumable' && ['potion', 'food', 'topical'].includes(it.consumable?.consumableCategory),
  },
  read: {
    cat: 'Consumable', label: 'Read',
    default: it => it.itemType === 'consumable' && it.consumable?.consumableCategory === 'scroll',
  },
  crumble: {
    cat: 'Consumable', label: 'Crumbles When Spent',
    default: it => it.itemType === 'consumable' && typeof it.consumable?.uses?.max === 'number',
  },
  throw: {
    cat: 'Combat', label: 'Throw',
    default: it => (it.itemType === 'weapon' && (it.weapon?.properties || []).includes('thrown'))
      || (it.itemType === 'consumable' && it.consumable?.consumableCategory === 'thrown'),
  },
  weapon_coating: {
    cat: 'Combat', label: 'Weapon Coating',
    default: it => it.itemType === 'consumable' && it.consumable?.consumableCategory === 'coating',
  },
  craft_material: {
    cat: 'Crafting', label: 'Crafting Material',
    default: it => it.itemType === 'material',
  },
  reagent: {
    cat: 'Crafting', label: 'Reagent',
    default: it => it.itemType === 'material' && (it.material?.materialTags || []).includes('reagent'),
  },
};

export function computeItemInteractions(item) {
  const set = new Set();
  for (const action in INTERACTIONS) {
    if (INTERACTIONS[action].default(item)) set.add(action);
  }
  (item.extraInteractions || []).forEach(a => set.add(a));
  (item.blockedInteractions || []).forEach(a => set.delete(a));
  return [...set];
}

export function canInteract(item, action) {
  if (!item || !INTERACTIONS[action]) return false;
  const list = item.interactions || computeItemInteractions(item);
  return list.includes(action);
}
