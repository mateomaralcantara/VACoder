# VACoder Project Scanner Pack

Incluye los archivos base para escanear proyectos grandes y generar un manifiesto antes de enviar contexto al agente.

## Archivos incluidos

- `lib/file-filters.ts`
- `lib/project-manifest.ts`
- `lib/project-scanner.ts`
- `lib/prompts/evaluate-project.ts`

## Aplicar

Copia las carpetas `lib/` sobre la raíz de tu proyecto `VACoder` o ejecuta `apply-project-scanner.ps1`.

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-project-scanner.ps1
npm run build
```
