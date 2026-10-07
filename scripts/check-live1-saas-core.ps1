$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

Set-Location $Root

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " LIVE 1 SAAS CORE - STRUCTURAL CHECK" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$RequiredFiles = @(
    "middleware.ts",
    "lib\supabase\env.ts",
    "lib\supabase\server.ts",
    "lib\supabase\client.ts",
    "lib\supabase\middleware.ts",
    "lib\live1\auth.ts",
    "lib\live1\data.ts",
    "app\login\page.tsx",
    "app\signup\page.tsx",
    "app\setup\page.tsx",
    "app\dashboard\layout.tsx",
    "app\dashboard\page.tsx",
    "app\dashboard\projects\page.tsx",
    "app\dashboard\projects\new\page.tsx",
    "app\dashboard\projects\[id]\page.tsx",
    "app\dashboard\team\page.tsx",
    "app\dashboard\billing\page.tsx",
    "app\api\live1\health\route.ts",
    "app\api\live1\me\route.ts",
    "app\api\live1\projects\route.ts",
    "supabase\migrations\20260817_live1_saas_core.sql"
)

foreach ($File in $RequiredFiles) {
    if (!(Test-Path -LiteralPath (Join-Path $Root $File))) {
        throw "Falta: $File"
    }

    Write-Host "[OK] $File" -ForegroundColor Green
}

Write-Host ""
Write-Host "TYPECHECK..." -ForegroundColor Cyan

npm run typecheck

if ($LASTEXITCODE -ne 0) {
    throw "TYPECHECK FAIL"
}

Write-Host "[PASS] TYPECHECK" -ForegroundColor Green

Write-Host ""
Write-Host "BUILD..." -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    throw "BUILD FAIL"
}

Write-Host "[PASS] BUILD" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " LIVE 1 ESTRUCTURA: PASS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pendiente para certificacion:"
Write-Host "1. Configurar Supabase"
Write-Host "2. Ejecutar SQL"
Write-Host "3. Crear usuarios"
Write-Host "4. Probar RLS"
Write-Host ""

