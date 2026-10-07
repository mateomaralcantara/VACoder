param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$IsolationConfirmed
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " LIVE 1 - CERTIFICACION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

try {
    $Health = Invoke-RestMethod `
        -Uri "$BaseUrl/api/live1/health" `
        -Method GET `
        -TimeoutSec 20
}
catch {
    throw "Coder no responde en $BaseUrl"
}

Write-Host ""
Write-Host "Version      : $($Health.version)"
Write-Host "Configured   : $($Health.configured)"
Write-Host "Schema Ready : $($Health.schemaReady)"

if (-not $Health.configured) {
    throw "Supabase todavia no esta configurado."
}

if (-not $Health.schemaReady) {
    Write-Host ""
    Write-Host "Database error:" -ForegroundColor Red
    Write-Host $Health.databaseError

    throw "Schema LIVE 1 no esta listo."
}

if (-not $IsolationConfirmed) {
    Write-Host ""
    Write-Host "FALTA PRUEBA RLS ENTRE DOS USUARIOS." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Haz la prueba:"
    Write-Host "1. Usuario A crea Organizacion A y Proyecto A."
    Write-Host "2. Cierra sesion."
    Write-Host "3. Usuario B crea su propia cuenta."
    Write-Host "4. Confirma que Usuario B NO ve Proyecto A."
    Write-Host "5. Ejecuta nuevamente:"
    Write-Host ""
    Write-Host 'powershell -ExecutionPolicy Bypass -File ".\scripts\certificar-live1.ps1" -IsolationConfirmed'
    Write-Host ""

    exit 2
}

Write-Host ""
Write-Host "[PASS] Supabase configurado" -ForegroundColor Green
Write-Host "[PASS] Schema disponible" -ForegroundColor Green
Write-Host "[PASS] Aislamiento RLS confirmado" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BLOQUE 1 - LIVE SAAS CORE CERTIFICADO" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
