param([string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder")
$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 2 - CONTROL PLANE CHECK" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$Required = @(
  "lib\control-plane\types.ts",
  "lib\control-plane\bridge.ts",
  "lib\control-plane\project.ts",
  "lib\control-plane\persistence.ts",
  "app\api\control-plane\health\route.ts",
  "app\api\control-plane\projects\[id]\[...action]\route.ts",
  "components\project-control-plane.tsx",
  "app\dashboard\projects\[id]\control\page.tsx",
  "app\dashboard\projects\[id]\market\page.tsx",
  "app\dashboard\projects\[id]\supreme\page.tsx",
  "app\dashboard\projects\[id]\runtime\page.tsx",
  "app\dashboard\projects\[id]\page.tsx",
  "supabase\migrations\20260817_live2_control_plane.sql"
)
foreach ($File in $Required) {
  $Full = Join-Path $ProjectRoot $File
  if (!(Test-Path -LiteralPath $Full)) { throw "Falta: $File" }
  Write-Host "[OK] $File" -ForegroundColor Green
}
function Require-Pattern([string]$RelativePath,[string]$Pattern,[string]$Label) {
  $Raw = Get-Content -LiteralPath (Join-Path $ProjectRoot $RelativePath) -Raw
  if ($Raw -notmatch $Pattern) { throw "Falta patron '$Label' en $RelativePath" }
  Write-Host "[OK] $Label" -ForegroundColor Green
}
Write-Host ""; Write-Host "Arquitectura..." -ForegroundColor Cyan
Require-Pattern "lib\control-plane\project.ts" "requireWorkspace" "Project Resolver"
Require-Pattern "lib\control-plane\project.ts" "workspace_registry" "Workspace Registry"
Require-Pattern "lib\control-plane\persistence.ts" "runtime_sessions" "Runtime Persistence"
Require-Pattern "lib\control-plane\persistence.ts" "change_sets" "Change-set Persistence"
Require-Pattern "lib\control-plane\persistence.ts" "project_memory" "Memory Persistence"
Require-Pattern "app\api\control-plane\projects\[id]\[...action]\route.ts" "market/create" "Market Bridge"
Require-Pattern "app\api\control-plane\projects\[id]\[...action]\route.ts" "supreme/score" "Supreme Bridge"
Require-Pattern "app\api\control-plane\projects\[id]\[...action]\route.ts" "runtime/start" "Runtime Bridge"
Write-Host ""; Write-Host "TYPECHECK..." -ForegroundColor Cyan
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TYPECHECK FAIL" }
Write-Host "[PASS] TYPECHECK" -ForegroundColor Green
Write-Host ""; Write-Host "BUILD..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "BUILD FAIL" }
Write-Host "[PASS] BUILD" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BLOQUE 2 ESTRUCTURA: PASS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
