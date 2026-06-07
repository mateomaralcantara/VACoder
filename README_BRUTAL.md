# Agente Tutor IDE — Upgrade Pack Brutal

Este paquete convierte tu MVP en una base más fuerte antes de meter muchos agentes.

## Qué incluye

- Contrato fuerte de eventos en `lib/types.ts`.
- Validación del input del agente.
- Validación básica de eventos del stream.
- Hook `useAgentRun` para separar streaming del componente principal.
- `Workspace` más limpio y con soporte para cancelar ejecución.
- Panel de diff.
- Panel de terminal simulado/listo para eventos reales.
- Runner central del agente.
- Proveedores OpenAI, Anthropic y Gemini con salida normalizada a eventos.
- Demo-run más realista.
- Script PowerShell seguro para aplicar cambios con backup.

## Cómo aplicar

1. Descomprime este ZIP dentro de la raíz de tu proyecto.
2. Ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-upgrade.ps1
```

3. Luego corre:

```powershell
npm install
npm run build
npm run dev
```

## Variables de entorno

Crea o actualiza `.env.local`:

```env
DEMO_MODE=true
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_MODEL=gpt-5.5
ANTHROPIC_MODEL=claude-opus-4-8
GEMINI_MODEL=gemini-3.5-flash
```

Para proveedores reales:

```env
DEMO_MODE=false
```

## Nota directa

Esto no mete todavía un sandbox real, GitHub real ni terminal real. Primero endurece la base: eventos, validación, diff, cancelación, proveedores y UI modular. Ese es el orden correcto antes de soltar una jauría de agentes.
