import { summarizeManifestForPrompt, type ProjectManifest } from '@/lib/project-manifest';

export const EVALUATE_PROJECT_PROMPT = `
Actúa como arquitecto senior, auditor técnico y profesor de código.

Evalúa este proyecto completo sin hacer cambios todavía.

Quiero un diagnóstico profesional con estas secciones:

1. Resumen ejecutivo:
   - Qué tipo de proyecto es.
   - Qué tan listo está.
   - Qué riesgos principales tiene.

2. Arquitectura:
   - Estructura de carpetas.
   - Separación de responsabilidades.
   - Componentes principales.
   - Flujo de datos.

3. Calidad del código:
   - Imports.
   - Tipos.
   - Repetición.
   - Manejo de errores.
   - Estado global/local.
   - Validaciones.

4. Riesgos críticos:
   - Errores que impiden compilar.
   - Errores que pueden romper producción.
   - Riesgos de seguridad.
   - Configuración incompleta.

5. Mejoras recomendadas:
   - Cambios críticos.
   - Cambios importantes.
   - Cambios estéticos.
   - Cambios futuros.

6. Archivos prioritarios:
   - Lista de archivos que deben modificarse primero.
   - Por qué cada archivo importa.
   - Qué cambio exacto harías.

7. Plan de acción:
   - Paso 1.
   - Paso 2.
   - Paso 3.
   - Paso 4.

Reglas:
- No modifiques archivos todavía.
- No inventes archivos que no existen.
- Si falta información, dilo claramente.
- Prioriza estabilidad antes que diseño.
- Explica como profesor, pero con criterio de producción.
- Usa el manifiesto como mapa del proyecto.
- Si el proyecto es grande, recomienda evaluación por lotes.
`.trim();

export function createEvaluateProjectPrompt(manifest: ProjectManifest): string {
  return [
    EVALUATE_PROJECT_PROMPT,
    '',
    'MANIFIESTO DEL PROYECTO:',
    '```txt',
    summarizeManifestForPrompt(manifest),
    '```',
    '',
    'Entrega el diagnóstico en español, con prioridad clara y sin modificar archivos.',
  ].join('\n');
}
