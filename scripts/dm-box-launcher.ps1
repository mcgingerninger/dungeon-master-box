# Dungeon Master Box - self-updating launcher.
#
# Pulls the latest code for $Branch from GitHub, installs dependencies, and starts
# the server. Then loops forever: every $CheckIntervalSeconds it checks GitHub for
# new commits, and if found, stops the server, pulls, reinstalls, and restarts it.
#
# Intended to run unattended (via Windows Task Scheduler - see
# install-autostart-task.bat) so the box updates itself over WiFi with no monitor
# or manual git/npm commands required at the table.

param(
    [string]$Branch = "main",
    [int]$CheckIntervalSeconds = 300
)

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$LogFile = Join-Path $RepoRoot "dm-box.log"

function Write-Log($message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Get-RemoteHead {
    git fetch origin $Branch 2>&1 | Out-Null
    return (git rev-parse "origin/$Branch").Trim()
}

function Get-LocalHead {
    return (git rev-parse HEAD).Trim()
}

function Update-Code {
    Write-Log "Updating to latest '$Branch'..."
    git fetch origin $Branch
    git checkout $Branch 2>&1 | Out-Null
    git reset --hard "origin/$Branch"
    npm install
}

function Start-Server {
    Write-Log "Starting server..."
    return Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm start >> `"$LogFile`" 2>&1" `
        -WorkingDirectory $RepoRoot `
        -WindowStyle Hidden `
        -PassThru
}

function Stop-Server($proc) {
    if ($proc -and !$proc.HasExited) {
        Write-Log "Stopping server (PID $($proc.Id))..."
        # cmd.exe's child npm/node.exe processes aren't killed by Stop-Process alone
        # (Windows doesn't auto-kill children) - taskkill /T kills the whole tree.
        Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID $($proc.Id) /T /F" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue
    }
}

Write-Log "Dungeon Master Box launcher starting (branch: $Branch, check interval: ${CheckIntervalSeconds}s)"

try {
    Update-Code
} catch {
    Write-Log "Initial update failed (offline?), starting with code already on disk: $_"
}

$serverProc = Start-Server
$lastKnownHead = Get-LocalHead

while ($true) {
    Start-Sleep -Seconds $CheckIntervalSeconds
    try {
        $remoteHead = Get-RemoteHead
        if ($remoteHead -and $remoteHead -ne $lastKnownHead) {
            Write-Log "New commit detected on '$Branch' ($remoteHead) - restarting server."
            Stop-Server $serverProc
            Update-Code
            $serverProc = Start-Server
            $lastKnownHead = Get-LocalHead
        }
    } catch {
        Write-Log "Update check failed (likely offline): $_"
    }

    if ($serverProc.HasExited) {
        Write-Log "Server process exited unexpectedly (code $($serverProc.ExitCode)) - restarting it."
        $serverProc = Start-Server
    }
}
