# Weapon modifiers: side-by-side

Everything that can end up on a generated weapon, how many of each a weapon gets from each source, and how much it is worth.
Numbers were measured on the live code (600 weapons per source per rarity, random base weapon from the 31 in `WEAPON_BASE_TYPES`),
so they include the Item Rules re-rolling (`buildItemUnderRules`). "Weight" is the Item Rules total (see `docs/ITEM_RULES.md`): it decides the rarity and the gp price.

## 1. The five modifier systems a weapon can carry

| System | Where it lives | Entries that fit a weapon | Used by | Weighted how |
|---|---|---|---|---|
| **Named affixes** (`ITEM_AFFIXES`) — materials, enchantments, slayers, stat prefixes | monolith + `item-affixes.js` | **101** (was 27) | Generate tab, loot rolls, Store | `AFFIX_WEIGHTS` by name, or scored from the text when it has numbers |
| **General modifier pool** — power/spell, buff, debuff, trait, skill, monster skill, transform, summon | `generateModifierOfType`, `GEN` | ~108 spells (4/19/34/24/15/12 per rarity), 56+23 self buffs, 12+15 ally buffs, 18+18 self debuffs, 24+44 target debuffs, 51 named traits, 100 skill bonuses; monster skills, transformations and summons come from the monster database (115 fallback forms, 15 fallback summons) | Generate tab, loot rolls, Store | type weights `modWeights` (below), then scored by the Item Rules text parser |
| **Monster-part effects** (`MONSTER_PART_EFFECT_POOL`) | monolith | 62 weapon effects | Monster Mangler grafts | its own table; rarity comes from the source part |
| **Material modifiers** (`MATERIAL_MODIFIERS`) | `mechanics/data/material-modifiers.js` | 4 (Silvered, Mithral, Adamantine, Masterwork) | migration script only, not rolled | none — a flag set once on the catalog |
| **Hand-written catalog effects** (`loot-data.js`) | catalog | 405 weapons (21 / 120 / 132 / 82 / 39 / 11 by rarity) | the "normal" loot roll when the generated chance misses | text scored by the Item Rules; `scripts/enforce-item-rules.js` keeps it in range |

Of these, only the first two are rolled onto a generated weapon. The other three are separate tables with their own rules.

## 2. Generate tab vs loot-roll generated item vs Store

All three call `buildItemUnderRules` with the same base list (`GEN.weapon`), the same affix pool and the same general pool, then re-roll up to 80 times until the item obeys every Item Rule
and its weight lands in the requested rarity's band. Only the count and the category/rarity inputs differ:

| | Generate Item tab | Loot roll (`generateLootItem`) | Store (`generateStoreItem`) |
|---|---|---|---|
| Triggered by | the button | the *Rolled loot* slider (default 25 % of slots) | the daily wares |
| Rarity | the rarity buttons | the wheel / chest rarity | `pickRarity()` — the Rarity Chances sliders |
| Category | the category dropdown | the slot's allowed types | the merchant's allowed categories / subcategories |
| Modifier count (before the cap) | the *Modifiers* dropdown (default 2) +1 at legendary and celestial | fixed by rarity: 1–2 / 2 / 2–3 / 3 / 3–4 / 4 | random: 15 % three, 45 % two, 40 % one — **plus** the affixes |
| Counts affixes against the count | yes | yes | **no** (affixes are extra) |
| Hard cap (Item Rules) | 2 / 3 / 4 / 5 / 6 / 7 for common → celestial | same | same |

Measured, per weapon (affixes are included in "mods"; weight = Item Rules total):

| Rarity | Generate tab: mods | loot roll: mods | Store: mods | Generate: weight | loot: weight | Store: weight | affixes (all three) |
|---|---|---|---|---|---|---|---|
| Common | 2 | 1.4 | 1.73 | 1.2 | 0.9 | 1.1 | 0.52 |
| Uncommon | 2.04 | 2.03 | 2.65 | 2.6 | 2.6 | 2.8 | 0.55 |
| Rare | 2.74 | 3.06 | 3.66 | 5.8 | 5.8 | 6 | 1.72 |
| Super rare | 3.5 | 3.8 | 4.22 | 9.5 | 9.4 | 9.4 | 1.57 |
| Legendary | 3.95 | 4.24 | 4.9 | 14.1 | 14 | 14.1 | 2.59 |
| Celestial | 3.76 | 4.36 | 4.83 | 25.2 | 24.8 | 24.7 | 2.52 |

Affix counts roll the same everywhere (`AFFIX_COUNT_BY_RARITY`: 0–1, 0–1, 1–2, 1–2, 2–3, 2–3), which is why the last column is one number. Before and after this change the
averages are the same within noise (e.g. Generate, legendary: 2.43 → 2.49 affixes, weight 13.9 → 14.1); what changed is how many different affixes they are drawn from (below).

### Per source, in detail

**Generate tab**

| Rarity | mods / item | affixes / item | avg weight | rolls that change rarity |
|---|---|---|---|---|
| Common | 2 | 0.54 | 1.2 | 0% |
| Uncommon | 2.04 | 0.47 | 2.6 | 0% |
| Rare | 2.74 | 1.67 | 5.8 | 0% |
| Super rare | 3.5 | 1.49 | 9.5 | 0% |
| Legendary | 3.95 | 2.49 | 14.1 | 0% |
| Celestial | 3.76 | 2.5 | 25.2 | 0% |

**Loot roll**

| Rarity | mods / item | affixes / item | avg weight | rolls that change rarity |
|---|---|---|---|---|
| Common | 1.4 | 0.53 | 0.9 | 0% |
| Uncommon | 2.03 | 0.49 | 2.6 | 0% |
| Rare | 3.06 | 1.72 | 5.8 | 0% |
| Super rare | 3.8 | 1.51 | 9.4 | 0% |
| Legendary | 4.24 | 2.54 | 14 | 0% |
| Celestial | 4.36 | 2.47 | 24.8 | 0% |

**Store**

| Rarity | mods / item | affixes / item | avg weight | rolls that change rarity |
|---|---|---|---|---|
| Common | 1.73 | 0.5 | 1.1 | 0% |
| Uncommon | 2.65 | 0.7 | 2.8 | 0% |
| Rare | 3.66 | 1.78 | 6 | 0% |
| Super rare | 4.22 | 1.7 | 9.4 | 0% |
| Legendary | 4.9 | 2.74 | 14.1 | 0% |
| Celestial | 4.83 | 2.59 | 24.7 | 0% |

No source re-labels a rarity (the "changes rarity" column is 0 %): the builder keeps re-rolling instead.

### What the rest of the modifiers are made of

Type weights for the general pool (`modWeights`, editable in the Generate tab): power/spell 8, buff 7, debuff 5, trait 4, skill 4, monster skill 4, transform 3, summon 3.
Weapon tags nudge them (`SYNERGY_RULES`): a melee weapon boosts buff ×2 and skill ×2; a ranged weapon boosts skill ×2, buff ×1.8, power ×1.5; fire/cold/storm/arcane names boost power ×2–3.

Average non-affix modifiers per item, Generate tab: common — Buff 0.47, Power/Spell 0.29, Skill 0.27, Debuff 0.19, Trait 0.12, Summon 0.08, Transform 0.04; legendary — Buff 0.47, Trait 0.28, Power/Spell 0.2, Debuff 0.15, Skill 0.1, Monster Skill 0.1, Summon 0.08, Transform 0.08.

## 3. What changed in this pass

| | Before | After |
|---|---|---|
| Weapon affixes in the pool | 27 | **101** |
| …at common / uncommon / rare / super rare / legendary / celestial | 12 / 17 / 20 / 23 / 24 / 24 | **32 / 63 / 85 / 90 / 95 / 94** |
| Materials | Rusty, Iron, Steel, Silvered, Mithral, Adamantine, Dragonbone, Voidsteel | + **18** |
| Enchantments (damage types, tricks) | Sharp, Heavy, Balanced, Flaming, Frost, Shocking, Venomous, Radiant, Vicious, Masterful, Vampiric | + **34** |
| Slayers | — | **10** |
| Stat prefixes | Mighty, Nimble, Hardy, Brilliant, Wise, Charismatic | + **12** |
| Fits the base weapon | any | affixes carry a class filter (`bases`): no Ironwood longsword, no Seeking greatsword, no Reaching dagger |
| Stacking | any | one material and one slayer per weapon |
| Art | 15 effects, 42 materials | 20 effects (+ soul, prismatic, gravity, spore, time) and 52 materials (+ 10) |
| Description | appearance + closing only | an extra paragraph describing each affix (2 variants each) |

Weapon classes (`weaponClassesOf`): blade, axe, blunt, pole, whip, staff, ranged (bow / sling / crossbow), light, heavy, thrown, melee, metal, wood.

### New materials (18)

| Affix | Rarity | Fits | Effect (at the magnitude of its first rarity) | Weight by name (scored from text) |
|---|---|---|---|---|
| Bronze | Common – Uncommon | metal | No mechanical change — soft, old-fashioned metal that never rusts or corrodes. | 0.3 (0.5) |
| Bone | Common – Rare | melee | Weighs half as much as a metal weapon and makes no sound when drawn, sheathed or dropped. | 0.5 (0.5) |
| Obsidian | Common – Rare | blade, axe, pole | +1 to damage rolls — a glassy, razor edge — but brittle: on a natural 1 on the attack roll it chips and loses this bonus until repaired. | 1 (1.2) |
| Ironwood | Uncommon+ | wood | +1 to damage rolls — grown dense as steel, and it can't be burned, rotted or splintered by nonmagical means. | 1.2 (1.2) |
| Heartwood | Uncommon+ | wood | While you wield it and are below half your hit points, you regain 1 hit point at the start of each of your turns. | 1.5 (0.5) |
| Dwarven | Uncommon+ | metal | +1 to damage rolls, and the weapon cannot be damaged by acid, rust or sundering effects. | 1.2 (1.2) |
| Elven | Uncommon+ | blade, pole, ranged | +1 to damage rolls, and the weapon is light as a feather, weighing half as much as usual. | 1.2 (1.2) |
| Coldiron | Uncommon+ | metal | +1 to damage rolls against fey and fiends — raw, unrefined iron that spirits and devils cannot abide. | 1.2 (1.2) |
| Meteoric | Rare+ | metal | +2 to damage rolls, and the star-metal sheds dim light in a 10-foot radius while the weapon is drawn. | 2.4 (2.4) |
| Moonsilver | Rare+ | metal | +2 to damage rolls against shapechangers, lycanthropes and undead, and it ignores the damage resistance of creatures that resist nonmagical weapons. | 2.4 (4.4) |
| Sunsteel | Rare+ | metal | +2 to damage rolls against undead and creatures of shadow, and on command it sheds bright light in a 20-foot radius. | 2.4 (2.4) |
| Bloodsteel | Rare+ | metal | +2 to damage rolls against creatures at or below half their hit points. | 2.4 (2.4) |
| Blacksteel | Rare+ | metal | A creature hit by this weapon cannot regain hit points until the start of your next turn. | 2 (0) |
| Hellforged | Rare+ | metal | +2 to damage rolls, and fire damage dealt by this weapon ignores damage resistance. It is always warm to the touch. | 2.4 (2.9) |
| Shatterglass | Rare – Legendary | blade, axe, pole | On a critical hit, shards burst from the weapon, dealing 2d4 slashing damage to every other creature within 5 feet of the target. | 2 (1.75) |
| Orichalcum | Super rare+ | metal | +2 to damage rolls, and the weapon can't be broken, dulled or corroded by any means short of divine intervention. | 3 (2.4) |
| Wraithsteel | Super rare+ | metal | Its damage is magical and counts as force damage, and it ignores the damage resistance of creatures that resist nonmagical weapons. | 3.5 (2) |
| Celestine | Legendary+ | metal | +3d4 radiant damage on a hit, and once per long rest a hit lets you end one condition affecting you. | 3 (2.63) |

### New enchantments (34)

| Affix | Rarity | Fits | Effect (at the magnitude of its first rarity) | Weight by name (scored from text) |
|---|---|---|---|---|
| Thundering | Uncommon+ | any | +1d4 thunder damage on a hit, and the strike can be heard for 300 feet. | 2 (0.88) |
| Corrosive | Uncommon+ | any | +1d4 acid damage on a hit, and nonmagical armor worn by the target takes a permanent -1 penalty to its AC (once per armor). | 2 (0.88) |
| Impact | Uncommon+ | any | +1d4 force damage on a hit. | 2 (0.88) |
| Wasting | Rare+ | any | +2d4 necrotic damage on a hit, and the target can't regain hit points until the start of your next turn. | 3 (1.75) |
| Mindrending | Rare+ | any | +2d4 psychic damage on a hit. | 3 (1.75) |
| Searing | Rare+ | melee | Deals an extra 2d6 fire damage on a critical hit and ignites flammable objects the target carries. | 2.5 (2.45) |
| Sporing | Uncommon+ | melee | On a critical hit, spores burst in a 5-foot radius around the target, dealing 1d4 poison damage to every creature there. | 2 (0.88) |
| Prismatic | Legendary+ | any | On each hit, roll a d6: +3d4 fire, cold, lightning, acid, poison or radiant damage matching the result. | 4.5 (0.5) |
| Barbed | Common+ | blade, axe, pole, whip | On a hit, the target takes 1d4 bleeding damage at the start of its next turn. | 1 (0.5) |
| Cleaving | Common+ | axe, heavy | When you reduce a creature to 0 hit points with it, you deal 1d4 damage of the same type to another creature within 5 feet. | 1.5 (0.88) |
| Brutal | Uncommon+ | heavy, blunt, axe | +2 to damage rolls against creatures that are prone, grappled or restrained. | 2 (2.4) |
| Crushing | Uncommon+ | blunt | +1 to damage rolls against constructs, objects and creatures in heavy armor. | 1.5 (1.2) |
| Dueling | Uncommon+ | light, blade | +1 to damage rolls when no other creature is within 5 feet of your target. | 1.5 (1.2) |
| Tactical | Uncommon+ | any | +1 to damage rolls when an ally is within 5 feet of the target. | 1.5 (1.2) |
| Tidal | Uncommon+ | melee | +1 to damage rolls, and once per turn you can push a creature you hit 5 feet away from you. | 1.5 (0.36) |
| Gale | Uncommon+ | blade, pole, whip | +1 to damage rolls, and once per turn a creature you hit must succeed on a Strength saving throw or be pushed 10 feet away. | 2 (0.36) |
| Dazzling | Uncommon+ | any | On a critical hit, the target is blinded until the end of its next turn. | 2 (0.5) |
| Rending | Uncommon+ | pole, blade, ranged | Once per turn, damage from this weapon ignores damage resistance to its damage type. | 2.5 (0.6) |
| Seeking | Uncommon+ | ranged, thrown | On a miss, the shot still deals 1d4 damage to the target. | 1.5 (0.88) |
| Returning | Uncommon+ | thrown | When thrown, it returns to your hand at the end of your turn if it is within 60 feet. | 1.5 (0.5) |
| Parrying | Uncommon+ | blade, light, staff | +1 Armor Class while you wield it. | 1.5 (1.5) |
| Quickdraw | Common+ | any | You can draw or stow it as part of the same action or movement, without spending your free object interaction. | 0.8 (0.5) |
| Hushed | Common+ | melee | Makes no sound when it strikes, and you have advantage on Stealth checks made while you wield it. | 1 (1.5) |
| Luminous | Common+ | any | Sheds bright light in a 20-foot radius on command, and dim light for another 20 feet. | 0.5 (0.5) |
| Sundering | Rare+ | axe, blunt, pole | On a hit, the target's AC drops by 1 until the end of its next turn; the drops stack to a maximum of 3. | 2 (0.5) |
| Reaching | Rare+ | pole, whip | Your reach with this weapon increases by 5 feet. | 2 (0.5) |
| Quaking | Rare+ | blunt, axe | On a critical hit the target is knocked prone and each other creature within 5 feet takes 2d6 thunder damage. | 2.5 (0.5) |
| Berserking | Rare+ | heavy, axe, blunt | While you are at half your hit points or fewer, +3 to damage rolls. | 2.5 (3.6) |
| Hungering | Rare+ | any | When you reduce a creature to 0 hit points with it, you regain 4 hit points. | 2 (0.5) |
| Lucky | Rare+ | any | Once per long rest, you can reroll one damage roll made with it and use either result. | 2 (0.5) |
| Executing | Super rare+ | any | Deals an extra 2d8 damage to a creature that is below a quarter of its hit points. | 3.5 (3.15) |
| Gravitic | Super rare+ | melee | +2 to damage rolls, and once per turn you can pull or push a creature you hit up to 10 feet. | 3 (0.72) |
| Soulreaver | Legendary+ | any | When you reduce a creature to 0 hit points with it, you gain 3d8 temporary hit points. | 3.5 (0.5) |
| Temporal | Legendary+ | any | Once per short rest, after rolling damage with this weapon, you can reroll the damage dice and take either result. | 4 (0.5) |

### Slayers (10) — one per weapon

| Affix | Rarity | Fits | Effect (at the magnitude of its first rarity) | Weight by name (scored from text) |
|---|---|---|---|---|
| Beastbane | Common+ | any | +1d6 damage against beasts. | 1.2 (1.22) |
| Plantbane | Uncommon+ | any | +1d6 damage against plants. | 1.2 (1.22) |
| Oozebane | Uncommon+ | any | +1d6 damage against oozes. | 1.2 (1.22) |
| Giantbane | Uncommon+ | any | +1d6 damage against giants. | 1.2 (1.22) |
| Undeadbane | Uncommon+ | any | +1d6 damage against undead. | 1.2 (1.22) |
| Constructbane | Uncommon+ | any | +1d6 damage against constructs. | 1.2 (1.22) |
| Aberrationbane | Rare+ | any | +2d6 damage against aberrations. | 2 (2.45) |
| Elementalbane | Rare+ | any | +2d6 damage against elementals. | 2 (2.45) |
| Fiendbane | Rare+ | any | +2d6 damage against fiends. | 2 (2.45) |
| Dragonbane | Rare+ | any | +2d6 damage against dragons. | 2 (2.45) |

### New stat prefixes (12) — weapon or armor

| Affix | Rarity | Fits | Effect (at the magnitude of its first rarity) | Weight by name (scored from text) |
|---|---|---|---|---|
| Swift | Common+ | any | +5 Movement Speed. | 0.4 (0.4) |
| Hale | Common+ | any | +5 Maximum Hit Points. | 0.5 (0.5) |
| Vigilant | Common+ | any | +1 Initiative. | 0.4 (0.4) |
| Watchful | Common+ | any | +1 Perception. | 0.4 (0.4) |
| Lurking | Common+ | any | +1 Stealth. | 0.4 (0.4) |
| Fearsome | Common+ | any | +1 Intimidation. | 0.4 (0.4) |
| Persuasive | Common+ | any | +1 Persuasion. | 0.4 (0.4) |
| Brawny | Common+ | any | +1 Athletics. | 0.4 (0.4) |
| Agile | Common+ | any | +1 Acrobatics. | 0.4 (0.4) |
| Learned | Common+ | any | +1 Arcana. | 0.4 (0.4) |
| Wayfaring | Common+ | any | +1 Survival. | 0.4 (0.4) |
| Restorative | Uncommon+ | any | +1 Healing Received. | 0.3 (0.3) |

## 4. Toward one system

What the numbers say about merging:

* The three **generation paths are already one builder** — they differ only in a count function and in where rarity and category come from. Collapsing them is a matter of one config object (count by rarity, affixes count toward the cap or not); the Store's 15/45/40 split and its "affixes are extra" rule are the only real behavioral differences.
* **Named affixes** are the best candidate for the single weapon system: they are class-aware, readable in the item name, have a description and art, and are weighted by name. The general pool still supplies the spells, summons and transformations that affixes do not model.
* **Material modifiers** (4 entries, never rolled) are fully covered by Silvered / Mithral / Adamantine in `ITEM_AFFIXES` plus the new materials; **Masterwork** is the only gap.
* **Monster-part effects** (62 weapon effects) and the 405 **catalog** weapons keep separate tables; porting the part effects into affixes would give grafts the same names, art and descriptions.
