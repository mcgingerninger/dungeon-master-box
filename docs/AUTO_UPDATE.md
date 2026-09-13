# Auto-Update (self-updating box, no monitor needed)

`scripts/dm-box-launcher.ps1` lets the mini PC pull the latest code from GitHub and
(re)start the server on its own, over WiFi, without plugging in a monitor/keyboard
or running `git`/`npm` by hand each session.

## What it does

1. On start: `git fetch` + `git reset --hard origin/<branch>` (defaults to `main`),
   `npm install`, then `npm start`.
2. Every 5 minutes (configurable): checks GitHub for new commits on that branch. If
   there's a new commit, it stops the server, pulls/reinstalls, and restarts it.
3. Logs everything (its own actions and the server's stdout/stderr) to
   `dm-box.log` in the repo root, so you can check what happened after the fact
   without having watched it live.

It uses `git reset --hard`, not `git pull` — this is meant for an unattended
deployment copy of the repo. **Don't make manual edits directly in the mini PC's
checkout**; they'll be silently discarded on the next update check. Do development
elsewhere and let this pull it in.

## One-time setup on the mini PC (Windows)

1. Make sure the repo is cloned and `npm install` has been run at least once
   (as you already did).
2. Right-click `scripts/install-autostart-task.bat` -> **Run as administrator**.
3. That's it — it registers a Windows scheduled task (`DungeonMasterBox`) that runs
   the launcher every time this Windows account logs in.
4. To start it immediately without logging out/in: open Command Prompt and run
   `schtasks /Run /TN "DungeonMasterBox"`, or just log out and back in.

From then on, powering on the mini PC and logging in is all that's needed — no
monitor required for normal sessions. Keep the mini PC's WiFi connected so it can
reach GitHub to check for updates; if it's offline, it just keeps running whatever
code it already has and retries on the next check.

## Checking on it / troubleshooting

- **Log file**: `dm-box.log` in the repo root — shows every update check, every
  restart, and the server's own printed LAN URL (`http://192.168.x.x:4000`).
- **Change the tracked branch or check frequency**: edit the `/TR` line in
  `install-autostart-task.bat` (the `-Branch` and `-CheckIntervalSeconds`
  arguments), then re-run it as administrator to re-register the task.
- **Stop auto-start entirely**: run `scripts/uninstall-autostart-task.bat` as
  administrator.
- **Force an update check right now** without waiting: just log out and back in
  (or `schtasks /Run /TN "DungeonMasterBox"`), which restarts the launcher and
  runs an immediate update check on startup.

## Known limitations

- Tracks a single branch (`main` by default) — there's no way to preview an
  unmerged feature branch on the box through this mechanism.
- No rollback: if a bad commit lands on the tracked branch, the box will pull it
  too. There's no health check gating the restart on the new code actually working.
- The local SQLite database file (`*.db`, gitignored) is untouched by updates —
  campaign data survives across code updates, but there's still no schema
  migration mechanism (see Phase 6b's note in `docs/ARCHITECTURE.md`) if a future
  update changes the schema shape.
