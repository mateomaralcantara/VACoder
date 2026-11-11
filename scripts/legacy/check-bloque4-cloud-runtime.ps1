param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 4 - REAL CLOUD RUNTIME CHECK" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$Required = @(
    "lib\cloud-runtime\types.ts",
    "lib\cloud-runtime\env.ts",
    "lib\cloud-runtime\snapshot.ts",
    "lib\cloud-runtime\jobs.ts",
    "app\api\cloud-runtime\health\route.ts",
    "app\api\cloud-runtime\probe\route.ts",
    "app\api\cloud-runtime\projects\[id]\snapshot\route.ts",
    "app\api\cloud-runtime\projects\[id]\jobs\route.ts",
    "app\api\cloud-runtime\worker\certification\[id]\route.ts",
    "components\cloud-runtime-panel.tsx",
    "app\dashboard\projects\[id]\cloud-runtime\page.tsx",
    "services\cloud-worker\worker.mjs",
    "services\cloud-worker\Dockerfile",
    "scripts\run-cloud-worker.ps1",
    "supabase\migrations\20260818_live4_real_cloud_runtime.sql"
)

foreach ($File in $Required) {
    if (!(Test-Path -LiteralPath (Join-Path $ProjectRoot $File))) {
        throw "Falta: $File"
    }
    Write-Host "[OK] $File" -ForegroundColor Green
}

$Pkg = Get-Content -LiteralPath ".\package.json" -Raw | ConvertFrom-Json
$Deps = @{}

if ($Pkg.dependencies) {
    $Pkg.dependencies.psobject.Properties |
        ForEach-Object { $Deps[$_.Name] = $_.Value }
}

foreach ($Dep in @("e2b", "tar")) {
    if (!$Deps.ContainsKey($Dep)) {
        throw "Falta dependencia: $Dep"
    }
    Write-Host "[OK] dependency $Dep $($Deps[$Dep])" -ForegroundColor Green
}

$Checks = @(
    @("supabase\migrations\20260818_live4_real_cloud_runtime.sql", "claim_next_cloud_agent_run", "Cloud atomic claim"),
    @("services\cloud-worker\worker.mjs", "Sandbox.create", "E2B create"),
    @("services\cloud-worker\worker.mjs", "Sandbox.connect", "E2B reconnect"),
    @("services\cloud-worker\worker.mjs", "cloud_runtime_sessions", "Runtime persistence"),
    @("lib\cloud-runtime\snapshot.ts", "name.startsWith(`".env.`")", "Secret exclusion")
)

foreach ($Check in $Checks) {
    $Raw = Get-Content -LiteralPath (Join-Path $ProjectRoot $Check[0]) -Raw
    if ($Raw -notmatch [regex]::Escape($Check[1])) {
        throw "Falta arquitectura: $($Check[2])"
    }
    Write-Host "[OK] $($Check[2])" -ForegroundColor Green
}

$Procs = @(
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -match "^(node|npm|npx)(\.exe|\.cmd)?$" -and
        $_.CommandLine -and
        $_.CommandLine -like "*$ProjectRoot*"
    }
)

if ($Procs.Count -gt 0) {
    throw "Deten npm run dev y workers antes del structural build."
}

if (Test-Path -LiteralPath ".\.next") {
    Remove-Item -LiteralPath ".\.next" -Recurse -Force
}

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TYPECHECK FAIL" }
Write-Host "[PASS] TYPECHECK" -ForegroundColor Green

npm run build
if ($LASTEXITCODE -ne 0) { throw "BUILD FAIL" }
Write-Host "[PASS] BUILD" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BLOQUE 4 ESTRUCTURA: PASS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
