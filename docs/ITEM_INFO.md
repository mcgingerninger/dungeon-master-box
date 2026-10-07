# Item information: one popup, one Examine view

## The hover popup (every screen)

Every place an item appears shows the **same** hover popup, built by `buildTooltipHtml`: name and art, rarity and type, breadcrumb,
stat chips (damage, AC, price, slot, weight, charges, requirement), the **Scales** row (weapons and armor), the **✦ Focus** row (magical items),
effect bullets, modifiers, hidden powers, a quick-reference card for each spell or creature it mentions, tags and interactions.

A surface gets it with one call in its template:

```js
`<div class="my-row" ${itemHoverAttrs(item, rarity, key)}>…</div>`   // key (a TOKEN_INDEX key) is optional
```

`itemHoverAttrs` registers the item and returns the hover handlers; with a key the popup reads the saved entry, without one it is built from the raw item.
Surfaces that now use it (they previously had no popup, a plain browser tooltip, or a different layout):
Compendium rows, the equipped-effects list on the Inventory tab, the Interactions finder, the DM's view of a player's doll and inventory
(that one used a plain `title`), the Players "send item" list, saved items, the Mangler / Fleshmancer slots and finished work, the players' combat
loot list and the Hidden Powers tracker. The older `show*Tooltip` helpers remain as thin wrappers over the same builder.

## Examine (everything about one item)

Hover any item and press **I** (or **Shift+click**), or click the 🔍 on a Compendium row. `item-examine.js` shows:

| Section | What it holds |
|---|---|
| Header | art, name, rarity, type, breadcrumb, price, slot, weight, requirement, attunement |
| Combat and scaling | weapon: damage dice, every scaling grade with your modifier and the damage it adds, proficiency, the weapon's attack class and the minor/major effects it can pick on a great hit. Armor: weight class, grades and the AC they add. Magical items: spell focus stat, grade and bonuses |
| Effects and powers | effect text, every modifier, activated abilities, hidden powers (hidden from players until unlocked), tags, properties and interactions |
| Description | the item's description and generated paragraphs |
| Quick reference | the full card for every spell, creature or table the item mentions |
| Why it is worth this | the Item Rules weight breakdown: each modifier's weight, the total, the rarity band and price band, any rule notes |
| Where it comes from | merchant, source monster, affixes, generation tags |

## Wild Magic table

"Confused (must roll on Wild Magic table each turn)" and any other text that says "Wild Magic table" now links to a real, original d100 table
(`wild-magic-data.js`, 50 results: fun, good, odd, bad and dangerous). Click the underlined name on an item card or in its quick reference, or open the
Dice Roller and press **🌀 Wild Magic table**, to roll. The result is for the DM to apply; nothing is tracked automatically.
