// Ported verbatim from dungeonboxnewVersion2_rework's src/engine/character/stat-modifiers.js —
// see docs/V2_MECHANICS_MIGRATION.md. A generic StatModifier aggregator — the same {stat, value}
// shape traits use, and weapon/armor items' `passive` facet reuses too.
//
// Supported `stat` values: 'ac', 'hp_max', 'speed', an ability abbreviation ('str'|'dex'|'con'|
// 'int'|'wis'|'cha' — bumps that ability's MODIFIER, not the raw score, so it doesn't
// retroactively change proficiency-bonus math), an exact skill name from SKILL_ABILITY_MAP (e.g.
// 'Stealth'), `save_<abbr>` (e.g. 'save_dex'), or 'attackRoll'/'damageRoll' (a flat bonus to
// attack/damage rolls, consumed by combat/attack.js's getAttackBonus/getDamageBonus once an item
// is equipped). Unrecognized stat values are simply never summed by anything — each consumer only
// asks for the keys it knows about — so an unsupported value doesn't error, it just has no effect
// yet.

export function collectStatMods(traits = []) {
  return traits.flatMap(t => t.statMods || []);
}

export function sumModifier(statMods, stat) {
  return statMods.filter(m => m.stat === stat).reduce((sum, m) => sum + m.value, 0);
}
