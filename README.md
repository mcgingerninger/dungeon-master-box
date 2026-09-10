# Dungeon Master Box

**This is the architectural migration home for [dungeon-loot-tool](https://github.com/mcgingerninger/dungeon-loot-tool).**

## What this repository is

`dungeon-loot-tool` is a single-page D&D 5e loot/combat/campaign tool that has grown into a
large, feature-rich application — item generation, a full combat tracker with live multiplayer,
a character sheet, a puzzle library, journey encounters, and more — all built as one monolithic
HTML file plus a couple of supporting JS/data files, synced through Firebase.

That architecture served the project well while it was growing fast, but it has natural ceilings:
everything lives in the browser, state authority is split awkwardly between clients and Firestore,
and there's no server-side game engine a future "Dungeon Master Box" (a small local-first server a
DM could run at the table, with real multiplayer state authority) could build on directly.

This repository is where that evolution happens. **It is not a rewrite-from-scratch** — it starts
from the exact current working state of `dungeon-loot-tool`'s `main` branch (full commit history
preserved, not squashed or reset) and evolves it in reviewed, incremental phases.

## Relationship to the original repository

| | |
|---|---|
| **[dungeon-loot-tool](https://github.com/mcgingerninger/dungeon-loot-tool)** | Stable, deployed, continues to receive its own updates independently. This is the known-good reference/baseline. Nothing here changes it. |
| **dungeon-master-box (this repo)** | Development home for the architectural migration. Starts as an exact copy of dungeon-loot-tool's history and diverges from here forward. |

The two repos are intentionally independent from this point on — this one doesn't track or merge
from the original going forward; it's a fork-in-spirit (same history up to the migration baseline
below, then its own path).

## Current baseline

Migrated from `dungeon-loot-tool`'s `main` branch at commit `26e1c2d` ("Add Five-Card Poker to
Gambling: draw poker, full hand evaluation"), September 2026 — this includes the Gambling tab
(Roulette, Blackjack, Slots, Five-Card Poker), which lands directly in scope for Phase 1's
"resolution logic for all four gambling games" extraction target. At the point of migration, the
application is
fully functional and unchanged — same files, same behavior, same commit history.

## Migration objective

Move from a browser-only, Firebase-synced monolith toward a local-first architecture with a real
server-authoritative game engine, while changing as little user-visible behavior as possible along
the way. Each phase is scoped, reviewed, and merged independently — this is not a big-bang rewrite.

```
Phase 1: Game-engine extraction        — pull dependency-light game rules into game-engine.js
Phase 2: SQLite / database foundation  — durable local persistence, replacing ad-hoc state blobs
Phase 3: Node.js server                — a real local server process the DM runs
Phase 4: Server-authoritative state    — the server, not individual clients, owns game truth
Phase 5: WebSocket multiplayer         — replaces the current Firebase-based sync layer
Phase 6+: Dungeon Master Box deployment — packaged, runnable by a DM with no cloud dependency
```

See `docs/MIGRATION_PLAN.md` for the full phase-by-phase plan as originally scoped.

## Status

**Phase 0 complete** (this commit) — repository separated, history preserved, documentation in
place. No application architecture has changed yet. Phase 1 (game-engine extraction) has not
started.
