# Attack narrator (read-aloud attack descriptions)

`AttackNarrator` turns any attack, spell or monster ability into a few short paragraphs a DM can read to the
table: what the attack is, how it looks, what happens to someone it hits, how it misses, and the extra
details (damage riders, conditions, how dangerous the blow really is). It is generic: it works on the
stat-block text alone, so it can be used anywhere an attack appears.

```
attack text  ->  parse        what is it? (melee / ranged / area / save / auto / utility / multiattack)
             ->  choose move  how is it delivered? (bite, blade, hammer, breath, cone, ray, orb, hex ...)
             ->  context      creature family + size + role, damage type, tier of damage, spell/weapon data
             ->  compose      wind-up, motion, effect, hit, miss, riders, conditions, lethality, scene, rules, tip
```

Output is **bullets, not a wall of text**: a simple bite is a handful of lines, a poisoned, grappling,
frightening, fire-breathing thing gets one small bullet per effect.

## Files

| File | What it holds |
| --- | --- |
| `attack-narrator-elements.js` | The 13 damage types (fire, cold, lightning, thunder, acid, poison, necrotic, radiant, psychic, force, slashing, piercing, bludgeoning): what they look, sound, smell and feel like, six tiers of wound, gear damage, aftermath, plus secondary flavours (water, earth, shadow, blood, holy...). |
| `attack-narrator-moves.js` | Templates for natural attacks (bite, claw, talon, slam, gore, tail, sting, tentacle, constrict, engulf, touch, beak...), held weapons (blade, shortblade, greatblade, axe, hammer, club, mace, staff, spear, polearm, whip, shield, pick) and projectiles (bow, crossbow, sling, thrown, firearm, net). |
| `attack-narrator-magic.js` | Area and magic deliveries (breath, cone, gaze, ray, orb, burst, wave, spray, cloud, aura, hex, drain, entangle, summon) and the stat-block ability archetypes (shapechange, teleport, charm, haste, defense, heal, leadership, terrain...). |
| `attack-narrator-effects.js` | ~30 conditions and riders (prone, grappled, frightened, poisoned, paralyzed, swallowed, push/pull, disease, curse, silence...) with a feel line and a one-line rule each, area shapes, damage tiers, party-level HP benchmarks, lethality text, creature sizes, families, roles, weapon rarity auras, crowd reaction beats. |
| `attack-narrator-lexicon.js` | Name → move rules (what a "Rending Bite" or a "Cloud Morningstar" is), weapon part names, body parts, irregular verbs. |
| `attack-narrator-spells.js` | About 170 hand-written spells, spell kinds for the rest (heal, ward, shapeshift, summon, detect, charm, curse, dispel, movement, illusion, creation, weather, light, darkness, buff, divine, cantrip) and school fallbacks. |
| `attack-narrator.js` | The engine: parser, move chooser, grammar (pronouns, verb agreement, a/an), composer, public API. |
| `attack-narrator.test.js` | Tests. |

Scripts load in this order (classic scripts sharing `window.AttackNarratorData`): elements → moves → magic →
effects → lexicon → spells → engine. The engine injects its own small stylesheet (`an-narr`, `an-chip`, ...).

## API

```js
AttackNarrator.describe(attack, ctx)          // one attack -> { title, chips, bullets, text, html, brief, ... }
AttackNarrator.describeSequence(list, ctx)    // a multiattack / whole turn as one flowing exchange
AttackNarrator.describeMonster(monster, ctx)  // every action, bonus action, reaction, legendary action and spell
AttackNarrator.parse(attack, ctx)             // the parsed profile only
```

`attack` is `{ name, text, source?, isSpell?, spellLevel? }` — the same shape the monster database and the
Battle Field tab use. `ctx` (all optional):

| Field | Meaning |
| --- | --- |
| `attacker` | `{ name, type, size, cr, str, dex, traits }` — decides the subject noun, scale, role (brute, skirmisher, caster...) and flavour |
| `entry` | the battle entry (`variant`, `dmgMult`, `traits`) — adds a "mark of the creature" line for variants |
| `target` | `{ name }` — who is hit; default "the target" |
| `result` | `{ outcome: 'hit'\|'crit'\|'miss'\|'fumble'\|'save', damage, failed }` — adds a line about what actually happened |
| `weapon` | `{ name, rarity }` — chaos-gear weapon; names the weapon and adds a rarity aura |
| `spell` | the raw spell JSON from `SpellCompendiumAPI.find` (looked up automatically for spell attacks) |
| `detail` | `'brief'` (windup/motion/hit), `'standard'` (default), `'full'` (adds scene, mark, rules at a glance, DM tip) |
| `variant`, `seed` | change either for "another take"; the same inputs always give the same text |

The result's `bullets` are `{ label, text, kind }`; `html` is ready to inject; `text` is plain text for
copy/paste. `lethality` says how large the blow is against a party-level adventurer.

## What it reads from the stat block

* delivery from the **name** first (Rending Bite, Cloud Morningstar, Hurl Flame), then reconciled with the
  mechanics (a "Bite" that makes the target save is still a bite, an area "Wing Attack" is a burst);
* **damage type** → look, sound, smell, and six tiers of wound; extra damage types get their own bullet;
* **average damage** → a tier (nuisance → catastrophic) and the "weight of the blow" line (percentage of an
  appropriate-level adventurer's HP, and whether it would drop a commoner or a guard);
* **area** (cone, line, sphere, cube, radius, "within N feet") → size in words and a real-world comparison;
* **saves, half damage, recharge, reach/range, per-day** → rules at a glance and miss/resist lines;
* **conditions** → one bullet each with how it feels, and a rule line;
* **creature family and size** → the subject noun, pose, the way a big creature changes the scene;
* **spells** → the hand-written read-aloud when one exists, else a kind (heal, ward, summon...) matched from
  the name and description, else the school; spell level and concentration are folded in;
* **chaos gear** → the weapon's own name, damage type taken from the weapon, rarity aura (common → celestial).

## Where it is used

* **Battle Field tab** – every rolled attack has a **📖 Describe** toggle (with *Another take*, *Full detail*
  and *Copy*) and the real roll (hit, crit, miss, failed save) is written into the narration. Multiattacks
  get **📖 Describe the whole turn**.
* **Monster Compendium** – every action, bonus action, reaction and legendary action has a 📖 button.

## Extending it

Add a spell to `D.SPELLS` with `S(move, element, level, school, { windup, motion, fail, effect, shape, size })`
(or `U(...)` for a non-attacking one); add a name rule to `D.MOVE_LEX`; add a utility archetype to
`D.UTILITY` or a spell kind to `D.SPELL_KINDS`. Template tokens are listed at the top of
`attack-narrator-moves.js` and `attack-narrator-magic.js`. After changing data, run
`node --test attack-narrator.test.js`; it checks the fixtures for leftover tokens, doubled words and empty bullets.
