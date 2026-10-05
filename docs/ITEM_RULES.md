# Item Rules

One rule set and one weight table govern **every** item source: the default catalog (`loot-data.js`),
rolled loot (wheel, chests, corpses, combat), Store wares, the Generate Item tab, Fleshmancer limbs
and Monster Mangler results. There are no per-source exceptions.

Files

| File | Role |
|---|---|
| `mechanics/data/item-rules-default.js` | the default config: weights, rarity bands, price bands, rules |
| `mechanics/engine/items/item-rules.js` | pure engine: `scoreText`, `scoreItem`, `rarityForWeight`, `priceForWeight`, `evaluateItem`, `mergeItemRules` |
| `scripts/enforce-item-rules.js` | one-shot catalog fixer + `--audit`; writes `docs/ITEM_RULES_AUDIT.md` |
| DM Controls → **⚖ Item Rules** | edit the config in the app, simulate sources, audit the catalog, export/import JSON |

## Weight decides rarity and price

Every modifier has a weight (the "Modifier weights" tables in the panel):

- a stat boost is weight-per-+1 × amount (Strength 1, Armor Class 1.5, Maximum Hit Points 0.1, skills 0.4, Proficiency Bonus 2.5, Damage Dealt 1.2 ...)
- beneficial conditions, inflicted conditions, spells, summons, transformations, charges and so on have their own weights
- drawbacks are **negative** weights (Fatigued −1.5, Cannot Remove This Item ... −3)
- activated effects (a buff you trigger "1× per day") are scaled down by an activation factor; ally-targeted ones and drawbacks have their own factors
- named affixes (Masterful, Voidsteel ...) have a weight by name

An item's **total weight** picks its rarity from the rarity bands:

| Rarity | Weight from | Price band (gp) |
|---|---|---|
| Common | 0 | 5 – 50 |
| Uncommon | 2 | 25 – 300 |
| Rare | 5 | 150 – 1,000 |
| Super Rare | 8 | 1,000 – 10,000 |
| Legendary | 12 | 8,000 – 50,000 |
| Celestial | 18 | 30,000 – 100,000 |

Where the weight sits inside its band picks the gp inside the rarity's price band (geometric
interpolation, rounded to a "nice" number). Nothing may ever cost more than 100,000 gp.

## Rules

Each rule has an on/off switch, a severity (`error` / `warn`) and parameters, all editable.

| Rule | Default |
|---|---|
| No modifiers to attack rolls — modifiers only add to damage | error; forbidden stats: Attack Bonus, Attack Rolls, Spell Attack |
| No items with only bad modifiers — a drawback needs at least one real benefit | error; minimum benefit 1 |
| Modifier limit by rarity | common 2, uncommon 3, rare 4, super rare 5, legendary 6, celestial 7 |
| No stacking the same stat boost | error |
| Cap on "+N to your proficiency bonus" | max +4 per item |
| Rarity follows weight | error; catalog tolerance ±2 rarity steps, generated items exact |
| GP follows weight | warn; ±15 % |
| Price caps | 100,000 gp overall, 1,000 gp for Rare |

An individual item may list `rulesExempt: ["rule-id", ...]` for a deliberate exception (one catalog item uses it).
Chests, quest items, documents, "Unknown"-priced unique pieces and raw monster-part crafting
materials are exempt from the rarity/price rules only (`isValueExempt`).

## How each source obeys the rules

- **Store wares and Generate Item** share `buildItemUnderRules`: stats, affixes and modifiers are rolled
  together, scored, and re-rolled (up to 80 attempts; the allowed modifier count widens as attempts fail) until the item passes every `error` rule **and**
  its weight lands in the requested rarity's band. Then gp = `priceForWeight`. In 600 store rolls and 240 Generate Item rolls across all six
  rarities there were 0 violations and 0 re-rated items; the simulator in the panel reproduces this with your own settings.
- **Generated stat pools** never offer attack-roll stats (`Attack Bonus`, `Attack Rolls`, "Advantage on Attack Rolls" ...); named traits that
  used one (Frenzied, Berserk ...) swap it for Damage Dealt.
- **Default catalog** was fixed by `scripts/enforce-item-rules.js`: 375 catalog items + 5 NPC weapons had attack modifiers converted
  to damage-only, 58 items moved to the tier their weight earns (or because they exceeded the modifier cap), 1,027 items repriced;
  1,249 / 1,249 items now pass. Saved copies in a player's save follow their catalog twin on load, including the new tier.
- **Rolled loot** (wheel, chests, corpses, combat, bounty chests) draws from the catalog and so inherits the fix. A DM setting (DM Controls → ⚖ Item Rules → *Rolled loot*, default 25 %) makes that share of slots a freshly **generated** item instead, built by the same rule-enforcing builder as Store wares; 0 % keeps loot catalog-only.
- **Fleshmancer limbs** re-roll their effects until they pass the rules, then take rarity and price from weight.
  Monster-part **grafts** use their own effect table; its entries were converted to damage-only and every roll tested passes the rules,
  but their rarity comes from the source part, not from weight.
- **Monster Mangler** checks the finished item against the rules before consuming anything (it refuses a combination that breaks the
  modifier cap or another rule) and re-rates and re-prices the item upward if the infusion pushes it into a higher band.

## Modifiers that used to touch attack rolls

Sharp, Heavy, Balanced, Rusty, Silvered, Voidsteel, the Masterwork material and the monster-part effects Keen Eye, Quick Strike,
Charging Point, Furious Heart, Talon Strike, Diving Strike, Hunter's Focus, Numbing Venom, Nimble Grip and Spell Conduit are now
damage-only. **Open design point:** a spell-focus staff keeps its built-in focus feature (`inferSpellFocus`: a staff can buff spell damage
*or* chance to hit), because that was requested separately and is not an item modifier; say if staffs should become damage-only too.

## Do the effects reach the character sheet?

Checked by generating 1,500 Store items and testing every modifier type against the sheet engine:

| Effect | Reaches the sheet? |
|---|---|
| Passive stat boosts and drawbacks (abilities, AC, Max HP, speed, saves, the 18 skills) from affixes, traits, self-curses and skill aptitudes | **Yes.** Generated items used to be invisible to the sheet because they carry `mods`, not `effect`; `itemMechanicsText` now turns the passive mods into sheet text |
| Invented skills (Trap Expertise ...), Initiative, Spell Save DC, Damage Dealt, Critical Hit Range, Healing Received, senses, extra speeds, carrying capacity | **Yes**, listed under the sheet's "other bonuses"; Initiative shows on the init banner, Spell Save DC feeds spell save DCs, Damage Dealt adds to every weapon hit. Critical Hit Range, Healing Received, senses, extra speeds and carrying capacity are shown but not yet applied to any roll |
| Weapon damage bonuses and bonus damage dice (Sharp, Flaming, Vicious ...) | **Yes**, in the attack popup |
| "+N to your proficiency bonus" | **Yes** (sum of gear and feats) |
| Activated effects (buffs "1× per day", spells, summons, transformations, potion effects) | Usable from the ability bar; timed buffs flow to the sheet while active |
| Situational or narrative effects: Adamantine (no crits), Warded (chosen resistance), Grounded, Silent (advantage on Stealth), Reflective, Vampiric, Mithral's weight rule | **Display only** — the sheet has no advantage/resistance tracking, so the table adjudicates them |

## Managing the rules

DM Controls → **⚖ Item Rules**: rule switches and parameters, rarity and price bands, every modifier weight, a simulator (roll N Store or
Generate Item items and see the rarity/weight/price distribution and rule violations) and a catalog audit. Settings are saved in this
browser (`localStorage` key `dmItemRules`). **Export JSON / Import JSON / Reset** move the whole config to a file and back; the file
is the same structure as `DEFAULT_ITEM_RULES`, and an imported file is merged defensively over the defaults.

To re-apply the rules to the catalog after changing the defaults: `node scripts/enforce-item-rules.js` (use `--dry` or `--audit` to look first),
then `npm run migrate`.
