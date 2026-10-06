// The default Item Rules configuration — the ONE place that says how much each modifier is worth and
// which rules every item (default catalog, rolled loot, shop wares, generated items) must follow.
//
// Everything here is plain JSON-serializable data on purpose: the DM's "Item Rules" panel edits a
// copy of it (stored with the campaign) and can export/import it as a JSON file.
//
// HOW IT WORKS
//  - Every modifier an item can carry has a WEIGHT (points). An item's total weight is the sum of its
//    modifiers' weights (beneficial = positive, drawbacks = negative).
//  - The item's RARITY is decided by that total weight (rarityBands).
//  - The item's GP VALUE is decided by where its weight falls inside its rarity's band (priceBands).
//  - RULES (rules[]) are checks every item must pass; shops, loot rolls and the default catalog all
//    use the same ones — there are no per-source exceptions.
// See docs/ITEM_RULES.md.

// Points per +1 of a numeric ("scalar") stat. Keys are the exact stat names the generators and the
// catalog text use ("+2 Strength", "+5 Movement Speed"...). A drawback of -N costs penaltyFactor ×
// N × the same weight.
export const SCALAR_WEIGHTS = {
  'Strength': 1, 'Dexterity': 1, 'Constitution': 1, 'Intelligence': 1, 'Wisdom': 1, 'Charisma': 1,
  'Attack Bonus': 1, 'Attack Rolls': 1, 'Spell Attack': 1,
  'Armor Class': 1.5, 'Maximum Hit Points': 0.1, 'Movement Speed': 0.08, 'Saving Throws': 1,
  'Spell Save DC': 1.2, 'Critical Hit Range': 2, 'Damage Dealt': 1.2, 'Initiative': 0.4,
  'Spell Slot Level': 2, 'Darkvision Range (feet)': 0.01, 'Tremorsense Range (feet)': 0.015,
  'Telepathy Range (feet)': 0.01, 'Fly Speed (feet)': 0.05, 'Swim Speed (feet)': 0.03,
  'Burrow Speed (feet)': 0.03, 'Carrying Capacity (lbs)': 0.004, 'Number of Attacks': 3,
  'Healing Received': 0.3, 'Aura Radius (feet)': 0.02, 'Weapon Range (feet)': 0.02,
  'Cantrip Damage Dice': 1.5, 'Proficiency Bonus': 2.5, 'Regeneration (HP per turn)': 0.8,
  'Sneak Attack Dice': 1.2, 'Bardic Inspiration Die (size)': 0.3, 'Divine Smite Damage Dice': 1.2,
  'Ki Points': 0.8, 'Rage Damage Bonus': 1, 'Superiority Dice': 1, 'Eldritch Blast Damage Dice': 1.5,
  'Hex Damage Dice': 1, "Hunter's Mark Damage Dice": 1, 'Haste Bonus (extra attacks)': 3,
  'Death Saving Throws': 0.8, 'Saving Throws vs Magic': 1.2, 'Critical Hit Damage': 1.5,
  // skill / check bonuses
  'Stealth': 0.4, 'Perception': 0.4, 'Persuasion': 0.4, 'Intimidation': 0.4, 'Deception': 0.4,
  'Insight': 0.4, 'Athletics': 0.4, 'Acrobatics': 0.4, 'Arcana': 0.4, 'History': 0.4, 'Medicine': 0.4,
  'Nature': 0.4, 'Religion': 0.4, 'Survival': 0.4, 'Animal Handling': 0.4, 'Sleight of Hand': 0.4,
  'Skill Checks': 0.4,
};
// Stats not listed above fall back to this weight per +1.
export const DEFAULT_SCALAR_WEIGHT = 0.5;

// Points for a named (non-numeric) beneficial effect the bearer gets.
export const CONDITION_WEIGHTS = {
  'Advantage on Attack Rolls': 2.5, 'Advantage on Saving Throws': 2, 'Advantage on Death Saving Throws': 1,
  'Advantage on Concentration Checks': 1, 'Immunity to Fear': 1.2, 'Immunity to Poison': 1.5,
  'Immunity to Disease': 1, 'Immunity to Critical Hits': 3, 'Truesight (30 feet)': 3,
  'Blindsight (30 feet)': 2, 'Resistance to Fire Damage': 2, 'Resistance to Cold Damage': 2,
  'Resistance to Lightning Damage': 2, 'Resistance to Necrotic Damage': 2, 'Resistance to Radiant Damage': 2,
  'Resistance to Psychic Damage': 2.5, 'Resistance to Poison Damage': 2, 'Cannot Be Charmed': 1.5,
  'Cannot Be Frightened': 1.5, 'Cannot Be Paralyzed': 2.5, 'Water Breathing': 0.8, 'Never Needs to Sleep': 0.8,
  'Immune to Exhaustion': 1.2, 'Temporary Hit Points': 0.8, 'Instant Healing': 1.2,
  'Blessed (add 1d4 to attack rolls and saving throws)': 2, 'Hasted (one extra action)': 3,
  'Guarded (damage taken is halved)': 3, 'Warded (advantage on the next saving throw)': 1,
};
// Weight for any other "Resistance to X"/"Immunity to X"/"Advantage on X" the text mentions.
export const GENERIC_CONDITION_WEIGHTS = { resistance: 2, immunity: 3, advantage: 1.5, disadvantageOnTarget: 1.5 };

// Conditions an item can inflict on a TARGET (a benefit to the bearer).
export const INFLICT_WEIGHTS = {
  Blinded: 2.5, Charmed: 3, Deafened: 1, Frightened: 2.5, Grappled: 1.5, Incapacitated: 4, Paralyzed: 4,
  Petrified: 5, Poisoned: 1.5, Prone: 1.5, Restrained: 2.5, Stunned: 4, Exhaustion: 2, Silenced: 2,
  'Cannot Use Reactions': 1.5, 'Cannot Regain Hit Points': 1.5, 'Cannot Benefit from Rest': 1,
  Vulnerability: 2, Marked: 1.5, Cursed: 2, Doomed: 5, Confused: 3, Compelled: 3, 'Soul-Marked': 2.5, Slowed: 2,
};
export const DEFAULT_INFLICT_WEIGHT = 2.5;

// Drawbacks the bearer suffers. Negative points.
export const DRAWBACK_WEIGHTS = {
  Fatigued: -1.5, Frightened: -1.5, 'Cannot Remove This Item Without Remove Curse': -3,
  'Cannot Regain Hit Points from Resting': -2.5, 'Disadvantage on Saving Throws vs Magic': -2,
  'Disadvantage on Concentration Checks': -1, Vulnerability: -2, 'Randomly Poisoned Once per Day': -1.5,
  Haunted: -1.5, 'Slowed Once per Day': -1, 'Marked by Darkness': -1, 'Weakened Resolve': -1,
  'Whispering Curse': -1, 'Cannot Cast Spells': -3, 'Cannot Benefit from Long Rests': -3, 'Drawn to Danger': -1,
};
export const DEFAULT_DRAWBACK_WEIGHT = -1.5;

export const KIND_WEIGHTS = {
  // fixed points per occurrence
  spellGrant: 2.5,         // "Grants the ability to cast X (N× per day)" — before the uses factor
  spellPerLevel: 0.4,      // extra per spell level named in "(3)" style lists
  summon: 3, transform: 3, monsterSkill: 2.5, flight: 2.5, extraDamageDicePerAvg: 0.35,
  skillBonusPerPoint: 0.4, resistance: 2, immunity: 3, advantageClause: 1.5,
  chargePerCharge: 0.15, dailyUse: 0.8, unlockTier: 1.5, genericClause: 0.5, genericClauseCap: 3,
  proficiencyPerPoint: 2.5, damageBonusPerPoint: 1.2, attackBonusPerPoint: 1, acPerPoint: 1.5,
  statPerPoint: 1, hpPer5: 0.5,
};

// Weapon / armor prefix modifiers (ITEM_AFFIXES) that carry no number the text parser can read.
// Numeric ones are scored from their text. Keys are the affix names.
export const AFFIX_WEIGHTS = {
  Rusty: -0.5, Iron: 0, Steel: 1.2, Silvered: 1, Mithral: 2, Adamantine: 2.5, Dragonbone: 3, Voidsteel: 4,
  Runic: 2, Ancient: 4, Sharp: 1, Heavy: 0.5, Balanced: 2, Flaming: 2, Frost: 2.5, Shocking: 2, Venomous: 2.5,
  Radiant: 3, Vicious: 2.5, Masterful: 5, Vampiric: 4, Sturdy: 1.5, Warded: 2, Padded: 1, Silent: 1,
  Reflective: 1.5, Grounded: 0.8, Mighty: 1, Nimble: 1, Hardy: 1, Brilliant: 1, Wise: 1, Charismatic: 1,
  // item-affixes.js — materials
  Bronze: 0.3, Bone: 0.5, Obsidian: 1, Ironwood: 1.2, Heartwood: 1.5, Dwarven: 1.2, Elven: 1.2, Coldiron: 1.2, Meteoric: 2.4,
  Moonsilver: 2.4, Sunsteel: 2.4, Bloodsteel: 2.4, Blacksteel: 2, Hellforged: 2.4, Shatterglass: 2, Orichalcum: 3, Wraithsteel: 3.5, Celestine: 3,
  // enchantments: damage types and combat tricks
  Thundering: 2, Corrosive: 2, Impact: 2, Wasting: 3, Mindrending: 3, Searing: 2.5, Sporing: 2, Prismatic: 4.5,
  Barbed: 1, Cleaving: 1.5, Brutal: 2, Crushing: 1.5, Dueling: 1.5, Tactical: 1.5, Tidal: 1.5, Gale: 2, Dazzling: 2, Rending: 2.5,
  Seeking: 1.5, Returning: 1.5, Parrying: 1.5, Quickdraw: 0.8, Hushed: 1, Luminous: 0.5, Sundering: 2, Reaching: 2, Quaking: 2.5,
  Berserking: 2.5, Hungering: 2, Lucky: 2, Executing: 3.5, Gravitic: 3, Soulreaver: 3.5, Temporal: 4,
  // slayers
  Beastbane: 1.2, Plantbane: 1.2, Oozebane: 1.2, Giantbane: 1.2, Undeadbane: 1.2, Constructbane: 1.2,
  Aberrationbane: 2, Elementalbane: 2, Fiendbane: 2, Dragonbane: 2,
  // stat prefixes
  Swift: 0.4, Hale: 0.5, Vigilant: 0.4, Watchful: 0.4, Lurking: 0.4, Fearsome: 0.4, Persuasive: 0.4, Brawny: 0.4,
  Agile: 0.4, Learned: 0.4, Wayfaring: 0.4, Restorative: 0.3,
};

// Weight a temporary (not permanent) effect keeps: base, +per extra daily use, +by duration.
export const ACTIVATION = {
  base: 0.3, perExtraUse: 0.12, cap: 1,
  durationBonus: [[/\b(?:1|one) minute\b/i, 0], [/\b(?:5|10) minutes\b/i, 0.05], [/\b(?:30 minutes|1 hour|one hour)\b/i, 0.1],
                  [/\b(?:2|4|8) hours\b/i, 0.2], [/\b24 hours\b|\b1 day\b/i, 0.3]],
  alliesFactor: 0.8,       // granting a buff to allies instead of yourself
  penaltyFactor: 0.6,      // a self-inflicted -N costs this fraction of the same +N
};

// Weight bands: an item's total weight picks its rarity. [from, to) — the last is open-ended.
export const RARITY_BANDS = {
  common:    [0, 2],
  uncommon:  [2, 5],
  rare:      [5, 8],
  superrare: [8, 12],
  legendary: [12, 18],
  celestial: [18, Infinity],
};

// Price band (gp) per rarity — position inside the weight band picks the price inside this range.
export const PRICE_BANDS = {
  common:    [5, 50],
  uncommon:  [25, 300],
  rare:      [150, 1000],
  superrare: [1000, 10000],
  legendary: [8000, 50000],
  celestial: [30000, 100000],
};
export const GP_HARD_CAP = 100000;

// The rules every item must follow. `enabled` can be switched in the DM panel; `params` tune them.
export const DEFAULT_RULES = [
  { id: 'no-attack-roll-modifiers', enabled: true, severity: 'error', label: 'No modifiers to attack rolls',
    desc: 'Modifiers only ever add to damage — nothing may add to or subtract from the to-hit roll.',
    params: { forbiddenStats: ['Attack Bonus', 'Attack Rolls', 'Spell Attack'] } },
  { id: 'no-only-bad-modifiers', enabled: true, severity: 'error', label: 'No items with only bad modifiers',
    desc: 'An item that carries a drawback must also carry at least one real benefit.', params: { minBenefit: 1 } },
  { id: 'max-modifiers-by-rarity', enabled: true, severity: 'error', label: 'Limit modifiers by rarity',
    desc: 'The most distinct modifiers an item of each rarity may carry.',
    params: { common: 2, uncommon: 3, rare: 4, superrare: 5, legendary: 6, celestial: 7 } },
  { id: 'no-duplicate-stat-boost', enabled: true, severity: 'error', label: 'No stacking the same stat boost',
    desc: 'An item cannot boost the same stat twice.', params: {} },
  { id: 'proficiency-boost-cap', enabled: true, severity: 'error', label: 'Cap proficiency bonus boosts',
    desc: 'The most "+N to your proficiency bonus" a single item may give.', params: { max: 4 } },
  { id: 'rarity-matches-weight', enabled: true, severity: 'error', label: 'Rarity follows modifier weight',
    desc: 'An item\'s rarity must be the one its total modifier weight falls in, give or take this many rarity steps. Generated items are built to match exactly; hand-authored catalog items get the tolerance.',
    params: { tolerance: 2 } },
  { id: 'price-matches-weight', enabled: true, severity: 'warn', label: 'GP value follows modifier weight',
    desc: 'An item\'s gp value must be the price its weight earns inside its rarity (± tolerance %).',
    params: { tolerancePct: 15 } },
  { id: 'price-caps', enabled: true, severity: 'error', label: 'Price caps',
    desc: 'No item above 100,000 gp; no Rare item above 1,000 gp.', params: { hardCap: 100000, rareCap: 1000 } },
];

// Sources of items. Every source uses the SAME weights and rules; this list only exists so the DM
// panel can show and simulate each one (and so a source can be switched off entirely).
export const SOURCES = [
  { id: 'catalog', label: 'Default catalog items' },
  { id: 'loot', label: 'Rolled loot (wheel, chests, corpses, combat)' },
  { id: 'store', label: 'Store wares' },
  { id: 'generate', label: 'Generate Item tab' },
];

export const DEFAULT_ITEM_RULES = {
  version: 1,
  weights: { scalar: SCALAR_WEIGHTS, conditions: CONDITION_WEIGHTS, inflict: INFLICT_WEIGHTS, drawbacks: DRAWBACK_WEIGHTS, affixes: AFFIX_WEIGHTS, kinds: KIND_WEIGHTS, activation: { base: ACTIVATION.base, perExtraUse: ACTIVATION.perExtraUse, cap: ACTIVATION.cap, alliesFactor: ACTIVATION.alliesFactor, penaltyFactor: ACTIVATION.penaltyFactor } },
  rarityBands: { common: [0, 2], uncommon: [2, 5], rare: [5, 8], superrare: [8, 12], legendary: [12, 18], celestial: [18, 1e9] },
  priceBands: PRICE_BANDS,
  rules: DEFAULT_RULES,
};
