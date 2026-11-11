param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder",
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ProjectId = ""
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

function Read-EnvMap {
    param([string]$Path)
    $Map = @{}

    foreach ($Line in Get-Content -LiteralPath $Path) {
        $T = $Line.Trim()
        if (!$T -or $T.StartsWith("#")) { continue }

        $I = $T.IndexOf("=")
        if ($I -lt 1) { continue }

        $Key = $T.Substring(0, $I).Trim()
        $Value = $T.Substring($I + 1).Trim().Trim('"').Trim("'")
        $Map[$Key] = $Value
    }

    return $Map
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 4 - REAL CLOUD RUNTIME CERTIFICATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (!$ProjectId) { throw "Falta -ProjectId." }

$Health = Invoke-RestMethod `
    -Uri "$BaseUrl/api/cloud-runtime/health" `
    -Method GET `
    -TimeoutSec 30

Write-Host "Version                : $($Health.version)"
Write-Host "Configured             : $($Health.configured)"
Write-Host "Schema Ready           : $($Health.schemaReady)"
Write-Host "E2B Configured         : $($Health.e2bConfigured)"
Write-Host "Server Key Configured  : $($Health.serverKeyConfigured)"
Write-Host "Worker Token Configured: $($Health.workerTokenConfigured)"

if (-not $Health.configured -or -not $Health.schemaReady -or -not $Health.e2bConfigured) {
    throw "LIVE 4 health no esta listo."
}

Write-Host "[PASS] LIVE 4 HEALTH" -ForegroundColor Green

$Env = Read-EnvMap ".\.env.local"
$Token = $Env["VACODER_WORKER_TOKEN"]
if (!$Token) { throw "Falta VACODER_WORKER_TOKEN." }

$Probe = Invoke-RestMethod `
    -Uri "$BaseUrl/api/cloud-runtime/probe" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $Token" } `
    -TimeoutSec 90

if ($Probe.ok -ne $true -or $Probe.provider -ne "e2b") {
    throw "E2B probe fallo."
}

Write-Host "[PASS] E2B sandbox real creado y ejecutado" -ForegroundColor Green
Write-Host "Probe Sandbox: $($Probe.sandboxId)"

$Data = Invoke-RestMethod `
    -Uri "$BaseUrl/api/cloud-runtime/worker/certification/$ProjectId" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $Token" } `
    -TimeoutSec 30

if ($Data.ok -ne $true) { throw "Cloud certification endpoint fallo." }
if (!$Data.latestRun) {
    throw "No existe Cloud Job. Crea snapshot + Cloud Job desde /cloud-runtime."
}

Write-Host ""
Write-Host "Latest Cloud Job : $($Data.latestRun.id)"
Write-Host "Status           : $($Data.latestRun.status)"
Write-Host "Progress         : $($Data.latestRun.progress)%"
Write-Host "Tasks            : $($Data.tasks.Count)"
Write-Host "Runtime Provider : $($Data.runtime.provider)"
Write-Host "E2B Sandbox ID   : $($Data.runtime.external_id)"
Write-Host "Runtime Status   : $($Data.runtime.status)"
Write-Host "Cloud Events     : $($Data.events.Count)"
Write-Host ""

if ($Data.certified -ne $true) {
    $Failed = $Data.checks.psobject.Properties |
        Where-Object { $_.Value -ne $true } |
        ForEach-Object { $_.Name }

    throw "LIVE 4 no certificado. Falla: $($Failed -join ', ')"
}

Write-Host "[PASS] Workspace snapshot persistente" -ForegroundColor Green
Write-Host "[PASS] E2B runtime real" -ForegroundColor Green
Write-Host "[PASS] Sandbox ID persistido" -ForegroundColor Green
Write-Host "[PASS] Tasks ejecutadas en cloud" -ForegroundColor Green
Write-Host "[PASS] Cloud runtime events persistentes" -ForegroundColor Green
Write-Host "[PASS] Cloud Job completed / 100%" -ForegroundColor Green
Write-Host "[PASS] Worker cloud standalone disponible" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BLOQUE 4 - REAL CLOUD RUNTIME CERTIFICADO" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
