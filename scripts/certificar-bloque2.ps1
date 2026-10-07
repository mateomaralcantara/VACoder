param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder",
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ProjectId = "",
    [switch]$StructuralOnly,
    [switch]$LiveOnly,
    [switch]$UserScopedConfirmed
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 2 - CONTROL PLANE CERTIFICATION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# =========================================================
# FASE A - ESTRUCTURAL
# Dev server debe estar DETENIDO
# =========================================================

if (-not $LiveOnly) {

    Write-Host ""
    Write-Host "FASE A - STRUCTURAL / BUILD" -ForegroundColor Cyan

    powershell `
        -ExecutionPolicy Bypass `
        -File ".\scripts\check-bloque2-control-plane.ps1" `
        -ProjectRoot $ProjectRoot

    if ($LASTEXITCODE -ne 0) {
        throw "Structural check fallo."
    }

    Write-Host ""
    Write-Host "[PASS] BLOQUE 2 STRUCTURAL" -ForegroundColor Green

    if ($StructuralOnly) {

        Write-Host ""
        Write-Host "==========================================" -ForegroundColor Green
        Write-Host " FASE ESTRUCTURAL CERTIFICADA" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green

        Write-Host ""
        Write-Host "Ahora ejecuta:"
        Write-Host ""
        Write-Host "npm run dev"
        Write-Host ""
        Write-Host "Y en otra PowerShell usa -LiveOnly."

        exit 0
    }
}

# =========================================================
# FASE B - LIVE
# Dev server debe estar ENCENDIDO
# =========================================================

if (-not $StructuralOnly) {

    Write-Host ""
    Write-Host "FASE B - LIVE CONTROL PLANE" -ForegroundColor Cyan

    try {

        $Health = Invoke-RestMethod `
            -Uri "$BaseUrl/api/control-plane/health" `
            -Method GET `
            -TimeoutSec 30

    }
    catch {

        throw "Control Plane no responde en $BaseUrl. Ejecuta npm run dev."
    }

    Write-Host ""
    Write-Host "Version      : $($Health.version)"
    Write-Host "Configured   : $($Health.configured)"
    Write-Host "Schema Ready : $($Health.schemaReady)"

    if (-not $Health.configured) {
        throw "Supabase no esta configurado."
    }

    if (-not $Health.schemaReady) {

        Write-Host ""
        Write-Host "Errores del schema:" -ForegroundColor Red

        $Health.errors |
            ForEach-Object {
                Write-Host $_
            }

        throw "LIVE 2 schema no esta listo."
    }

    Write-Host "[PASS] CONTROL PLANE HEALTH" -ForegroundColor Green
    Write-Host "[PASS] LIVE 2 SCHEMA" -ForegroundColor Green

    if (-not $ProjectId) {

        Write-Host ""
        Write-Host "Falta ProjectId." -ForegroundColor Yellow
        Write-Host "Abre /dashboard/projects y copia el UUID real."
        exit 2
    }

    Write-Host ""
    Write-Host "PROJECT ID:" -ForegroundColor Cyan
    Write-Host $ProjectId

    Write-Host ""
    Write-Host "PANEL:" -ForegroundColor Cyan
    Write-Host "$BaseUrl/dashboard/projects/$ProjectId/control"

    if (-not $UserScopedConfirmed) {

        Write-Host ""
        Write-Host "Completa en el panel:" -ForegroundColor Yellow
        Write-Host "1. Workspace Linked"
        Write-Host "2. Scan"
        Write-Host "3. Validate"
        Write-Host "4. Supreme Product Score"
        Write-Host "5. Runtime Start + Status"
        Write-Host "6. Crear Change-set"
        Write-Host "7. Guardar Memory Decision"
        Write-Host "8. Certification = 100%"
        Write-Host ""
        Write-Host "Luego ejecuta nuevamente con:"
        Write-Host "-LiveOnly -UserScopedConfirmed"

        exit 2
    }

    Write-Host ""
    Write-Host "[PASS] Supabase configurado" -ForegroundColor Green
    Write-Host "[PASS] Control Plane schema" -ForegroundColor Green
    Write-Host "[PASS] Project scoped certification confirmada" -ForegroundColor Green

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " BLOQUE 2 - CONTROL PLANE CERTIFICADO" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
}
