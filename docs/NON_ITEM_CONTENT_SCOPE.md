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

### `puzzle-data.js` (13 categories, 313 entries total) — scoped in full; not a preservation gap, and full structuring is not recommended

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
stat bonuses), a puzzle's consequence space here is genuinely open-ended by design.

#### Full scoping pass: read every one of the 13 categories directly, not just riddles

The finding above was written from `RIDDLE_LIBRARY` alone. Reading a representative sample of all 13
categories' actual `note`/`hook` text changes the picture — there's more shared structure than that
first pass gave credit for, but also a real, structural reason auto-resolution doesn't pay off here
the way it did for traps and journeys.

**More internal structure than expected.** 9 of the 13 categories (Riddles, Logic, Cipher,
Astronomical, Environmental, Sequence, Illusion, Timeloop, Antipuzzle) consistently write their
`note`/`hook` field as the same loose three-part narrative, in the same order, every time: a **hint**
clause (a skill + DC to nudge a stuck table, or "no roll needed" for a pure-reasoning puzzle), a
**failure consequence** clause (what happens on a wrong attempt — commonly "no penalty, just retry,"
sometimes a small damage roll, sometimes an alarm/wandering-encounter trigger, sometimes lost time),
and a **reward** clause (what the puzzle yields once solved). That's a real, consistent authoring
pattern, not noise.

**But 4 of the 13 don't fit that same shape at all**, and can't be forced into it without losing what
makes them work:
- `CHARACTER_GATED_PUZZLES` opens with a **gate** (a specific class feature/proficiency/racial trait
  that solves it outright) plus a **fallback** (an alternate, harder path for a party without it) —
  structurally a gate+fallback+reward triple, not a hint+failure+reward one.
- `MORAL_PUZZLES` is explicit, in-text, that there is **no correct answer** ("Deliberately no
  'correct' verdict" — The Dryad's Orchard) — resolution is open-ended roleplay judgment the DM
  weighs case-by-case; there is no failure state or fixed reward to encode.
- `RESOURCE_PUZZLES` demands a **real, permanent cost** (actual gold burned, actual current HP lost,
  an actual expended spell slot) with no hint-DC at all and often no separate reward clause — the
  reward IS passage.
- `COOPERATIVE_PUZZLES` has the hint/failure shape but routinely has **no explicit reward clause** —
  solving it simply lets the scene continue.

**Even within the 9 "standard-shape" categories, the values inside each clause are too heterogeneous
for a small closed enum** the way `journey-data.js`'s 9 consequence types worked. A journey's
`consequence.type: 'gold'` always means the same thing: a `{amount}` the engine adds to the player's
sheet. A puzzle's "reward" clause might be a flat gp value, a fully-invented one-off magic item
described in prose ("a sunstone — functions as a continual light pebble, or sells for 50 gp"), an
ability grant ("advantage on the party's next saving throw"), or explicitly left to improvisation
("a minor magic trinket, DM's choice"; "whatever the festival lock protects, ideally something
thematically tied to that holiday's meaning"). Structuring that last, common case would mean either
inventing specificity the content deliberately doesn't commit to, or falling back to a free-text
escape hatch often enough that the schema stops earning its keep.

**The deeper reason automation doesn't pay off here, structurally, not just as a content-messiness
problem:** a trap's trigger is mechanical (a creature steps on a plate) and its outcome is a die roll
(a saving throw) — software can own the whole thing. A journey's consequence is chosen by the player
picking one of several pre-written approaches — still a discrete, software-knowable input. A puzzle's
"solved or not" is neither: it's whether the players actually reasoned out the answer at the table,
in conversation, in their own words — an inherently DM-judged call with no structured signal for any
tool to read. Even a perfect consequence schema wouldn't give a "click to resolve" button the way the
Trap tool has, because there's no equivalent trigger moment; the DM still has to decide "did they get
it" before anything could fire.

**Current live behavior, confirmed directly:** `note`/`hook` renders as one flat prose line (a single
🎲-prefixed paragraph) shown after "Reveal Solution/Answer" — never split, never parsed. The Puzzle
Log (the DM's "what's active right now" tracker) is completely decoupled from the library: there is
no "send this to the log" action; a DM using a canned library puzzle re-types its title/prompt/answer
into the log by hand if they want to track it.

**Recommendation: don't build a full structured, auto-resolving consequence schema — it's a poor fit
for most of this content and the automation payoff is structurally weak.** If anything is worth
doing, it's much smaller than originally framed: splitting the single `note`/`hook` field into
labeled sub-fields (`hint`/`onFail`/`onSolve` for the 9 standard-shape categories; `gate`/`fallback`/
`reward` for `CHARACTER_GATED_PUZZLES`; leaving `RESOURCE_PUZZLES`' cost and `MORAL_PUZZLES`' judgment
guidance as single free-text fields, since they don't decompose the same way) — a pure readability/
display improvement (the DM scans three short labeled lines instead of one dense paragraph), still
entirely free text inside each field, no enum, no auto-resolution attempted. A genuinely separate,
smaller, and more clearly valuable improvement — unrelated to consequence-structuring — would be
wiring a "send to Puzzle Log" action from the library so the DM doesn't have to retype a canned
puzzle's title/prompt/answer by hand. Neither is started here; both are optional content/UX work, not
preservation fixes, and the call on whether either is worth doing belongs to whoever's driving the
project.

### `npc-data.js` (`NPC_LIBRARY`: 29, `NPC_COMBAT_DEFS`: 26, `NPC_CONNECTIONS`: 29, `NPC_WEAPONS`: 8) — reconciled (see below); update to this section's original finding

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
  flavor/roleplay display. Coverage: `NPC_COMBAT_DEFS` covers every `NPC_LIBRARY` entry except three
  (Sela Reave, Petra Ashby, "The Patron") — all three read as deliberately non-combatant on
  inspection (the file's own header comment already singles out "The Patron" as someone nobody in
  the story has ever met in person), not an oversight.

**This section originally reported "zero mismatches" — that check only compared `ac`. A full audit
(HP, speed, and every weapon attack's to-hit/damage) found 46 mismatches across 21 of the 26
combat-capable NPCs — not rare drift, most of the cast, and not even one-directional (a few of
NPC_LIBRARY's numbers were lower than the formula, most were higher).** Since `NPC_LIBRARY`'s
`attacks[]` text is confirmed read-only display (the NPCs tab prints it as-is; nothing ever rolls
dice off it — that's exclusively `NPC_COMBAT_DEFS`'s job via `NPC_LIBRARY_MONSTERS`/`monsterDatabase`),
`NPC_COMBAT_DEFS` is the one with a real, live mechanical consequence and the one whose formula
(`humanNpc`/`humanNpcAttack`) has an actual computable "correct" answer.

**Reconciled by recomputing NPC_LIBRARY's formula-backed numbers from NPC_COMBAT_DEFS** — HP (from
`hitDice`+`con`), speed (a flat copy), and each weapon attack's own `+to-hit` and base damage
dice/modifier (from the relevant ability score + CR) — using the exact same formulas
`humanNpc()`/`humanNpcAttack()` themselves use. A first attempt did this as a full `attacks[]`
overwrite and was caught before committing: it silently deleted Firewarden Cassia Emberlyn's
"Hearth-Seal" ability outright (a narrative utility ability with no `NPC_COMBAT_DEFS` counterpart to
preserve it against) and trimmed several other abilities' flavor/DM-guidance text with no
correctness justification (a non-weapon special ability's save DC and effect text is hand-authored
on both sides with no formula backing either one — there's no computable "correct" version to
enforce, so overwriting was just replacing one hand-authored choice with another and silently
losing content). Redone narrower: only fields with an actual formula-derived ground truth were
touched; attack/ability *names*, non-weapon special-ability text, and bonus-damage riders were left
completely untouched. Verified nothing narrative was lost by diffing every changed line by hand
before committing.

Also added a permanent regression test (`npc-data.test.js`) — the same "keep it reconciled forever,
not just once" pattern this whole migration effort already uses for items — that verifies every
`NPC_COMBAT_DEFS` entry's formula-derived HP/speed/attack numbers still appear in `NPC_LIBRARY`'s
text, for every shared NPC, so a future edit to either file that reintroduces this drift fails a test
immediately instead of sitting unnoticed. Confirmed it actually catches drift (deliberately
corrupted one value, watched the test fail with a clear message, restored it, watched it pass again)
before treating the test as done.

## What this means for "the non-item content migration"

There mostly isn't one — not in the shape the item migration was. Two files (`trap-data.js`,
`journey-data.js`) are already exactly what a migration would have produced. Three
(`reference-data.js`, `cult-data.js`, and `NPC_CONNECTIONS`/`NPC_COMBAT_DEFS` within `npc-data.js`)
are reference/narrative/already-live content with nothing to fix. Of the two remaining items:

1. **`NPC_LIBRARY`/`NPC_COMBAT_DEFS` reconciliation** — **done.** Turned out to be a real, live
   46-mismatch drift across 21 of 26 NPCs (not the "zero mismatches" this document originally
   reported — that check only compared `ac`), fixed by recomputing `NPC_LIBRARY`'s formula-backed
   numbers from `NPC_COMBAT_DEFS`, guarded going forward by a new permanent test
   (`npc-data.test.js`). See the `npc-data.js` section above for the full account, including a first
   attempt that was caught and reverted for silently deleting content.
2. **A structured puzzle-consequence schema** — **scoped, not recommended.** A full read of all 13
   categories (not just riddles) found more shared narrative structure than first assumed (9 of 13
   consistently write a hint/failure/reward pattern), but also a structural reason automation doesn't
   pay off here even where that pattern holds: a puzzle's "solved or not" is a DM's own judgment call
   about the players' table talk, with no discrete signal any schema could read the way a trap's save
   roll or a journey's chosen approach gives one — so there's no clean "click to resolve" moment to
   build a Trap-tool-style button around even with a perfect schema. 4 of 13 categories also don't
   fit any single shape at all (gated/fallback, open-ended moral judgment, hard resource cost, no
   fixed reward). Recommendation: don't build the full schema. The only piece that might still be
   worth doing is much smaller — splitting the single `note`/`hook` field into a few labeled free-text
   sub-fields per category-family, purely for DM readability at the table, no enum or resolution logic
   involved — and, separately, a "send to Puzzle Log" convenience action. See the `puzzle-data.js`
   section above for the full account. Neither is started; whether either is worth doing is a call for
   whoever's driving the project.
