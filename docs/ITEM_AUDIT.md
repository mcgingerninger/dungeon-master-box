# Item audit: AC, slots and descriptions

A browser audit over the whole catalogue (289 armor and weapon items) and 3,000 generated items found these faults. All are fixed.

| Fault | Cause | Fix |
| --- | --- | --- |
| **Body armor card said "AC 6-10" and wearing it did nothing or LOWERED AC** (189 catalogue pieces plus every generated one) | Body armor *replaces* the unarmoured 10. The generator's base table started at 6 (leather) and the catalogue held numbers from 1 to 15 with no pattern. | `normalizedBodyArmorAc` (game-engine.js): a value of 11+ is kept; anything lower is rebuilt from the piece's name (padded/leather 11 ... plate 18) plus a rarity bonus (0-5). The generator now emits the same numbers. |
| Helmets, bracers etc. showed "AC 11/13/15" and did nothing (72 pieces) | A bare number only counted on the body slot; those numbers were the catalogue's body-armor fallback by rarity. | `normalizedAccessoryAc`: a small flat bonus from the piece (helm +1, great helm/bracers/greaves +2 ...) plus a rarity bonus, applied in any slot. |
| 41 armor pieces went to the **ring** slot ("Ring Mail", "Thundering", "Smoldering", "Wayfaring"), some to face or amulet | Slot was guessed by `name.includes('ring')` and by words in the description. | Names decide first, with word boundaries: body-armor words go to the body slot, jewelry words and `\bring\b` to rings, shields and bucklers to the off-hand. |
| Bucklers sat in the body-armor slot | "buckler" was not recognised as a shield. | Same fix. |
| The card AC did not match what the sheet changed (enchantment "+2 AC" extra, migrated data that disagreed with the stored number) | The card printed `item.ac` only. | `acLabel()` asks the same engine the sheet uses: body armor shows the AC you end up with ("AC 15"), anything else the bonus ("+3"), enchantments included. Armor scaling (stat grades) is still shown separately. |
| Old catalogue "arrows" were equippable weapons with "No bonus" damage | Superseded by stackable ammunition. | Removed at load; AmmoData items replace them. |
| Wand of Magic Missiles damage "1-3d4+1" could not be rolled | Text, not dice. | Written as `3d4+3` (three darts). |
| Potion, vial, tonic, powder and incense descriptions read "A a ceramic bottle ... of translucent grey like river ice liquid" (about 4% of consumables) | Templates put "A" before pool phrases that already start with "a", and colour phrases that already end in a noun. | Templates and pools rewritten so every sentence parses; powders and incense use the powder wording. |

Checked and clean: unresolved `{tokens}` / "undefined" in 2,400 generated descriptions, "an" before a consonant, repeated words,
weapon descriptions naming a different weapon (1 in 2,400, left alone).

Not changed (a design call for you): a few enchantments give very large AC (a celestial "Fortified" piece is +12 AC with -30 speed). The card now shows the
real total, so it is visible, but the size is set by the Item Rules weights.
