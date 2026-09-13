@echo off
REM Removes the scheduled task installed by install-autostart-task.bat.
REM This does NOT stop a copy of the server already running - close its window
REM (or use Task Manager to end any leftover "node.exe" processes) separately.

schtasks /Delete /TN "DungeonMasterBox" /F

echo.
echo Removed. The box will no longer auto-start or auto-update on login.
pause
