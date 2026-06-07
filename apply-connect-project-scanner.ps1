# apply-connect-project-scanner.ps1
# Conecta Project Scanner a API + UI con backup.
# Ejecutar desde la raíz del proyecto VACoder:
# powershell -ExecutionPolicy Bypass -File .\apply-connect-project-scanner.ps1

$ErrorActionPreference = "Stop"

$Root = Get-Location
$Backup = Join-Path $Root ("backup-connect-project-scanner-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

$Files = @(
  "app\api\project\scan\route.ts",
  "lib\project-scan-client.ts",
  "components\project-scan-panel.tsx",
  "components\workspace.tsx"
)

New-Item -ItemType Directory -Force -Path $Backup | Out-Null

foreach ($File in $Files) {
  $Source = Join-Path $PSScriptRoot $File
  $Target = Join-Path $Root $File

  if (Test-Path -LiteralPath $Target) {
    $BackupTarget = Join-Path $Backup $File
    New-Item -ItemType Directory -Force -Path (Split-Path $BackupTarget -Parent) | Out-Null
    Copy-Item -LiteralPath $Target -Destination $BackupTarget -Force
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $Target -Parent) | Out-Null
  Copy-Item -LiteralPath $Source -Destination $Target -Force
}

$DuplicatePrompt = Join-Path $Root "lib\providers\evaluate-project.ts"
if (Test-Path -LiteralPath $DuplicatePrompt) {
  $BackupDuplicate = Join-Path $Backup "lib\providers\evaluate-project.ts"
  New-Item -ItemType Directory -Force -Path (Split-Path $BackupDuplicate -Parent) | Out-Null
  Copy-Item -LiteralPath $DuplicatePrompt -Destination $BackupDuplicate -Force
  Remove-Item -LiteralPath $DuplicatePrompt -Force
}

$CssTarget = Join-Path $Root "app\globals.css"
$CssSource = Join-Path $PSScriptRoot "connect-scanner-css.txt"

if (Test-Path -LiteralPath $CssTarget) {
  $CssContent = Get-Content -LiteralPath $CssTarget -Raw -Encoding UTF8

  if ($CssContent -notmatch "Project Scanner Connection") {
    $BackupCss = Join-Path $Backup "app\globals.css"
    New-Item -ItemType Directory -Force -Path (Split-Path $BackupCss -Parent) | Out-Null
    Copy-Item -LiteralPath $CssTarget -Destination $BackupCss -Force

    Add-Content -LiteralPath $CssTarget -Value "`n"
    Add-Content -LiteralPath $CssTarget -Value (Get-Content -LiteralPath $CssSource -Raw -Encoding UTF8)
  }
}

Write-Host "Project Scanner conectado correctamente." -ForegroundColor Green
Write-Host "Backup:" $Backup -ForegroundColor Cyan
Write-Host ""
Write-Host "Siguiente:" -ForegroundColor Yellow
Write-Host "npm run build"
