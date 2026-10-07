# Ammunition, stacks and wands

## Arrows and bolts are their own items
Bows and crossbows are just the weapon. Every shot spends one **arrow** (bows) or **bolt** (crossbows) from the inventory.
Slings, thrown weapons and bows that say they need no ammunition (or conjure their own) are unaffected.

* Data: `ammo-data.js` (`AmmoData`), about 220 catalog pieces, built from a **head** (material, a flat damage bonus) and an **effect**
  (extra damage dice, a to-hit bonus and/or a rider), plus hand-made legendary and celestial pieces.
* Heads: flint, iron, bone, steel, silvered, obsidian, mithral, adamantine, dragonbone, starmetal.
* Effects: whistling, barbed, bodkin, tracking, smoke, snare, flaming, frost, shocking, venomed, corrosive, thunderous, sunlit,
  gravetouched, seeking, blasting, beast-bane, grave-bane.
* Legendary / celestial: Wyrmslayer, Stormcaller, Phoenix, Banshee, Quicksilver, Earthshaker; Starfall, Oblivion, Judgement, World-Tree.
* Each piece has an `ammo` block (`flat`, `dice[]`, `atk`, `riders[]`, `save`) the attack roll reads, and a plain `effect` line.
  Dice that only apply to one creature type ("vs dragons") are shown in the roll but not added to the total.

## Stacks (up to 999)
* An inventory tile can hold `qty` pieces of the same item (same name and rarity, so loot, store and library copies merge).
  A quantity badge shows on the tile; drag one stack onto another to merge; right-click a stack to split it in half.
* Loot drops ammunition as a **bundle** (more of the plain stuff, a couple of the rare stuff), about 8% of the slots that could hold
  a weapon or trinket. The Blacksmith sells plain and steel arrows and bolts in bundles. Class kits give 20.
* Weight and value count the whole stack. Selling a stack to a merchant sells the whole stack.

## Firing
Rolling an attack with a bow/crossbow spends one piece. The attack popup shows what was fired, its extra dice and rider, and a
selector for **what the next shot uses** (default: the plainest stack, so rare ammunition is never wasted by accident).
No ammunition means no shot.

## Wands, rods and staves
They are held implements: they now equip into the Weapon slots even when they are catalogued as misc trinkets.
