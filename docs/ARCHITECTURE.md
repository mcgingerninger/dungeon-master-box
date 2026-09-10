# Architecture

Living documentation of the migration (see `docs/MIGRATION_PLAN.md` for the full phase plan),
organized by phase. Each section documents what that phase actually did — not just what was
planned — including dependencies discovered and mistakes made along the way, since those are
useful context for whoever (human or Claude) picks up the next phase.

## Phase 1: Game-Engine Extraction

This documents what Phase 1 actually did: what moved into `game-engine.js`, what stayed in the
monolithic HTML file and why, what the dependency audit found, and — importantly — a couple of
real mistakes made and caught during this phase.

### What's in `game-engine.js`

A single dependency-light ES module (`export function` / `export const` throughout, no default
export). No `document`, `window`, `localStorage`, or other browser API anywhere in the file.
Organized into five sections:

1. **Item classification** — `classifyItemFull` and its full call graph: `classifyItemHierarchy`,
   `deriveItemProperties`, `deriveItemTags`, `computeItemInteractions`, `canInteract`,
   `itemRequiresAttunement`, plus the `INTERACTIONS` rule table and the `*_PARTS` Sets /
   `ARMOR_BODY_SLOT_LABEL` constants it reads.
2. **Character sheet** — `computeCharacterSheetFor` and its full call graph:
   `collectEquippedStatBreakdown`, `collectEquippedAcBreakdown`, `uniqueEquippedSlotEntries`,
   `extractStatDeltasFromText`, `sumBreakdown`, `statusFor`, `describeStatSources`,
   `abilityModifier`, `proficiencyBonusForLevel`, `fmtMod`, plus `ABILITY_NAMES`,
   `SKILL_ABILITY_MAP`, `SHEET_STAT_ALIASES`.
3. **Battle** — `battleParseAttack`, `battleRollDamage`, `battleEffectivenessLabel`.
4. **Shared random helpers** — `rn`, `ri`, `weightedPickFromObject` (see "Randomness" below for
   why these exist here as well as in the monolith).
5. **Gambling** — all four games' table constructors, action resolvers, and (for Roulette and
   Blackjack) the newly-split-out pure resolution cores: `newRouletteTable`,
   `applyRouletteAction`, `resolveRouletteSpin`, `rouletteColor`, `rouletteMultiplier`,
   `ROULETTE_WHEEL_ORDER`/`ROULETTE_RED_NUMBERS`/`ROULETTE_OUTSIDE_BETS`; `newBlackjackTable`,
   `applyBlackjackAction`, `resolveBlackjackDeal`, `resolveBlackjackDealerPlay`,
   `blackjackHandValue`, `isBlackjackHand`, `blackjackAllDone`, `cardValue`, `freshShuffledDeck`,
   `CARD_SUITS`/`CARD_RANKS`; `newSlotsTable`, `applySlotsAction`, `SLOTS_SYMBOLS`;
   `newPokerTable`, `applyPokerAction`, `evaluatePokerHand`, `pokerRankValue`,
   `POKER_RANK_ORDER`/`POKER_PAYOUTS`.

### What was already pure vs. what needed splitting

**Already fully dependency-free, moved verbatim:** item classification and character sheet math
were both already designed with dependency injection in mind — `computeCharacterSheetFor` takes
`slots`/`resolveItem` as parameters rather than reaching for a hardcoded global, and
`classifyItemFull` only ever reads the `item` object passed to it. Neither needed any redesign
to extract; this is a credit to how they were originally written, not something this phase gets
to take credit for.

**Needed a pure/impure split — Roulette and Blackjack's actual resolution logic:** the registered
`GAMBLING_HANDLERS.<game>.applyAction` function is a reasonable place to look for "the resolution
logic," and for Slots and Poker it genuinely is the whole thing — `applySlotsAction` and
`applyPokerAction` were already fully self-contained and moved with no changes beyond the
optional `rand` parameter. But for Roulette and Blackjack, `applyAction` (`applyRouletteAction` /
`applyBlackjackAction`) turned out to only handle *bet placement* — the actual spin / deal /
dealer-play logic lived in separate DM-only functions (`spinRouletteWheel`, `blackjackDeal`,
`blackjackDealerPlay`) that mixed the real game math with permission checks
(`isRealPlayerAccount()`), reads of the mutable global `gamblingState`, and direct
`renderGamblingTab()` / `pushGamblingState()` calls.

Those three functions were split: the pure computation (draw a number and compute payouts;
shuffle and deal; run the dealer AI and resolve outcomes) moved to game-engine.js as
`resolveRouletteSpin(table, rand)`, `resolveBlackjackDeal(table, rand)`, and
`resolveBlackjackDealerPlay(table)`, each taking the table object explicitly and returning it
mutated — same behavior as before, just relocated across the module boundary. The original
three functions stay in the monolith as thin wrappers: permission check, call the extracted
resolver, render, push.

This is the one place this phase did more than "move code" — it's a genuine (small, scoped)
refactor to establish a real module boundary, which the instructions for this phase explicitly
permit ("move/refactor only what is necessary to establish the module boundary"). The game rules
themselves (wheel order, payout multipliers, dealer-stands-on-17, blackjack pays 2.5x, etc.) are
byte-for-byte unchanged — only where the DOM/global-touching code stops and the pure code starts
moved.

### Randomness

Every function that needs randomness (`battleRollDamage`, `rn`, `ri`, `weightedPickFromObject`,
`freshShuffledDeck`, `resolveRouletteSpin`, `resolveBlackjackDeal`, `applySlotsAction`,
`applyPokerAction`) takes an **optional trailing `rand` parameter** — a `() => number in [0,1)`
function, defaulting to `Math.random`. Existing callers that don't pass one get identical
behavior to before extraction. The regression tests pass a fixed/constant `rand` to get
deterministic, assertable output without needing to touch or weaken the actual game rules.

**Known, intentional duplication:** `rn`, `ri`, and `weightedPickFromObject` also still exist as
their own separate definitions in the monolithic HTML file, unchanged, because they're
general-purpose utilities used throughout the app far beyond the six Phase 1 target areas (loot
generation, chest/corpse rolls, journey encounters, etc.). Removing the monolith's own copies and
routing every one of those call sites through the `window.X` bridge instead was judged a bigger
blast radius than this phase's scope warranted — see "Not extracted" below. game-engine.js's
internal copies are self-contained (it can't import from the monolith, by definition) and
behaviorally identical to the monolith's originals.

### Not extracted, and why

- **`rn`, `ri`, `weightedPickFromObject`** (monolith's own copies) — general utilities with a
  much wider blast radius than the six target areas; left in place rather than routing dozens of
  unrelated call sites through the bridge for no behavior change. game-engine.js has its own
  internal copies (see "Randomness" above).
- **`spinRouletteWheel`, `blackjackDeal`, `blackjackDealerPlay`, `blackjackNewRound`,
  `rouletteNewRound`, and every `render*Html`/`*PullLever`/`*Deal`/`*Draw`/`*ToggleHold` gambling
  UI function** — genuinely DOM- and multiplayer-state-coupled (permission checks, `document.
  getElementById`, `gamblingState` global reads/writes, `renderGamblingTab()`/
  `pushGamblingState()`). These stay in the monolith by design; the pure cores they call now live
  in game-engine.js (see above).
- **`computeWeaponAttackRoll`, `weaponAttackRollHtml`, `rollEquippedWeaponAttack`,
  `collectEquippedWeaponInfo`, `parseWeaponEffectBonuses`** — genuinely UI-coupled (DOM reads/
  writes, modal open/close) and not on the original target list. `computeWeaponAttackRoll` calls
  the now-bridged `battleRollDamage`, same as before. Not extracted this phase, but a reasonable
  Phase 2+ candidate if a future phase wants the weapon-attack math itself pulled out separately
  from its DOM wrapper.
- **The entire Dice Roller feature** (`DICE_TYPES`, `DICE_SHAPES`, `diceIconSvg`, the dice tray
  state and all its render/roll functions) — not a Phase 1 target at all (not game *rules*, just
  a UI utility with its own animation timing), left untouched in the monolith.
- **`GAMBLING_HANDLERS`, `gamblingState`, `pushGamblingState`, `hostGamblingGame`,
  `closeGamblingTable`, `submitGamblingAction`, `applyGamblingAction`, `renderGamblingShell`,
  `checkOwnGamblingPayout`, `placeGamblingBet`, `renderGamblingTab`, `gamblingSelfUid`,
  `gamblingSelfName`** — the shared gambling framework shell. Reads `window.getMultiplayerSelf`,
  mutates the `gamblingState` global, calls `window.pushGamblingState`. Correctly UI/multiplayer
  coupled; not a candidate for this phase.

### The `window.X` bridge

A small inline `<script type="module">` near the top of the main HTML file (right before the
`APP_VERSION` script block) does:

```js
import * as GameEngine from './game-engine.js';
Object.assign(window, GameEngine);
```

Every extracted function/constant is then called from the rest of the (still classic, non-module)
script exactly as it was before extraction — `classifyItemFull(item, rarity)`,
`battleParseAttack(text)`, etc. — resolving through the global object rather than a local
`function` declaration. This is explicitly a temporary migration shim, matching the same pattern
`multiplayer-sync.js` already established for its own (differently-directed) bridge — not the
intended final architecture, which should use explicit module imports throughout once more of the
app has followed the engine out of the monolith.

#### The ordering problem this created, and how it was actually handled

Module scripts execute after the document finishes parsing but *before* `DOMContentLoaded` fires,
regardless of where in the document the `<script type="module">` tag sits. The main script is a
classic (non-module) script, which runs synchronously, in document order, *during* parsing — so
it always finishes running *before* the bridge module executes, no matter where the bridge tag is
placed. Any code that runs at the main script's **top level** (i.e., not inside a function body
that's only called later) and touches a bridged name will hit a `ReferenceError`, because the
bridge hasn't run yet.

This phase's original audit checked for direct top-level *calls* to the six target function names
and found exactly one (the initial `lootData` classification pass). That single call was deferred
into a `document.addEventListener('DOMContentLoaded', ...)` listener and the fix was believed
complete.

**It wasn't.** Real browser validation (not just the Node regression suite, which has no
knowledge of script-loading order at all) surfaced two more categories the original audit missed:

1. **Top-level bare *references*, not calls** — `GAMBLING_HANDLERS.roulette = { newTable:
   newRouletteTable, applyAction: applyRouletteAction, ... }` reads `newRouletteTable` and
   `applyRouletteAction` as plain values, not function calls, so the original "search for
   `functionName(`" audit never matched it. All four `GAMBLING_HANDLERS.*` registration lines
   had this problem and were each wrapped in their own `DOMContentLoaded` listener.
2. **Transitive top-level calls** — the real app-entry-point call, `refreshAllViewsAfterStateApply()`
   (called at top level, right after `loadAppState()`), reaches `computeCharacterSheetFor` several
   layers down (`refreshAllViewsAfterStateApply` → `renderPlayerSlots` → `renderCharacterSheet` →
   `computeCharacterSheet` → `computeCharacterSheetFor`). No amount of grepping for the six target
   names directly would have caught this — the audit needed to check *every* top-level statement
   in the file, not just ones naming the target functions. That broader sweep was done after this
   bug surfaced (every non-function-declaration top-level statement in the main script was
   individually reviewed) and confirmed these were the only two additional cases.

**Lesson for future phases:** a "search for calls to the target function names" audit is not
sufficient to find every top-level ordering hazard a `window.X` bridge introduces. The reliable
check is to enumerate *every* top-level statement in the file (not just ones matching the target
names) and verify each one either doesn't touch bridged code, or is safely inside an event
listener / timeout callback that won't fire until well after the bridge has loaded.

#### A second mistake, also worth recording

While removing the (correctly targeted) character-sheet functions from the monolith, a bulk
line-range deletion (removing everything between two grep-located line numbers) was used without
first re-reading the *entire* span about to be deleted. The line range actually contained a large
amount of unrelated code that was never meant to be touched — `collectEquippedWeaponInfo`,
`parseWeaponEffectBonuses`, `computeWeaponAttackRoll`, `weaponAttackRollHtml`,
`rollEquippedWeaponAttack`, `closeWeaponAttackPopup`, and the entire Dice Roller feature — all
sitting between `collectEquippedAcBreakdown` (a real target) and `computeCharacterSheetFor`
(also a real target). This was caught by the same real-browser validation pass (a
`ReferenceError: collectEquippedWeaponInfo is not defined`), diagnosed via `git diff` against the
pre-edit working tree, and restored verbatim from the diff's removed-lines.

**Lesson for future phases:** before any bulk line-range deletion, read the *complete* span about
to be removed, not just its start/end boundary markers — grep-based boundary-finding after
earlier edits have shifted line numbers is not a substitute for confirming what's actually inside
the range. Prefer precise, exact-string `Edit` operations over line-range deletion wherever
practical; they fail loudly (no match found) instead of silently deleting unintended content.

### How the extracted engine is consumed today

- **The monolithic HTML app** (`dungeon_loot_wheel_v96_spell_details.html`) — via the `window.X`
  bridge described above. This is the only real consumer right now.
- **The regression test suite** (`game-engine.test.js`) — via a direct `import * as GE from
  './game-engine.js'`, run with `node --test`. No browser, no DOM, no bridge involved — this is
  the clearest proof the module genuinely has zero DOM dependency, since Node has no DOM at all.

### What this enables for the future server architecture

`game-engine.js` can be `import`ed directly by a future Node.js server (Phase 3) with zero
changes — it already has no dependency on `window`/`document`/`localStorage`, and every
randomness-dependent function already accepts an injectable source, which a
server-authoritative design will want anyway (e.g., a server-side seeded RNG per game session,
rather than trusting `Math.random()` per client). The gambling resolution split (pure
`resolve*`/`apply*` functions vs. DOM-coupled wrappers) is exactly the shape a server-authoritative
model needs: the server would own the `table` state and call the same pure resolvers this phase
already extracted, with the client-side wrappers eventually replaced by network calls instead of
direct function calls.

### Validation performed

- All 25 Node regression tests pass (`node --test`), covering item classification (weapon/potion/
  ring classification, idempotency, attunement interactions), character sheet math (gear bonuses,
  proficiency scaling, save/skill/AC/max-HP totals), battle parsing (multi-damage-type clauses,
  save DCs, deterministic damage rolls, crit doubling, effectiveness boundaries), and all four
  gambling games (roulette payouts and spin resolution, blackjack hand values and dealer AI,
  slots weighted reels, poker hand evaluation across every rank tier).
- The live app was loaded in a real browser (not just Node) and confirmed to load without
  JavaScript errors — this is what surfaced the two bridge-ordering bugs and the accidental
  deletion described above, none of which the Node test suite alone could have caught, since it
  has no concept of script-loading order or of code paths the tests don't happen to exercise.
- Manually spot-checked after all fixes: item generation (classification still shows), the
  character sheet (stats/AC/skills compute), equipping a weapon and using the ⚔ Attack button
  (exercises the restored weapon-attack code specifically), and the dice roller (exercises the
  other restored code) — all confirmed working.
- No unrelated files were modified — `loot-data.js`, `puzzle-data.js`, `multiplayer-sync.js`,
  `index.html` are untouched.

## Phase 2: SQLite / Database Foundation

Scope for this phase, confirmed before starting: build the schema and a Node-side data-access
layer only, with its own regression tests — same pattern as Phase 1's `game-engine.js`. **Not**
wired into the live browser app yet; that's later work (the live app still uses
`localStorage`/`saveAppState`/`loadAppState`, untouched). This phase exists to have something
real for Phase 3's Node.js server to build on rather than inventing the schema and the server at
the same time.

### Library choice: `node:sqlite`, not `better-sqlite3`

Node's own built-in SQLite module, not an npm package. Confirmed working on the Node version
installed for this migration (`node:sqlite`'s `DatabaseSync` class). Chosen over `better-sqlite3`
specifically to avoid adding a native-compiled dependency (an npm package that compiles C++ on
install) for something Node now ships itself. **Real risk, stated plainly:** `node:sqlite` is
still marked experimental by Node as of this writing. If a future phase's Node version drops it,
renames its API, or a production deployment needs a Node version where it's unavailable/unstable,
swapping to `better-sqlite3` would be a contained change — nothing outside `db/database.js`
imports from `node:sqlite` directly, and `better-sqlite3`'s synchronous `.prepare()/.run()/.get()/
.all()` API is close enough to `node:sqlite`'s that the rest of `database.js` likely wouldn't need
to change shape, just the `import` line and the constructor call in `openDatabase`.

### Schema design: partial normalization, not a full relational redesign

`db/schema.js` has the full `CREATE TABLE` statements and the reasoning inline; summarized here.
The current app persists one flat JSON blob (see `saveAppState`/`applyStateBlob` in the monolith)
covering everything from equipped gear to gambling table state. Rather than either (a) leaving
it as one blob column in SQLite, which wouldn't be much of a foundation, or (b) speculatively
designing a fully normalized schema for every field before any future phase has established real
query patterns against this data, this phase split the difference:

- **`campaigns`** — one row per save/campaign. The natural top-level entity everything else hangs
  off of.
- **`characters`** — genuinely relational, real columns (ability scores, level, HP, AC, class,
  etc.), one row per character per campaign. This is the one piece of the old blob that clearly
  benefits from being queryable rows rather than JSON — it maps directly onto
  `computeCharacterSheetFor`'s inputs from Phase 1's `game-engine.js`, and a server-authoritative
  future phase will very plausibly want to query/filter on these columns (e.g. "every character
  below half HP").
- **`campaign_state`** — a generic `(campaign_id, subsystem, data)` bucket for the eleven other
  areas the old blob covered (inventory, battle, merchant, bounties, mangler, loot_settings,
  effects, claims, journey, puzzle_log, gambling — see `SUBSYSTEMS` in `db/schema.js` for the
  exact old-field-name mapping for each). These keep their current JSON shape unchanged, but
  scoped per campaign *and* per subsystem instead of one flat blob — a real improvement (updating
  the gambling table no longer means reading/writing the entire rest of the campaign's state too)
  without guessing at a larger relational design nothing has validated a need for yet. Each
  subsystem row is a clean seam for a later phase to normalize individually, on its own schedule,
  without disturbing the others.

### Data-access layer (`db/database.js`)

`openDatabase(path)` opens (or creates) a database file, turns on `PRAGMA foreign_keys`, and
applies the schema — safe to call repeatedly (every `CREATE TABLE`/`CREATE INDEX` is
`IF NOT EXISTS`). Everything else is a small set of plain functions taking `db` as their first
argument (no class, no hidden state) — `createCampaign`, `getCampaign`, `listCampaigns`,
`touchCampaign`, `upsertCharacter`, `getCharacter`, `getCharacterById`, `listCharacters`,
`saveSubsystemState`, `loadSubsystemState`, `loadAllSubsystemState`.

`upsertCharacter` deliberately mirrors `applyStateBlob`'s existing "field-by-field, only
overwrite what's actually present" behavior — passing a partial sheet (e.g. just `{ level: 6 }`)
updates only that field and leaves the rest of the row untouched, the same contract the current
localStorage-based save/load already promises callers.

`saveSubsystemState`/`loadSubsystemState` validate the subsystem name against `SUBSYSTEMS` from
`db/schema.js` and throw on an unrecognized one, rather than silently accepting a typo'd
subsystem name that would then never be found again.

### What this enables for Phase 3

A Node.js server can `import { openDatabase, ... } from './db/database.js'` directly — this
module has no dependency on the browser app at all (confirmed the same way Phase 1 confirmed
`game-engine.js`'s browser-independence: it only runs under Node, in tests, with no DOM involved
anywhere). Phase 3/4 will need to decide how the monolith's current `saveAppState`/
`applyStateBlob` field-by-field logic maps onto calls into this module (likely: the server calls
`upsertCharacter`/`saveSubsystemState` on writes it receives from clients, and
`getCharacter`/`loadAllSubsystemState` to reconstruct a full state blob to send to a newly
connecting client) — that mapping is Phase 3/4 work, not done here.

### Validation performed

- All 41 Node regression tests pass (`node --test` — 25 from Phase 1's `game-engine.test.js`,
  16 new in `db/database.test.js`), covering campaign CRUD, character upsert (both full-sheet
  creation and partial-field updates), per-subsystem state save/load/overwrite/isolation-between-
  campaigns, subsystem-name validation, and foreign-key cascade deletes.
- Confirmed `node:sqlite` actually works on the Node version installed for this project before
  writing any code against it (a real, not assumed, dependency check).
- Not wired into the live browser app, per the confirmed scope — no live-app validation needed or
  performed this phase, unlike Phase 1.
- No unrelated files modified.

## Phase 3: Node.js Server

Scope for this phase, confirmed before starting: stand up a real Node.js server exposing Phase
2's persistence layer over a REST API, with its own regression tests. **Not** wired into the live
browser app yet — that's Phase 4 ("server-authoritative game state"), once the server is trusted
to actually own game truth rather than just store/retrieve it on request. Also confirmed before
starting: plain Node `http`, not Express — this is the project's first point where adding a real
npm dependency was a live option, and the deliberate choice was to stay dependency-free rather
than add one by default.

### What the server exposes (`server/server.js`)

`createServer(db)` takes an already-open database (same dependency-injection shape as Phase 1/2)
and returns a plain `http.Server` with these routes, all wrapping the Phase 2 functions of the
same shape:

```
POST   /campaigns                                  create a campaign
GET    /campaigns                                  list campaigns
GET    /campaigns/:id                               get one campaign
GET    /campaigns/:id/characters                    list characters in a campaign
GET    /campaigns/:id/characters/:accountUid         get one character
PUT    /campaigns/:id/characters/:accountUid         upsert one character
GET    /campaigns/:id/state                          load every saved subsystem's state
GET    /campaigns/:id/state/:subsystem               load one subsystem's state
PUT    /campaigns/:id/state/:subsystem               save one subsystem's state
```

`:accountUid` accepts the literal token `_solo` to address the null-account-uid solo/guest
character slot from Phase 2's schema — a URL path segment can't carry a real `null`, and reusing
the string `"null"` risked colliding with a real (if unlikely) account uid, so a distinct token
was used instead.

No routing framework — the whole point of choosing plain `http` was staying small enough not to
need one, and a handful of fixed path-segment patterns matched positionally is genuinely simpler
here than adding a dependency to get pattern-matching syntax sugar.

### Error handling

Every route validates its inputs and returns a real status code rather than throwing an
unhandled exception into the process: `400` for a non-numeric campaign id, a missing/invalid
body field, an unrecognized subsystem name (reusing Phase 2's own `SUBSYSTEMS` validation, not a
separate list that could drift out of sync with it), or malformed JSON; `404` for a campaign,
character, or unsaved-subsystem that doesn't exist; `405` for a valid route hit with the wrong
HTTP method; `500` as a last-resort catch-all for anything unexpected. A malformed-JSON request
is confirmed (by a regression test, not just an assumption) to leave the server able to handle
the *next* request normally — the whole process doesn't go down over one bad client request.

### Validation performed

- All 59 Node regression tests pass (`node --test` — 41 from Phase 1/2, 18 new in
  `server/server.test.js`), covering every route's success path, every documented error status,
  the `_solo` token mapping, and that a malformed request doesn't take the server down.
- The server tests make real HTTP requests (Node's built-in `fetch`) against a real
  `http.Server` listening on an OS-assigned port, not mocked request/response objects — this
  exercises the actual routing and JSON-parsing code exactly as a real client would.
- Beyond the automated suite: manually started the server for real (`server/start.js`) against
  an actual SQLite file (not the tests' `:memory:` database) and hit it with `curl` — created a
  campaign and listed it back — confirming the real end-to-end path (file-backed DB, a process
  actually listening on a TCP port) works, not just the in-process test harness.
- Not wired into the live browser app, per the confirmed scope.
- No unrelated files modified.

## Phase 4: Server-Authoritative Game State (first slice)

This phase's scope is deliberately much narrower than its name might suggest. "Server-
authoritative game state" as a literal reading of the roadmap could mean re-architecting every
state mutation across the entire monolith — confirmed before starting that this was too large
and risky to attempt as one phase (informed directly by how much Phase 1's much smaller scope
still surfaced real bugs under actual testing). What was built instead: **gambling resolution**
is now genuinely server-authoritative, as a first, well-bounded proof of the concept, with
everything else — combat, inventory, character state, the rest of multiplayer — untouched and
still working exactly as it does today.

### What "authoritative" means here, concretely

Every resolution step (`resolveRouletteSpin`, `resolveBlackjackDeal`,
`resolveBlackjackDealerPlay`, `applySlotsAction`, `applyPokerAction`) is called from
`server/gambling.js` with **no `rand` argument**, so each one falls back to its own default —
the server process's own `Math.random`. Nothing in the request body is ever read as a source of
randomness or a proposed outcome. A client can ask the server to host a game, place a bet, or
trigger a spin/deal/dealer-play — it cannot supply what number the wheel lands on or what cards
get dealt. This is provable by inspection (`resolveRouletteSpin(state.table)` — one argument,
the table, nothing from `body`) and is exercised by a regression test that sends an extra
`number` field alongside a real spin request and confirms it has no special handling anywhere in
the code path.

This is a narrow, specific definition of "authoritative" — it does not yet mean the server
enforces *who* is allowed to do what (see "Known gap: no authorization" below).

### New routes (`server/gambling.js`, wired into `server/server.js`)

```
GET  /campaigns/:id/gambling             current { game, table } (or the empty state if nothing hosted)
POST /campaigns/:id/gambling/host        body: { game } — creates a fresh table for that game
POST /campaigns/:id/gambling/action      body: { type, ... } — place_bet / hit / stand / spin / deal / draw,
                                          dispatched to the hosted game's applyAction, same shape
                                          the monolith's own GAMBLING_HANDLERS[game].applyAction already uses
POST /campaigns/:id/gambling/resolve     body: { step: 'spin' | 'deal' | 'dealerPlay' } — the DM-only
                                          steps that were split out of the monolith's spinRouletteWheel /
                                          blackjackDeal / blackjackDealerPlay back in Phase 1
POST /campaigns/:id/gambling/close       clears the hosted table
```

Slots and Poker fully resolve inside a single `/action` call (their `applyAction` already does
everything, per Phase 1's finding that those two games needed no pure/impure split). Roulette
and Blackjack need `/action` for bets (and hit/stand, for Blackjack) plus a separate `/resolve`
call for the actual spin/deal/dealer-play — this mirrors exactly the split Phase 1 already
documented between each game's `applyAction` and its separate DM-triggered resolution function.

**The Phase 3 route is untouched and still works**: `PUT /campaigns/:id/state/gambling` still
lets a caller overwrite the raw gambling blob directly, no different from Phase 3. Both routes
read and write the exact same underlying storage (`campaign_state` where `subsystem =
'gambling'`) — the new routes don't replace the old one, they add a second, validated way to
reach the same data that actually runs the game rules instead of trusting a client's own
computed result.

### Known gap: no authorization (deliberately not invented here)

Nothing in this phase checks *who* is allowed to host a game, place a bet on someone else's
behalf, or trigger a dealer-play step — there is no account/session/auth concept anywhere in
this server yet (Phase 2/3 never introduced one). The monolith's own client-side equivalent
(`isRealPlayerAccount()`) is a UI-trust convention, not real enforcement, and this phase
deliberately did not invent a real authorization system to paper over that gap — doing so would
mean guessing at a design nothing has asked for yet. **This is a real, acknowledged limitation,
not an oversight**: a genuinely secure deployment (anyone able to reach the server over a
network, not just a DM's own local process) would need real auth before these routes could be
trusted the way "authoritative" implies. Worth deciding explicitly in Phase 5 or a dedicated
follow-up, not assumed away here.

### What this enables for Phase 5

Phase 5 ("WebSocket multiplayer — replaces the current Firebase-based sync layer") is where the
live browser app would actually start calling these routes instead of resolving gambling
locally and pushing the result to Firestore. This phase deliberately stopped short of that
wiring (per the confirmed scope) so Phase 5 can focus entirely on the transport-layer swap
(Firestore's `onSnapshot` model → WebSocket) without also debugging new server-side game logic
at the same time.

### Validation performed

- All 72 Node regression tests pass (`node --test` — 59 from Phases 1–3, 13 new in
  `server/gambling.test.js`), covering hosting/closing, every game's action + resolve flow
  (roulette bet+spin, a full blackjack round through deal/stand/dealer-play, a slots spin, a
  poker deal+draw), rejecting resolve steps that don't match the hosted game or current phase,
  rejecting actions before anything is hosted, and confirming the Phase 3 raw-blob route still
  works unchanged alongside the new ones.
- These tests use the server's real, non-deterministic randomness (no injected `rand`, unlike
  Phase 1's own tests) — run six consecutive times during validation with no flakiness, rather
  than trusting a single green run given real RNG is involved.
- Not wired into the live browser app, per the confirmed scope.
- No unrelated files modified.

## Phase 5a: WebSocket Sync — Core State Loop (first sub-phase of Phase 5)

"Phase 5: WebSocket multiplayer, replaces the current Firebase-based sync layer" turned out to
be a much bigger phase than its name suggests once actually audited (see below) — large enough
that attempting it as one phase was explicitly rejected in favor of breaking it into sub-phases.
This is the first one: replacing only `multiplayer-sync.js`'s core state push/listen loop
(`pushOwnState`/`startPlayerListener`) and its three cross-player writes (`applyHpDelta`,
`giftItemToPlayer`, `setPlayerInventoryFields`). Everything else `multiplayer-sync.js` does —
listed in full below — is explicitly out of scope for this sub-phase.

### Why this got broken into sub-phases

A full audit of `multiplayer-sync.js` (1,538 lines) found it's not one system but four bundled
together:

1. **Authentication** — real Firebase accounts, username/password disguised as fake emails,
   session persistence, signup rollback-on-failure logic. Has nothing to do with WebSocket vs.
   Firestore as a transport — it's a full login system.
2. **Real-time state sync** — the core push/listen loop, with real hard-won correctness logic: a
   `rev` counter to detect and drop stale/out-of-order writes, and a separate `extRev` counter so
   a DM's write to a player's doc is never mistaken for that player's own echo.
3. **Race-condition arbitration** — real-time loot claims rely specifically on Firestore's
   create-vs-update security rule semantics to get true first-write-wins with zero server-side
   code. Replacing the transport doesn't replace this arbitration; something else has to do that
   job.
4. **A whole login/account UI** — the gate screen, signup/login forms, account panel, roster
   display, guest mode. Injected DOM/CSS, tightly coupled to the auth flow.

Plus, underneath those: room/campaign membership, a DM-review queue for player attacks
(`submitBattlefieldAttack`/`startAttackRequestListener`), battlefield/puzzle-log broadcast with
loot-visibility filtering, and a DM-only roster listener across every player in a room.

Given Phase 1 already demonstrated that real bugs surface even at a much smaller scope than
this, attempting all four systems (plus the six-plus remaining subsystems) in one phase was
rejected. **Confirmed scope for this sub-phase**: keep Firebase Auth completely untouched
(system #1 above, and the account UI, #4, stay exactly as they are); build only the core sync
loop and cross-player writes (system #2); explicitly defer loot-claim arbitration, battlefield/
puzzle-log broadcast, and the roster listener to their own future sub-phases.

### What changed vs. the original design, and why it's simpler

The original's `rev`/`extRev` two-counter scheme exists entirely to solve a problem specific to
Firestore's `onSnapshot`: it always echoes a client's own writes back to that same client, so the
app needs its own logic to tell "this is just my own write bouncing back, ignore it" apart from
"the DM actually changed something." A WebSocket server is stateful and knows exactly which
connection sent which message — so it can simply never send a `state_update` back to the
connection that sent the `push_state` that caused it. This eliminates the self-echo problem by
construction rather than by counter-comparison logic; confirmed by a dedicated regression test
(`the pushing connection never receives its own push back`) that would fail loudly if this
invariant were ever broken.

What's still needed and still present: a single `rev` field, guarding against a narrower problem
that doesn't go away — two rapid pushes from the *same* client arriving out of order over the
network, where an older one's round-trip happens to finish after a newer one's. `push_state`
compares the incoming `rev` against what's already persisted and drops anything not strictly
newer.

### Schema addition: `player_states` (see `db/schema.js`)

Phase 2's `campaign_state` table is scoped per `(campaign_id, subsystem)` — built for
campaign-wide DM settings (loot rarity weights, journey log, etc.), all owned by one account.
A player's full save-state blob (inventory, equipped gear, character sheet) is inherently
per-*player*, mirroring exactly what Firestore's `rooms/{code}/players/{uid}` document already
was — a shape Phase 2 never needed to model since it only ever handled a DM's own data. Rather
than force per-player blobs into the campaign-wide table (which the code doesn't even allow —
`saveSubsystemState` validates the subsystem name against a fixed list) or invent something more
elaborate, this phase added one small, directly-analogous table: `(campaign_id, account_uid,
state, rev)`, one row per player per campaign. `db/database.js` gained `savePlayerState`,
`loadPlayerState`, `loadAllPlayerStates` to match, with their own regression tests.

### Message protocol (`server/websocket.js`)

JSON messages over a `ws` WebSocket connection, sharing the same TCP port as the REST API (the
`ws` package upgrades HTTP connections on the existing `http.Server` instance — no second port
needed):

```
client -> server:
  { type: 'identify', campaignId, accountUid, role, username }   -- must be sent first
  { type: 'push_state', rev, state }                              -- persists the sender's own state
  { type: 'hp_delta', targetUid, delta }                          -- DM only
  { type: 'gift_item', targetUid, item }                          -- DM only
  { type: 'set_inventory_fields', targetUid, fields }             -- DM only
server -> client:
  { type: 'identified', state, rev }    -- ack, plus whatever was already persisted for this account
  { type: 'state_update', state, rev }  -- this account's state changed (a DM cross-write landed)
  { type: 'error', message }
```

`hp_delta` clamps the same way the original did (floors at 0, ceilings at
`characterMaxHpEffective`/`characterMaxHp` if known) — including the same behavior for a target
with no prior state at all (current HP treated as 0, so any negative delta floors straight to 0,
not a negative number). A cross-player write to a target with no live connection still persists
correctly and is delivered the next time that account identifies — confirmed by a dedicated test,
not just assumed.

### `ws` package — first real npm dependency

Node has no built-in WebSocket *server* (only an experimental client, for connecting outward).
Per the user's confirmed choice, this uses the `ws` package — the de facto standard, rather than
hand-rolling the handshake/framing protocol from raw `http`/`net`. This is the project's first
real dependency; `package.json` and `.gitignore` (for `node_modules/`, plus `*.db`/`*.db-journal`
so a locally-running server's database file is never accidentally committed) were added this
phase.

### Deliberate, documented gap: no identity verification

The server trusts whatever `accountUid`/`role` a client's `identify` message claims — it does not
cryptographically verify this against a real Firebase session. Real verification would mean
pulling in Firebase Admin SDK to check ID tokens server-side on every connection, which is a
separate integration effort from what this sub-phase is actually about (sync-loop correctness).
Same trust model Phase 4 already established for gambling ("no authorization" gap) — noted here
explicitly rather than silently inherited.

### What's still needed for "Phase 5" as originally named (future sub-phases)

- **Loot-claim first-write-wins arbitration** — needs the WebSocket server itself to do what
  Firestore's create-vs-update security rules did implicitly: reject a second claim on the same
  drop once the first has landed.
- **Battlefield/puzzle-log broadcast** — DM-authored state pushed to every connected player in a
  room, including the loot-visibility filtering (`pushBattlefieldState` strips unrevealed/
  reserved/claimed items before it ever reaches a player).
- **DM roster listener** — a live, thin (username/HP/AC) summary across every player in a room,
  for the Combat tab's targeting UI.
- **Attack-request review queue** — a player submits a weapon-attack roll, the DM applies/
  dismisses it.
- **Authentication and the account/login UI** — deliberately untouched in this sub-phase;
  whether Firebase Auth stays permanently (only ever replacing the real-time sync/game-state
  parts) or eventually gets replaced too is an open question for a future conversation, not
  decided here.

### Validation performed

- All 90 Node regression tests pass (`node --test` — 78 from Phases 1–4 plus the `player_states`
  schema additions, 12 new in `server/websocket.test.js`), covering identify (including unknown
  campaign and pre-identify-message rejection), push/reconnect round-tripping, the no-self-echo
  guarantee, stale-push rejection, all three cross-player writes (including HP clamping at both
  floor and ceiling), non-DM rejection, and delivery-on-reconnect for an offline target.
- A real end-to-end smoke test: started the actual server process (`server/start.js`) against a
  real file-backed SQLite database, created a campaign via the REST API, then connected a real
  `ws` client to the *same port* and successfully identified — confirming the shared-port HTTP/
  WebSocket upgrade actually works outside the in-process test harness, not just inside it.
- Not wired into the live browser app, per the confirmed scope.
