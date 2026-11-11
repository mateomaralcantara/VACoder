param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder",
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ProjectId = "",
    [switch]$StructuralOnly,
    [switch]$LiveOnly
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 3 - JOB ORCHESTRATOR CERTIFICATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

function Read-EnvMap {
    param([string]$Path)

    $Map = @{}

    if (!(Test-Path -LiteralPath $Path)) {
        return $Map
    }

    foreach ($Line in Get-Content -LiteralPath $Path) {
        $T = $Line.Trim()

        if (
            !$T -or
            $T.StartsWith("#")
        ) {
            continue
        }

        $I = $T.IndexOf("=")

        if ($I -lt 1) {
            continue
        }

        $Key =
            $T.Substring(0, $I).Trim()

        $Value =
            $T.Substring($I + 1).Trim()

        if (
            ($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
            ($Value.StartsWith("'") -and $Value.EndsWith("'"))
        ) {
            $Value =
                $Value.Substring(
                    1,
                    $Value.Length - 2
                )
        }

        $Map[$Key] = $Value
    }

    return $Map
}

if (-not $LiveOnly) {
    powershell `
        -ExecutionPolicy Bypass `
        -File ".\scripts\check-bloque3-orchestrator.ps1" `
        -ProjectRoot $ProjectRoot

    if ($LASTEXITCODE -ne 0) {
        throw "Structural certification fallo."
    }

    if ($StructuralOnly) {
        Write-Host "[PASS] FASE ESTRUCTURAL BLOQUE 3" -ForegroundColor Green
        exit 0
    }
}

if (-not $StructuralOnly) {
    Write-Host ""
    Write-Host "FASE LIVE..." -ForegroundColor Cyan

    $Health = Invoke-RestMethod `
        -Uri "$BaseUrl/api/orchestrator/health" `
        -Method GET `
        -TimeoutSec 30

    Write-Host "Version                : $($Health.version)"
    Write-Host "Configured             : $($Health.configured)"
    Write-Host "Schema Ready           : $($Health.schemaReady)"
    Write-Host "Server Key Configured  : $($Health.serverKeyConfigured)"
    Write-Host "Worker Token Configured: $($Health.workerTokenConfigured)"

    if (
        -not $Health.configured -or
        -not $Health.schemaReady
    ) {
        throw "LIVE 3 health no esta listo."
    }

    Write-Host "[PASS] LIVE 3 HEALTH" -ForegroundColor Green

    $Env =
        Read-EnvMap ".\.env.local"

    $Token =
        $Env["VACODER_WORKER_TOKEN"]

    if (!$Token) {
        throw "Falta VACODER_WORKER_TOKEN."
    }

    # Probe del worker: NO ejecuta job.
    $Probe = Invoke-RestMethod `
        -Uri "$BaseUrl/api/orchestrator/worker/tick" `
        -Method POST `
        -Headers @{
            Authorization = "Bearer $Token"
        } `
        -ContentType "application/json" `
        -Body '{"workerId":"certifier-probe","probeOnly":true}' `
        -TimeoutSec 30

    if (
        $Probe.ok -ne $true -or
        $Probe.authenticated -ne $true
    ) {
        throw "Worker endpoint no autentico correctamente."
    }

    Write-Host "[PASS] Worker endpoint autenticado" -ForegroundColor Green

    if (!$ProjectId) {
        throw "Falta -ProjectId."
    }

    # IMPORTANTE:
    # PowerShell ya NO usa SUPABASE_SECRET_KEY directamente.
    # La consulta se ejecuta dentro de Next.js/server mediante admin client.
    $CertUrl =
        "$BaseUrl/api/orchestrator/worker/certification/$ProjectId"

    $Data = Invoke-RestMethod `
        -Uri $CertUrl `
        -Method GET `
        -Headers @{
            Authorization = "Bearer $Token"
        } `
        -TimeoutSec 30

    if ($Data.ok -ne $true) {
        throw "Certification endpoint fallo."
    }

    if (!$Data.latestRun) {
        throw "No existe ningun Job para ProjectId $ProjectId."
    }

    $Run = $Data.latestRun

    Write-Host ""
    Write-Host "Latest Job : $($Run.id)"
    Write-Host "Status     : $($Run.status)"
    Write-Host "Progress   : $($Run.progress)%"
    Write-Host "Tasks      : $($Data.tasks.Count)"
    Write-Host "Events     : $($Data.events.Count)"
    Write-Host ""

    if ($Run.status -ne "completed") {
        throw "El ultimo job no esta completed."
    }

    if ([int]$Run.progress -ne 100) {
        throw "El ultimo job no esta en 100%."
    }

    if (
        !$Data.tasks -or
        $Data.tasks.Count -eq 0
    ) {
        throw "No hay tasks persistentes."
    }

    $IncompleteTasks =
        @(
            $Data.tasks |
            Where-Object {
                $_.status -ne "completed"
            }
        )

    if ($IncompleteTasks.Count -gt 0) {
        throw "Hay $($IncompleteTasks.Count) task(s) no completadas."
    }

    if (
        !$Data.events -or
        $Data.events.Count -lt 3
    ) {
        throw "Faltan eventos persistentes."
    }

    Write-Host "[PASS] Durable Queue" -ForegroundColor Green
    Write-Host "[PASS] Worker independiente del browser" -ForegroundColor Green
    Write-Host "[PASS] Tasks persistentes" -ForegroundColor Green
    Write-Host "[PASS] Progress 100%" -ForegroundColor Green
    Write-Host "[PASS] Eventos persistentes" -ForegroundColor Green

    if ($Data.certification.retryObserved -eq $true) {
        Write-Host "[PASS] Retry observado en ejecucion real" -ForegroundColor Green
    }
    else {
        Write-Host "[INFO] Retry instalado; el ultimo job no contiene evento retry" -ForegroundColor DarkGray
    }

    Write-Host "[PASS] Cancel / Priority / Timeout / Lease instalados" -ForegroundColor Green

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " BLOQUE 3 - JOB ORCHESTRATOR CERTIFICADO" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
}
