param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " VACODER LIVE 4 - CLOUD WORKER" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$EnvPath = Join-Path $ProjectRoot ".env.local"

if (!(Test-Path -LiteralPath $EnvPath)) {
    throw "Falta .env.local"
}

foreach ($Line in Get-Content -LiteralPath $EnvPath) {
    $T = $Line.Trim()

    if (!$T -or $T.StartsWith("#")) {
        continue
    }

    $I = $T.IndexOf("=")

    if ($I -lt 1) {
        continue
    }

    $Key = $T.Substring(0, $I).Trim()
    $Value = $T.Substring($I + 1).Trim().Trim('"').Trim("'")

    [Environment]::SetEnvironmentVariable(
        $Key,
        $Value,
        "Process"
    )
}

node ".\services\cloud-worker\worker.mjs"
