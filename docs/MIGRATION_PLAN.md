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

## Phase 1 — Game-engine extraction ✅ complete

Extracted item classification, character sheet math, battle parsing/damage, and all four
gambling games into `game-engine.js`, bridged into the monolith via `window.X`. Two real
ordering/audit mistakes were made and fixed — see `docs/ARCHITECTURE.md`'s Phase 1 section for
the full account, including the lesson for future phases about auditing bulk line-range edits
and top-level script-ordering hazards more thoroughly than "just" the target function names.

Original scope description, preserved for reference:

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

## Phase 2 — SQLite / database foundation ✅ complete

Built the schema (`db/schema.js`) and a Node-side data-access layer (`db/database.js`) using
Node's built-in `node:sqlite`, with 16 regression tests. Deliberately **not** wired into the live
browser app yet — the app still uses `localStorage` unchanged. Partial normalization: a real
`characters` table (matches `game-engine.js`'s character-sheet shape), everything else scoped
into a generic per-subsystem `campaign_state` bucket rather than a speculative full redesign. See
`docs/ARCHITECTURE.md`'s Phase 2 section for the full schema reasoning and the `node:sqlite`
experimental-API risk this introduces.

## Phase 3 — Node.js server ✅ complete

Built a real Node.js server (`server/server.js`, plain `http` module, no framework — the
project's first point where adding a dependency like Express was a live option, deliberately
declined to stay dependency-free) exposing Phase 2's persistence layer as a REST API, with 18
regression tests plus a manual end-to-end smoke test against a real file-backed database.
Deliberately **not** wired into the live browser app yet — that's Phase 4. See
`docs/ARCHITECTURE.md`'s Phase 3 section for the full route list and error-handling design.

## Phase 4 — Server-authoritative game state ✅ complete (first slice: gambling)

Confirmed before starting that the literal full scope ("every state mutation, server-owned") was
too large and risky for one phase. Built a narrower, well-bounded first slice instead: gambling
resolution (`server/gambling.js`) is now genuinely decided server-side — every resolve step uses
the server's own randomness, never a client-supplied value, provable by inspection and covered
by a regression test that confirms extra client-supplied fields are ignored. Everything else
(combat, inventory, character state, the rest of multiplayer) is untouched. Deliberately does
NOT add any authorization/auth system — that gap is real and explicitly documented, not papered
over. Not wired into the live app yet. See `docs/ARCHITECTURE.md`'s Phase 4 section for the full
route list and the authorization gap in detail.

## Phase 5 — WebSocket multiplayer (in progress, broken into sub-phases)

A full audit of `multiplayer-sync.js` (1,538 lines) found it bundles four largely separate
systems — authentication, real-time state sync, Firestore-security-rule-dependent race
arbitration for loot claims, and a whole login/account UI — plus several more broadcast/listener
subsystems on top. Attempting all of it as one phase was rejected as too large; see
`docs/ARCHITECTURE.md`'s Phase 5a section for the full breakdown.

**Phase 5a ✅ complete** — replaces only the core state push/listen loop
(`pushOwnState`/`startPlayerListener`) and the three cross-player writes (`applyHpDelta`,
`giftItemToPlayer`, `setPlayerInventoryFields`) with a WebSocket layer (`server/websocket.js`),
backed by a new `player_states` table (`db/schema.js`). Firebase Auth and the account UI are
untouched. First real npm dependency (`ws`) added, per confirmed choice over hand-rolling the
WebSocket protocol.

**Phase 5b ✅ complete** — replaces `createLootClaim`/`startLootClaimListener`'s real-time,
first-write-wins loot claiming. A `UNIQUE(campaign_id, claim_id)` constraint on a new
`loot_claims` table (`db/schema.js`) is the direct SQL equivalent of the original's reliance on
Firestore's create-vs-update security rules — same no-race-window guarantee. Deliberately still
doesn't carry the actual item data, matching the original's own split between claim arbitration
and item delivery. Confirmed with a real two-connection race test, not just single-claim checks.

**Phase 5c ✅ complete** — replaces `pushBattlefieldState`/`startBattlefieldListener` and
`pushPuzzleLogState`/`startPuzzleLogListener`, including the original's exact loot-visibility
filtering (allowlisted fields, loot hidden until revealed, reserved/claimed items stripped). Two
new `campaign_state` subsystem buckets (`battlefield_broadcast`, `puzzle_log_broadcast`), no new
table. A late-joining player catches up immediately on identify rather than waiting for the next
push. Surfaced a real, 100%-reproducible test bug (not flakiness) — see
`docs/ARCHITECTURE.md` for the full account, including why it's a structurally different bug
class than the two flaky-test fixes before it.

**Not yet started** (future sub-phases): the DM roster listener, the attack-request review
queue, and a decision on whether Firebase Auth stays permanently or is ever replaced.

## Phase 6+ — Dungeon Master Box deployment (not started, not yet scoped in detail)

Packaging the evolved application so a DM can run it locally with no cloud dependency — the
"Dungeon Master Box" this repository is named for.
