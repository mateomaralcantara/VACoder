$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK SUPREME 2 RUNTIME ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "lib\vacoder\supreme\runtime.ts",
  "app\api\supreme\runtime\start\route.ts",
  "app\api\supreme\runtime\stop\route.ts",
  "app\api\supreme\runtime\status\route.ts",
  "app\api\supreme\runtime\ports\route.ts",
  "app\api\supreme\runtime\command\route.ts",
  "app\api\supreme\runtime\preview\route.ts",
  "components\supreme-runtime-center.tsx",
  "app\runtime\page.tsx"
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
Write-Host "SUPREME 2 RUNTIME INSTALADO Y VALIDADO." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/runtime"
Write-Host ""
