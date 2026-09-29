# Scoping: non-item content ("Phase 2" of the content migration effort)

This is a scoping pass, not an implementation — see `docs/V2_MECHANICS_MIGRATION.md`'s "Not yet
done" list, item 2: `npc-data.js`'s non-weapon content, `journey-data.js`, `puzzle-data.js`,
`trap-data.js`, `reference-data.js`, and `cult-data.js`. None of this is item content, so none of
it fits the `Item` schema that migration built. Investigated each file directly (structure, live
consumption in the monolith, and what dungeonboxnewVersion2_rework — "V2" — actually has for it)
before proposing any work, the same way the item migration itself started with an audit before a
single line of schema was written.

## The one finding that reframes everything else

**V2 has no mechanics engine for any of this content.** Confirmed two ways, not assumed:

1. V2's own source says so directly. `dungeonboxnewVersion2_rework/src/data/example-monsters.js`'s
   header comment: *"No real monster/NPC system exists yet in this rebuild (that's Phase 7.2+)."*
   There is no equivalent comment for journeys/puzzles/traps/reference/cult content because there's
   no placeholder data for them at all — monsters at least got a synthetic stand-in file; this
   content has nothing.
2. Enumerated V2's actual `src/engine/**` and `src/data/**` directories. Every file is
   character/combat math (`ability-scores`, `character-sheet`, `equipment`, `hp`, `stat-modifiers`),
   dice, or **items** (`abilities`, `consume`, `interactions`, `item-schema`, `modifiers`,
   `monster-parts`, `validate-item`) — the exact slice this whole migration effort has already
   ported. Nothing for monsters, NPCs, journeys, puzzles, traps, or reference/cult content exists
   anywhere in V2's engine.

This matters because the item migration's entire shape — a real, designed target schema
(`item-schema.js`) to port dungeon-master-box's own regex-driven content INTO, with V2 as the
mechanics authority — has no equivalent here. There is nothing to port to. Whatever structure
already exists for this content in dungeon-master-box was authored natively, not ported from V2,
and (this is the second finding) most of it turns out to already be in very good shape.

## Per-file findings

### `trap-data.js` (`TRAP_LIBRARY`: 16, `HAZARD_LIBRARY`: 10 — 26 entries) — already done, no work needed

Already fully structured: real typed fields (`saveAbility`, `saveDC`, `damage`, `damageType`,
`condition`, `conditionDuration`), not prose. Already mechanically live: `game-engine.js`'s
`applyTrapEffectToState` resolves these directly (rolls damage, applies a save, sets a condition),
backing the DM's "Apply Trap to Player" tool. This is, structurally, already exactly what an item
migration would have produced — dungeon-master-box's own authors built it this way from the start.
Confirms the migration doc's earlier guess ("traps are already fully structured today") directly
against the code rather than leaving it as a guess.

### `journey-data.js` (`JOURNEY_ENCOUNTERS`: 85) — already done, no work needed

Also already fully structured, and more ambitiously so than traps: each encounter's `approaches[]`
carries a typed `consequence` (`loot`/`namedItem`/`gold`/`monster`/`namedNpc`/`buff`/`debuff`/
`note`/`none`, each with real sub-fields), resolved live by the monolith's `applyJourneyConsequence`
— which rolls real loot into the player's inventory, adds a real monster to the Combat tab, etc.
It also deliberately reuses the trap/hazard/puzzle/NPC libraries via a `sourceRef` field
(`{type, ref}`) rather than duplicating their content, resolved live by `journeySourceContent()`.
This is a well-designed, working, native structured-content system — no gap to close.

### `reference-data.js` (129 entries across 6 categories) and `cult-data.js` (`CULT_LIBRARY`: 10) — nothing to migrate, by nature

Pure DM lookup/compendium and worldbuilding content respectively. Checked specifically whether
anything here has a live "apply this" tool the way traps do (e.g. `DISEASE_LIBRARY`, which has
`saveAbility`/`saveDC` fields that look mechanical) — confirmed none exists; `DISEASE_LIBRARY` is
read only by the Compendium's display code, same as every other reference-data category. This is
appropriate, not a gap: a disease is something a DM narrates onto a character and adjudicates by
hand (there's no "you contracted a disease" trigger anywhere in the app that would need one to
auto-resolve into), the same way a real sourcebook's disease writeup doesn't "run" itself. `cult-data.js`
has no mechanical fields at all — pure narrative. Neither needs a schema; they aren't mechanics.

### `puzzle-data.js` (13 categories, 313 entries total) — the one real gap, and it's a design problem, not a preservation one

Structured at the top level (`{q, a, tier, hook}` for riddles; `{title, prompt, solution, note}` for
the other 12 categories), but the actual mechanical content — a DC, a damage die, a condition, a
reward — lives inside free-prose `hook`/`note` text ("DC 12 Acrobatics check", "1d6 fire damage",
"advantage on the party's next saving throw"), not structured fields. Confirmed there is no live
parsing of this text anywhere: the Puzzles tab is a browsable library plus a manually-typed
DM "Puzzle Log" (title/prompt/answer typed fresh each time, not read from the library's own
fields) — 100% DM-read-and-adjudicate, same as the original tabletop material this represents.

This is a genuinely different kind of gap from everything the item migration fixed. Every item bug
this project found (double-counted damage, dropped bonus riders, silently-lost effect text) was a
**regression from a live regex path already running against this data** — real, present bugs with
real, present player-facing consequences. Puzzles have no such regex path: nothing is silently
wrong today, because nothing currently tries to resolve a puzzle's consequence automatically at all.
"Migrating" this would mean **designing a new consequence schema from scratch** — and unlike
`OnUseEffect` (which only ever had to model 5e's well-worn vocabulary: attack rolls, damage, saves,
stat bonuses), a puzzle's consequence space here is genuinely open-ended by design (313 examples
range from "a wall of animate razor-grass" to "a time-locked door," "a sound-ward," "a scale-vault
door," and dozens of shapes that don't reduce to a small enum the way `journey-data.js`'s 9
consequence types cleanly did). This is new design work with no existing template to follow, not a
bounded preservation fix — closer in kind to designing `journey-data.js`'s own consequence system
was, the first time, than to anything this migration branch has done so far.

### `npc-data.js` (`NPC_LIBRARY`: 29, `NPC_COMBAT_DEFS`: 26, `NPC_CONNECTIONS`: 29, `NPC_WEAPONS`: 8) — mostly done; one real, small content-quality question

`NPC_WEAPONS` (8 items) was already migrated as real canonical items back in the item migration's
own Phase 6 — not revisited here. Of the rest:

- `NPC_COMBAT_DEFS` is already structured (ability scores, AC, hit dice, CR, a real `actions[]`
  array) and already mechanically live: `humanNpc()` maps each entry into a real `monsterDatabase`
  entry (`NPC_LIBRARY_MONSTERS`), so every combat-capable named NPC is already selectable from the
  Combat tab's normal monster picker like any other creature. No gap.
- `NPC_CONNECTIONS` (29 entries, one per `NPC_LIBRARY` id including narrative-only ones) backs a
  read-only "Web" relationship-chart display. No mechanics to speak of; nothing to migrate.
- `NPC_LIBRARY` itself carries its own `ac`/`hp`/`speed`/`attacks[]` fields, separately authored
  from — and duplicating — the same information in `NPC_COMBAT_DEFS`, for the NPCs tab's own
  flavor/roleplay display. **Checked directly whether these two hand-kept-in-sync sources have
  actually drifted**: compared every shared name's `ac` field programmatically — zero mismatches
  across all 26 combat-capable NPCs. Also checked coverage: `NPC_COMBAT_DEFS` covers every
  `NPC_LIBRARY` entry except three (Sela Reave, Petra Ashby, "The Patron") — all three read as
  deliberately non-combatant on inspection (the file's own header comment already singles out "The
  Patron" as someone nobody in the story has ever met in person), not an oversight.

So today: consistent, not broken. The only real question is a maintainability one, not a mechanics
one — two independently-authored sources of truth for the same NPC's combat stats is a real risk
for future drift (nothing currently checks them against each other), but it isn't a live bug to fix
today. If this is ever worth doing, the shape of the fix is narrow and well-understood: either a
one-time reconciliation pass plus a lint-style consistency check in the test suite (cheap, keeps
both files as-is), or collapsing `NPC_LIBRARY`'s `ac`/`hp`/`speed`/`attacks` fields to read live from
`NPC_COMBAT_DEFS` instead of duplicating them (removes the duplication outright, more invasive).
Neither is scoped further here since neither is urgent.

## What this means for "the non-item content migration"

There mostly isn't one — not in the shape the item migration was. Two files (`trap-data.js`,
`journey-data.js`) are already exactly what a migration would have produced. Three
(`reference-data.js`, `cult-data.js`, and `NPC_CONNECTIONS`/`NPC_COMBAT_DEFS` within `npc-data.js`)
are reference/narrative/already-live content with nothing to fix. What's actually left is two
small, independent, genuinely-optional pieces of NEW work, not preservation fixes, each easily
separable from the other:

1. **`NPC_LIBRARY`/`NPC_COMBAT_DEFS` reconciliation** — small, mechanical, low-risk, a content-quality
   improvement (either a consistency check or a dedup). Could be done in an afternoon.
2. **A structured puzzle-consequence schema** — a real, open-ended design task with no template to
   follow (V2 has nothing for this, and `journey-data.js`'s consequence system — the closest
   precedent in this codebase — is a much narrower, closed vocabulary by comparison). Worth doing
   only if there's an actual feature it would unlock (e.g. a "resolve this puzzle's consequence"
   button the DM could click, mirroring the trap tool) — not valuable as preservation for its own
   sake, since nothing is currently lost or broken by puzzles staying DM-adjudicated prose.

Neither is started here. This document is the scoping deliverable; which (if either) to actually
build is a call for whoever's driving the project, not something to default into.
