# Phase 6i (packaging): registers a Windows Scheduled Task that starts the Dungeon Master Box
# server whenever this user logs on, and restarts it automatically (up to 5 times, 1 minute apart)
# if the process ever crashes or is killed. Run this ONCE, from an elevated ("Run as
# Administrator") PowerShell window, directly on the machine hosting the game.
#
# Why a Scheduled Task instead of a "real" Windows Service: turning an arbitrary node.exe process
# into a true service (one Windows can start before anyone logs in) needs a service wrapper like
# NSSM -- a small, well-known open-source tool, but still a third-party download this script
# deliberately avoids requiring. A Scheduled Task triggered "at log on" needs nothing beyond what
# Windows already ships, and combined with Windows' own auto-login option (see the note printed at
# the end of this script) gets the same practical result: the server is already running by the
# time anyone opens a browser to it.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$batPath = Join-Path $repoRoot 'scripts\start-server.bat'
$taskName = 'DungeonMasterBox'

if (-not (Test-Path $batPath)) {
    throw "Expected launcher script not found at $batPath -- run this script from inside the repo's scripts folder (don't move or copy it elsewhere)."
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Output "A task named $taskName already exists -- replacing it with this configuration."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $batPath
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Starts the Dungeon Master Box game server on login.' -Force | Out-Null

Write-Output "Installed. The server will start automatically the next time you log in to this account."
Write-Output ""
Write-Output "To start it right now, without logging out and back in, run:"
Write-Output "  Start-ScheduledTask -TaskName DungeonMasterBox"
Write-Output ""
Write-Output "To remove this later, run scripts\uninstall-windows-autostart.ps1"
Write-Output ""
Write-Output "Optional, for a fully hands-off boot (e.g. after a power outage) with no one needing"
Write-Output "to log in at all: run netplwiz, uncheck the box for requiring a username and password"
Write-Output "to use this computer, and enter this account's credentials when prompted. Combined"
Write-Output "with this task, the Mini PC will then boot straight to a running server."
