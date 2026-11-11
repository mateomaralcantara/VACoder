$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

Set-Location $Root

Write-Host ""
Write-Host "=== CHECK CODER 10/10 FASE 1 ===" -ForegroundColor Cyan
Write-Host ""

$requiredFiles = @(
  "app\not-found.tsx",
  "app\api\agent\stream\route.ts",
  "app\api\project\builder\create\route.ts",
  "app\api\project\builder\preview\route.ts",
  "app\api\project\production\status\route.ts",
  "app\api\project\patch\apply\route.ts"
)

$missing = @()

foreach ($file in $requiredFiles) {
  if (Test-Path (Join-Path $Root $file)) {
    Write-Host "[OK] $file" -ForegroundColor Green
  } else {
    Write-Host "[FALTA] $file" -ForegroundColor Red
    $missing += $file
  }
}

if ($missing.Count -gt 0) {
  throw "Faltan archivos críticos. Reinstala la fase 1."
}

Write-Host ""
Write-Host "Ejecutando typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Ejecutando build..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Si typecheck y build pasaron, Coder Fase 1 está estable." -ForegroundColor Green
Write-Host ""
