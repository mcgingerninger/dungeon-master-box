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

## Every stat is shown

A weapon scales with all six abilities. A stat the weapon has no real affinity for is rank **E** (×0.1) rather than missing, so a plain
club still lists INT E. Hover tooltips and the attack popup always show all six grades (STR · DEX · CON · INT · WIS · CHA).

## Armor scaling (AC)

Every armor piece carries the same six letter grades, and they add to **AC** instead of damage: grade multiplier × stat modifier,
the best-graded stat at its signed value and the rest only adding, rounded. Only the **best grade per stat across everything worn**
counts, so a DEX A gauntlet lifts heavy armor's DEX but a full set never stacks the same modifier twice.

| Kind | Default grades |
|---|---|
| Light body armor | DEX A |
| Medium body armor | DEX C · STR D · CON D |
| Heavy body armor | STR C · CON D · DEX E |
| Shield | STR C · CON D |
| Helm | CON C · WIS D |
| Gauntlets / bracers | DEX C · STR D |
| Boots / greaves | DEX C · CON D |
| Cloak | DEX D · CHA D |
| Belt | CON C · STR D |

No body armor counts as DEX A (10 + Dex, as before). Rarity lifts grades exactly like weapons (Super Rare +1 on the main stat, Legendary/Celestial
+1 on the best two); `item.scaling` authors them; armor made for casters adds its casting stat at C. This replaces the old flat rule (light = full Dex,
medium = Dex capped at +2, heavy = none): the character sheet lists "Armor scaling (…)" as an AC source and the tooltip shows
"your AC bonus +N". Code: `inferArmorScaling`, `computeArmorScalingAc`, `armorPieceKind` in `game-engine.js`.

## Spell focus on every magical item

Staves, wands and rods already had a focus (above). Every other magical item (rings, cloaks, amulets, armor, trinkets — anything not
common-and-mundane, or with spell/charge/attunement text) now has one too: a casting stat (from its attunement classes or keywords) and a grade
one step below a real focus (Common/Uncommon D, Rare C, Super Rare B, Legendary/Celestial A), shown as "✦ Focus" on its tooltip.
A focus only **adds** when its item casts spells or deals damage (`itemFocusActive`); otherwise the tooltip says there is nothing to boost.
When active it adds scaled stat modifier to **spell damage** and half of it to the **spell save DC** of every spell you cast
(`computeSpellFocusBonus`, `computeSpellFocusDc`); a staff's attack/both buffs are unchanged. Code: `inferItemSpellFocus`, `isMagicalItem`.
