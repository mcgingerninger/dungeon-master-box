@echo off
rem Launched by the "DungeonMasterBox-Server" scheduled task. Not meant to be
rem double-clicked directly (it will work, but output only goes to logs\server.log).
setlocal
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\.."
cd /d "%REPO_ROOT%"
if not exist logs mkdir logs
node server\start.js >> logs\server.log 2>&1
