# Handoff brief: wiring the frontend to the new backend

Paste this whole file as your first message in a new Claude Code session (on whatever computer
you're continuing from) to pick up exactly where this one left off. It's written to be
self-contained — no prior conversation context required.

## What this project is

`dungeon-master-box` is a local-first architectural migration of `dungeon-loot-tool`, a D&D 5e
loot/combat/campaign browser tool. The migration moves it from a Firebase-synced monolithic HTML
file toward a real local Node.js server backed by SQLite, with no cloud dependency. Full plan:
`docs/MIGRATION_PLAN.md`. Full phase-by-phase build history and design reasoning:
`docs/ARCHITECTURE.md`.

**Two repos, never confuse them:**
- `dungeon-loot-tool` — the ORIGINAL. Stable, deployed, continues independently. **Never modify
  this repo as part of this migration**, under any circumstances.
- `dungeon-master-box` — the migration's development home. Started as an exact copy of
  `dungeon-loot-tool`'s history and diverges from there. This is the repo all work happens in.

## Standing rules (established over a long prior session, apply to everything from here on)

- **Confirm scope with the user before building anything new.** Each phase/sub-phase gets scoped
  narrowly and approved before code is written, especially once a phase is large enough to bundle
  multiple concerns — audit first, then propose a narrowed plan, then wait for explicit approval.
- **Audit before building**, always, for any nontrivial existing code being replaced or wrapped —
  read it fully, trace dependencies, don't assume behavior.
- **Never trust one clean test run.** Run the full test suite (`node --test` from the repo root)
  30-70+ times consecutively before calling any new work validated. This project has repeatedly
  found real bugs (not just flaky ones) that only a single run would miss — see
  `docs/ARCHITECTURE.md`'s Phase 5c and 5d sections for two different concrete examples of this.
- **Document every deliberate simplification or gap explicitly** in `docs/ARCHITECTURE.md` rather
  than silently dropping original behavior (e.g. no Firebase-Auth-equivalent verification yet, no
  400ms debounce on broadcasts, DM roster reflects connected-only players). Don't silently
  over-engineer unrequested completeness either.
- **Don't commit without explicit instruction.** Once told to commit, the established flow is:
  feature branch per phase/sub-phase, descriptive commit message (with
  `Co-Authored-By: Claude <noreply@anthropic.com>`), push immediately after committing without a
  separate confirmation question, `gh pr create` (never draft) — but **never merge a PR without a
  separate, explicit "merge it" from the user**, even if they approved the branch/PR itself
  earlier. After merging: `git checkout main && git pull origin main`, then re-run the full test
  suite before building on top of it.
- **Tool quirk to know about:** the `Edit` tool sometimes throws "File has been modified since
  read" even right after a fresh `Read`, particularly on docs and test files. Workaround: do an
  explicit fresh `Read` immediately before the edit, or use `Write` for full-file rewrites, or use
  shell (`cat >>`, careful `sed -i`) for append/single-line edits — but avoid heredocs with a lot
  of apostrophes in the body (`isn't`, `doesn't`, etc.), they can break the outer shell quoting;
  prefer `Read` + `Edit`/`Write` for prose-heavy content instead.

## Current state (as of this handoff)

Phases 0 through 5 are complete and merged to `main`. In order:
- **Phase 0**: repo separated, history preserved.
- **Phase 1**: game logic extracted to `game-engine.js` (character sheet math, battle
  parsing/damage, item classification, all four gambling games).
- **Phase 2**: SQLite schema + data-access layer (`db/schema.js`, `db/database.js`), using
  Node's built-in `node:sqlite`. Partial normalization — `characters` and (later) a few other
  genuinely relational tables get real columns; everything else lives as JSON in a generic
  per-subsystem `campaign_state` bucket (see `SUBSYSTEMS` in `db/schema.js`).
- **Phase 3**: a real Node.js server (`server/server.js`), plain `http` module, no framework,
  exposing Phase 2's persistence as a REST API. Routes: `POST/GET /campaigns`,
  `GET /campaigns/:id`, `GET /campaigns/:id/characters`, `GET/PUT
  /campaigns/:id/characters/:accountUid`, `GET /campaigns/:id/state`, `GET/PUT
  /campaigns/:id/state/:subsystem`, `GET /campaigns/:id/gambling` + `POST
  /campaigns/:id/gambling/:subpath`. **No static file serving yet** — this server currently only
  answers JSON API requests, it doesn't serve the HTML/CSS/JS files themselves.
- **Phase 4**: gambling resolution made genuinely server-authoritative (`server/gambling.js`) —
  first proof that the server, not the client, can own game truth.
- **Phase 5 (a-d, all merged)**: full WebSocket multiplayer layer (`server/websocket.js`),
  replacing every real-time system `multiplayer-sync.js` implements: core state push/listen,
  cross-player writes (hp_delta/gift_item/set_inventory_fields), loot-claim arbitration
  (first-write-wins via a SQL `UNIQUE` constraint), battlefield/puzzle-log broadcast (with the
  original's exact loot-visibility filtering), the DM roster listener, and the attack-request
  review queue. Full message protocol documented at the top of `server/websocket.js`. 126 tests
  passing (`node --test` from repo root), validated with 30-70+ consecutive clean runs at each
  phase.

**Critically: none of this is wired into the live app yet.** The actual browser app
(`dungeon_loot_wheel_v96_spell_details.html`, ~18,600 lines) and `multiplayer-sync.js` (1,624
lines) are completely untouched — still 100% Firebase/Firestore for multiplayer, still
`localStorage` for persistence. The new backend has been built and tested entirely in isolation.
This is deliberate and was confirmed at every phase, not an oversight.

## What's next: frontend wiring (not yet scoped as a formal phase — that's the first thing to do)

This is the gap between "the backend exists" and "a DM could actually run this with real
players." Concrete numbers gathered so far, to save re-discovery:

- `multiplayer-sync.js`: 1,624 lines, 57 Firebase/Firestore references, 52 exported functions.
  This is the file whose *internals* need to swap from Firestore calls to WebSocket calls against
  `server/websocket.js`'s already-built, already-tested protocol. The design intent is to keep
  its exported function names/signatures the same so call sites elsewhere don't need to change.
- The main monolith calls `multiplayer-sync.js` functions in **27 places**, and calls
  `saveAppState`/`loadAppState` (its localStorage persistence functions) in **13 places**. Same
  approach: rewrite those two functions' internals to call the REST API, keep call sites
  unchanged where possible.
- `server/server.js` has no static file serving yet — needed so the DM's machine can serve the
  actual app files, not just answer API requests.
- Firebase Auth is still an open, undecided question. Given this is local-first and typically
  played in person, a much simpler identity model (DM sets a room code, each player picks a
  display name, no real credential system) is likely sufficient and avoids reimplementing
  Firebase Auth — but this is a product decision for the user to confirm, not something to assume
  and build.

### Recommended order of work (propose this to the user, get explicit sign-off before starting)

1. **Audit** `multiplayer-sync.js`'s 52 functions and the monolith's 27+13 call sites in detail —
   same rigor as the original Phase 5 audit (trace what each function actually does, what state
   it touches, what UI it's coupled to). Produces a real scoped plan instead of an estimate.
2. **Decide the auth/identity approach explicitly** with the user before writing code — it
   changes what "wiring" means. Don't decide unilaterally.
3. **Add static file serving** to `server/server.js` — small, standalone, low-risk, could be its
   own tiny first sub-phase.
4. **Rewrite `multiplayer-sync.js` internals** against the existing WebSocket protocol described
   in `server/websocket.js`'s module comment — the biggest chunk of work, but translation against
   an already-tested spec, not exploratory design.
5. **Rewrite `saveAppState`/`loadAppState`** against the REST API.
6. **Real multi-device LAN testing** as an explicit validation step of its own — this can't be
   brute-forced with `node --test` loops the way prior phases were; it needs actual browsers on
   actual devices on a real network, DM's machine plus at least one other device.
7. **Only after that works**, move to Phase 6 (packaging/deployment) — bundling, local network
   discovery (e.g. mDNS so players don't need to type a raw IP), installer/startup scripts.

### First message to send once in the new session

Something like: *"Continue the dungeon-master-box migration. Start with step 1 above — audit
`multiplayer-sync.js` and the monolith's call sites into it, and `saveAppState`/`loadAppState`'s
call sites — and come back with a scoped plan before writing any code. Don't touch
`dungeon-loot-tool` at all."*
