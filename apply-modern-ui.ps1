# apply-modern-ui.ps1
# Aplica el paquete visual moderno del Agente Tutor IDE con backup automático.
# Ejecutar desde la raíz del proyecto:
# powershell -ExecutionPolicy Bypass -File .\apply-modern-ui.ps1

param(
  [string]$Root = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path $Root).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $ProjectRoot "backup-modern-ui-$Stamp"

$Files = @(
  "app/globals.css",
  "components/activity-panel.tsx",
  "components/code-panel.tsx",
  "components/control-bar.tsx",
  "components/diff-panel.tsx",
  "components/run-status-bar.tsx",
  "components/teacher-panel.tsx",
  "components/terminal-panel.tsx",
  "components/workspace.tsx"
)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " APLICANDO MODERN UI - AGENTE TUTOR IDE" -ForegroundColor Cyan
Write-Host " Proyecto: $ProjectRoot" -ForegroundColor Cyan
Write-Host " Backup:   $BackupDir" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

foreach ($Relative in $Files) {
  $Source = Join-Path $ProjectRoot $Relative
  $Backup = Join-Path $BackupDir $Relative

  if (Test-Path -LiteralPath $Source) {
    $BackupParent = Split-Path $Backup -Parent
    New-Item -ItemType Directory -Path $BackupParent -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Backup -Force
    Write-Host "Backup: $Relative" -ForegroundColor DarkGray
  }
}

foreach ($Relative in $Files) {
  $PackFile = Join-Path $PSScriptRoot $Relative
  $Target = Join-Path $ProjectRoot $Relative
  $TargetParent = Split-Path $Target -Parent

  if (!(Test-Path -LiteralPath $PackFile)) {
    throw "No existe en el paquete: $Relative"
  }

  New-Item -ItemType Directory -Path $TargetParent -Force | Out-Null
  Copy-Item -LiteralPath $PackFile -Destination $Target -Force
  Write-Host "Aplicado: $Relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "Modern UI aplicado." -ForegroundColor Green
Write-Host "Ahora ejecuta:" -ForegroundColor White
Write-Host "npm run build" -ForegroundColor Gray
Write-Host "npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Si algo falla, restaura desde:" -ForegroundColor Yellow
Write-Host $BackupDir -ForegroundColor Yellow
Write-Host ""
