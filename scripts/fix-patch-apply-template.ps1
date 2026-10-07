$ErrorActionPreference = "Stop"

$File = "C:\Users\martin\Desktop\VSC\BestS\Coder\app\api\project\patch\apply\route.ts"

if (!(Test-Path $File)) {
  throw "No existe el archivo: $File"
}

$Source = Get-Content $File -Raw

$Source = $Source.Replace(
@'
function createReadingText(bookName: string, unlocked: boolean) {
  if (unlocked) {
    return `Iniciando lectura completa del libro ${bookName}. Esta versión está desbloqueada para el usuario.`;
  }

  return `Iniciando lectura de muestra del libro ${bookName}. Esta es una vista previa gratuita. Para escuchar la lectura completa debes desbloquear este libro.`;
}
'@,
@'
function createReadingText(bookName: string, unlocked: boolean) {
  if (unlocked) {
    return (
      "Iniciando lectura completa del libro " +
      bookName +
      ". Esta versión está desbloqueada para el usuario."
    );
  }

  return (
    "Iniciando lectura de muestra del libro " +
    bookName +
    ". Esta es una vista previa gratuita. " +
    "Para escuchar la lectura completa debes desbloquear este libro."
  );
}
'@
)

$Source = $Source.Replace(
@'
    setStatus(`${selectedBooks.length} libro(s) cargado(s).`);
'@,
@'
    setStatus(selectedBooks.length + " libro(s) cargado(s).");
'@
)

Set-Content -Path $File -Value $Source -Encoding UTF8

Write-Host ""
Write-Host "Archivo corregido:" -ForegroundColor Green
Write-Host $File
Write-Host ""

Write-Host "Buscando backticks peligrosos dentro del componente..." -ForegroundColor Cyan

Select-String -Path $File -Pattern 'return `|setStatus\(`\$' -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "npm run typecheck"
Write-Host "npm run build"
Write-Host ""