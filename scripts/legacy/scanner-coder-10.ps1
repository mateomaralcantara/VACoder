param(
  [string]$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder",
  [switch]$SkipValidation,
  [switch]$RunApiChecks,
  [switch]$OpenReport
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $Root)) {
  throw "No existe el proyecto Coder en: $Root"
}

$Root = (Resolve-Path $Root).Path
Set-Location $Root

$ScanDir = Join-Path $Root "_scanner-coder-10"
New-Item -ItemType Directory -Force -Path $ScanDir | Out-Null

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$JsonReport = Join-Path $ScanDir "scanner-coder-10-$Stamp.json"
$HtmlReport = Join-Path $ScanDir "scanner-coder-10-$Stamp.html"

$Findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
  param(
    [string]$Section,
    [string]$Item,
    [string]$Status,
    [double]$Points,
    [double]$Max,
    [string]$Details
  )

  $Findings.Add([PSCustomObject]@{
    Section = $Section
    Item = $Item
    Status = $Status
    Points = $Points
    Max = $Max
    Details = $Details
  }) | Out-Null
}

function Convert-ToHtmlSafe {
  param([object]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function Test-File {
  param(
    [string]$RelativePath,
    [string]$Section,
    [string]$Item,
    [double]$Points
  )

  $Full = Join-Path $Root $RelativePath

  if (Test-Path $Full) {
    Add-Finding $Section $Item "OK" $Points $Points $RelativePath
  } else {
    Add-Finding $Section $Item "FAIL" 0 $Points "Falta: $RelativePath"
  }
}

function Get-Text {
  param([string]$RelativePath)

  $Full = Join-Path $Root $RelativePath

  if (!(Test-Path $Full)) {
    return ""
  }

  return Get-Content $Full -Raw -ErrorAction SilentlyContinue
}

function Test-Pattern {
  param(
    [string]$RelativePath,
    [string]$Pattern,
    [string]$Section,
    [string]$Item,
    [double]$Points
  )

  $Text = Get-Text $RelativePath

  if ($Text -match $Pattern) {
    Add-Finding $Section $Item "OK" $Points $Points "$RelativePath contiene $Pattern"
  } else {
    Add-Finding $Section $Item "FAIL" 0 $Points "$RelativePath no contiene $Pattern"
  }
}

function Get-CodeFiles {
  Get-ChildItem $Root -Recurse -File |
    Where-Object {
      $_.FullName -notmatch "\\node_modules\\" -and
      $_.FullName -notmatch "\\.next\\" -and
      $_.FullName -notmatch "\\.git\\" -and
      $_.FullName -notmatch "\\dist\\" -and
      $_.FullName -notmatch "\\build\\" -and
      $_.FullName -notmatch "\\coverage\\" -and
      $_.FullName -notmatch "\\_backup" -and
      $_.FullName -notmatch "\\_scanner-coder-10\\" -and
      $_.Extension -in @(".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".md", ".ps1")
    }
}

function Run-Cmd {
  param(
    [string]$Command,
    [int]$TimeoutSeconds = 240
  )

  $TempOut = Join-Path $env:TEMP ("coder-scan-out-" + [guid]::NewGuid() + ".txt")
  $TempErr = Join-Path $env:TEMP ("coder-scan-err-" + [guid]::NewGuid() + ".txt")

  $Process = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c $Command" `
    -WorkingDirectory $Root `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput $TempOut `
    -RedirectStandardError $TempErr

  $Exited = $Process.WaitForExit($TimeoutSeconds * 1000)

  if (!$Exited) {
    try {
      $Process.Kill()
    } catch {}

    return [PSCustomObject]@{
      Command = $Command
      ExitCode = 124
      Stdout = if (Test-Path $TempOut) { Get-Content $TempOut -Raw } else { "" }
      Stderr = "TIMEOUT despues de $TimeoutSeconds segundos."
    }
  }

  return [PSCustomObject]@{
    Command = $Command
    ExitCode = $Process.ExitCode
    Stdout = if (Test-Path $TempOut) { Get-Content $TempOut -Raw } else { "" }
    Stderr = if (Test-Path $TempErr) { Get-Content $TempErr -Raw } else { "" }
  }
}

function Test-CommandLooksSuccessful {
  param(
    [object]$Result,
    [string]$Kind
  )

  $Text = (($Result.Stdout + "`n" + $Result.Stderr) -as [string])

  if ($Result.ExitCode -eq 0) {
    return $true
  }

  if ($Text -match "error TS\d+") {
    return $false
  }

  if ($Text -match "Failed to compile") {
    return $false
  }

  if ($Text -match "Build error occurred") {
    return $false
  }

  if ($Text -match "Module not found") {
    return $false
  }

  if ($Text -match "Type error:") {
    return $false
  }

  if ($Kind -eq "typecheck") {
    if ($Text -match "tsc --noEmit" -and $Text -notmatch "error TS\d+") {
      return $true
    }
  }

  if ($Kind -eq "build") {
    if (
      $Text -match "Compiled successfully" -and
      $Text -match "Generating static pages" -and
      $Text -match "Finalizing page optimization"
    ) {
      return $true
    }
  }

  return $false
}

Write-Host ""
Write-Host "=== SCANNER CODER 10/10 ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host ""

# ============================================================
# 1. Package / scripts
# ============================================================

$PackagePath = Join-Path $Root "package.json"

if (Test-Path $PackagePath) {
  try {
    $Package = Get-Content $PackagePath -Raw | ConvertFrom-Json

    Add-Finding "Package" "package.json existe" "OK" 2 2 "package.json encontrado."

    if ($Package.scripts.dev) {
      Add-Finding "Package" "script dev" "OK" 1 1 "npm run dev existe."
    } else {
      Add-Finding "Package" "script dev" "FAIL" 0 1 "Falta script dev."
    }

    if ($Package.scripts.typecheck) {
      Add-Finding "Package" "script typecheck" "OK" 2 2 "npm run typecheck existe."
    } else {
      Add-Finding "Package" "script typecheck" "FAIL" 0 2 "Falta script typecheck."
    }

    if ($Package.scripts.build) {
      Add-Finding "Package" "script build" "OK" 2 2 "npm run build existe."
    } else {
      Add-Finding "Package" "script build" "FAIL" 0 2 "Falta script build."
    }

    $DepsText = Get-Content $PackagePath -Raw

    if ($DepsText -match '"next"') {
      Add-Finding "Package" "Next.js dependency" "OK" 1 1 "Next detectado."
    } else {
      Add-Finding "Package" "Next.js dependency" "FAIL" 0 1 "No aparece next."
    }

    if ($DepsText -match '"typescript"') {
      Add-Finding "Package" "TypeScript dependency" "OK" 1 1 "TypeScript detectado."
    } else {
      Add-Finding "Package" "TypeScript dependency" "FAIL" 0 1 "No aparece typescript."
    }

    if ($DepsText -match '"react"') {
      Add-Finding "Package" "React dependency" "OK" 1 1 "React detectado."
    } else {
      Add-Finding "Package" "React dependency" "FAIL" 0 1 "No aparece react."
    }
  } catch {
    Add-Finding "Package" "package.json valido" "FAIL" 0 10 "package.json no se pudo leer."
  }
} else {
  Add-Finding "Package" "package.json existe" "FAIL" 0 10 "Falta package.json."
}

# ============================================================
# 2. Rutas API criticas
# ============================================================

Test-File "app\api\agent\stream\route.ts" "API Routes" "Agent Stream" 2
Test-File "app\api\project\builder\create\route.ts" "API Routes" "Builder Create" 2
Test-File "app\api\project\builder\preview\route.ts" "API Routes" "Builder Preview" 2
Test-File "app\api\project\production\status\route.ts" "API Routes" "Production Status" 3
Test-File "app\api\project\patch\apply\route.ts" "API Routes" "Patch Apply" 4
Test-File "app\api\project\scan\route.ts" "API Routes" "Project Scan" 3
Test-File "app\api\project\snapshot\route.ts" "API Routes" "Snapshot" 3
Test-File "app\api\project\diff\route.ts" "API Routes" "Diff" 3
Test-File "app\api\project\validate\route.ts" "API Routes" "Validate" 3
Test-File "app\api\project\rollback\route.ts" "API Routes" "Rollback" 3
Test-File "app\not-found.tsx" "API Routes" "Not Found page" 1

# ============================================================
# 3. Core Agent OS
# ============================================================

Test-File "lib\vacoder\core.ts" "Core" "VACoder Core" 5

Test-Pattern "lib\vacoder\core.ts" "assertSafeProjectPath" "Core" "Proteccion de ruta absoluta" 3
Test-Pattern "lib\vacoder\core.ts" "assertSafeRelativePath" "Core" "Proteccion de ruta relativa" 3
Test-Pattern "lib\vacoder\core.ts" "snapshotProject" "Core" "Snapshot de proyecto" 3
Test-Pattern "lib\vacoder\core.ts" "diffSnapshots" "Core" "Diff de snapshots" 3
Test-Pattern "lib\vacoder\core.ts" "createBackup" "Core" "Backup automatico" 3
Test-Pattern "lib\vacoder\core.ts" "rollbackBackup" "Core" "Rollback automatico" 3
Test-Pattern "lib\vacoder\core.ts" "validateProject" "Core" "Validador typecheck/build" 3
Test-Pattern "lib\vacoder\core.ts" "runCommand" "Core" "Ejecucion de comandos" 2
Test-Pattern "lib\vacoder\core.ts" "writeProjectFile" "Core" "Escritura real de archivos" 3
Test-Pattern "lib\vacoder\core.ts" "deleteProjectFile" "Core" "Eliminacion controlada" 2
Test-Pattern "lib\vacoder\core.ts" "timeoutMs|timedOut|TIMEOUT" "Core" "Timeout de comandos" 2

# ============================================================
# 4. Patch Agent
# ============================================================

Test-Pattern "app\api\project\patch\apply\route.ts" "createBackup" "Patch Agent" "Crea backup antes de modificar" 3
Test-Pattern "app\api\project\patch\apply\route.ts" "rollbackBackup" "Patch Agent" "Rollback si falla validacion" 3
Test-Pattern "app\api\project\patch\apply\route.ts" "validateProject" "Patch Agent" "Valida despues de modificar" 3
Test-Pattern "app\api\project\patch\apply\route.ts" "writeProjectFile" "Patch Agent" "Escribe archivo real" 3
Test-Pattern "app\api\project\patch\apply\route.ts" "normalizeOperations" "Patch Agent" "Normaliza operaciones" 2
Test-Pattern "app\api\project\patch\apply\route.ts" "files" "Patch Agent" "Soporta files[] directos" 2
Test-Pattern "app\api\project\patch\apply\route.ts" "promptRequestsBookReading" "Patch Agent" "Receta por prompt" 1

# ============================================================
# 5. Production Gate / UI
# ============================================================

Test-File "components\production-run-panel.tsx" "UI" "Production Run Panel" 3
Test-File "components\workspace.tsx" "UI" "Workspace principal" 3
Test-File "lib\production-client.ts" "Production" "Production Client" 2
Test-File "lib\production\types.ts" "Production" "Production Types" 2

Test-Pattern "components\production-run-panel.tsx" "normalizeStatus" "UI" "Status seguro / events fallback" 3
Test-Pattern "components\production-run-panel.tsx" "safeStatus" "UI" "Uso de safeStatus" 2
Test-Pattern "components\production-run-panel.tsx" "status.events|safeStatus.events" "UI" "Timeline de eventos" 1

# ============================================================
# 6. Seguridad
# ============================================================

$AllCode = @(Get-CodeFiles)
$RiskyMatches = New-Object System.Collections.Generic.List[object]

foreach ($File in $AllCode) {
  $Text = Get-Content $File.FullName -Raw -ErrorAction SilentlyContinue

  if (!$Text) {
    continue
  }

  $Rel = $File.FullName.Substring($Root.Length).TrimStart("\", "/")

  if ($Rel -like "scripts\scanner-coder-10*.ps1") {
    continue
  }

  if ($Text -match "eval\s*\(") {
    $RiskyMatches.Add([PSCustomObject]@{ File = $Rel; Risk = "eval()" }) | Out-Null
  }

  if ($Text -match "new\s+Function\s*\(") {
    $RiskyMatches.Add([PSCustomObject]@{ File = $Rel; Risk = "new Function()" }) | Out-Null
  }

  if ($Text -match "dangerouslySetInnerHTML") {
    $RiskyMatches.Add([PSCustomObject]@{ File = $Rel; Risk = "dangerouslySetInnerHTML" }) | Out-Null
  }

  if ($File.Extension -ne ".css" -and $Text -match "AIza|sk-[a-zA-Z0-9]{20,}|paypal_[a-zA-Z0-9]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=") {
    $RiskyMatches.Add([PSCustomObject]@{ File = $Rel; Risk = "posible secreto hardcodeado" }) | Out-Null
  }
}

if ($RiskyMatches.Count -eq 0) {
  Add-Finding "Security" "Patrones peligrosos" "OK" 8 8 "No se detectaron eval, new Function, dangerouslySetInnerHTML ni secretos obvios."
} else {
  Add-Finding "Security" "Patrones peligrosos" "WARN" 2 8 (($RiskyMatches | Select-Object -First 10 | ConvertTo-Json -Compress))
}

Test-Pattern "lib\vacoder\core.ts" "APPS_ROOT" "Security" "Raiz permitida APPS_ROOT" 2
Test-Pattern "lib\vacoder\core.ts" "SKIP_DIRS" "Security" "Ignora carpetas peligrosas" 2
Test-Pattern "lib\vacoder\core.ts" "node_modules|\.next|\.git" "Security" "No escanea basura pesada" 2

# ============================================================
# 7. Validacion real
# ============================================================

if ($SkipValidation) {
  Add-Finding "Validation" "typecheck" "SKIP" 0 0 "Omitido por -SkipValidation."
  Add-Finding "Validation" "build" "SKIP" 0 0 "Omitido por -SkipValidation."
} else {
  Write-Host "Ejecutando npm run typecheck..." -ForegroundColor Cyan
  $Typecheck = Run-Cmd "npm run typecheck" 300
  $TypecheckText = (($Typecheck.Stdout + "`n" + $Typecheck.Stderr).Trim())

  if (Test-CommandLooksSuccessful $Typecheck "typecheck") {
    Add-Finding "Validation" "npm run typecheck" "OK" 8 8 "Typecheck paso correctamente."
  } else {
    Add-Finding "Validation" "npm run typecheck" "FAIL" 0 8 $TypecheckText
  }

  Write-Host "Ejecutando npm run build..." -ForegroundColor Cyan
  $Build = Run-Cmd "npm run build" 480
  $BuildText = (($Build.Stdout + "`n" + $Build.Stderr).Trim())

  if (Test-CommandLooksSuccessful $Build "build") {
    Add-Finding "Validation" "npm run build" "OK" 12 12 "Build paso correctamente."
  } else {
    Add-Finding "Validation" "npm run build" "FAIL" 0 12 $BuildText
  }
}
# ============================================================
# 8. API checks opcionales
# ============================================================

if ($RunApiChecks) {
  $Endpoints = @(
    "http://localhost:3000/api/project/production/status",
    "http://localhost:3000/api/project/scan",
    "http://localhost:3000/api/project/snapshot",
    "http://localhost:3000/api/project/diff",
    "http://localhost:3000/api/project/validate",
    "http://localhost:3000/api/project/rollback",
    "http://localhost:3000/api/project/patch/apply",
    "http://localhost:3000/api/agent/stream"
  )

  foreach ($Endpoint in $Endpoints) {
    try {
      $Response = Invoke-WebRequest -Uri $Endpoint -UseBasicParsing -TimeoutSec 5

      if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500) {
        Add-Finding "Live API" $Endpoint "OK" 0.5 0.5 "HTTP $($Response.StatusCode)"
      } else {
        Add-Finding "Live API" $Endpoint "WARN" 0 0.5 "HTTP $($Response.StatusCode)"
      }
    } catch {
      Add-Finding "Live API" $Endpoint "FAIL" 0 0.5 $_.Exception.Message
    }
  }
} else {
  Add-Finding "Live API" "Checks localhost" "SKIP" 0 0 "Usa -RunApiChecks si Coder esta corriendo en localhost:3000."
}

# ============================================================
# 9. Calculo final
# ============================================================

$MaxPoints = ($Findings | Measure-Object -Property Max -Sum).Sum
$EarnedPoints = ($Findings | Measure-Object -Property Points -Sum).Sum

if ($null -eq $MaxPoints -or $MaxPoints -le 0) {
  $Score100 = 0
} else {
  $Score100 = [math]::Round(($EarnedPoints / $MaxPoints) * 100, 2)
}

$Score10 = [math]::Round($Score100 / 10, 1)

$Fails = @($Findings | Where-Object { $_.Status -eq "FAIL" })
$Warns = @($Findings | Where-Object { $_.Status -eq "WARN" })

$Grade = if ($Score10 -ge 9.5) {
  "10/10 casi premium"
} elseif ($Score10 -ge 9.0) {
  "9/10 competidor serio"
} elseif ($Score10 -ge 8.0) {
  "8/10 vendible con mejoras"
} elseif ($Score10 -ge 7.0) {
  "7/10 funcional avanzado"
} elseif ($Score10 -ge 6.0) {
  "6/10 funcional basico"
} elseif ($Score10 -ge 5.0) {
  "5/10 inestable"
} else {
  "menor de 5/10 roto o incompleto"
}

$Recommendations = New-Object System.Collections.Generic.List[string]

foreach ($Fail in ($Fails | Select-Object -First 12)) {
  $Recommendations.Add("Corregir: [$($Fail.Section)] $($Fail.Item) - $($Fail.Details)") | Out-Null
}

if ($Fails.Count -eq 0 -and $Warns.Count -eq 0) {
  $Recommendations.Add("No hay fallas criticas. Proxima fase: IA real multiarchivo, diff visual, aprobacion UI, Git commit y deploy.") | Out-Null
}

if ($Fails.Count -eq 0 -and $Warns.Count -gt 0) {
  foreach ($Warn in ($Warns | Select-Object -First 6)) {
    $Recommendations.Add("Revisar advertencia: [$($Warn.Section)] $($Warn.Item)") | Out-Null
  }
}

$Report = [PSCustomObject]@{
  Project = "VACoder Agent OS / Coder"
  Root = $Root
  GeneratedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  Score10 = $Score10
  Score100 = $Score100
  EarnedPoints = $EarnedPoints
  MaxPoints = $MaxPoints
  Grade = $Grade
  FailCount = $Fails.Count
  WarnCount = $Warns.Count
  Findings = $Findings
  Recommendations = $Recommendations
}

$Report | ConvertTo-Json -Depth 20 | Set-Content $JsonReport -Encoding UTF8

# ============================================================
# 10. HTML report
# ============================================================

$Rows = ""

foreach ($Finding in $Findings) {
  $Color = if ($Finding.Status -eq "OK") {
    "#047857"
  } elseif ($Finding.Status -eq "WARN") {
    "#B45309"
  } elseif ($Finding.Status -eq "SKIP") {
    "#6B7280"
  } else {
    "#B91C1C"
  }

  $FindingSection = Convert-ToHtmlSafe $Finding.Section
  $FindingItem = Convert-ToHtmlSafe $Finding.Item
  $FindingStatus = Convert-ToHtmlSafe $Finding.Status
  $FindingDetails = Convert-ToHtmlSafe $Finding.Details

  $Rows += @"
<tr>
  <td>$FindingSection</td>
  <td>$FindingItem</td>
  <td style="font-weight:800;color:$Color;">$FindingStatus</td>
  <td>$($Finding.Points) / $($Finding.Max)</td>
  <td><pre>$FindingDetails</pre></td>
</tr>
"@
}

$RecHtml = ""

foreach ($Rec in $Recommendations) {
  $SafeRec = Convert-ToHtmlSafe $Rec
  $RecHtml += "<li>$SafeRec</li>`n"
}

$SafeRoot = Convert-ToHtmlSafe $Root
$SafeDate = Convert-ToHtmlSafe $Report.GeneratedAt
$SafeGrade = Convert-ToHtmlSafe $Grade

$Html = @"
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Scanner Coder 10/10</title>
<style>
body {
  font-family: Arial, sans-serif;
  background: #f5f7fa;
  color: #111827;
  padding: 28px;
}
.card {
  background: white;
  border-radius: 18px;
  padding: 22px;
  margin-bottom: 18px;
  box-shadow: 0 12px 35px rgba(15,23,42,.08);
}
.score {
  font-size: 64px;
  line-height: 1;
  font-weight: 900;
  color: #0B1F3A;
}
.badge {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(215, 38, 56, .12);
  color: #D72638;
  font-weight: 900;
}
table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}
th {
  background: #0B1F3A;
  color: white;
  text-align: left;
  padding: 10px;
}
td {
  border-bottom: 1px solid #e5e7eb;
  padding: 10px;
  vertical-align: top;
}
pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  font-family: Consolas, monospace;
  font-size: 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}
.metric {
  background: #f8fafc;
  border-radius: 14px;
  padding: 14px;
}
.metric span {
  color: #6b7280;
  display: block;
  margin-bottom: 6px;
}
.metric strong {
  font-size: 24px;
}
</style>
</head>
<body>

<div class="card">
  <span class="badge">VACoder Agent OS</span>
  <h1>Scanner Coder 10/10</h1>
  <p><strong>Proyecto:</strong> $SafeRoot</p>
  <p><strong>Fecha:</strong> $SafeDate</p>
</div>

<div class="card">
  <div class="score">$Score10 / 10</div>
  <h2>$SafeGrade</h2>

  <div class="grid">
    <div class="metric">
      <span>Puntos</span>
      <strong>$EarnedPoints / $MaxPoints</strong>
    </div>
    <div class="metric">
      <span>Porcentaje</span>
      <strong>$Score100%</strong>
    </div>
    <div class="metric">
      <span>Fallas</span>
      <strong>$($Fails.Count)</strong>
    </div>
    <div class="metric">
      <span>Warnings</span>
      <strong>$($Warns.Count)</strong>
    </div>
  </div>
</div>

<div class="card">
  <h2>Recomendaciones</h2>
  <ul>
    $RecHtml
  </ul>
</div>

<div class="card">
  <h2>Detalle tecnico</h2>
  <table>
    <thead>
      <tr>
        <th>Seccion</th>
        <th>Item</th>
        <th>Estado</th>
        <th>Puntos</th>
        <th>Detalles</th>
      </tr>
    </thead>
    <tbody>
      $Rows
    </tbody>
  </table>
</div>

</body>
</html>
"@

Set-Content -Path $HtmlReport -Value $Html -Encoding UTF8

Write-Host ""
Write-Host "=== RESULTADO SCANNER CODER ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Puntuacion: $Score10 / 10" -ForegroundColor Green
Write-Host "Porcentaje: $Score100%"
Write-Host "Grado: $Grade"
Write-Host "Fallas: $($Fails.Count)"
Write-Host "Warnings: $($Warns.Count)"
Write-Host ""
Write-Host "Reporte JSON: $JsonReport"
Write-Host "Reporte HTML: $HtmlReport"
Write-Host ""

if ($Recommendations.Count -gt 0) {
  Write-Host "Recomendaciones principales:" -ForegroundColor Yellow

  foreach ($Rec in ($Recommendations | Select-Object -First 8)) {
    Write-Host "- $Rec"
  }

  Write-Host ""
}

if ($OpenReport) {
  Start-Process $HtmlReport
}
