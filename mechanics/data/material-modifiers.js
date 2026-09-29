// Real materials mechanics for dungeon-master-box's V2-mechanics migration — see
// docs/V2_MECHANICS_MIGRATION.md's Materials section for the full rationale.
//
// Legacy content check performed before writing this file: across the entire 1,243-item catalog,
// mithral/adamantine appear only as classification-label keyword matches (zero mechanical effect
// anywhere in game-engine.js or the monolith); "silvered" appears exactly once, in a single NPC's
// flavor text, not as an item or a mechanic; "masterwork" does not appear anywhere in the
// codebase. There was no existing behavior to preserve for any of the four — this content is new
// game design, built to the standard 5e rules for each material rather than invented from scratch:
//   - Silvered: a silvered weapon overcomes certain creatures' resistance/immunity to nonmagical
//     bludgeoning/piercing/slashing damage. Purely mundane on its own (not magical).
//   - Mithral: as light armor for the purposes of stealth and Strength requirements regardless of
//     its actual armor type — modeled here as clearing stealthDisadvantage/strengthRequirement
//     outright (the two mechanical effects those requirements have in this schema) — and halves
//     weight, matching mithral's real-world/5e "lighter than steel" characterization used elsewhere
//     in this catalog's own flavor text.
//   - Adamantine: any critical hit against the wearer becomes a normal hit; an adamantine weapon
//     automatically scores a critical hit against objects (not creatures).
//   - Masterwork: a purely mundane +1 to attack rolls only (no damage bonus, no AC bonus) —
//     explicitly NOT magical, distinct from a true +1 weapon/armor.
//
// These are migration-time modifiers, applied by scripts/migrate-legacy-content.js when an
// existing item's name/desc/effect names one of these materials — see that script's
// `applyMaterialModifiers` for the detection rules — not hand-applied to any specific item here.

export const MATERIAL_MODIFIERS = {
  silvered: {
    id: 'material-silvered',
    name: 'Silvered',
    appliesTo: ['weapon'],
    rarity: 'common',
    magical: false,
    weaponOverrides: { ignoresNonmagicalResistance: true },
    nameTemplate: '{base} (Silvered)',
  },
  mithral: {
    id: 'material-mithral',
    name: 'Mithral',
    appliesTo: ['armor'],
    rarity: 'uncommon',
    weightMultiplier: 0.5,
    armorOverrides: { stealthDisadvantage: false, strengthRequirement: undefined },
    nameTemplate: '{base} (Mithral)',
  },
  adamantine: {
    id: 'material-adamantine',
    name: 'Adamantine',
    appliesTo: ['weapon', 'armor'],
    rarity: 'uncommon',
    weaponOverrides: { autoCritVsObjects: true },
    armorOverrides: { critImmuneWhileWorn: true },
    nameTemplate: '{base} (Adamantine)',
  },
  masterwork: {
    id: 'material-masterwork',
    name: 'Masterwork',
    appliesTo: ['weapon', 'armor'],
    rarity: 'common',
    magical: false,
    passiveMods: [{ stat: 'attackRoll', value: 1 }],
    nameTemplate: '{base} (Masterwork)',
  },
};
