// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/character/ability-scores.js —
// see docs/V2_MECHANICS_MIGRATION.md. Same values as this repo's own game-engine.js
// ABILITY_NAMES/SKILL_ABILITY_MAP/abilityModifier/proficiencyBonusForLevel — kept, just relocated
// into the new structured engine so item/equipment mechanics can import one canonical copy.

export const ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

export const SKILL_ABILITY_MAP = {
  'Athletics': 'str',
  'Acrobatics': 'dex', 'Sleight of Hand': 'dex', 'Stealth': 'dex',
  'Arcana': 'int', 'History': 'int', 'Investigation': 'int', 'Nature': 'int', 'Religion': 'int',
  'Animal Handling': 'wis', 'Insight': 'wis', 'Medicine': 'wis', 'Perception': 'wis', 'Survival': 'wis',
  'Deception': 'cha', 'Intimidation': 'cha', 'Performance': 'cha', 'Persuasion': 'cha',
};

export function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

// There is no built-in proficiency bonus at all: it comes only from gear or feats that say
// "+N to your proficiency bonus" (see game-engine.js's copy, collectProficiencyBoost).
export function proficiencyBonusForLevel(level) {
  return 0;
}
