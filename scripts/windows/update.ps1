# Run by the "DungeonMasterBox-AutoUpdate" scheduled task on a timer. Pulls whatever
# branch is currently checked out, and only reinstalls deps / restarts the server
# task when the pull actually moved HEAD - a no-op check (e.g. while offline) is cheap.
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RepoRoot

$LogDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "update.log"

function Log($msg) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg" | Out-File -Append -FilePath $LogFile
}

Log "Checking for updates..."

$branch = git rev-parse --abbrev-ref HEAD
$before = git rev-parse HEAD
git fetch origin *>> $LogFile
# --ff-only: never auto-merge or rebase. If local history has diverged (e.g. someone
# committed by hand on the machine), this fails safely and logs it instead of guessing.
git pull --ff-only origin $branch *>> $LogFile
$after = git rev-parse HEAD

if ($before -ne $after) {
    Log "Updated $before -> $after on branch '$branch'. Installing dependencies and restarting server..."
    npm install *>> $LogFile
    schtasks /End /TN "DungeonMasterBox-Server" *>> $LogFile 2>&1
    Start-Sleep -Seconds 2
    schtasks /Run /TN "DungeonMasterBox-Server" *>> $LogFile 2>&1
    Log "Restart complete."
} else {
    Log "No changes (still at $after)."
}
