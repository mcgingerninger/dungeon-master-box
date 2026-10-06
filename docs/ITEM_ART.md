# Item art (pixel icons)

Every item icon in the app — inventory, equip doll, store, loot results, compendium, tooltips — is a hand-built
32×32 pixel sprite, shaded and outlined the same way as the monster tokens (`monster-art.js`). Nothing is a
bitmap file: sprites are drawn from shapes (polygons, ellipses, lines) and then recoloured per item.

```
item  ->  base object  (what it is)           longsword, platehelm, potion, cat, fang ...
      +   material     (what it is made of)   steel, adamantine, oak, leather, a creature palette ...
      +   effects      (what it does)         fire, frost, storm, poison, acid, holy, shadow, necrotic,
                                              blood, arcane, nature, wind, water, sonic, luck, magic
```

An *Adamantine Plate Helm of the Gale* is the `platehelm` sprite, coloured as adamantine, with wind streaks.

## Files

| File | What it holds |
| --- | --- |
| `item-art-kit.js` | Drawing helpers on top of `PixelKit` (`monster-art.js`): rotated local frames for long objects, pattern fills (chain, scales, quilting), curves. |
| `item-art-weapons.js` | ~60 weapon sprites — each base weapon has its own silhouette (longsword ≠ sword ≠ shortsword ≠ falchion ≠ dagger, axes, hammers, polearms, bows, crossbows, ammunition, staves…). |
| `item-art-armor.js` | Helms, body armour (plate, half-plate, splint, chain, ring, scale, studded, hide, padded…), cloth, shields, hands, feet, belts. |
| `item-art-misc.js` | Jewellery, gems, containers, potions & bottles, light, tools, instruments, paper, food, curios (~130 sprites). |
| `item-art-parts.js` | Monster parts (heartstone, eye, fang, claw, horn, wing, hide…), grafted limbs, and ~60 creatures for pets and mounts. |
| `item-art-rules.js` | Name → base object rules, type fallbacks, default materials, creature palettes. |
| `item-art.js` | The engine: materials, effect detection, shading, outline, effect drawing, SVG output, cache. |
| `item-art.test.js` | Tests (every rule has a sprite, classification, effects, no floating pixels…). |

Scripts load in this order after `monster-art.js`: kit → weapons → armor → misc → parts → rules → engine.

## Public API (`window`)

* `itemArtSpec(item, rarity)` → `{ base, material, effects, liquid }` — what will be drawn and why.
* `itemArtInner(item, rarity)` → SVG rects for a 32×32 viewBox (cached). `itemPixelIcon()` in the HTML wraps this
  with the rarity frame and glow animation.
* `itemArtSvg(item, px, rarity)` / `itemArtBaseSvg(base, {material, effects, rarity, liquid}, px)` — standalone SVG.
* `attachItemArt(item)` — optional: freezes the current spec on `item.artSpec` (`{base, material, effects, liquid}`).
  An item with `artSpec` always draws from it, so a DM can override any item's art by hand.
* `ItemArtSprites` (all sprites), `ITEM_ART.MAT / FX` (material and effect tables).

## How an item is classified

1. `item.artSpec.base` if present.
2. Companions → creature sprite by name (`Barn Cat` → `cat`, `Pegasus` → `pegasus`…).
3. Monster parts (`anatomicalId`/`partType`) → part sprite; the colours come from `sourceMonster` via the monster palette.
4. Limbs → limb sprite by `subcategory`.
5. Ordered name rules in `item-art-rules.js` (head nouns first: "Plate Greaves" is greaves, "Ring of Mind Shielding"
   is a ring). Rules listing several bases pick one by hashing the name so a class of items (all helms, all potions)
   still varies.
6. Type fallbacks (weapon → sword family, armour → mail/plate, consumable → potion, document → journal, otherwise a curio).

Every item therefore gets art; nothing falls back to a blank icon.

## Materials

The material is read from affix names and the item name (`Adamantine`, `Mithral`, `Dragonbone`, `Obsidian`,
`Silvered`, `Oaken`, `Cold-forged`…), else a default for the base (steel blades, oak staves, leather boots,
cloth robes, glass bottles…). A material has four colours: `a` main, `b` shade, `c` highlight, `t` trim.
Creature parts pass a palette object instead of a name (bony parts use ivory tinted by the creature).

## Effects

Detected from the item name (strongest), modifier names, modifier text (e.g. "extra cold damage"), the effect
text and the description. Weak matches are ignored on mundane items; rarity ≥ rare or any modifier lowers the bar.
Up to two effects are drawn; items with a magical flavour but no element get a `magic` ring.

| Effect | Look |
| --- | --- |
| fire | flames licking up the object, red→gold, orange blade tint |
| frost | rime on the edges, ice crystals, pale-blue tint |
| storm | jagged yellow bolts |
| poison | green drips and bubbles, green stains |
| acid | yellow-green drips, bubbles, corroded pits |
| holy | golden rays with sparkle crosses |
| shadow | billowing purple smoke, dark tint |
| necrotic | thin green wisps, rotted spots |
| blood | red drips and splatter |
| arcane | rune circle with glyph markers |
| nature | vines and leaves, moss |
| wind | white swooshes |
| water | blue drops and bubbles |
| sonic | curved sound-wave arcs |
| luck | green/gold sparkles |

Effects are drawn on the object's own silhouette (spread evenly along its long axis), never as loose decoration.
After drawing, any fragment under three pixels that isn't attached to the object is deleted — there are no stray
single pixels. Rarity scales the effect (more and larger shapes, a soft glow from uncommon up). Potions and other
bottles fill with a colour from their name (healing red, giant strength orange, water breathing blue…).

## Generated items

Items from the Generate Item tab, the stores, and generated rolled loot carry their `mods` (affixes, traits), so
art is derived from exactly what the item is and what it does — no separate art step is needed. Call
`attachItemArt(item)` if an icon must stay fixed regardless of later renames.

## Adding a sprite

Add `S.myThing = C => { ... }` in the matching `item-art-*.js`, then a rule in `item-art-rules.js`
(`add('mything', /regex/)`), and optionally a default material in `ItemArtRules.material`. Roles: `a` main,
`b` dark, `c` light, `t` trim, `h` wood/grip, `l` dark leather, `f` fuller/emissive channel, `g` gem/liquid/glow,
`w` white/parchment, `k` black, `r` red, `y` gold, `p` skin, `x` erase. `item-art.test.js` checks that every
rule resolves to a drawn sprite.

## Affix materials and effects

Weapon affixes (`item-affixes.js`, see `WEAPON_MODIFIERS.md`) have their own art. New materials (`MAT` / `MATERIAL_RULES`): moonsilver, bloodsteel, wraithsteel, hellforged, shatterglass, coldiron, heartwood, ironwood, elven, dwarven (and "Meteoric" maps to starmetal). New effects (`FX` / `FXF`): `soul` (pale cyan wisps), `prism` (rainbow glints and colour bands), `gravity` (dashed pull rings and streaks), `spore` (spore puffs, olive tint) and `time` (a ticking ring). Existing effect words also pick up the new names (Hellforged / Searing → fire, Wasting → necrotic, Tidal → water, Mindrending / Impact → arcane, Thundering → storm and sonic from its thunder damage text).
