# Weapon proficiency

There is **no built-in proficiency bonus** — not by level and not a flat +2. Being proficient with a
weapon (or ticking a skill/saving throw) only marks you as proficient; the number a proficient roll
adds is whatever equipped gear or feats say they add ("+N to your proficiency bonus",
`collectProficiencyBoost` in `game-engine.js`). With nothing like that equipped it is +0.

A weapon attack adds that bonus **only if you're proficient with that weapon**. Sources of
weapon proficiency, checked in this order:

1. **Natural weapons** (claws, fangs, grafted limbs) — always.
2. **Class** — the 5e class tables, matched from the free-text Class field (multiclass text like
   "Rogue / Wizard" unions them). Artificer: simple weapons; Fighter/Paladin/Ranger/Barbarian:
   simple + martial; Wizard/Sorcerer: dagger, dart, sling, quarterstaff, light crossbow; etc.
3. **Character Sheet ticks** — "Weapon Proficiencies" section (simple/martial, or specific weapons).
4. **Gear and feats whose text grants it** — "Proficiency with longbows and shortbows" (Bracers of
   Archery), "proficiency with martial weapons", "proficient with all weapons".

Each weapon's base type and simple/martial category are read from its name
(`WEAPON_PROFICIENCY_TABLE`); an unrecognizable custom weapon counts as martial, and an item can set
`weaponCategory: 'simple'|'martial'|'natural'` to override. An unset sheet is proficient with nothing.
Unarmed strikes are always proficient. Armor and shield proficiency are not modeled.
