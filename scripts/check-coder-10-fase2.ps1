$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK CODER 10/10 FASE 2 ===" -ForegroundColor Cyan
Write-Host ""

$RequiredFiles = @(
  "lib\vacoder\core.ts",
  "app\api\project\scan\route.ts",
  "app\api\project\snapshot\route.ts",
  "app\api\project\diff\route.ts",
  "app\api\project\validate\route.ts",
  "app\api\project\rollback\route.ts",
  "app\api\project\patch\apply\route.ts"
)

$Missing = @()

foreach ($File in $RequiredFiles) {
  $FullPath = Join-Path $Root $File

  if (Test-Path $FullPath) {
    Write-Host "[OK] $File" -ForegroundColor Green
  } else {
    Write-Host "[FALTA] $File" -ForegroundColor Red
    $Missing += $File
  }
}

if ($Missing.Count -gt 0) {
  throw "Faltan archivos criticos."
}

Write-Host ""
Write-Host "Ejecutando typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Ejecutando build..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "CODER FASE 2 PASO TYPECHECK Y BUILD." -ForegroundColor Green
Write-Host ""