param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder"
)
$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 3 - JOB ORCHESTRATOR CHECK" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$Required = @(
    "lib\orchestrator\types.ts",
    "lib\orchestrator\admin.ts",
    "lib\orchestrator\worker-auth.ts",
    "lib\orchestrator\jobs.ts",
    "lib\orchestrator\executors.ts",
    "lib\orchestrator\engine.ts",
    "app\api\orchestrator\health\route.ts",
    "app\api\orchestrator\worker\tick\route.ts",
    "app\api\orchestrator\projects\[id]\jobs\route.ts",
    "app\api\orchestrator\projects\[id]\jobs\[jobId]\route.ts",
    "app\api\orchestrator\projects\[id]\jobs\[jobId]\cancel\route.ts",
    "app\api\orchestrator\projects\[id]\jobs\[jobId]\retry\route.ts",
    "components\job-orchestrator.tsx",
    "app\dashboard\projects\[id]\orchestrator\page.tsx",
    "scripts\run-orchestrator-worker.mjs",
    "scripts\run-orchestrator-worker.ps1",
    "supabase\migrations\20260818_live3_job_orchestrator.sql"
)
foreach ($File in $Required) {
    if (!(Test-Path -LiteralPath (Join-Path $ProjectRoot $File))) { throw "Falta: $File" }
    Write-Host "[OK] $File" -ForegroundColor Green
}

function Require-Pattern([string]$File,[string]$Pattern,[string]$Label) {
    $Raw = Get-Content -LiteralPath (Join-Path $ProjectRoot $File) -Raw
    if ($Raw -notmatch $Pattern) { throw "Falta $Label en $File" }
    Write-Host "[OK] $Label" -ForegroundColor Green
}

Write-Host ""
Write-Host "Arquitectura..." -ForegroundColor Cyan
Require-Pattern "supabase\migrations\20260818_live3_job_orchestrator.sql" "claim_next_agent_run" "Atomic queue claim"
Require-Pattern "lib\orchestrator\engine.ts" "lease_expires_at" "Worker lease"
Require-Pattern "lib\orchestrator\engine.ts" "task.retry" "Retries"
Require-Pattern "lib\orchestrator\jobs.ts" "cancel_requested" "Cancellation"
Require-Pattern "lib\orchestrator\jobs.ts" "priority" "Priority"
Require-Pattern "lib\orchestrator\engine.ts" "progress" "Progress"
Require-Pattern "scripts\run-orchestrator-worker.mjs" "while \(!stopped\)" "Persistent local worker"
Require-Pattern "lib\orchestrator\worker-auth.ts" "VACODER_WORKER_TOKEN" "Worker auth"

$Procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match "^(node|npm|npx)(\.exe|\.cmd)?$" -and $_.CommandLine -and $_.CommandLine -like "*$ProjectRoot*"
})
if ($Procs.Count -gt 0) {
    throw "Hay procesos Node de Coder activos. Deten npm run dev/worker antes del BUILD estructural."
}

if (Test-Path -LiteralPath ".\.next") { Remove-Item -LiteralPath ".\.next" -Recurse -Force }
Write-Host ""
Write-Host "TYPECHECK..." -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TYPECHECK FAIL" }
Write-Host "[PASS] TYPECHECK" -ForegroundColor Green

Write-Host ""
Write-Host "BUILD..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "BUILD FAIL" }
Write-Host "[PASS] BUILD" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BLOQUE 3 ESTRUCTURA: PASS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
