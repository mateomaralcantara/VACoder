$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK MARKET PREMIUM VIEW ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "components\market-leader-premium-view.tsx",
  "app\market\page.tsx"
)

foreach ($File in $Files) {
  if (Test-Path (Join-Path $Root $File)) {
    Write-Host "[OK] $File" -ForegroundColor Green
  } else {
    throw "Falta archivo: $File"
  }
}

Write-Host ""
Write-Host "Ejecutando typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Ejecutando build..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "VISTA MARKET PREMIUM VALIDADA." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/market"
Write-Host ""
