param(
    [string]$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\Coder",
    [ValidateSet("Static", "Structural", "Live")]
    [string]$Mode = "Static",
    [switch]$StopCoderDev,
    [string]$ProjectId = ""
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

$Findings = New-Object System.Collections.Generic.List[object]
$Started = Get-Date

function Add-Finding {
    param(
        [string]$Area,
        [string]$Check,
        [ValidateSet("PASS", "WARN", "FAIL", "INFO")]
        [string]$Status,
        [string]$Details = ""
    )

    $Findings.Add([pscustomobject]@{
        Area = $Area
        Check = $Check
        Status = $Status
        Details = $Details
    })

    $Color = switch ($Status) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        default { "Gray" }
    }

    Write-Host ("[{0}] {1} :: {2}" -f $Status, $Area, $Check) -ForegroundColor $Color
    if ($Details) { Write-Host ("       " + $Details) -ForegroundColor DarkGray }
}

function Test-FileLiteral {
    param([string]$Relative, [string]$Area = "Files")
    $Full = Join-Path $ProjectRoot $Relative
    if (Test-Path -LiteralPath $Full) {
        Add-Finding $Area $Relative "PASS" "Existe"
        return $true
    }
    Add-Finding $Area $Relative "FAIL" "No existe"
    return $false
}

function Test-PatternLiteral {
    param([string]$Relative, [string]$Pattern, [string]$Label, [string]$Area = "Architecture")
    $Full = Join-Path $ProjectRoot $Relative
    if (!(Test-Path -LiteralPath $Full)) {
        Add-Finding $Area $Label "FAIL" "Falta $Relative"
        return $false
    }
    $Raw = Get-Content -LiteralPath $Full -Raw
    if ($Raw -match $Pattern) {
        Add-Finding $Area $Label "PASS" $Relative
        return $true
    }
    Add-Finding $Area $Label "FAIL" "Patron no encontrado en $Relative"
    return $false
}

function Read-EnvFile {
    param([string]$Path)
    $Map = @{}
    if (!(Test-Path -LiteralPath $Path)) { return $Map }
    foreach ($Line in Get-Content -LiteralPath $Path) {
        $T = $Line.Trim()
        if (!$T -or $T.StartsWith("#")) { continue }
        $I = $T.IndexOf("=")
        if ($I -lt 1) { continue }
        $K = $T.Substring(0, $I).Trim()
        $V = $T.Substring($I + 1).Trim()
        $Map[$K] = $V
    }
    return $Map
}

function Get-CoderNodeProcesses {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match "^(node|npm|npx)(\.exe|\.cmd)?$" -and
            $_.CommandLine -and
            $_.CommandLine -like "*$ProjectRoot*"
        }
}

function Save-Report {
    $ReportDir = Join-Path $ProjectRoot "_reports"
    New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $JsonPath = Join-Path $ReportDir "prebloque3-$Stamp.json"
    $TxtPath = Join-Path $ReportDir "prebloque3-$Stamp.txt"

    $Pass = @($Findings | Where-Object Status -eq "PASS").Count
    $Warn = @($Findings | Where-Object Status -eq "WARN").Count
    $Fail = @($Findings | Where-Object Status -eq "FAIL").Count
    $TotalScored = [Math]::Max(1, $Pass + $Fail)
    $Score = [Math]::Round(($Pass / $TotalScored) * 100, 0)

    $Object = [pscustomobject]@{
        ProjectRoot = $ProjectRoot
        Mode = $Mode
        StartedAt = $Started.ToString("o")
        FinishedAt = (Get-Date).ToString("o")
        Score = $Score
        Pass = $Pass
        Warn = $Warn
        Fail = $Fail
        GateReady = ($Fail -eq 0)
        Findings = $Findings
    }

    $Object | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $JsonPath -Encoding UTF8
    $Lines = New-Object System.Collections.Generic.List[string]
    $Lines.Add("VACODER PRE-BLOQUE 3")
    $Lines.Add("Score: $Score/100")
    $Lines.Add("PASS=$Pass WARN=$Warn FAIL=$Fail")
    $Lines.Add("GateReady=$($Fail -eq 0)")
    $Lines.Add("")
    foreach ($F in $Findings) {
        $Lines.Add("[$($F.Status)] $($F.Area) :: $($F.Check) :: $($F.Details)")
    }
    $Lines | Set-Content -LiteralPath $TxtPath -Encoding UTF8

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host " PRE-BLOQUE 3 - RESULTADO" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Score : $Score/100"
    Write-Host "PASS  : $Pass"
    Write-Host "WARN  : $Warn"
    Write-Host "FAIL  : $Fail"
    Write-Host "JSON  : $JsonPath"
    Write-Host "TXT   : $TxtPath"
    if ($Fail -eq 0) {
        Write-Host "GATE  : PASS - LISTO PARA BLOQUE 3" -ForegroundColor Green
    } else {
        Write-Host "GATE  : FAIL - CORREGIR ANTES DE BLOQUE 3" -ForegroundColor Red
    }
    return $Fail
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " VACODER - SCANNER PRE-BLOQUE 3" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Root : $ProjectRoot"
Write-Host "Mode : $Mode"
Write-Host ""

if (!(Test-Path -LiteralPath $ProjectRoot)) { throw "ProjectRoot no existe." }

# 1. JSON / package
foreach ($JsonFile in @("package.json", "tsconfig.json")) {
    $Full = Join-Path $ProjectRoot $JsonFile
    if (!(Test-Path -LiteralPath $Full)) {
        Add-Finding "JSON" $JsonFile "FAIL" "Falta archivo"
        continue
    }
    try {
        Get-Content -LiteralPath $Full -Raw | ConvertFrom-Json | Out-Null
        Add-Finding "JSON" $JsonFile "PASS" "JSON valido"
    } catch {
        Add-Finding "JSON" $JsonFile "FAIL" $_.Exception.Message
    }
}

try {
    $Pkg = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json
    $Deps = @{}
    if ($Pkg.dependencies) { $Pkg.dependencies.psobject.Properties | ForEach-Object { $Deps[$_.Name] = $_.Value } }
    if ($Pkg.devDependencies) { $Pkg.devDependencies.psobject.Properties | ForEach-Object { $Deps[$_.Name] = $_.Value } }
    foreach ($Dep in @("next", "react", "@supabase/supabase-js", "@supabase/ssr")) {
        if ($Deps.ContainsKey($Dep)) { Add-Finding "Dependencies" $Dep "PASS" $Deps[$Dep] }
        else { Add-Finding "Dependencies" $Dep "FAIL" "Dependencia faltante" }
    }
} catch {
    Add-Finding "Dependencies" "package parse" "FAIL" $_.Exception.Message
}

# 2. Env / secret hygiene
$EnvPath = Join-Path $ProjectRoot ".env.local"
$Env = Read-EnvFile $EnvPath
foreach ($Key in @("NEXT_PUBLIC_SUPABASE_URL")) {
    if ($Env.ContainsKey($Key) -and $Env[$Key]) { Add-Finding "Environment" $Key "PASS" "Configurada" }
    else { Add-Finding "Environment" $Key "FAIL" "Falta variable" }
}
if (($Env.ContainsKey("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") -and $Env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) -or
    ($Env.ContainsKey("NEXT_PUBLIC_SUPABASE_ANON_KEY") -and $Env["NEXT_PUBLIC_SUPABASE_ANON_KEY"])) {
    Add-Finding "Environment" "Supabase public key" "PASS" "Configurada"
} else {
    Add-Finding "Environment" "Supabase public key" "FAIL" "Falta publishable/anon key"
}

$UnsafePublicSecrets = @($Env.Keys | Where-Object { $_ -match '^NEXT_PUBLIC_.*(SERVICE|SECRET|PRIVATE|ADMIN)' })
if ($UnsafePublicSecrets.Count -gt 0) {
    Add-Finding "Security" "NEXT_PUBLIC secret exposure" "FAIL" ($UnsafePublicSecrets -join ", ")
} else {
    Add-Finding "Security" "NEXT_PUBLIC secret exposure" "PASS" "No detectado"
}

if (Test-Path -LiteralPath (Join-Path $ProjectRoot ".git")) {
    $TrackedEnv = & git ls-files ".env*" 2>$null
    if ($TrackedEnv) { Add-Finding "Git" "Tracked .env files" "WARN" ($TrackedEnv -join ", ") }
    else { Add-Finding "Git" "Tracked .env files" "PASS" "Ningun .env rastreado" }
    $Status = & git status --short 2>$null
    if ($Status) { Add-Finding "Git" "Working tree" "WARN" "Hay cambios sin commit" }
    else { Add-Finding "Git" "Working tree" "PASS" "Limpio" }
}

# 3. Bloques 1/2 criticos
$Required = @(
    "lib\supabase\server.ts",
    "lib\live1\auth.ts",
    "lib\control-plane\types.ts",
    "lib\control-plane\bridge.ts",
    "lib\control-plane\project.ts",
    "lib\control-plane\persistence.ts",
    "app\api\control-plane\health\route.ts",
    "app\api\control-plane\projects\[id]\[...action]\route.ts",
    "components\project-control-plane.tsx",
    "app\dashboard\projects\[id]\control\page.tsx",
    "supabase\migrations\20260817_live1_saas_core.sql",
    "supabase\migrations\20260817_live2_control_plane.sql"
)
foreach ($File in $Required) { [void](Test-FileLiteral $File "LIVE1/LIVE2") }

Test-PatternLiteral "lib\control-plane\project.ts" "resolveProject" "Project resolver" | Out-Null
Test-PatternLiteral "lib\control-plane\project.ts" "requireWorkspace" "Workspace resolver" | Out-Null
Test-PatternLiteral "lib\control-plane\persistence.ts" "runtime_sessions" "Runtime persistence" | Out-Null
Test-PatternLiteral "lib\control-plane\persistence.ts" "change_sets" "Change-set persistence" | Out-Null
Test-PatternLiteral "app\api\control-plane\projects\[id]\[...action]\route.ts" "certification" "Control Plane certification" | Out-Null

# 4. Public-danger endpoints (warning until security block)
foreach ($Endpoint in @(
    "app\api\project\run-command\route.ts",
    "app\api\supreme\runtime\command\route.ts"
)) {
    if (Test-Path -LiteralPath (Join-Path $ProjectRoot $Endpoint)) {
        Add-Finding "Security" $Endpoint "WARN" "Shell endpoint local: NO exponer publicamente sin auth/allowlist/worker isolation"
    }
}

# 5. npm audit, informative but explicit
try {
    $AuditRaw = (& npm audit --json 2>$null | Out-String)
    if ($AuditRaw.Trim()) {
        $Audit = $AuditRaw | ConvertFrom-Json
        $V = $Audit.metadata.vulnerabilities
        $High = if ($null -ne $V.high) { [int]$V.high } else { 0 }
        $Critical = if ($null -ne $V.critical) { [int]$V.critical } else { 0 }
        if ($Critical -gt 0) { Add-Finding "Dependencies" "npm audit critical" "FAIL" "$Critical critical" }
        elseif ($High -gt 0) { Add-Finding "Dependencies" "npm audit high" "WARN" "$High high; revisar sin usar --force a ciegas" }
        else { Add-Finding "Dependencies" "npm audit" "PASS" "Sin high/critical" }
    }
} catch {
    Add-Finding "Dependencies" "npm audit" "WARN" "No se pudo interpretar npm audit"
}

# 6. Mode Structural: typecheck/build, nunca competir con next dev
if ($Mode -eq "Structural") {
    $Processes = @(Get-CoderNodeProcesses)
    if ($Processes.Count -gt 0) {
        if ($StopCoderDev) {
            foreach ($P in $Processes) {
                try { Stop-Process -Id $P.ProcessId -Force -ErrorAction Stop } catch {}
            }
            Start-Sleep -Seconds 2
            Add-Finding "Build Safety" "Coder dev process" "PASS" "Procesos Coder detenidos antes de build"
        } else {
            Add-Finding "Build Safety" "Coder dev process" "FAIL" "Hay Node/Next usando Coder. Repite con -StopCoderDev."
        }
    } else {
        Add-Finding "Build Safety" "Coder dev process" "PASS" "No hay proceso compitiendo con .next"
    }

    if (@(Get-CoderNodeProcesses).Count -eq 0) {
        if (Test-Path -LiteralPath ".\.next") {
            Remove-Item -LiteralPath ".\.next" -Recurse -Force
        }
        & npm run typecheck
        if ($LASTEXITCODE -eq 0) { Add-Finding "Compiler" "npm run typecheck" "PASS" "tsc limpio" }
        else { Add-Finding "Compiler" "npm run typecheck" "FAIL" "Exit $LASTEXITCODE" }

        if (@($Findings | Where-Object { $_.Status -eq "FAIL" -and $_.Area -eq "Compiler" }).Count -eq 0) {
            & npm run build
            if ($LASTEXITCODE -eq 0) {
                Add-Finding "Build" "npm run build" "PASS" "Next production build limpio"
                if (Test-Path -LiteralPath ".\.next\routes-manifest.json") {
                    Add-Finding "Build" "routes-manifest.json" "PASS" "Generado"
                } else {
                    Add-Finding "Build" "routes-manifest.json" "FAIL" "No generado"
                }
            } else {
                Add-Finding "Build" "npm run build" "FAIL" "Exit $LASTEXITCODE"
            }
        }
    }
}

# 7. Mode Live: servidor debe estar arriba
if ($Mode -eq "Live") {
    foreach ($Url in @(
        "http://localhost:3000/api/live1/health",
        "http://localhost:3000/api/control-plane/health"
    )) {
        try {
            $R = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 20
            if ($R.configured -eq $true -and $R.schemaReady -eq $true) {
                Add-Finding "Live" $Url "PASS" "configured=true schemaReady=true"
            } else {
                Add-Finding "Live" $Url "FAIL" ("configured={0} schemaReady={1}" -f $R.configured, $R.schemaReady)
            }
        } catch {
            Add-Finding "Live" $Url "FAIL" $_.Exception.Message
        }
    }
    if ($ProjectId) {
        try {
            $Resp = Invoke-WebRequest -Uri "http://localhost:3000/dashboard/projects/$ProjectId/control" -MaximumRedirection 0 -ErrorAction SilentlyContinue -TimeoutSec 20
            if ($Resp.StatusCode -in 200,302,303,307,308) { Add-Finding "Live" "Project Control route" "PASS" "HTTP $($Resp.StatusCode)" }
            else { Add-Finding "Live" "Project Control route" "WARN" "HTTP $($Resp.StatusCode)" }
        } catch {
            Add-Finding "Live" "Project Control route" "WARN" "La ruta requiere sesion web; verifica en navegador"
        }
    }
}

$FailCount = Save-Report
if ($FailCount -gt 0) { exit 2 }
exit 0
