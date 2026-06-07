# apply-project-scanner.ps1
# Copia los archivos del Project Scanner sobre la raíz del proyecto actual.

$ErrorActionPreference = "Stop"

$Root = Get-Location
$Backup = Join-Path $Root ("backup-project-scanner-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

$Files = @(
  "lib\file-filters.ts",
  "lib\project-manifest.ts",
  "lib\project-scanner.ts",
  "lib\prompts\evaluate-project.ts"
)

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

foreach ($File in $Files) {
  $Target = Join-Path $Root $File
  $Source = Join-Path $PSScriptRoot $File

  if (Test-Path -LiteralPath $Target) {
    $BackupTarget = Join-Path $Backup $File
    New-Item -ItemType Directory -Force -Path (Split-Path $BackupTarget -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $BackupTarget -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Target -Force
}

Write-Host "Project Scanner aplicado correctamente." -ForegroundColor Green
Write-Host "Backup:" $Backup -ForegroundColor Cyan
