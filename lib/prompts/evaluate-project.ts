import { summarizeManifestForPrompt, type ProjectManifest } from '@/lib/project-manifest';

export const EVALUATE_PROJECT_PROMPT = `
Actúa como arquitecto senior, auditor técnico y profesor de código.

Evalúa el proyecto usando SOLO el manifiesto. No modifiques archivos.

Entrega un diagnóstico profesional en español con estas secciones:

1. Resumen ejecutivo:
- Tipo de proyecto.
- Nivel de madurez.
- Riesgos principales.

2. Arquitectura:
- Estructura.
- Componentes clave.
- Flujo probable de datos.

3. Riesgos críticos:
- Compilación.
- Producción.
- Seguridad.
- Configuración.

4. Archivos prioritarios:
- Archivo.
- Por qué importa.
- Qué revisarías primero.

5. Plan de acción:
- 4 pasos concretos.

Reglas:
- No inventes archivos.
- Si falta código fuente, dilo claramente.
- Prioriza estabilidad, seguridad y build.
- Sé directo, técnico y útil.
`.trim();

export function createEvaluateProjectPrompt(manifest: ProjectManifest): string {
  return [
    EVALUATE_PROJECT_PROMPT,
    '',
    'MANIFIESTO DEL PROYECTO:',
    '```txt',
    summarizeManifestForPrompt(manifest),
    '```',
  ].join('\n');
}