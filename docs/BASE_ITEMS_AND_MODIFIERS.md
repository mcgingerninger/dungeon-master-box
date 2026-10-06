# Base weapons, base armor and their modifiers — where we are

> Update: the weapon affix pool grew from 27 to 101 (more materials, enchantments, slayers and stat prefixes, with weapon-class filters and descriptions). The tables below are the earlier snapshot; the current pool, counts and weights are in [WEAPON_MODIFIERS.md](WEAPON_MODIFIERS.md).

A snapshot of everything a weapon or armor piece is built from and what can be applied on top of it, taken from the live data (`WEAPON_BASE_TYPES`, `ARMOR_BASE_TYPES`, `ITEM_AFFIXES`, `MATERIAL_MODIFIERS`, `MONSTER_PART_EFFECT_POOL`). **ATTACK** marks anything that changes an attack (to-hit) roll, since to-hit modifiers are the thing under review.

- **31 base weapon types**, **26 base armor pieces**, **37 prefix affixes**, **4 materials**, **85 monster-part effects** that can land on a weapon or armor.
- The hand-authored catalog has **405 weapons** and **289 armor items**; **359 of the weapons** carry a “+N … attack” bonus in their effect text.

## Base weapons

Base list = name + damage die only (no damage type, weapon properties or weight live here). Scaling and proficiency category are derived from the name.

| Weapon | Die | Scaling (damage) | Proficiency category |
|---|---|---|---|
| Club | 1d4 | STR C · DEX D | simple |
| Dagger | 1d4 | DEX B · STR D | simple |
| Handaxe | 1d6 | STR B · DEX D | simple |
| Javelin | 1d6 | DEX B · STR C | simple |
| Mace | 1d6 | STR B · DEX E | simple |
| Quarterstaff | 1d6 | STR C · DEX D | simple |
| Sickle | 1d4 | STR C · DEX C | simple |
| Spear | 1d6 | STR C · DEX C | simple |
| Shortsword | 1d6 | DEX B · STR C | martial |
| Scimitar | 1d6 | DEX B · STR C | martial |
| Battleaxe | 1d8 | STR B · DEX D | martial |
| Longsword | 1d8 | STR B · DEX D | martial |
| Rapier | 1d8 | DEX A · STR D | martial |
| Trident | 1d6 | STR C · DEX C | martial |
| Warhammer | 1d8 | STR B · DEX E | martial |
| Morningstar | 1d8 | STR B · DEX D | martial |
| War Pick | 1d8 | STR B · DEX D | martial |
| Flail | 1d8 | STR B · DEX D | martial |
| Whip | 1d4 | DEX A · STR E | martial |
| Halberd | 1d10 | STR B · DEX C | martial |
| Glaive | 1d10 | STR B · DEX C | martial |
| Pike | 1d10 | STR B · DEX C | martial |
| Greataxe | 1d12 | STR A · DEX E | martial |
| Greatsword | 2d6 | STR A · DEX E | martial |
| Maul | 2d6 | STR A · DEX E | martial |
| Shortbow | 1d6 | DEX A · STR E | simple |
| Longbow | 1d8 | DEX A · STR E | martial |
| Sling | 1d4 | DEX B · STR D | simple |
| Light Crossbow | 1d8 | DEX B · STR D | simple |
| Heavy Crossbow | 1d10 | DEX B · STR D | martial |
| Hand Crossbow | 1d6 | DEX B · STR D | martial |

## Base armor

| Piece | Base AC | Slot | Weight class |
|---|---|---|---|
| Padded Armor | 6 | body | light |
| Leather Armor | 6 | body | light |
| Studded Leather | 7 | body | light |
| Hide Armor | 7 | body | medium |
| Chain Shirt | 7 | body | medium |
| Ring Mail | 8 | body | heavy |
| Scale Mail | 8 | body | medium |
| Breastplate | 8 | body | medium |
| Half Plate | 8 | body | medium |
| Chain Mail | 9 | body | heavy |
| Splint Armor | 10 | body | heavy |
| Plate Armor | 10 | body | heavy |
| Buckler Shield | 2 | accessory / shield | — |
| Round Shield | 2 | accessory / shield | — |
| Kite Shield | 3 | accessory / shield | — |
| Tower Shield | 4 | accessory / shield | — |
| Iron Cap | 1 | accessory / shield | — |
| Great Helm | 2 | accessory / shield | — |
| War Helm | 2 | accessory / shield | — |
| Leather Gauntlets | 1 | accessory / shield | — |
| Steel Bracers | 2 | accessory / shield | — |
| Reinforced Greaves | 2 | accessory / shield | — |
| Leather Boots | 1 | accessory / shield | — |
| Traveler's Cloak | 1 | accessory / shield | — |
| Battle Mantle | 1 | accessory / shield | — |
| Studded Belt | 1 | accessory / shield | — |

## Materials (`MATERIAL_MODIFIERS`)

| Material | Applies to | Magical | Effect |
|---|---|---|---|
| Silvered | weapon | no | weapon {"ignoresNonmagicalResistance":true} |
| Mithral | armor | yes | armor {"stealthDisadvantage":false}; weight ×0.5 |
| Adamantine | weapon/armor | yes | weapon {"autoCritVsObjects":true}; armor {"critImmuneWhileWorn":true} |
| Masterwork | weapon/armor | no | passive [{"stat":"attackRoll","value":1}] **ATTACK** |

## Prefix affixes (`ITEM_AFFIXES`) — shown at magnitude 2

### Weapon only

| Affix | Rarity range | Effect | Touches |
|---|---|---|---|
| Rusty | common – uncommon | -1 to damage rolls — the corroded edge bites unevenly. | damage |
| Steel | common – rare | +1 to damage rolls — a properly tempered edge. | damage |
| Silvered | uncommon+ | +1 to damage rolls against shapechangers and undead specifically. | damage |
| Mithral | rare+ | Considerably lighter than it looks — never imposes a heavy-weapon penalty. | utility |
| Adamantine | rare+ | Critical hits with this weapon automatically maximize their damage dice. | damage |
| Dragonbone | superrare+ | +2 to damage rolls, and once per turn deals an extra 2d4 damage of a damage type matching a dragon's breath (wielder's choice). | damage |
| Voidsteel | superrare+ | +2 to damage rolls; on a critical hit, the target has disadvantage on its next saving throw. | damage |
| Sharp | common+ | +2 to damage rolls. | damage |
| Heavy | common+ | +3 to damage rolls, but -1 Dexterity — the weight throws off your footing. | damage |
| Balanced | common+ | +2 to damage rolls — perfectly weighted for the wielder. | damage |
| Flaming | uncommon+ | +2d4 fire damage on a hit. | damage |
| Frost | uncommon+ | +2d4 cold damage on a hit, and the target's speed is reduced by 10 ft. until the end of its next turn. | damage |
| Shocking | uncommon+ | +2d4 lightning damage on a hit. | damage |
| Venomous | uncommon+ | +2d4 poison damage on a hit, and the target has disadvantage on its next Constitution saving throw. | damage, stat |
| Radiant | rare+ | +2d4 radiant damage on a hit (+2d4 more against undead and fiends). | damage |
| Vicious | rare+ | Deals an extra 2d6 damage on a critical hit. | damage |
| Masterful | superrare+ | +2 to your proficiency bonus while wielded — it applies to every proficient roll: weapons, skills, and saving throws. | stat |
| Vampiric | superrare+ | The wielder regains 2 hit points whenever this weapon deals damage. | damage |

### Armor only

| Affix | Rarity range | Effect | Touches |
|---|---|---|---|
| Rusty | common – uncommon | -1 AC — it doesn't seal right anymore. | AC |
| Steel | common – rare | +1 AC — properly tempered plate. | AC |
| Mithral | rare+ | +1 AC, and no Strength requirement no matter how heavy the base piece. | AC, stat |
| Adamantine | rare+ | Attack rolls against the wearer can't score a critical hit. | **ATTACK** |
| Sturdy | common+ | +2 AC. | AC |
| Warded | uncommon+ | Resistance to one damage type of the wearer's choice, chosen when this armor is equipped. | damage |
| Padded | common+ | +4 to the wearer's maximum hit points. | utility |
| Silent | common+ | Advantage on Dexterity (Stealth) checks made while wearing this. | stat |
| Reflective | uncommon+ | +1 AC against ranged attacks specifically. | AC |
| Grounded | common+ | Advantage on saving throws against being knocked prone. | utility |

### Weapon or armor

| Affix | Rarity range | Effect | Touches |
|---|---|---|---|
| Iron | common – uncommon | No mechanical change — a plain, honestly-made iron piece. | utility |
| Runic | rare+ | +2 to saving throws made by whoever wields/wears this. | utility |
| Ancient | legendary+ | Once per short rest, treat a failed attack roll, ability check, or saving throw made with/while wearing this as a success instead. | **ATTACK** |
| Mighty | common+ | +2 Strength. | stat |
| Nimble | common+ | +2 Dexterity. | stat |
| Hardy | common+ | +2 Constitution. | stat |
| Brilliant | common+ | +2 Intelligence. | stat |
| Wise | common+ | +2 Wisdom. | stat |
| Charismatic | common+ | +2 Charisma. | stat |

### Affixes that change attack rolls

None any more — the Item Rules forbid attack-roll modifiers (see ITEM_RULES.md). Rusty, Silvered, Voidsteel, Sharp, Heavy and Balanced were converted to damage-only. Ancient (a once-per-rest reroll) is the only affix that still mentions an attack roll.

## Monster-part effects that can land on a weapon or armor

85 effects across the part families; the former attack-roll effects, now damage-only:

| Part | Effect | Applies to | Text (magnitude 2) |
|---|---|---|---|
| eye | Keen Eye | weapon | +2 to damage rolls — it sees the opening before you do. |
| eye | Hunter's Focus | weapon | Your first hit each combat against a creature you can see deals an extra 1d6 damage. |
| claw | Quick Strike | weapon | +2 to damage rolls. |
| horn | Charging Point | weapon | +2 to damage rolls when you moved 10+ ft. before the attack. |
| venomsac | Numbing Venom | weapon | On a critical hit, the target has disadvantage on its next saving throw. |
| heart | Furious Heart | weapon | +2 to damage rolls once you're below half HP. |
| talon | Talon Strike | weapon | +2 to damage rolls. |
| talon | Diving Strike | weapon | +2 to damage rolls if you moved at least 10 ft. straight toward the target this turn. |

## Observations

- **Attack-roll modifiers are gone.** The catalog's 375 "+N to attack (and damage)" weapons, Masterwork, the affixes and the monster-part effects above were all converted to damage-only by the Item Rules (docs/ITEM_RULES.md).
- **Base weapon data is thin.** `WEAPON_BASE_TYPES` has no damage type, properties (finesse, two-handed, reach, thrown, ammunition) or weight; those exist only on migrated catalog items.
- **Scaling and proficiency are derived, not stored.** Both come from the weapon's name (`weaponScalingKind` / `weaponProficiencyInfo`), so a renamed or unusual weapon falls back to a generic kind or martial.
- **Armor modifiers are mostly AC/stat/utility** (Sturdy, Warded, Padded, Silent, Reflective, Grounded, Mithral, Adamantine); only Ancient and a few part effects touch attack rolls.
