param(
  [string]$SourceDir = "G:\My Drive\Boss_Web\boss-web",
  [string]$BackupRoot = "C:\dev\boss-web-auto-backups",
  [int]$RetainDays = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourceDir)) {
  exit 0
}

# Backup only when any Next.js app server is running.
$isRunning = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "node.exe" -and
  $_.CommandLine -match "next dev|start-server"
}

if (-not $isRunning) {
  exit 0
}

if (-not (Test-Path -LiteralPath $BackupRoot)) {
  New-Item -ItemType Directory -Path $BackupRoot | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destDir = Join-Path $BackupRoot "backup-$timestamp"

New-Item -ItemType Directory -Path $destDir | Out-Null

robocopy "$SourceDir" "$destDir" /E /R:1 /W:1 /XD node_modules .next node_modules_partial | Out-Null

# Keep storage under control.
$cutoff = (Get-Date).AddDays(-$RetainDays)
Get-ChildItem -Path $BackupRoot -Directory |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
