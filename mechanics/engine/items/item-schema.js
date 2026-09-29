// Canonical structured item schema for dungeon-master-box's V2-mechanics migration — see
// docs/V2_MECHANICS_MIGRATION.md.
//
// Based on dungeonboxnewVersion2_rework's src/engine/items/item-schema.js, extended for this
// migration's confirmed scope:
//   - itemType stays an open enum, now 'weapon'|'armor'|'consumable'|'material'|'tool'|'wondrous'.
//     'wondrous' is this migration's own addition (Phase 3) — V2 had explicitly deferred it
//     ("wondrous/quest/treasure are deliberately deferred... until their own subcategories get
//     designed"). It covers rings/amulets/cloaks/attuned trinkets: dungeon-master-box's misc-typed
//     items that have a body slot and/or grant a real bonus/ability and/or require attunement.
//     Genuinely mundane misc gear (a torch, rope, thieves' tools) maps onto the EXISTING 'tool'
//     itemType instead of a third new type — ToolData's own doc comment already anticipated this
//     ("5e's own tool list is open-ended"), and 'tool' already allows a `passive` facet for exactly
//     the "a masterwork tool grants a small skill bonus" case.
//   - 'companion' is Phase 4's addition — pets/mounts, a genuinely distinct concept (summoned/
//     ridden, never equipped to a body slot) rather than a wondrous-item variant. Mounts commonly
//     carry real mechanics (their own AC, movement speeds, a flat attack-roll bonus granted to
//     their rider) that pets mostly don't (mostly narrative advantage-granting effects, preserved
//     as flavorText). treasure/questitem/document (Phase 4, 18 items total) map onto the EXISTING
//     'tool' itemType — dungeon-master-box's own data explicitly describes these as mechanically
//     inert ("Pure currency — no mechanical effect", "GM determines..."), so there's no real
//     mechanic to model beyond identity/content/category, which 'tool' already covers.
//   - WeaponData gains `bonusDamage` (informally used by V2's own modifiers.js already) as a real
//     documented field: extra damage dice bundled onto a weapon instance (an elemental-damage
//     rider migrated from legacy free text, or one added by a Modifier).
//   - WeaponData/ArmorData gain the real materials-mechanics fields agreed for this migration
//     (silvered/mithral/adamantine/masterwork are NOT free — legacy dungeon-master-box content has
//     zero mechanical implementation of these today; see docs/V2_MECHANICS_MIGRATION.md's Materials
//     section for the full ruleset and rationale):
//       - `magical` (boolean, default true when omitted) — false only for a plain masterwork item
//         or a purely-mundane silvered item; matters for anything that keys off "counts as magical"
//         (e.g. bypassing certain damage resistance).
//       - `ignoresNonmagicalResistance` (weapon only) — Silvered: standard 5e rule, a silvered
//         weapon overcomes certain creatures' resistance/immunity to nonmagical B/P/S damage.
//       - `autoCritVsObjects` (weapon only) — Adamantine: standard 5e rule, an adamantine weapon
//         automatically critically hits objects (not creatures).
//       - `critImmuneWhileWorn` (armor only) — Adamantine: standard 5e rule, any critical hit
//         against the wearer becomes a normal hit while this armor is worn.
//   - Every mechanical value here is a real typed field, never prose — dungeon-master-box's
//     existing `effect` string (regex-scraped at runtime for bonuses) is replaced entirely for
//     migrated items. `flavorText` still exists for display, but nothing in this engine ever
//     parses it for mechanics.
//   - `description` (Phase 15, docs/V2_MECHANICS_MIGRATION.md) is this migration's fix for a real
//     content-preservation gap found in Phase 14c: an item's raw legacy `effect` text was being
//     silently dropped entirely for any item whose mechanics don't fully capture it (most acutely,
//     the 404 `type: 'misc'` items that migrate onto the `tool` itemType — 401 of which have
//     non-empty `effect` text, none of it preserved anywhere before this). Same convention as
//     `Ability.description` below: display-only, populated with the item's raw legacy `effect`
//     text verbatim wherever it's non-empty, NEVER parsed for mechanics. A structured facet
//     (`weapon`/`armor`/`consumable`/`passive`/etc.) is still the real, authoritative mechanic
//     whenever one exists — `description` is a backstop against silent loss, not a replacement for
//     structured extraction.
//   - `'permanent_stat_increase'` (Phase 15) is a new OnUseEffect kind for a genuinely different
//     shape of mechanic from every other kind here: a ONE-TIME, PERMANENT change to a character's
//     base stats (an ability-score-boosting tome's "Constitution score... permanently increase[s]
//     by 2"), not a temporary buff/debuff. Reuses the existing `statMods` field — for this kind
//     only, `statMods` describes a permanent base-stat change, not an active/timed modifier, and
//     `durationMs` is never set. See docs/V2_MECHANICS_MIGRATION.md's Phase 15 for the six
//     ability-score tomes this models.

// ---------- Shared vocab ----------

export const WEAPON_CATEGORIES = ['simple', 'martial'];
export const ARMOR_TYPES = ['light', 'medium', 'heavy', 'shield'];
export const CONSUMABLE_CATEGORIES = ['potion', 'food', 'scroll', 'thrown', 'coating', 'topical', 'other'];
export const ON_USE_KINDS = ['heal', 'buff', 'debuff', 'damage', 'utility', 'permanent_stat_increase'];
export const ABILITY_KINDS = ['spell', 'active_effect'];
export const RECHARGE_KINDS = ['short_rest', 'long_rest', 'dawn', 'charges'];

/**
 * @typedef {Object} StatModifier
 * @property {string} stat   // 'ac'|'hp_max'|'speed'|ability abbr|skill name|`save_<abbr>`|'attackRoll'|'damageRoll'
 * @property {number} value
 * @property {string} [condition]  // structured enum, reserved for future use; unrecognized = no effect yet
 */

/**
 * @typedef {Object} OnUseEffect
 * @property {'heal'|'buff'|'debuff'|'damage'|'utility'|'permanent_stat_increase'} kind
 * @property {string} [healDice]        // 'heal' kind
 * @property {string} [damageDice]      // 'damage' kind
 * @property {string} [damageType]      // 'damage' kind
 * @property {StatModifier[]} [statMods]  // buff/debuff: an active, timed modifier (see durationMs).
 *   'permanent_stat_increase' (Phase 15): the SAME field reused for a one-time, permanent change to
 *   the character's own base stats instead — applied once, directly, never expires, never
 *   re-applied by a rest. `durationMs` is never set for this kind.
 * @property {number} [durationMs]     // structured, not a parsed phrase; buff/debuff duration is
 *   REPORTED by resolveConsumableEffect (consume.js) but not yet tracked by a persistent
 *   active-effects timer — that's a separate system, not built in this migration phase.
 */

/**
 * @typedef {Object} Ability
 * @property {string} id
 * @property {string} name
 * @property {'spell'|'active_effect'} kind
 * @property {OnUseEffect} effect
 * @property {{max: number, recharge: 'short_rest'|'long_rest'|'dawn'|'charges'}} uses
 * @property {number} usesLeft
 * @property {string} [description]  // display-only free text describing what the ability does,
 *   for an ability whose real effect can't be confidently reduced to a structured OnUseEffect (the
 *   same honest-gap pattern consumables use — see docs/V2_MECHANICS_MIGRATION.md's Phase 6). NEVER
 *   parsed for mechanics, same convention as Item.flavorText.
 */

/**
 * @typedef {Object} ProficiencyGrant
 * @property {string[]} [skills]
 * @property {string[]} [saves]           // ability abbreviations
 * @property {string[]} [weaponCategories]  // subset of WEAPON_CATEGORIES
 * @property {string[]} [armorTypes]        // subset of ARMOR_TYPES
 */

/**
 * @typedef {Object} Grants   // non-numeric effects — granting something outright, not a flat bonus
 * @property {ProficiencyGrant} [proficiencies]
 * @property {Array<{id:string,name:string,description?:string,statMods:StatModifier[]}>} [traits]
 */

/**
 * @typedef {Object} WeaponData
 * @property {string} damageDice        // '1d8'
 * @property {string} damageType        // 'slashing'|'piercing'|'bludgeoning'|'fire'|...
 * @property {'simple'|'martial'} [weaponCategory]  // omitted when the migration couldn't
 *   determine 5e proficiency category with confidence — see the migration report's ambiguous-item
 *   list. Not required by validate-item.js.
 * @property {string[]} [properties]    // ['light','finesse','thrown','versatile','two-handed','reach','ammunition']
 * @property {string} [versatileDice]
 * @property {number} [rangeNormal]
 * @property {number} [rangeMax]
 * @property {'weapon1'|'weapon2'|'offhand'} [slot]
 * @property {{dice: string, type: string}[]} [bonusDamage]  // extra damage dice bundled onto this
 *   instance (an elemental-damage rider migrated from legacy free text, e.g. "+2d6 fire damage",
 *   or one added later by applying a Modifier — see modifiers.js).
 * @property {boolean} [magical]  // default true when omitted; false only for a plain masterwork
 *   weapon (a purely mundane +1-to-hit item).
 * @property {boolean} [ignoresNonmagicalResistance]  // Silvered material.
 * @property {boolean} [autoCritVsObjects]  // Adamantine material.
 */

/**
 * @typedef {Object} ArmorData
 * @property {'light'|'medium'|'heavy'|'shield'} armorType
 * @property {number} baseAC
 * @property {boolean} addsDexMod
 * @property {number} [dexModCap]
 * @property {'helmet'|'chest'|'handwear'|'boots'|'leggings'|'facewear'|'cloak'|'beltwaist'|'shield'|'amulet'} [slot]
 *   // 'amulet' is a slot FAMILY like a wondrous item's — see equipmentSlotsForItem in
 *   // character/equipment.js, which expands it to the same amulet1/amulet2 pair.
 * @property {number} [strengthRequirement]
 * @property {boolean} [stealthDisadvantage]
 * @property {boolean} [additive]  // true for a shield or an accessory piece whose baseAC ADDS to
 *   whatever body armor already set; absent/false for body armor, whose baseAC REPLACES the
 *   base-10 formula outright.
 * @property {boolean} [magical]  // default true when omitted; false for plain masterwork armor.
 * @property {boolean} [critImmuneWhileWorn]  // Adamantine material.
 */

/**
 * @typedef {Object} ConsumableData
 * @property {'potion'|'food'|'scroll'|'thrown'|'coating'|'topical'|'other'} consumableCategory
 * @property {OnUseEffect[]} effects
 * @property {{max: number}} uses
 * @property {number} usesLeft
 */

/**
 * @typedef {Object} MaterialData
 * @property {string[]} materialTags   // 'reagent', 'craft_material', 'weapon_material', 'armor_material'
 */

/**
 * @typedef {Object} ToolData
 * @property {string} toolCategory
 */

/**
 * @typedef {Object} WondrousData
 * @property {'ring'|'amulet'|'cloak'|'beltwaist'|'boots'|'leggings'|'handwear'|'helmet'|'facewear'|'charm'} [slot]
 *   // absent for a wondrous item that isn't worn on a body slot at all (a whistle, a lucky coin
 *   // carried in a pocket, etc.) — still meaningfully "wondrous" rather than a plain 'tool' because
 *   // it requires attunement and/or grants a real mechanical bonus/ability. 'cloak'/'beltwaist'/
 *   // 'boots'/'leggings'/'handwear'/'helmet'/'facewear' deliberately reuse the SAME slot names
 *   // ArmorData uses (mechanics/character/equipment.js's EQUIPMENT_SLOTS) — a wondrous cloak and an
 *   // armor-type cloak compete for the same equip slot, which is correct (you can't wear two). Only
 *   // 'ring'/'amulet'/'charm' are new slot FAMILIES (each expands to several concrete slots —
 *   // ring1-4, amulet1-2, charm1-5 — matching dungeon-master-box's own existing, larger SLOT_CATEGORY
 *   // that the ported equipment.js had deliberately scoped down from until this type existed to
 *   // occupy them; see equipment.js's own comment).
 */

/**
 * @typedef {Object} CompanionData
 * @property {'pet'|'mount'} companionType
 * @property {number} [ac]          // the companion's own combat stat — common on mounts (a Riding
 *   Horse, a Hippogriff), rare on pets; parsed directly from the same numeric `ac` field armor uses.
 * @property {number} [speed]       // walking speed in ft.
 * @property {number} [flySpeed]
 * @property {number} [swimSpeed]
 * @property {number} [climbSpeed]
 */

/**
 * @typedef {Object} LegacySource   // traceability back to dungeon-master-box's existing
 *   loot-data.js catalog — not a V2/mechanics concept, carried so a later save-compatibility phase
 *   can map a player's existing saved item (referenced by name/tier today) onto its new canonical
 *   id without re-running the whole migration's derivation logic.
 * @property {string} tier    // 'common'|'uncommon'|'rare'|'superrare'|'legendary'|'celestial'
 * @property {number} index   // position within that tier's array in loot-data.js at migration time
 * @property {string} name    // the item's original `name` field, verbatim
 */

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} name
 * @property {'weapon'|'armor'|'consumable'|'material'|'tool'|'wondrous'|'companion'} itemType   // enum will grow in later migration phases
 * @property {string} rarity        // keeps dungeon-master-box's existing loot-table rarity tiers verbatim
 * @property {number} [weight]
 * @property {string} [value]       // gp, matches existing loot-table formatting
 * @property {string} [flavorText]  // display only, NEVER parsed for mechanics — dungeon-master-box's
 *   `desc` field (the item's physical appearance/narrative flavor).
 * @property {string} [description]  // display only, NEVER parsed for mechanics — dungeon-master-box's
 *   `effect` field, preserved verbatim (Phase 15). Distinct from flavorText: this is what the item
 *   DOES in the original prose, kept as a backstop even when a structured facet already captures
 *   the real mechanic, so nothing from the legacy catalog is ever silently unreadable in canonical
 *   data. Same convention as Ability.description below.
 * @property {boolean} [requiresAttunement]
 *
 * @property {WeaponData} [weapon]        // weapon only, required for weapon
 * @property {ArmorData} [armor]          // armor only, required for armor
 * @property {ConsumableData} [consumable] // consumable only, required for consumable
 * @property {MaterialData} [material]    // material only, required for material
 * @property {ToolData} [tool]            // tool only, required for tool
 * @property {WondrousData} [wondrous]    // wondrous only, required for wondrous
 * @property {CompanionData} [companion]  // companion only, required for companion
 * @property {StatModifier[]} [passive]   // weapon/armor/tool/wondrous/companion only — a mount's
 *   "+N to attack rolls made while mounted" is the one recurring companion mechanic this migration
 *   extracts, via the standard 'attackRoll' StatModifier key.
 * @property {Ability[]} [abilities]      // weapon/armor/wondrous only
 * @property {Grants} [grants]            // weapon/armor/wondrous only
 * @property {string[]} [appliedModifiers] // ids of Modifiers (see modifiers.js) baked into this instance
 *
 * @property {LegacySource} [legacySource]  // migration traceability, see LegacySource above
 * @property {{unlocks?: Array<Object>}} [narrative]  // preserved verbatim, presentation-only —
 *   e.g. dungeon-master-box's "Hidden Power" `unlocks` tier system. Never read by any mechanics
 *   function in this engine; the DM/UI layer is the only consumer.
 */

export function blankItem(itemType) {
  const base = { id: '', name: '', itemType, rarity: 'common' };
  if (itemType === 'weapon') return { ...base, weapon: { damageDice: '1d6', damageType: 'bludgeoning', weaponCategory: 'simple' } };
  if (itemType === 'armor') return { ...base, armor: { armorType: 'light', baseAC: 11, addsDexMod: true } };
  if (itemType === 'consumable') return { ...base, consumable: { consumableCategory: 'potion', effects: [] } };
  if (itemType === 'material') return { ...base, material: { materialTags: [] } };
  if (itemType === 'tool') return { ...base, tool: { toolCategory: '' } };
  if (itemType === 'wondrous') return { ...base, wondrous: {} };
  if (itemType === 'companion') return { ...base, companion: { companionType: 'pet' } };
  return base;
}
