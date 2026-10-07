$ErrorActionPreference = "Stop"

$File = "C:\Users\martin\Desktop\VSC\BestS\Coder\app\api\project\patch\apply\route.ts"

if (!(Test-Path $File)) {
  throw "No existe el archivo: $File"
}

$Source = Get-Content $File -Raw

$NewFunction = @'
function normalizeOperations(files: unknown): FileOperation[] {
  if (!Array.isArray(files)) {
    return [];
  }

  const operations: FileOperation[] = [];

  for (const item of files) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const value = item as Partial<FileOperation>;

    if (typeof value.path !== "string" || value.path.trim().length === 0) {
      continue;
    }

    if (value.action === "delete") {
      operations.push({
        path: value.path,
        action: "delete",
      });

      continue;
    }

    operations.push({
      path: value.path,
      content: typeof value.content === "string" ? value.content : "",
      action: "upsert",
    });
  }

  return operations;
}
'@

$Pattern = '(?s)function normalizeOperations\(files: unknown\): FileOperation\[\] \{.*?\n\}\r?\n\r?\nexport async function POST'

if ($Source -notmatch $Pattern) {
  throw "No se encontro la funcion normalizeOperations para reemplazar."
}

$Source = [regex]::Replace(
  $Source,
  $Pattern,
  $NewFunction + "`r`n`r`nexport async function POST",
  1
)

Set-Content -Path $File -Value $Source -Encoding UTF8

Write-Host ""
Write-Host "normalizeOperations corregido correctamente." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host ""