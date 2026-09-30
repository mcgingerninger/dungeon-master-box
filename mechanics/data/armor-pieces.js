// The compositional armor PIECE catalog — supersedes the monolith's `ARMOR_BASE_TYPES`
// (dungeon_loot_wheel_v102_spell_details.html ~line 9657). See docs/V2_MECHANICS_MIGRATION.md's
// armor-rework plan for the full rationale; this file is Phase 2's deliverable.
//
// Why this exists: `ARMOR_BASE_TYPES` has a name + baseAC per piece but no `slot`/`isBodySlot`/
// `weightClass` fields of its own — those were always re-derived elsewhere, unreliably, by
// regexing the item's NAME (`classifyItemHierarchy`'s armor branch, game-engine.js ~line 196-211,
// and `classifySubcategory`'s armor branch, monolith ~line 4534-4558) rather than read from
// structured data. `scripts/migrate-legacy-content.js`'s own `migrateArmor` comment already flags
// `classifySubcategory` as "never a source of mechanical truth" for exactly this reason. This
// catalog carries `slot`/`isBodySlot`/`weightClass` as real authored fields instead.
//
// weightClass is standard 5e (PHB armor table), not the monolith's own `classifyItemHierarchy`
// archetype regex — that regex was checked directly (game-engine.js ~line 196-211) and turns out
// to disagree with real 5e in several places (e.g. it buckets Chain Shirt/Studded Leather/Chain
// Mail all under "Medium Armor" by matching the bare words "chain"/"studded", and Ring Mail under
// "Heavy Armor" only incidentally via its "ring mail" phrase check) — it was only ever built to
// pick a flavor-archetype label, never validated as real armor-weight mechanics, so it isn't a
// source of truth to copy here. Standard 5e is what `effectiveDexModForArmorStyle` (game-engine.js)
// was actually built to model, so this catalog uses that directly:
//   light:  Padded, Leather, Studded Leather
//   medium: Hide, Chain Shirt, Scale Mail, Breastplate, Half Plate
//   heavy:  Ring Mail, Chain Mail, Splint, Plate
//
// `slot` uses the monolith's live equip-slot-category vocabulary (`SUBCATEGORY_TO_SLOT_CATEGORY`,
// monolith ~line 4496 — 'armor'/'offhand'/'helmet'/'handwear'/'boots'/'leggings'/'cloak'/
// 'beltwaist'), the vocabulary that actually drives equip behavior today (`collectEquippedAcBreakdown`
// checks `slotId === 'armor'` for the body slot specifically), NOT `migrateArmor`'s own local
// `SLOT_MAP` (scripts/migrate-legacy-content.js ~line 599, which uses 'chest'/'shield' and only
// ever labels canonical JSON — nothing equip-relevant reads it). One vocabulary, not two.
//
// baseAC values are the Phase 2 rebalance: each body piece's OLD total (from `ARMOR_BASE_TYPES`,
// which held nearly the whole AC value on one flat body-slot item) is split so the body piece
// keeps ~56% and the remaining ~44% is redistributed across the AC-bearing accessory slots
// (shield/helmet/handwear/leggings), confirmed against the user's own worked example (Plate 18 ->
// body 10, matching "I want the plate armor piece to be say +10 AC" exactly). Accessory pieces
// that carried only a token 1-3 AC before now carry a real share; boots/cloak/belt stay modest
// (1 AC) since they're not part of the redistributed 44% — matching the approved table exactly.

export const ARMOR_PIECES = [
  // -- Body armor (isBodySlot: true, slot: 'armor') --
  { id: 'padded',          name: 'Padded Armor',    slot: 'armor', isBodySlot: true, weightClass: 'light',  baseAC: 6 },
  { id: 'leather',         name: 'Leather Armor',   slot: 'armor', isBodySlot: true, weightClass: 'light',  baseAC: 6 },
  { id: 'studded-leather', name: 'Studded Leather', slot: 'armor', isBodySlot: true, weightClass: 'light',  baseAC: 7 },
  { id: 'hide',            name: 'Hide Armor',      slot: 'armor', isBodySlot: true, weightClass: 'medium', baseAC: 7 },
  { id: 'chain-shirt',     name: 'Chain Shirt',     slot: 'armor', isBodySlot: true, weightClass: 'medium', baseAC: 7 },
  { id: 'ring-mail',       name: 'Ring Mail',       slot: 'armor', isBodySlot: true, weightClass: 'heavy',  baseAC: 8 },
  { id: 'scale-mail',      name: 'Scale Mail',      slot: 'armor', isBodySlot: true, weightClass: 'medium', baseAC: 8 },
  { id: 'breastplate',     name: 'Breastplate',     slot: 'armor', isBodySlot: true, weightClass: 'medium', baseAC: 8 },
  { id: 'half-plate',      name: 'Half Plate',      slot: 'armor', isBodySlot: true, weightClass: 'medium', baseAC: 8 },
  { id: 'chain-mail',      name: 'Chain Mail',      slot: 'armor', isBodySlot: true, weightClass: 'heavy',  baseAC: 9 },
  { id: 'splint',          name: 'Splint Armor',    slot: 'armor', isBodySlot: true, weightClass: 'heavy',  baseAC: 10 },
  { id: 'plate',           name: 'Plate Armor',     slot: 'armor', isBodySlot: true, weightClass: 'heavy',  baseAC: 10 },

  // -- Shields (isBodySlot: false, slot: 'offhand') --
  { id: 'buckler-shield', name: 'Buckler Shield', slot: 'offhand', isBodySlot: false, baseAC: 2 },
  { id: 'round-shield',   name: 'Round Shield',   slot: 'offhand', isBodySlot: false, baseAC: 2 },
  { id: 'kite-shield',    name: 'Kite Shield',    slot: 'offhand', isBodySlot: false, baseAC: 3 },
  { id: 'tower-shield',   name: 'Tower Shield',   slot: 'offhand', isBodySlot: false, baseAC: 4 },

  // -- Helmets (isBodySlot: false, slot: 'helmet') --
  { id: 'iron-cap',   name: 'Iron Cap',   slot: 'helmet', isBodySlot: false, baseAC: 1 },
  { id: 'great-helm', name: 'Great Helm', slot: 'helmet', isBodySlot: false, baseAC: 2 },
  { id: 'war-helm',   name: 'War Helm',   slot: 'helmet', isBodySlot: false, baseAC: 2 },

  // -- Handwear (isBodySlot: false, slot: 'handwear') --
  { id: 'leather-gauntlets', name: 'Leather Gauntlets', slot: 'handwear', isBodySlot: false, baseAC: 1 },
  { id: 'steel-bracers',     name: 'Steel Bracers',     slot: 'handwear', isBodySlot: false, baseAC: 2 },

  // -- Leggings (isBodySlot: false, slot: 'leggings') --
  { id: 'reinforced-greaves', name: 'Reinforced Greaves', slot: 'leggings', isBodySlot: false, baseAC: 2 },

  // -- Boots (isBodySlot: false, slot: 'boots') --
  { id: 'leather-boots', name: 'Leather Boots', slot: 'boots', isBodySlot: false, baseAC: 1 },

  // -- Cloaks (isBodySlot: false, slot: 'cloak') --
  { id: 'travelers-cloak', name: "Traveler's Cloak", slot: 'cloak', isBodySlot: false, baseAC: 1 },
  { id: 'battle-mantle',   name: 'Battle Mantle',    slot: 'cloak', isBodySlot: false, baseAC: 1 },

  // -- Belts (isBodySlot: false, slot: 'beltwaist') --
  { id: 'studded-belt', name: 'Studded Belt', slot: 'beltwaist', isBodySlot: false, baseAC: 1 },
];

export function armorPieceById(id) {
  return ARMOR_PIECES.find(p => p.id === id) || null;
}

export function armorPieceByName(name) {
  return ARMOR_PIECES.find(p => p.name === name) || null;
}
