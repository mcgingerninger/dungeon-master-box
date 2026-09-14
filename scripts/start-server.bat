@echo off
REM Launcher used by the Windows auto-start task (see install-windows-autostart.ps1). Resolves
REM the repo root from this file's OWN location (%~dp0..), never the caller's working directory --
REM same reasoning as server/start.js's REPO_ROOT anchoring: a process started by Task Scheduler
REM has no predictable working directory of its own, and a relative path there caused a real
REM data-loss incident earlier in this project (see docs/ARCHITECTURE.md's Phase 6h notes).
cd /d "%~dp0.."

REM Checks GitHub for a newer main branch and fast-forwards to it before starting (see
REM check-for-updates.bat for how and why -- --silent skips its interactive pause, since nobody's
REM watching this window at login). A failed or skipped update never blocks the server from
REM starting -- this line's own exit code is ignored, same as any other pre-flight step here.
call scripts\check-for-updates.bat --silent >> server.log 2>&1

REM Adjust this path if Node is installed somewhere else on this machine (check with `where node`
REM from a normal terminal). Output is appended to server.log in the repo root -- not rotated, so
REM it will grow indefinitely over a long-running deployment; fine for a home game, worth trimming
REM by hand occasionally.
"C:\Program Files\nodejs\node.exe" server\start.js >> server.log 2>&1
