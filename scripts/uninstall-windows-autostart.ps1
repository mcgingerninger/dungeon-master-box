# Removes the Scheduled Task installed by install-windows-autostart.ps1. Run from an elevated
# PowerShell window. Does not stop a currently-running server process -- only stops it from
# auto-starting on future logins.

$ErrorActionPreference = 'Stop'
$taskName = 'DungeonMasterBox'

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Output "No $taskName task is currently installed -- nothing to do."
} else {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Output "Removed. The server will no longer start automatically on login."
}
