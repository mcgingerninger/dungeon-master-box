# Weapon proficiency

A weapon attack adds the proficiency bonus **only if you're proficient with that weapon**. The bonus is a **flat +2** — it does not grow with character level (it's the same +2 for skills and saves you tick on the sheet) — and gear or a feat that says "+N to your proficiency bonus" raises it
(`weaponProficiencyCheck` in `game-engine.js`). Sources, checked in this order:

1. **Natural weapons** (claws, fangs, grafted limbs) — always.
2. **Class** — the 5e class tables, matched from the free-text Class field (multiclass text like
   "Rogue / Wizard" unions them). Artificer: simple weapons; Fighter/Paladin/Ranger/Barbarian:
   simple + martial; Wizard/Sorcerer: dagger, dart, sling, quarterstaff, light crossbow; etc.
3. **Character Sheet ticks** — "Weapon Proficiencies" section (simple/martial, or specific weapons).
4. **Gear and feats whose text grants it** — "Proficiency with longbows and shortbows" (Bracers of
   Archery), "proficiency with martial weapons", "proficient with all weapons".

Each weapon's base type and simple/martial category are read from its name
(`WEAPON_PROFICIENCY_TABLE`); an unrecognizable custom weapon counts as martial, and an item can set
`weaponCategory: 'simple'|'martial'|'natural'` to override. A sheet with no recognizable class and
nothing ticked is assumed proficient with everything (the behavior before this existed).
Unarmed strikes are always proficient. Armor and shield proficiency are not modeled.
