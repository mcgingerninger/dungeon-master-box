# One-time: creates a "Update Dungeon Master Box" shortcut on your Desktop that
# runs refresh-now.bat when double-clicked. Run once:
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\windows\create-desktop-shortcut.ps1
#
# Re-run after moving the repo folder to refresh the shortcut's target path.

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Target = Join-Path $RepoRoot "scripts\windows\refresh-now.bat"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Update Dungeon Master Box.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Target
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.Description = "Pull latest Dungeon Master Box updates and restart the server"
$Shortcut.Save()

Write-Host "Shortcut created: $ShortcutPath"
Write-Host "Double-click it any time to pull updates and restart the server."
