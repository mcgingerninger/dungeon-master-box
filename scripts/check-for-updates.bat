@echo off
REM Checks GitHub for a newer main branch and fast-forwards this working copy to it. Safe to
REM double-click directly (pauses so the window doesn't just flash and close), and is also called
REM automatically by start-server.bat with a --silent flag on every server start/login.
REM
REM Self-relaunches from a copy in %TEMP% before doing anything with git. Reason: this file lives
REM inside the very repo it updates, and cmd.exe executes a running .bat by seeking to byte offsets
REM in the file as it goes -- it doesn't load the whole script into memory first. If `git pull`
REM rewrites this file's on-disk bytes while cmd is partway through running it, later lines can be
REM read from the wrong offset and misexecute. Running from a temp copy that git never touches
REM avoids that entirely; the real file in scripts\ is free to change under it.
if "%~1"=="--relaunched" goto :run

set "REPOROOT=%~dp0.."
set "SILENT_FLAG=%~1"
set "STAGED=%TEMP%\dmb-check-for-updates-%RANDOM%%RANDOM%.bat"
copy /y "%~f0" "%STAGED%" >nul
call "%STAGED%" --relaunched "%REPOROOT%" "%SILENT_FLAG%"
set "RC=%ERRORLEVEL%"
del "%STAGED%" >nul 2>&1
exit /b %RC%

:run
set "REPOROOT=%~2"
set "SILENT_FLAG=%~3"
cd /d "%REPOROOT%"

where git >nul 2>&1
if errorlevel 1 (
  echo [update] git not found on PATH - skipping update check, starting with the current version.
  goto :done
)

for /f "delims=" %%A in ('git rev-parse HEAD 2^>nul') do set "BEFORE=%%A"

git fetch origin main
if errorlevel 1 (
  echo [update] Could not reach GitHub - skipping update check, starting with the current version.
  goto :done
)

REM --ff-only, never a hard reset: if this copy has any local commits or uncommitted edits that
REM don't cleanly fast-forward, git aborts on its own without touching any files. That's the
REM correct outcome for this script -- it should never silently discard something a DM did by hand
REM on this machine.
git pull --ff-only origin main
if errorlevel 1 (
  echo [update] Local copy doesn't fast-forward cleanly onto GitHub's main ^(local changes?^) - skipping auto-update.
  goto :done
)

for /f "delims=" %%A in ('git rev-parse HEAD 2^>nul') do set "AFTER=%%A"
if not "%BEFORE%"=="%AFTER%" (
  echo [update] Updated %BEFORE:~0,7% to %AFTER:~0,7% - installing any new dependencies...
  call npm install
) else (
  echo [update] Already up to date.
)

:done
if not "%SILENT_FLAG%"=="--silent" pause
exit /b 0
