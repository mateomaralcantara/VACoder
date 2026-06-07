# apply-upgrade.ps1
# Aplica el upgrade pack con backup automático.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupDir = Join-Path $Root "backup-agente-tutor-$Stamp"
$PatchDir = Join-Path $Root "patch"

if (!(Test-Path -LiteralPath $PatchDir)) {
  Write-Host "No existe la carpeta patch. Descomprime el ZIP en la raíz del proyecto." -ForegroundColor Red
  exit 1
}

$Files = Get-ChildItem -LiteralPath $PatchDir -Recurse -File

foreach ($File in $Files) {
  $Relative = $File.FullName.Substring($PatchDir.Length).TrimStart('\')
  $Target = Join-Path $Root $Relative
  $TargetDir = Split-Path -Parent $Target

  if (!(Test-Path -LiteralPath $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
  }

  if (Test-Path -LiteralPath $Target) {
    $BackupTarget = Join-Path $BackupDir $Relative
    $BackupTargetDir = Split-Path -Parent $BackupTarget

    if (!(Test-Path -LiteralPath $BackupTargetDir)) {
      New-Item -ItemType Directory -Path $BackupTargetDir -Force | Out-Null
    }

    Copy-Item -LiteralPath $Target -Destination $BackupTarget -Force
  }

  Copy-Item -LiteralPath $File.FullName -Destination $Target -Force
  Write-Host "Aplicado: $Relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "Upgrade aplicado." -ForegroundColor Cyan
Write-Host "Backup: $BackupDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ahora ejecuta:" -ForegroundColor White
Write-Host "npm run build" -ForegroundColor Gray
Write-Host "npm run dev" -ForegroundColor Gray
