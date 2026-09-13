@echo off
rem Double-click this (or a desktop shortcut to it) to manually pull the latest
rem code, reinstall dependencies if needed, and restart the server right now -
rem the same thing DungeonMasterBox-AutoUpdate does automatically every 30 minutes.
setlocal
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%..\.."
cd /d "%REPO_ROOT%"

echo Checking for updates...
git pull
if errorlevel 1 (
    echo git pull failed - see the message above ^(often local changes blocking a fast-forward^).
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install

echo Restarting server...
schtasks /End /TN "DungeonMasterBox-Server" >nul 2>&1
timeout /t 2 /nobreak >nul
schtasks /Run /TN "DungeonMasterBox-Server"

echo.
echo Done. Server restarted - check logs\server.log if anything looks wrong.
pause
