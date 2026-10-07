# Player Status and mobile display

## Player Status
A panel that shows everything active on a character right now, so a player (and the DM) never has to hunt through
gear text to remember what is on.

* **Where:** Inventory tab (above Active Effects) and a "🧍 Player Status" section on the DM's player card (Players tab).
* **Sections:** Transformations · Conditions & debuffs · Buffs · Feats & hidden powers · Resistances, immunities &
  advantages (also vulnerabilities, disadvantages, bearer restrictions) · Senses & movement (darkvision, fly speed,
  regeneration) · Stats currently changed (AC, abilities, HP, speed, proficiency, with the item that causes each).
* **Sources:** timed effects (potions, powers, DM-applied effects, with live countdowns that drop off when they expire),
  feats, achieved hidden powers, and the text of every equipped item (the same text the character sheet reads).
* **Engine:** `mechanics/engine/character/player-status.js` (pure, tested in `player-status.test.js`):
  `parseDefenses(text)`, `classifyEffect(text, name)`, `buildPlayerStatus(...)`, `formatRemaining(ms)`.
  UI: `player-status.js` (`PlayerStatusUI.mount/tick`).
* **Limits:** classification is text-based. An effect is a *transformation* if it says it turns/transforms/polymorphs
  you, a *condition* if it names a condition (Poisoned, Stunned ...) that it inflicts, a *debuff* if it has a negative
  stat or disadvantage, otherwise a *buff*. Offensive clauses ("the target must save ...") are ignored.

## Mobile / touch
* On devices without hover, the item popup becomes a **bottom sheet**: tap an item to open it, scroll it, use
  **Examine** or **Close**, tap outside or press Escape to dismiss.
* The Examine view, Wild Magic modal and Edit-style modals open full width from the bottom on screens up to 700px;
  tables scroll sideways, attack-margin controls use full-width, 16px inputs (no iOS zoom).
* Player Status is a single column of cards that becomes a grid on wider screens.
