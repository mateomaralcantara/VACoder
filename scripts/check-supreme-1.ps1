$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK SUPREME 1 ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "lib\vacoder\supreme\types.ts",
  "lib\vacoder\supreme\fs.ts",
  "lib\vacoder\supreme\memory.ts",
  "lib\vacoder\supreme\product-score.ts",
  "lib\vacoder\supreme\modules.ts",
  "lib\vacoder\supreme\visual-test.ts",
  "lib\vacoder\supreme\deploy.ts",
  "lib\vacoder\supreme\team.ts",
  "app\api\supreme\score\route.ts",
  "app\api\supreme\memory\route.ts",
  "app\api\supreme\modules\route.ts",
  "app\api\supreme\visual-test\route.ts",
  "app\api\supreme\deploy\status\route.ts",
  "app\api\supreme\deploy\vercel\route.ts",
  "components\supreme-command-center.tsx",
  "app\supreme\page.tsx"
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
Write-Host "SUPREME 1 INSTALADO Y VALIDADO." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/supreme"
Write-Host ""
