# Windows auto-start / auto-update setup

Keeps the Dungeon Master Box server running across reboots and pulls new commits
from GitHub on a timer, restarting itself when there's an update. No third-party
tools required - this only uses the built-in Windows Task Scheduler (`schtasks`).

There's no separate database service to manage: the SQLite database is just a
file, opened directly by the Node server process, so "keep the server running"
is the whole job.

## One-time setup

1. Make sure `git` and `node` work from a normal PowerShell prompt (`git --version`,
   `node --version`).
2. From the repo root, install dependencies once: `npm install`.
3. Run the registration script:

   ```powershell
   .\scripts\windows\register-tasks.ps1
   ```

   This creates two Scheduled Tasks:

   - **DungeonMasterBox-Server** - runs `start-server.bat` at login and keeps it
     running. Serves the app on `http://localhost:4000` (see the console/log output
     for your LAN IP too, so other devices on the same network can connect).
   - **DungeonMasterBox-AutoUpdate** - runs `update.ps1` every 30 minutes. It
     fetches and fast-forward-pulls whatever branch is currently checked out; if
     that actually moved `HEAD`, it runs `npm install` and restarts the server task.
     If you're offline, or you have local uncommitted edits that block a
     fast-forward, it just logs that and does nothing (never force-overwrites your
     local state).

4. Start the server right away instead of waiting for your next login:

   ```powershell
   schtasks /Run /TN "DungeonMasterBox-Server"
   ```

5. (optional) Create a Desktop shortcut for manually forcing an update, instead
   of waiting for the 30-minute timer or typing commands:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\windows\create-desktop-shortcut.ps1
   ```

   This adds an "Update Dungeon Master Box" icon to your Desktop. Double-click
   it any time to pull the latest code, reinstall dependencies if needed, and
   restart the server - it runs `refresh-now.bat`, which does the same thing as
   the scheduled `DungeonMasterBox-AutoUpdate` task but immediately, with a
   console window showing progress and a "Done" pause at the end.

## Logs

- `logs\server.log` - server stdout/stderr
- `logs\update.log` - each update check, and what it did

(Both are gitignored - they're local-machine state, not repo content.)

## Adjusting the update interval

Re-run `register-tasks.ps1` after editing the `/MO 30` value in it (minutes
between checks), or edit the task directly:

```powershell
schtasks /Change /TN "DungeonMasterBox-AutoUpdate" /RI 15
```

## Removing everything

```powershell
schtasks /Delete /TN "DungeonMasterBox-Server" /F
schtasks /Delete /TN "DungeonMasterBox-AutoUpdate" /F
```

## Notes / limitations

- The server task runs with your normal user rights, at login - not before login,
  and not if the machine is fully shut down (only sleep/wake or login/logout).
  If you want it running even with nobody logged in, you'd instead register it as
  a proper Windows service (e.g. with the third-party tool NSSM) - not covered
  here, since it needs an extra download.
- Task Scheduler's own "if the task fails, restart" option (Properties -> Settings
  tab, not exposed by `schtasks /Create`) can be added by hand in the Task
  Scheduler GUI if you want the server to relaunch automatically after a crash,
  not just after an update.
- `update.ps1` uses `git pull --ff-only`, so it will never auto-merge or discard
  local changes - if you ever edit files directly on the machine, the auto-update
  will just skip until that's resolved.
