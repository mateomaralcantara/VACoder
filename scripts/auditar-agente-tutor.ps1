# scripts/auditar-agente-tutor.ps1
# Auditoría estructural para el sistema "Agente Tutor IDE"
# Ejecutar desde la raíz del proyecto:
# powershell -ExecutionPolicy Bypass -File .\scripts\auditar-agente-tutor.ps1

param(
  [string]$Root = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path $Root).Path
$ReportPath = Join-Path $ProjectRoot "audit-agente-tutor.md"

$Issues = New-Object System.Collections.Generic.List[object]
$Ok = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]
$Suggestions = New-Object System.Collections.Generic.List[string]
$Lines = New-Object System.Collections.Generic.List[string]

function Add-Ok {
  param([string]$Message)
  [void]$Ok.Add($Message)
}

function Add-Warning {
  param([string]$Message)
  [void]$Warnings.Add($Message)
}

function Add-Issue {
  param(
    [string]$Level,
    [string]$Area,
    [string]$Message,
    [string]$Fix
  )

  [void]$Issues.Add([PSCustomObject]@{
    Level = $Level
    Area = $Area
    Message = $Message
    Fix = $Fix
  })
}

function Add-Suggestion {
  param([string]$Message)
  [void]$Suggestions.Add($Message)
}

function Add-Line {
  param([string]$Text = "")
  [void]$Lines.Add($Text)
}

function Get-Text {
  param([string]$RelativePath)

  $FullPath = Join-Path $ProjectRoot $RelativePath

  if (!(Test-Path -LiteralPath $FullPath)) {
    return $null
  }

  return Get-Content -LiteralPath $FullPath -Raw -Encoding UTF8
}

function Test-RequiredFile {
  param(
    [string]$RelativePath,
    [string]$Area,
    [string]$Fix
  )

  $FullPath = Join-Path $ProjectRoot $RelativePath

  if (Test-Path -LiteralPath $FullPath) {
    Add-Ok "Existe: $RelativePath"
    return $true
  }

  Add-Issue "ERROR" $Area "No existe el archivo requerido: $RelativePath" $Fix
  return $false
}

function Test-ContainsText {
  param(
    [string]$RelativePath,
    [string]$Needle,
    [string]$Area,
    [string]$Problem,
    [string]$Fix
  )

  $Content = Get-Text $RelativePath

  if ($null -eq $Content) {
    return
  }

  if ($Content.Contains($Needle)) {
    Add-Ok "$RelativePath contiene: $Needle"
  } else {
    Add-Issue "WARNING" $Area $Problem $Fix
  }
}

function Has-Property {
  param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $false
  }

  return $Object.PSObject.Properties.Name -contains $Name
}

function Test-PackageDependency {
  param(
    [object]$PackageJson,
    [string]$Name
  )

  $Found = $false

  if ((Has-Property $PackageJson "dependencies") -and $null -ne $PackageJson.dependencies) {
    if ($PackageJson.dependencies.PSObject.Properties.Name -contains $Name) {
      $Found = $true
    }
  }

  if ((Has-Property $PackageJson "devDependencies") -and $null -ne $PackageJson.devDependencies) {
    if ($PackageJson.devDependencies.PSObject.Properties.Name -contains $Name) {
      $Found = $true
    }
  }

  if ($Found) {
    Add-Ok "Dependencia encontrada: $Name"
  } else {
    Add-Issue "ERROR" "Dependencias" "Falta la dependencia: $Name" "Ejecuta npm install $Name"
  }
}

function Get-AllCodeFiles {
  $Files = @()
  $Extensions = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.mjs", "*.cjs")

  foreach ($Extension in $Extensions) {
    $Files += Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Filter $Extension -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -notmatch "\\node_modules\\" -and
        $_.FullName -notmatch "\\.next\\" -and
        $_.FullName -notmatch "\\dist\\" -and
        $_.FullName -notmatch "\\build\\"
      }
  }

  return $Files
}

function Resolve-AliasImport {
  param([string]$ImportPath)

  if ($ImportPath -notlike "@/*") {
    return $null
  }

  $WithoutAlias = $ImportPath.Substring(2)

  $Candidates = @(
    "$WithoutAlias.ts",
    "$WithoutAlias.tsx",
    "$WithoutAlias.js",
    "$WithoutAlias.jsx",
    "$WithoutAlias.mjs",
    "$WithoutAlias/index.ts",
    "$WithoutAlias/index.tsx",
    "$WithoutAlias/index.js",
    "$WithoutAlias/index.jsx"
  )

  foreach ($Candidate in $Candidates) {
    $FullPath = Join-Path $ProjectRoot $Candidate

    if (Test-Path -LiteralPath $FullPath) {
      return $Candidate
    }
  }

  return $null
}

function Test-NpmScripts {
  param([object]$PackageJson)

  if (!(Has-Property $PackageJson "scripts")) {
    Add-Issue "ERROR" "package.json" "No existe la sección scripts en package.json." "Agrega scripts dev y build."
    return
  }

  $Scripts = $PackageJson.scripts

  foreach ($ScriptName in @("dev", "build")) {
    if ($Scripts.PSObject.Properties.Name -contains $ScriptName) {
      Add-Ok "Script npm encontrado: $ScriptName"
    } else {
      Add-Issue "ERROR" "package.json" "Falta el script npm: $ScriptName" "Agrega el script $ScriptName en package.json."
    }
  }

  if ($Scripts.PSObject.Properties.Name -contains "lint") {
    Add-Ok "Script npm encontrado: lint"
  } else {
    Add-Warning "No hay script lint. No bloquea el arranque, pero conviene agregarlo."
  }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " AUDITORIA: AGENTE TUTOR IDE" -ForegroundColor Cyan
Write-Host " Proyecto: $ProjectRoot" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$RequiredFiles = @(
  @{
    Path = "package.json"
    Area = "Proyecto"
    Fix = "Crea package.json o verifica que estas en la raiz correcta del proyecto."
  },
  @{
    Path = "tsconfig.json"
    Area = "TypeScript"
    Fix = "Crea tsconfig.json y configura baseUrl y paths para @/*."
  },
  @{
    Path = "app/layout.tsx"
    Area = "Next App Router"
    Fix = "Mueve layout.tsx a app/layout.tsx."
  },
  @{
    Path = "app/page.tsx"
    Area = "Next App Router"
    Fix = "Mueve page.tsx a app/page.tsx."
  },
  @{
    Path = "app/globals.css"
    Area = "Estilos"
    Fix = "Mueve globals.css a app/globals.css."
  },
  @{
    Path = "app/api/agent/stream/route.ts"
    Area = "API Stream"
    Fix = "Mueve route.ts a app/api/agent/stream/route.ts."
  },
  @{
    Path = "components/workspace.tsx"
    Area = "Componentes"
    Fix = "Mueve workspace.tsx a components/workspace.tsx."
  },
  @{
    Path = "components/control-bar.tsx"
    Area = "Componentes"
    Fix = "Mueve control-bar.tsx a components/control-bar.tsx."
  },
  @{
    Path = "components/code-panel.tsx"
    Area = "Componentes"
    Fix = "Mueve code-panel.tsx a components/code-panel.tsx."
  },
  @{
    Path = "components/teacher-panel.tsx"
    Area = "Componentes"
    Fix = "Mueve teacher-panel.tsx a components/teacher-panel.tsx."
  },
  @{
    Path = "components/activity-panel.tsx"
    Area = "Componentes"
    Fix = "Mueve activity-panel.tsx a components/activity-panel.tsx."
  },
  @{
    Path = "lib/types.ts"
    Area = "Tipos"
    Fix = "Crea lib/types.ts con Provider, TeachingStyle, VirtualFile, StreamEvent, ActivityLog, TeacherMessage y FinalArtifact."
  },
  @{
    Path = "lib/sample-project.ts"
    Area = "Proyecto demo"
    Fix = "Crea lib/sample-project.ts y exporta SAMPLE_FILES."
  },
  @{
    Path = "lib/demo-run.ts"
    Area = "Motor demo"
    Fix = "Crea lib/demo-run.ts y exporta createDemoStream."
  }
)

foreach ($Item in $RequiredFiles) {
  [void](Test-RequiredFile $Item.Path $Item.Area $Item.Fix)
}

$ProviderFileA = Join-Path $ProjectRoot "lib/providers.ts"
$ProviderFileB = Join-Path $ProjectRoot "lib/providers/index.ts"

if ((Test-Path -LiteralPath $ProviderFileA) -or (Test-Path -LiteralPath $ProviderFileB)) {
  Add-Ok "Existe proveedor: lib/providers.ts o lib/providers/index.ts"
} else {
  Add-Issue "ERROR" "Proveedores IA" "No existe lib/providers.ts ni lib/providers/index.ts." "Crea el archivo que exporte runProvider(input)."
}

$PackagePath = Join-Path $ProjectRoot "package.json"

if (Test-Path -LiteralPath $PackagePath) {
  try {
    $PackageJson = Get-Content -LiteralPath $PackagePath -Raw -Encoding UTF8 | ConvertFrom-Json

    Test-PackageDependency $PackageJson "next"
    Test-PackageDependency $PackageJson "react"
    Test-PackageDependency $PackageJson "react-dom"
    Test-PackageDependency $PackageJson "typescript"
    Test-PackageDependency $PackageJson "@types/node"
    Test-PackageDependency $PackageJson "@types/react"
    Test-PackageDependency $PackageJson "@types/react-dom"

    Test-NpmScripts $PackageJson
  } catch {
    Add-Issue "ERROR" "package.json" "package.json no es JSON valido: $($_.Exception.Message)" "Corrige la sintaxis JSON."
  }
}

$TsconfigPath = Join-Path $ProjectRoot "tsconfig.json"

if (Test-Path -LiteralPath $TsconfigPath) {
  try {
    $Tsconfig = Get-Content -LiteralPath $TsconfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

    $HasAlias = $false

    if ((Has-Property $Tsconfig "compilerOptions") -and $null -ne $Tsconfig.compilerOptions) {
      $CompilerOptions = $Tsconfig.compilerOptions

      if ((Has-Property $CompilerOptions "paths") -and $null -ne $CompilerOptions.paths) {
        if ($CompilerOptions.paths.PSObject.Properties.Name -contains "@/*") {
          $HasAlias = $true
        }
      }
    }

    if ($HasAlias) {
      Add-Ok "tsconfig.json tiene alias @/* configurado."
    } else {
      Add-Issue "ERROR" "TypeScript" "No esta configurado el alias @/* en tsconfig.json." "Agrega baseUrl y paths para que imports como @/components/workspace funcionen."
    }
  } catch {
    Add-Issue "ERROR" "tsconfig.json" "tsconfig.json no es JSON valido: $($_.Exception.Message)" "Corrige la sintaxis JSON."
  }
}

Test-ContainsText "app/layout.tsx" "import './globals.css';" "Layout" "app/layout.tsx no importa ./globals.css." "Agrega import './globals.css'; al inicio de app/layout.tsx."
Test-ContainsText "app/page.tsx" "Workspace" "Pagina principal" "app/page.tsx no parece renderizar Workspace." "Importa Workspace desde @/components/workspace y retorna <Workspace />."
Test-ContainsText "components/workspace.tsx" "fetch('/api/agent/stream'" "Workspace" "workspace.tsx no llama a /api/agent/stream." "Asegura que runAgent haga POST a /api/agent/stream."
Test-ContainsText "app/api/agent/stream/route.ts" "application/x-ndjson" "API Stream" "route.ts no parece devolver NDJSON." "Configura Content-Type como application/x-ndjson; charset=utf-8."
Test-ContainsText "app/api/agent/stream/route.ts" "runProvider" "API Stream" "route.ts no parece llamar runProvider." "Importa runProvider desde @/lib/providers."
Test-ContainsText "app/api/agent/stream/route.ts" "createDemoStream" "API Stream" "route.ts no parece tener modo demo." "Importa createDemoStream desde @/lib/demo-run."

$ClientComponents = @(
  "components/workspace.tsx",
  "components/control-bar.tsx",
  "components/code-panel.tsx",
  "components/teacher-panel.tsx",
  "components/activity-panel.tsx"
)

foreach ($Component in $ClientComponents) {
  $Content = Get-Text $Component

  if ($null -ne $Content) {
    $Trimmed = $Content.TrimStart()

    if ($Trimmed.StartsWith("'use client';") -or $Trimmed.StartsWith('"use client";')) {
      Add-Ok "$Component tiene use client."
    } else {
      Add-Issue "ERROR" "React Client Components" "$Component parece interactivo, pero no tiene use client al inicio." "Agrega 'use client'; como primera linea del archivo."
    }
  }
}

$CodeFiles = Get-AllCodeFiles
$ImportRegex = 'from\s+[''"](@/[^''"]+)[''"]|import\s*\(\s*[''"](@/[^''"]+)[''"]\s*\)'

foreach ($File in $CodeFiles) {
  $Text = Get-Content -LiteralPath $File.FullName -Raw -Encoding UTF8
  $RegexResults = [regex]::Matches($Text, $ImportRegex)

  foreach ($RegexResult in $RegexResults) {
    $ImportPath = $null

    if ($RegexResult.Groups[1].Success) {
      $ImportPath = $RegexResult.Groups[1].Value
    } elseif ($RegexResult.Groups[2].Success) {
      $ImportPath = $RegexResult.Groups[2].Value
    }

    if ($null -ne $ImportPath) {
      $Resolved = Resolve-AliasImport $ImportPath

      if ($null -eq $Resolved) {
        $RelativeFile = Resolve-Path -LiteralPath $File.FullName -Relative
        Add-Issue "ERROR" "Imports" "Import no resuelto en $RelativeFile : $ImportPath" "Crea el archivo correspondiente o corrige el import."
      } else {
        Add-Ok "Import resuelto: $ImportPath -> $Resolved"
      }
    }
  }
}

$EnvLocal = Join-Path $ProjectRoot ".env.local"
$EnvExample = Join-Path $ProjectRoot ".env.example"

if (Test-Path -LiteralPath $EnvLocal) {
  Add-Ok "Existe .env.local"
} else {
  Add-Warning "No existe .env.local. Para proveedores reales necesitaras variables de entorno."
}

if (Test-Path -LiteralPath $EnvExample) {
  Add-Ok "Existe .env.example"
} else {
  Add-Suggestion "Crea .env.example con DEMO_MODE, OPENAI_API_KEY, ANTHROPIC_API_KEY y GEMINI_API_KEY."
}

Add-Suggestion "Crea lib/types.ts con el contrato fuerte de eventos."
Add-Suggestion "Crea lib/sample-project.ts con SAMPLE_FILES."
Add-Suggestion "Crea lib/demo-run.ts con createDemoStream."
Add-Suggestion "Crea lib/providers.ts con runProvider(input)."
Add-Suggestion "Ejecuta npm install despues de corregir dependencias."
Add-Suggestion "Ejecuta npm run build para validar TypeScript y Next."
Add-Suggestion "Agrega validacion del body de /api/agent/stream."
Add-Suggestion "Agrega try/catch alrededor de JSON.parse en workspace.tsx para NDJSON corrupto."
Add-Suggestion "Agrega diff viewer antes de aplicar cambios reales."
Add-Suggestion "Luego conecta sandbox, terminal, GitHub y pruebas automaticas."

$ErrorCount = @($Issues | Where-Object { $_.Level -eq "ERROR" }).Count
$IssueWarningCount = @($Issues | Where-Object { $_.Level -eq "WARNING" }).Count
$WarningCount = $IssueWarningCount + $Warnings.Count

Add-Line "# Auditoria Agente Tutor IDE"
Add-Line ""
Add-Line "Proyecto auditado: $ProjectRoot"
Add-Line ""
Add-Line "## Resumen"
Add-Line ""
Add-Line "- Errores criticos: **$ErrorCount**"
Add-Line "- Advertencias: **$WarningCount**"
Add-Line "- Validaciones correctas: **$($Ok.Count)**"
Add-Line ""

if ($Issues.Count -gt 0) {
  Add-Line "## Problemas detectados"
  Add-Line ""

  foreach ($Issue in $Issues) {
    Add-Line "### [$($Issue.Level)] $($Issue.Area)"
    Add-Line ""
    Add-Line "**Problema:** $($Issue.Message)"
    Add-Line ""
    Add-Line "**Como corregir:** $($Issue.Fix)"
    Add-Line ""
  }
} else {
  Add-Line "## Problemas detectados"
  Add-Line ""
  Add-Line "No se detectaron errores criticos en la estructura basica."
  Add-Line ""
}

if ($Warnings.Count -gt 0) {
  Add-Line "## Advertencias adicionales"
  Add-Line ""

  foreach ($Warning in $Warnings) {
    Add-Line "- $Warning"
  }

  Add-Line ""
}

Add-Line "## Validaciones correctas"
Add-Line ""

foreach ($Item in $Ok) {
  Add-Line "- $Item"
}

Add-Line ""
Add-Line "## Recomendaciones proximas"
Add-Line ""

foreach ($Suggestion in $Suggestions) {
  Add-Line "- $Suggestion"
}

Add-Line ""
Add-Line "## Comandos sugeridos"
Add-Line ""
Add-Line '```powershell'
Add-Line 'npm install'
Add-Line 'npm run build'
Add-Line 'npm run dev'
Add-Line '```'

$Lines | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " REPORTE GENERADO" -ForegroundColor Cyan
Write-Host " $ReportPath" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if ($ErrorCount -gt 0) {
  Write-Host "Errores criticos encontrados: $ErrorCount" -ForegroundColor Red
} else {
  Write-Host "No se detectaron errores criticos de estructura." -ForegroundColor Green
}

if ($WarningCount -gt 0) {
  Write-Host "Advertencias encontradas: $WarningCount" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Abre el reporte con:" -ForegroundColor White
Write-Host "notepad .\audit-agente-tutor.md" -ForegroundColor Gray
Write-Host ""
