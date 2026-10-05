# Item art

`item-art.js` draws weapons, armour, jewellery, potions, scrolls and books as 32x32 shaded pixel icons (same engine and look as
the monster tokens in `monster-art.js`). It is used by `itemPixelIcon()`, so it shows everywhere item icons do; the rarity frame and the
legendary/celestial animation are unchanged. Items it doesn't recognise (torches, food, pets, monster parts, ...) keep the older icon.

An icon is three layers:

1. **Base object**, from the item's name (type as fallback; a poetically named weapon looks for its noun in the description):
   longsword, greatsword, dagger, axe, greataxe, hammer, mace, flail, club, spear, polearm, trident, bow, crossbow, staff, wand, round/kite shield,
   helmet, crown, plate/leather body armour, robe, gauntlets, boots, cloak, ring, amulet, potion, scroll, book.
2. **Material** recolour, from the name: adamantine, mithral, silver, gold, bronze, copper, obsidian/voidsteel, bone, crystal/ice, ruby, jade,
   dragon scale, rusty, iron, steel (wood for bows/staves, leather for hide armour, cloth for robes).
3. **Effects** from the name, description and effect text, strength scaled by rarity: fire, frost, storm, poison, holy, shadow, blood, arcane,
   nature, wind, or a plain magic glimmer for any other enchanted item. Up to two effects; each adds a coloured glow plus particles.

`itemArtSpec(item, rarity)` returns `{ base, material, effects }` for debugging. Add a new object by adding a drawing to `D` and a name
pattern to `baseKind`; add a material to `MAT` / `material()`; add an effect to `FX` and the particle switch in `render()`.
