# Attack margin (degree of hit)

```
M = d20 + attack modifiers - defender AC
```

M picks a **tier**; the tier sets how much of the normal damage lands and how many **minor** and **major** effects the attacker earns.
It applies to **weapon attacks** (player weapons and unarmed strikes) and to **monster attacks** — both use the same table. Spells and
save-based abilities are unchanged.

| M | Result | Damage | Effects |
|---|---|---|---|
| ≤ -10 | **Fumble** | none | a mishap |
| -9 to -5 | **Clean miss** | none | — |
| -4 to -1 | **Glancing blow** | 50% | — |
| 0 to 3 | **Hit** | 100% | — |
| 4 to 7 | **Solid hit** | 125% | 1 minor |
| 8 to 11 | **Strong hit** | 150% | 2 minor |
| 12 to 15 | **Crushing hit** | 200% | 1 minor + 1 major |
| ≥ 16 | **Devastating** | 250% | 2 major |

* **Natural 20** always hits and is a **critical hit**: the damage dice are doubled *and* the tier's percentage still applies, so a crit that also
  beats AC by a lot is very effective. A natural 20 whose margin would have been a miss or a glancing blow counts as a plain Hit.
* **Natural 1** is always a **fumble**, whatever M is (so is M ≤ −10).
* Damage is the normal total (dice + modifiers + scaling) × the percentage; Glancing rounds down; a hit always does at least 1.
* Effects are **options**: for each earned effect the attacker picks one from a list filtered by the weapon, so a bow never offers
  "pull the target toward you" and a sword never offers a ranged shot. The app suggests a random fitting option and lets you change it.
  A fumble earns one random **mishap** (also changeable).

## Where it is used

| Place | What you see |
|---|---|
| Inventory ⚔ Attack / Unarmed (solo) | a **Target AC** box (remembered); enter it to see the tier, the final damage and the effect pickers |
| DM Combat tab: pending player attacks | the tier, damage × % and effect pickers, resolved against the monster's current AC; Apply deals the scaled damage and logs the effects |
| DM Combat tab: monster attack roll | the combat log shows the tier, M, scaled damage and the effects that were rolled |
| Battle Field attack popup | the tier, M, scaled damage and a picker for each effect |

A player sending an attack to their DM does not see the monster's AC, so the DM's panel resolves the degree of hit.

## Weapon classes

`attackClassesOf(name)` decides which options an attack can use: **blade, axe, blunt, pole, whip, staff, natural, unarmed, ranged, thrown,
heavy, light**, plus melee or ranged. It reads the weapon or attack name ("Rapier +1", "Greataxe", "Longbow", "Bite"); two-handed weapons are heavy.

## Minor effects (41)

| Effect | Fits | What happens |
|---|---|---|
| Shove | any | Push the target 5 ft. directly away from you. |
| Mark | any | Your next attack against the target before the end of your next turn gets +2 to its margin (M). |
| Expose | any | The target's AC is 1 lower until the end of your next turn. |
| Off-balance | any | The target's speed is reduced by 10 ft. until the end of its next turn. |
| Rattle | any | The target has -2 to its next saving throw. |
| Distract | any | The target can't take reactions until the start of its next turn. |
| Press the advantage | any | Move up to 5 ft. toward or around the target without provoking. |
| Draw the eye | any | The target has disadvantage on attacks against anyone but you until the end of its next turn. |
| Open a gap | any | An ally within 30 ft. may move 10 ft. without provoking. |
| Steady yourself | any | Gain temporary hit points equal to your proficiency bonus. |
| Show strength | any | The target can't willingly move closer to you until the end of its next turn. |
| Break focus | any | The target has disadvantage on its next Concentration check. |
| Find the weak spot | any | An ally's next attack against the target this round gets +1 to its margin. |
| Quicken | any | You may swap or stow one held item for free. |
| Bleeding nick | blade, axe, pole, natural, ranged | The target takes 1d4 damage at the start of its next turn. |
| Slip the guard | blade, whip, light | The target drops one item it is holding that isn't its main weapon. |
| Guarded stance | blade, pole, staff, light | You gain +1 AC until the start of your next turn. |
| Cut the cloth | blade, axe | The target's speed is reduced by 10 ft. and it can't take the Dash action until the end of its next turn. |
| Skirmish | light, blade, natural, whip | After the attack, move up to 10 ft. without provoking. |
| Hook the shield | axe | The target's shield bonus doesn't apply to your next attack against it. |
| Chip armor | axe, heavy, blunt | The target's AC is 1 lower for the rest of the encounter (stacks to -2). |
| Follow-through | heavy, axe | Deal 1d6 damage to another creature adjacent to the target. |
| Overwhelm | heavy, blunt | The target's next attack against you has -2 to its margin. |
| Ringing blow | blunt, heavy | The target is deafened until the end of its next turn. |
| Winded | blunt, natural, unarmed | The target can't use bonus actions until the end of its next turn. |
| Dent the guard | blunt, staff, unarmed | The target's next attack roll has -2 to its margin. |
| Jolt | blunt, staff, unarmed | The target can't benefit from advantage on its next attack roll. |
| Keep at bay | pole, whip | The target can't move closer to you until the end of its next turn. |
| Hook and drag | pole, whip | Pull the target 5 ft. toward you. |
| Trip line | pole, whip, staff | The target's speed is halved until the end of its next turn. |
| Lash the hand | whip | The target drops one held item (its choice). |
| Snag | whip | The target's speed is reduced by 15 ft. until the end of its next turn. |
| Pinning shot | ranged | The target's speed is reduced by 10 ft. until the end of its next turn. |
| Suppressive shot | ranged | The target has disadvantage on ranged attacks until the end of its next turn. |
| Steady aim | ranged | Your next ranged attack against the target ignores cover. |
| Tracer | ranged | The target can't hide from you until the end of the encounter. |
| Ricochet | thrown, ranged | The missile glances onward: another creature within 5 ft. of the target takes 1d4 damage. |
| Savage worry | natural | The target's speed is reduced by 10 ft. as you hold on until the start of your next turn. |
| Raking wound | natural, unarmed | The target takes 1d4 damage at the start of its next turn. |
| Snarl | natural | The target has -2 to its margin on its next attack (it flinches). |
| Latch on | natural, unarmed | You gain advantage on your next attempt to grapple or shove the target. |

## Major effects (32)

| Effect | Fits | What happens |
|---|---|---|
| Knock prone | melee | The target falls prone. |
| Stun | blunt, heavy, staff, unarmed, natural | The target is stunned until the end of its next turn. |
| Blinding strike | any | The target is blinded until the end of its next turn. |
| Terrify | any | The target is frightened of you until the end of its next turn. |
| Shatter focus | any | The target immediately loses concentration on any spell. |
| Dominate the field | any | All allies within 30 ft. get +2 to their margin against the target until the start of your next turn. |
| Savage display | any | Enemies within 15 ft. of you have disadvantage on their next attack. |
| Vital strike | any | Treat every weapon damage die on this hit as its maximum (add the difference to the damage). |
| Disrupt the line | melee | Swap places with the target; neither provokes. |
| Open wound | blade, axe, pole, natural, ranged | The target bleeds for 1d6 damage at the start of each of its turns for 3 rounds (a Medicine check or any healing stops it). |
| Disarm | blade, whip, axe, pole, light | The target drops its weapon; it lands 10 ft. away. |
| Hamstring | blade, pole, axe, ranged | The target's speed is 0 until the end of its next turn, then halved for 1 minute. |
| Wither the wound | blade, natural, ranged, pole | The target can't regain hit points for 3 rounds. |
| Lock down | whip, pole, blade | The target can't take reactions and has disadvantage on Dexterity saves until the end of its next turn. |
| Finishing opening | blade, axe, pole, ranged, natural | If the target is at a quarter of its hit points or fewer, it drops to 0 hit points (stable if you wish). |
| Cripple the arm | blade, blunt, axe | The target's attacks have -2 to their margin and it can't use two-handed weapons until the end of the encounter. |
| Cleave | axe, blade, heavy, blunt | Immediately make one extra weapon attack against a different creature within reach. |
| Pierce through | ranged, pole | The strike carries on and hits another creature behind the target for half damage. |
| Shatter armor | axe, blunt, heavy, pole | The target's AC is 2 lower for the rest of the encounter. |
| Sunder | axe, blunt, heavy | The target's weapon deals -2 damage until repaired or the encounter ends. |
| Heavy blow | blunt, heavy, pole, staff | Push the target 15 ft.; if it hits a wall or another creature it falls prone. |
| Daze | blunt, heavy, staff, natural, unarmed | On its next turn the target can take an action or move, not both. |
| Rattled skull | blunt, heavy, staff | The target is confused (acts at random) until the end of its next turn. |
| Concussive crack | blunt, natural, unarmed | The target is deafened and can't take reactions until the start of its next turn. |
| Pin | ranged, pole, whip | The target is restrained until it uses its action to break free. |
| Snare | ranged, whip | The target's speed is 0 and its AC is 2 lower until it uses its action to break free. |
| Seize | natural, whip, heavy, unarmed | The target is grappled (escape DC 8 + your proficiency bonus + your STR modifier). |
| Trample | natural, heavy | Move through the target's space; it is knocked prone and takes 1d6 damage. |
| Overbear | natural, heavy, unarmed | The target falls prone and is pushed 5 ft. |
| Feed on the blow | natural, blade | You regain hit points equal to twice your proficiency bonus. |
| Whirl | axe, heavy, blade | Every other enemy within 5 ft. of you takes half the damage you just dealt. |
| Opening for a riposte | blade, pole, light | You may immediately make one opportunity attack against the target. |

## Fumble mishaps (11)

| Mishap | Fits | What happens |
|---|---|---|
| Slips from the grip | melee | You drop your weapon (or lose your aim); picking it up costs half your movement. |
| Off-balance | any | You can't take reactions until the start of your next turn. |
| Overextended | any | Attacks against you have +2 to their margin until the start of your next turn. |
| Stuck fast | melee | The weapon wedges in something; freeing it takes your next action. |
| Jam or misfire | ranged | The weapon jams, the string frays or the sling tangles; fix it as an action before using it again. |
| Stumble | any | You fall prone. |
| Wasted breath | any | You lose your bonus action this turn. |
| Loud mistake | any | Everything within 60 ft. hears the clatter. |
| Free opening | any | The target may make one opportunity attack against you. |
| Pulled muscle | any | You have -2 to your margin on your next attack. |
| Strike wide | melee | An ally within 5 ft. of the target takes half your normal damage (if there is one); otherwise you stumble. |

## Files

* `mechanics/data/attack-margin-default.js` — the table and every effect list (plain data: edit the numbers or add effects here).
* `mechanics/engine/combat/attack-margin.js` — `resolveAttack`, `scaleDamage`, `attackClassesOf`, `effectOptions`, `suggestEffects`, `swapEffect`; tests beside it.
* `attack-margin-ui.js` — the shared tier box and effect pickers (`AttackMarginUI`).

Effects are rules text for the table to resolve: nothing is tracked automatically (a mark, a bleed or a prone condition is for the DM to apply).
