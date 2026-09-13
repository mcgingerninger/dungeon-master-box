@echo off
REM Registers the Dungeon Master Box launcher to run automatically whenever this
REM Windows account logs in - run this ONCE (as Administrator), then reboot or
REM log in again and the box will start updating/serving itself with no monitor
REM or manual commands needed.
REM
REM To change which branch it tracks or how often it checks for updates, edit
REM the /TR line below (defaults: branch=main, check every 300 seconds).

setlocal
set SCRIPT_DIR=%~dp0

schtasks /Create /TN "DungeonMasterBox" /TR "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SCRIPT_DIR%dm-box-launcher.ps1\" -Branch main -CheckIntervalSeconds 300" /SC ONLOGON /RL HIGHEST /F

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo FAILED. Right-click this file and choose "Run as administrator", then try again.
    pause
    exit /b 1
)

echo.
echo Installed. "DungeonMasterBox" will now start automatically every time you log in.
echo.
echo To start it right now without logging out/in, run:
echo     schtasks /Run /TN "DungeonMasterBox"
echo.
echo Server output/log goes to: %SCRIPT_DIR%..\dm-box.log
pause
