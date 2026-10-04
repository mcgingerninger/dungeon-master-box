# Weapon stat scaling

Every weapon carries a letter grade per stat. **Damage** = weapon dice + (grade multiplier × your
stat modifier, summed over the weapon's stats) + weapon bonuses. **To hit** = d20 + proficiency (only
if proficient) + the weapon's own "+N to attack" — ability modifiers and scaling never affect hitting,
only damage (and spell save DCs).

| Grade | S | A | B | C | D | E |
|---|---|---|---|---|---|---|
| Multiplier | 1.25 | 1.0 | 0.75 | 0.5 | 0.25 | 0.1 |

- The best-graded stat counts at its signed value (a weak primary stat hurts); other stats only add.
- The total is rounded to a whole number.

## Where grades come from (`game-engine.js`, "WEAPON STAT SCALING")
1. `item.scaling` (e.g. `{ str:'A', int:'C' }`) if the item authors one — always wins.
2. Otherwise the default for its kind (`WEAPON_SCALING_BY_KIND`), found from name keywords
   (`weaponScalingKind`), then the description for named uniques, then slot size.
3. Rarity lifts it: Super Rare +1 grade on the main stat; Legendary/Celestial +1 on the best two.
   A finesse weapon is at least DEX B.

## Spell-focus staves, wands, rods
`inferSpellFocus` gives them a casting stat (from "attunement by a wizard/cleric/..." or keywords),
a grade by rarity, and a **buff** that varies staff to staff: `damage` (stat-scaled spell damage),
`attack` (flat +1..+3 by rarity) or `both` (half of each). Authored `item.spellFocus = { stat,
grade, buff, attackBonus }` or "+N to spell attack rolls" in the effect text overrides it. The
numbers show in the tooltip and are appended to the cast message when the staff is equipped.

Tooltips, loot cards and the attack popup all read the same functions. Tests: `game-engine.test.js`.
