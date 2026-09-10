# Migration Plan

This is the phase-by-phase plan as originally scoped for the dungeon-master-box migration. Each
phase is reviewed and approved individually before the next begins — this document describes the
intended arc, not a commitment to execute every phase on any particular timeline.

## Guiding principles (apply to every phase)

- **Preserve behavior, don't redesign.** Each extraction/migration phase moves code, it doesn't
  change game rules, formulas, or user-visible behavior unless a phase is explicitly scoped to do
  so.
- **No silent scope creep.** A phase does only what it says it does. Unrelated cleanup, refactors,
  or "while I'm in here" changes belong in their own separate, reviewed change.
- **Stop and report before assuming.** If a phase's target state (permissions, architecture,
  environment) can't be safely verified, stop and report exactly what's missing rather than
  improvising.
- **Original repo stays untouched.** dungeon-loot-tool's own `main` branch continues independently
  and is never written to as part of this migration.

## Phase 0 — Repository Separation & Migration Baseline ✅ complete

Preserved dungeon-loot-tool as the stable reference and created this repository as the
architectural migration's development home, starting from dungeon-loot-tool's exact current
working state with full commit history preserved (not squashed, not reset to an unrelated repo).
No application architecture changed in this phase.

## Phase 1 — Game-engine extraction (not started)

Extract dependency-light game logic into a `game-engine.js` module, without changing any
user-visible behavior or beginning the SQLite/server/multiplayer migration.

Target logic (subject to the dependency audit below actually confirming each is extractable
as-is):
- `computeCharacterSheetFor`
- `battleParseAttack`
- `battleRollDamage`
- `battleEffectivenessLabel`
- `classifyItemFull` and its direct dependencies
- Resolution logic for all four gambling games

Required steps for this phase:
1. **Audit dependencies before extracting.** For every target function, trace direct and
   transitive dependencies and explicitly flag any reference to the DOM, `window`, browser APIs,
   mutable global state, global data structures, UI state, event handlers, `localStorage`, or
   randomness. Distinguish genuinely dependency-free logic from logic with easily-injectable
   dependencies from logic still coupled to the UI/app shell. Anything that can't cleanly extract
   yet stays where it is, with the reason documented — don't force UI-dependent code into the
   engine module.
2. **Preserve behavior exactly.** This phase is architectural extraction, not redesign. No
   intentional changes to formulas, game rules, damage calculations, item classification,
   gambling rules, modifier behavior, randomization behavior, or existing inputs/outputs.
3. **Establish regression tests** covering the extracted logic's existing behavior before/during
   extraction — known input → known output, both before and after the move. For randomness-
   involving functions, separate deterministic rule resolution from the random source where
   practical (or make the random source injectable) without changing gameplay behavior. Don't
   invent new game rules just to make something easier to test.
4. **Create `game-engine.js`** — a dependency-light ES module, explicit imports/exports, no DOM
   dependency, no unnecessary framework/abstraction layer.
5. **Temporary compatibility bridge** — reuse the existing `window.X` bridge pattern (same one
   `multiplayer-sync.js` already uses to talk to the monolithic HTML file) only where needed so
   the existing app can keep calling the extracted functions. This is a migration shim, not the
   intended final architecture — the eventual design uses explicit module imports, not a global
   `window` namespace.
6. **Do not start later phases** — no SQLite, no Node.js server, no persistence migration, no
   multiplayer redesign, no WebSocket work, no `multiplayer-sync.js` refactor, no Effects/Traits/
   Modifiers/Abilities unification, no item-data-model redesign, no UI rewrite, no broad repo
   reorganization, no unrelated cleanup.
7. **Document the result** in `docs/ARCHITECTURE.md` — what was extracted, what remains in the
   monolithic HTML file and why, dependencies discovered, functions that couldn't yet be
   extracted, temporary `window.X` bridges, randomness dependencies, remaining UI coupling, how
   the extracted engine is currently consumed, and what this enables for the future server
   architecture.
8. **Validate before finishing**: app still loads; loot/item, character, combat, and gambling
   behavior all unchanged; multiplayer functionality not intentionally altered; regression tests
   pass; no new console errors; the extracted module genuinely works independently of the DOM
   wherever claimed; no unrelated files touched.

Ends with a concise report (files changed, functions extracted, functions intentionally not
extracted and why, tests added/results, dependencies discovered, compatibility bridges, risks,
recommended next phase) and a stop for review before Phase 2.

## Phase 2 — SQLite / database foundation (not started, not yet scoped in detail)

Durable local persistence to replace the current ad-hoc state-blob approach. Detailed scope to be
written when this phase is approved to begin.

## Phase 3 — Node.js server (not started, not yet scoped in detail)

A real local server process a DM runs, as the foundation for server-authoritative state.

## Phase 4 — Server-authoritative game state (not started, not yet scoped in detail)

The server becomes the single source of truth for game state, rather than state being split
across clients and Firestore the way it is today.

## Phase 5 — WebSocket multiplayer (not started, not yet scoped in detail)

Replaces the current Firebase/Firestore-based multiplayer sync layer (`multiplayer-sync.js`) with
a WebSocket connection to the local server from Phase 3/4.

## Phase 6+ — Dungeon Master Box deployment (not started, not yet scoped in detail)

Packaging the evolved application so a DM can run it locally with no cloud dependency — the
"Dungeon Master Box" this repository is named for.
