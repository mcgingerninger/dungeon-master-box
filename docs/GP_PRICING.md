# Item gp pricing

Every item's gp value scales with its rarity tier **and** with how strong it is. No item is ever
worth more than **100,000 gp**, and no **Rare** item more than **1,000 gp**.

| Tier | Floor | Ceiling |
|---|---|---|
| Common | 1 cp | 50 gp |
| Uncommon | 25 gp | 300 gp |
| Rare | 150 gp | 1,000 gp |
| Super Rare | 1,000 gp | 10,000 gp |
| Legendary | 8,000 gp | 50,000 gp |
| Celestial | 30,000 gp | 100,000 gp |

## Where the rules live
- `scripts/rebalance-gp.js` — prices every item in `loot-data.js` (`node scripts/rebalance-gp.js`,
  `--dry` to preview) and marks NPC signature weapons in `npc-data.js` as `Unknown`. Position in
  a band = 60% power score (damage, AC, +N bonuses, charges, number of effects, scroll level...)
  + 40% rank of the item's previous price. Common-tier gear and chests keep their existing
  prices (clamped to the tier ceiling).
- `scripts/rebalance-gp.test.js` — fails the suite if any item breaks the caps or a non-numeric
  price is anything other than `Unknown`.
- `dungeon_loot_wheel_v102_spell_details.html` — `COMMERCE_SCALE`/`commercePrice` (Store wares),
  `FLESH_ATTACH_SCALE` (limb grafts) and `GEN.scale` (Generate Item) use the same bands.
  Monster parts keep their own, lower `MONSTER_PART_GP_RANGE`.

## "Unknown" cost
Quest items, documents, artifacts (Vecna, Orcus, Moonblade...), and unique/campaign items that
never had a price show `Unknown`. Merchants don't stock or buy them (`isItemTradeable`).
After changing `loot-data.js` run `npm run migrate` to refresh `mechanics/canonical/`.
