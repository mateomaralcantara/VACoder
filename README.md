# VACoder Connect Project Scanner Pack

Este pack conecta el Project Scanner con la app:

- API local: `app/api/project/scan/route.ts`
- Cliente frontend: `lib/project-scan-client.ts`
- Panel visual: `components/project-scan-panel.tsx`
- Workspace conectado: `components/workspace.tsx`
- CSS adicional para el panel
- Limpieza del duplicado accidental `lib/providers/evaluate-project.ts`

## Aplicar

Descomprime este ZIP en la raíz del proyecto y ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-connect-project-scanner.ps1
npm run build
```

## Uso

1. Ejecuta `npm run dev`.
2. Abre `http://localhost:3000`.
3. Escribe la ruta del proyecto.
4. Pulsa `Escanear proyecto`.
5. Pulsa `Cargar prompt de evaluación`.
6. Ejecuta el agente en modo `Solo planificar`.

## Nota de seguridad

La ruta `/api/project/scan` escanea carpetas locales del servidor donde corre Next.js.
En producción queda bloqueada salvo que configures:

```env
PROJECT_SCAN_ENABLED=true
```

No actives eso en producción pública sin sandbox/permisos.
