# Agente Tutor IDE - Modern UI Pack

Este paquete moderniza la interfaz del Agente Tutor IDE sin cambiar la arquitectura pesada de proveedores o agentes.

## Incluye

- `app/globals.css` completamente rediseñado.
- Componentes visuales modernizados.
- Mejor estética glassmorphism/dark premium.
- Búsqueda de archivos en `CodePanel`.
- Mejor estado visual en ejecución.
- Mejor panel de actividad y artefactos.
- Mejor panel profesor.
- Mejor panel terminal y diff.
- Script de aplicación con backup automático.

## Cómo aplicar

Copia/descomprime este paquete dentro de la raíz del proyecto y ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-modern-ui.ps1
npm run build
npm run dev
```

## Archivos tocados

```txt
app/globals.css
components/activity-panel.tsx
components/code-panel.tsx
components/control-bar.tsx
components/diff-panel.tsx
components/run-status-bar.tsx
components/teacher-panel.tsx
components/terminal-panel.tsx
components/workspace.tsx
```

## Nota

Este pack asume que ya aplicaste la base robusta anterior, porque usa tipos como `RunMode`, `WorkspaceState`, `TerminalOutput`, `BuildResult`, `TestResult` y utilidades como `applyStreamEventToState`, `project-state`, `diff-utils` y `use-agent-run`.
