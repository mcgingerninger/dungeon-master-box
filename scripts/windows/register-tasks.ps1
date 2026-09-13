# One-time setup: creates the two Windows Scheduled Tasks that keep the Dungeon
# Master Box server running across reboots and auto-updated from GitHub. Run this
# once, in a normal (non-admin) PowerShell prompt, from anywhere:
#
#   .\scripts\windows\register-tasks.ps1
#
# Re-run it any time to update the tasks (e.g. after moving the repo folder).

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$StartScript = Join-Path $RepoRoot "scripts\windows\start-server.bat"
$UpdateScript = Join-Path $RepoRoot "scripts\windows\update.ps1"

Write-Host "Repo root:     $RepoRoot"
Write-Host "Start script:  $StartScript"
Write-Host "Update script: $UpdateScript"

# Server: starts at login, stays running. /RL LIMITED = runs with your normal user
# rights (no admin needed, no elevation prompt).
schtasks /Create `
    /TN "DungeonMasterBox-Server" `
    /TR "`"$StartScript`"" `
    /SC ONLOGON `
    /RL LIMITED `
    /F

# Auto-update: checks GitHub every 30 minutes, forever, starting from now. A stale
# check while offline (or a fast-forward failure from local edits) just logs and
# does nothing - see logs\update.log.
$startTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
schtasks /Create `
    /TN "DungeonMasterBox-AutoUpdate" `
    /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$UpdateScript`"" `
    /SC MINUTE `
    /MO 30 `
    /ST $startTime `
    /F

Write-Host ""
Write-Host "Done. The server task starts at your next login (or run it now with:"
Write-Host "  schtasks /Run /TN `"DungeonMasterBox-Server`""
Write-Host ")."
Write-Host "Logs land in $RepoRoot\logs\server.log and $RepoRoot\logs\update.log"
