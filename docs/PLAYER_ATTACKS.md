# Player attacks on creatures

The opposite of a creature's "Roll Attack" on a player: a character attacks a selected creature.

## What can be used
Only things that really deal damage are offered:
* **Weapons** in the main hand or off hand that have damage dice (wands, rods and staves count when they have dice).
  Items that merely cause an effect and have no damage are not offered.
* **Damage spells** from the spellbook (healing, buffs and utility spells are left out). Cantrips are free, leveled spells use the
  lowest open slot that fits.
* A bow or crossbow is offered only while its ammunition (arrows / bolts) is in the inventory (see `docs/AMMUNITION.md`).
* **Unarmed** is offered only when there is no weapon.

## How it works
* The **Attack** button attacks with the **main hand**. If there are two weapons, or only spells and no weapon, a tiny chooser pops up
  with the attack icons (the same icons as the inventory ability bar, with the usual item hover popup). The small **▾** beside the
  button always opens the chooser. On phones the chooser is a bottom sheet.
* Roll: d20 + attack mods against the creature's AC gives the degree of hit (docs/ATTACK_MARGIN.md), damage and effects. Attack-roll spells
  work the same way; save spells show the DC and let you mark "failed" or "saved" (half damage where the spell allows it); spells with
  neither (automatic hit) just apply their damage.
* **Combat tab** (DM / solo): "🗡 Hit it" on a creature card rolls your character's attack and applies the damage and log in one click.
* **Battlefield tab** (connected player): ⚔ Attack sends the roll to the DM, who now also sees spell attacks, save DCs and the ammunition used.
* **Battle Field test tab** (DM): left-click a campaign character token to get them ready, then left-click a monster to make that
  character attack it with *their own* gear and spells. Campaign characters (everyone in the campaign, not just those online) can be dragged
  onto the field; their token shows their real AC, HP, level and class from their synced sheet, and the hover popup lists their ability scores.
  For another character the DM's own ammunition and spell slots are never spent; the popup reminds you to mark ammo used.

Code: `player-attack.js` (`PlayerAttack`), `battlefield-tab.js`. `PlayerAttack.withCharacter(state, fn)` runs `fn` with another character's
synced sheet standing in for the local one, then restores the DM's own.
