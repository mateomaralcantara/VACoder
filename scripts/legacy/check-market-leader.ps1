$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK MARKET LEADER MODE ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "lib\vacoder\market\types.ts",
  "lib\vacoder\market\agent.ts",
  "lib\vacoder\market\change-set.ts",
  "lib\vacoder\market\git.ts",
  "app\api\project\agent\plan\route.ts",
  "app\api\project\change-set\create\route.ts",
  "app\api\project\change-set\apply\route.ts",
  "app\api\project\change-set\reject\route.ts",
  "app\api\project\change-set\list\route.ts",
  "app\api\project\git\status\route.ts",
  "app\api\project\git\commit\route.ts",
  "components\market-leader-panel.tsx",
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
Write-Host "MARKET LEADER MODE INSTALADO Y VALIDADO." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/market"
Write-Host ""
