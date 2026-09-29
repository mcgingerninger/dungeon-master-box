// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/character/equipment.js — see
// docs/V2_MECHANICS_MIGRATION.md. Real equip/unequip + inventory-aware AC, replacing
// dungeon-master-box's existing SLOT_CATEGORY/collectEquippedAcBreakdown (the monolith HTML) — the
// SLOT structure and the "body armor sets a base, everything else adds on top" approach are ported
// directly, but the actual math is real (structured item fields) instead of
// collectEquippedAcBreakdown's runtime regex over "+N AC" strings.
//
// EQUIPMENT_SLOTS originally shipped as a scoped-down subset of dungeon-master-box's real 24-slot
// SLOT_CATEGORY (no ring/amulet/charm/limb/companion — deferred until a wondrous-equivalent item
// type existed to occupy them). This migration's Phase 3 adds the `wondrous` itemType, so
// ring/amulet/charm slots are restored here too, matching dungeon-master-box's own existing
// precedent exactly (SLOT_CATEGORY's real counts: 4 ring slots, 2 amulet slots, 5 charm slots).
// Grafted-limb/companion slots remain deferred — those need a Fleshmancer-equivalent mechanic this
// migration hasn't built.
//
// Pure functions throughout — nothing here reads the DOM or persistence; a caller (the inventory
// UI) is responsible for saving the resulting equippedSlots/inventory back to the character
// record. Not wired into the live app yet.

import { computeDerivedSheet } from './character-sheet.js';
import { collectStatMods, sumModifier } from './stat-modifiers.js';

export const EQUIPMENT_SLOTS = {
  weapon1: 'Weapon 1', weapon2: 'Weapon 2',
  armor: 'Armor (Body)', shield: 'Shield',
  helmet: 'Helmet', handwear: 'Hand Wear', boots: 'Boots', leggings: 'Leggings',
  facewear: 'Face Wear', cloak: 'Cloak', beltwaist: 'Belt',
  ring1: 'Ring 1', ring2: 'Ring 2', ring3: 'Ring 3', ring4: 'Ring 4',
  amulet1: 'Amulet 1', amulet2: 'Amulet 2',
  charm1: 'Charm 1', charm2: 'Charm 2', charm3: 'Charm 3', charm4: 'Charm 4', charm5: 'Charm 5',
};

// ArmorData.slot uses 'chest' for body armor — the equivalent dungeon-master-box SLOT_CATEGORY
// key is 'armor'. Mapped once here rather than renaming either vocabulary.
const ARMOR_SLOT_TO_EQUIPMENT_SLOT = {
  chest: 'armor', shield: 'shield', helmet: 'helmet', handwear: 'handwear',
  boots: 'boots', leggings: 'leggings', facewear: 'facewear', cloak: 'cloak', beltwaist: 'beltwaist',
};

// WondrousData.slot can name one of the SAME single body slots ArmorData does (a wondrous cloak
// competes with an armor-type cloak for the one 'cloak' slot, correctly — you can't wear two), or
// one of three multi-slot FAMILIES (ring/amulet/charm) where the caller picks which concrete slot,
// same pattern as a one-handed weapon picking weapon1 or weapon2.
const WONDROUS_DIRECT_SLOT = {
  cloak: 'cloak', beltwaist: 'beltwaist', boots: 'boots', leggings: 'leggings',
  handwear: 'handwear', helmet: 'helmet', facewear: 'facewear',
};
const RING_SLOTS = ['ring1', 'ring2', 'ring3', 'ring4'];
const AMULET_SLOTS = ['amulet1', 'amulet2'];
const CHARM_SLOTS = ['charm1', 'charm2', 'charm3', 'charm4', 'charm5'];

function isTwoHanded(item) {
  return item.itemType === 'weapon' && (item.weapon?.properties || []).includes('two-handed');
}

export function equipmentSlotsForItem(item) {
  if (item.itemType === 'weapon') return ['weapon1', 'weapon2'];
  if (item.itemType === 'armor') {
    // Same amulet1/amulet2 family a wondrous item's slot:'amulet' expands to below — an armor-type
    // amulet (e.g. a migrated "Amulet of Natural Armor") competes for the same two neck slots, not
    // a single dedicated one, the same way a one-handed weapon picks weapon1 or weapon2.
    if (item.armor?.slot === 'amulet') return AMULET_SLOTS;
    const slot = ARMOR_SLOT_TO_EQUIPMENT_SLOT[item.armor?.slot];
    return slot ? [slot] : [];
  }
  if (item.itemType === 'wondrous') {
    const slot = item.wondrous?.slot;
    if (!slot) return []; // a carried/attuned trinket with no body slot at all — never equippable
    if (slot === 'ring') return RING_SLOTS;
    if (slot === 'amulet') return AMULET_SLOTS;
    if (slot === 'charm') return CHARM_SLOTS;
    const direct = WONDROUS_DIRECT_SLOT[slot];
    return direct ? [direct] : [];
  }
  return [];
}

export function canEquipToSlot(item, slotId) {
  return equipmentSlotsForItem(item).includes(slotId);
}

function findEntry(inventory, instanceId) {
  return inventory.find(e => e.instanceId === instanceId) || null;
}

/**
 * Equips an already-owned inventory instance into a slot. Pure — returns a NEW equippedSlots
 * object; the caller decides what to persist. A two-handed weapon equipped into weapon1 or
 * weapon2 mirrors into the other slot too (occupying both hands), matching 5e.
 */
export function equipItem(equippedSlots, inventory, instanceId, slotId, resolveItem) {
  const entry = findEntry(inventory, instanceId);
  if (!entry) throw new Error(`No inventory entry with instanceId "${instanceId}"`);
  const item = resolveItem(entry.itemId);
  if (!item) throw new Error(`Unknown item id "${entry.itemId}"`);
  if (!canEquipToSlot(item, slotId)) {
    throw new Error(`"${item.name}" cannot be equipped to slot "${slotId}"`);
  }
  const next = { ...equippedSlots, [slotId]: instanceId };
  if (isTwoHanded(item)) {
    next[slotId === 'weapon1' ? 'weapon2' : 'weapon1'] = instanceId;
  }
  return next;
}

/**
 * Clears a slot (the item stays in `inventory`, just no longer equipped anywhere). If the slot
 * held one half of a two-handed weapon's mirrored pair, clears the other half too.
 */
export function unequipSlot(equippedSlots, slotId) {
  const next = { ...equippedSlots };
  const instanceId = next[slotId];
  next[slotId] = null;
  if (instanceId && (slotId === 'weapon1' || slotId === 'weapon2')) {
    const otherSlot = slotId === 'weapon1' ? 'weapon2' : 'weapon1';
    if (next[otherSlot] === instanceId) next[otherSlot] = null;
  }
  return next;
}

export function collectDistinctEquippedItems(equippedSlots, inventory, resolveItem) {
  const seen = new Set();
  const items = [];
  for (const instanceId of Object.values(equippedSlots)) {
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);
    const entry = findEntry(inventory, instanceId);
    const item = entry && resolveItem(entry.itemId);
    if (item) items.push(item);
  }
  return items;
}

// Turns each equipped item's `passive` StatModifiers into a synthetic trait — reusing
// computeDerivedSheet's existing trait-merge math rather than building a parallel stat pipeline
// for equipment. Only AC (below) needs real new logic, because body armor REPLACES the base-10
// formula instead of adding to it.
export function collectEquippedTraits(equippedSlots, inventory, resolveItem) {
  return collectDistinctEquippedItems(equippedSlots, inventory, resolveItem)
    .filter(item => (item.passive || []).length)
    .map(item => ({ id: `equip-${item.id}`, name: item.name, description: '', statMods: item.passive }));
}

/**
 * Real AC math off equipped armor: body armor (equippedSlots.armor) sets the base AC and gates
 * whether/how much Dex applies (armor.addsDexMod/dexModCap); everything else equipped that's
 * `additive` (shield, helm, gauntlets, greaves, boots) adds its own baseAC on top; `flatAcBonus`
 * folds in any 'ac' StatModifier from traits/equipped-item passives the caller already collected.
 */
export function computeEquippedArmorClass({ equippedSlots, inventory, resolveItem, dexModifier, flatAcBonus = 0 }) {
  const bodyEntry = equippedSlots.armor ? findEntry(inventory, equippedSlots.armor) : null;
  const bodyArmor = bodyEntry && resolveItem(bodyEntry.itemId);
  let base = 10;
  let baseSource = null;
  let dexContribution = dexModifier;
  if (bodyArmor && bodyArmor.itemType === 'armor' && !bodyArmor.armor.additive) {
    base = bodyArmor.armor.baseAC;
    baseSource = bodyArmor.name;
    if (!bodyArmor.armor.addsDexMod) dexContribution = 0;
    else if (typeof bodyArmor.armor.dexModCap === 'number') dexContribution = Math.min(dexModifier, bodyArmor.armor.dexModCap);
  }
  const additiveSources = [];
  for (const [slotId, instanceId] of Object.entries(equippedSlots)) {
    if (slotId === 'armor' || !instanceId) continue;
    const entry = findEntry(inventory, instanceId);
    const item = entry && resolveItem(entry.itemId);
    if (!item || item.itemType !== 'armor' || !item.armor.additive) continue;
    additiveSources.push({ itemName: item.name, amount: item.armor.baseAC });
  }
  const additiveTotal = additiveSources.reduce((sum, s) => sum + s.amount, 0);
  const total = base + dexContribution + additiveTotal + flatAcBonus;
  return { total, base, baseSource, dexContribution, additiveSources, flatAcBonus };
}

/**
 * The combined sheet: computeDerivedSheet already handles every equipment bonus generically once
 * equipped items' passives are folded into `traits` — this only has to special-case AC, since
 * armor replaces the base-10 formula rather than adding to it.
 */
export function computeDerivedSheetWithEquipment(character, equippedSlots, inventory, resolveItem) {
  const equippedTraits = collectEquippedTraits(equippedSlots, inventory, resolveItem);
  const mergedTraits = [...(character.traits || []), ...equippedTraits];
  const derived = computeDerivedSheet({ ...character, traits: mergedTraits });
  const flatAcBonus = sumModifier(collectStatMods(mergedTraits), 'ac');
  const acField = computeEquippedArmorClass({
    equippedSlots, inventory, resolveItem, dexModifier: derived.abilityModifiers.dex, flatAcBonus,
  });
  return { ...derived, ac: acField.total, acBreakdown: acField, equippedTraits };
}
