# Ruta:
# C:\Users\martin\Desktop\VSC\BestS\Coder\scripts\visualizar-cambios-app.ps1

param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [ValidateSet("before", "after", "check")]
  [string]$Mode = "check",

  [switch]$OpenReport
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $ProjectPath)) {
  throw "No existe la carpeta del proyecto: $ProjectPath"
}

$ProjectPath = (Resolve-Path $ProjectPath).Path
$auditDir = Join-Path $ProjectPath ".vacoder-audit"
$snapshotFile = Join-Path $auditDir "snapshot-before.json"
$reportFile = Join-Path $auditDir "report.html"

New-Item -ItemType Directory -Force -Path $auditDir | Out-Null

$extensions = @(".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md")
$ignorePattern = "\\(node_modules|\.next|\.git|\.vacoder-audit|dist|build)\\"

function Get-RelativePath {
  param([string]$FullName)

  return $FullName.Substring($ProjectPath.Length).TrimStart("\", "/")
}

function Get-ProjectFiles {
  Get-ChildItem -Path $ProjectPath -Recurse -File |
    Where-Object {
      $_.FullName -notmatch $ignorePattern -and
      $extensions -contains $_.Extension
    }
}

function New-Snapshot {
  $files = Get-ProjectFiles

  $snapshot = foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash

    [PSCustomObject]@{
      Path = Get-RelativePath $file.FullName
      Hash = $hash
      Size = $file.Length
      Lines = if ($null -eq $content) { 0 } else { ($content -split "`r?`n").Count }
      ModifiedAt = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    }
  }

  return @($snapshot)
}

function Find-Markers {
  $patterns = [ordered]@{
    "Boton Iniciar lectura" = "Iniciar lectura"
    "Web Speech API" = "speechSynthesis|SpeechSynthesisUtterance"
    "Boton detener lectura" = "Detener|Parar lectura"
    "Boton pagar lectura completa" = "Pagar lectura completa|desbloquear"
    "Carga de libros" = "type=`"file`"|accept=.*pdf|epub|docx|BookUpload"
    "Checkout mock" = "checkout|Stripe|PayPal|mock"
  }

  $results = @()
  $files = Get-ProjectFiles | Where-Object {
    $_.Extension -in @(".ts", ".tsx", ".js", ".jsx", ".css")
  }

  foreach ($label in $patterns.Keys) {
    $pattern = $patterns[$label]

    foreach ($file in $files) {
      $matches = Select-String -Path $file.FullName -Pattern $pattern -AllMatches -ErrorAction SilentlyContinue

      foreach ($match in $matches) {
        $results += [PSCustomObject]@{
          Marker = $label
          File = Get-RelativePath $file.FullName
          Line = $match.LineNumber
          Text = $match.Line.Trim()
        }
      }
    }
  }

  return @($results)
}

function Compare-Snapshots {
  param(
    [array]$Before,
    [array]$After
  )

  $beforeMap = @{}
  $afterMap = @{}

  foreach ($item in $Before) {
    $beforeMap[$item.Path] = $item
  }

  foreach ($item in $After) {
    $afterMap[$item.Path] = $item
  }

  $added = @()
  $removed = @()
  $changed = @()

  foreach ($path in $afterMap.Keys) {
    if (!$beforeMap.ContainsKey($path)) {
      $added += $afterMap[$path]
    } elseif ($beforeMap[$path].Hash -ne $afterMap[$path].Hash) {
      $changed += [PSCustomObject]@{
        Path = $path
        BeforeLines = $beforeMap[$path].Lines
        AfterLines = $afterMap[$path].Lines
        BeforeModifiedAt = $beforeMap[$path].ModifiedAt
        AfterModifiedAt = $afterMap[$path].ModifiedAt
      }
    }
  }

  foreach ($path in $beforeMap.Keys) {
    if (!$afterMap.ContainsKey($path)) {
      $removed += $beforeMap[$path]
    }
  }

  return [PSCustomObject]@{
    Added = @($added)
    Changed = @($changed)
    Removed = @($removed)
  }
}

function H {
  param([string]$Text)
  return [System.Net.WebUtility]::HtmlEncode($Text)
}

function New-HtmlReport {
  param(
    [object]$Diff,
    [array]$Markers
  )

  $changedCount = if ($null -eq $Diff) { 0 } else { $Diff.Changed.Count }
  $addedCount = if ($null -eq $Diff) { 0 } else { $Diff.Added.Count }
  $removedCount = if ($null -eq $Diff) { 0 } else { $Diff.Removed.Count }

  $html = @"
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>VACoder Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f7fa; color: #111827; padding: 32px; }
    .card { background: white; border-radius: 18px; padding: 24px; margin-bottom: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.08); }
    h1, h2 { color: #0B1F3A; }
    .ok { color: #047857; font-weight: bold; }
    .bad { color: #B91C1C; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #0B1F3A; color: white; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>VACoder Audit Report</h1>

  <div class="card">
    <h2>Proyecto</h2>
    <p><code>$(H $ProjectPath)</code></p>
    <p>Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")</p>
  </div>

  <div class="card">
    <h2>Resumen de cambios</h2>
    <p>Archivos agregados: <strong>$addedCount</strong></p>
    <p>Archivos modificados: <strong>$changedCount</strong></p>
    <p>Archivos eliminados: <strong>$removedCount</strong></p>
  </div>
"@

  if ($null -ne $Diff) {
    $html += "<div class='card'><h2>Archivos modificados</h2><table><tr><th>Archivo</th><th>Líneas antes</th><th>Líneas después</th><th>Modificado</th></tr>"

    foreach ($item in $Diff.Changed) {
      $html += "<tr><td><code>$(H $item.Path)</code></td><td>$($item.BeforeLines)</td><td>$($item.AfterLines)</td><td>$(H $item.AfterModifiedAt)</td></tr>"
    }

    foreach ($item in $Diff.Added) {
      $html += "<tr><td><code>$(H $item.Path)</code></td><td>Nuevo</td><td>$($item.Lines)</td><td>$(H $item.ModifiedAt)</td></tr>"
    }

    $html += "</table></div>"
  }

  $html += "<div class='card'><h2>Marcadores encontrados</h2>"

  if ($Markers.Count -eq 0) {
    $html += "<p class='bad'>No se encontró Iniciar lectura, speechSynthesis, carga de libros ni checkout mock.</p>"
  } else {
    $html += "<table><tr><th>Marcador</th><th>Archivo</th><th>Línea</th><th>Texto</th></tr>"

    foreach ($marker in $Markers) {
      $html += "<tr><td>$(H $marker.Marker)</td><td><code>$(H $marker.File)</code></td><td>$($marker.Line)</td><td>$(H $marker.Text)</td></tr>"
    }

    $html += "</table>"
  }

  $html += "</div></body></html>"

  Set-Content -Path $reportFile -Value $html -Encoding UTF8
}

if ($Mode -eq "before") {
  $snapshot = New-Snapshot
  $snapshot | ConvertTo-Json -Depth 5 | Set-Content -Path $snapshotFile -Encoding UTF8

  Write-Host ""
  Write-Host "Snapshot guardado antes del cambio." -ForegroundColor Green
  Write-Host "Archivos monitoreados: $($snapshot.Count)"
  Write-Host "Ahora aplica el prompt en VACoder. Luego ejecuta Mode after."
  Write-Host ""

  exit
}

if ($Mode -eq "after") {
  if (!(Test-Path $snapshotFile)) {
    throw "No existe snapshot previo. Primero ejecuta -Mode before."
  }

  $before = Get-Content $snapshotFile -Raw | ConvertFrom-Json
  $after = New-Snapshot
  $diff = Compare-Snapshots -Before @($before) -After @($after)
  $markers = Find-Markers

  New-HtmlReport -Diff $diff -Markers $markers

  Write-Host ""
  Write-Host "Resultado de auditoría:" -ForegroundColor Cyan
  Write-Host "Archivos agregados: $($diff.Added.Count)"
  Write-Host "Archivos modificados: $($diff.Changed.Count)"
  Write-Host "Archivos eliminados: $($diff.Removed.Count)"
  Write-Host "Marcadores encontrados: $($markers.Count)"
  Write-Host ""

  if ($diff.Added.Count -eq 0 -and $diff.Changed.Count -eq 0 -and $diff.Removed.Count -eq 0) {
    Write-Host "VACoder NO escribió cambios en disco." -ForegroundColor Red
  } else {
    Write-Host "VACoder sí modificó archivos." -ForegroundColor Green
  }

  if ($markers.Count -eq 0) {
    Write-Host "No apareció la función Iniciar lectura." -ForegroundColor Red
  } else {
    Write-Host "Se encontraron rastros de lectura/pago/carga." -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "Reporte HTML:"
  Write-Host $reportFile
  Write-Host ""

  if ($OpenReport) {
    Start-Process $reportFile
  }

  exit
}

if ($Mode -eq "check") {
  $snapshot = New-Snapshot
  $markers = Find-Markers

  New-HtmlReport -Diff $null -Markers $markers

  Write-Host ""
  Write-Host "Chequeo actual del proyecto:" -ForegroundColor Cyan
  Write-Host "Archivos revisados: $($snapshot.Count)"
  Write-Host "Marcadores encontrados: $($markers.Count)"
  Write-Host "Reporte HTML: $reportFile"
  Write-Host ""

  if ($OpenReport) {
    Start-Process $reportFile
  }

  exit
}