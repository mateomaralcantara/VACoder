import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

export function buildAgentInstruction(input: NormalizedAgentRunInput): string {
  const files = input.files?.map((file) => `- ${file.id}: ${file.path} (${file.language})`).join('\n') ?? 'No se enviaron archivos.';

  return `Eres el Agente Tutor IDE. Responde SOLO con JSON válido, preferiblemente un arreglo de eventos StreamEvent.\n\nObjetivo del usuario:\n${input.prompt}\n\nEstilo de enseñanza: ${input.teachingStyle}\nModo de ejecución: ${input.runMode}\nMáximo de pasos: ${input.maxSteps}\n\nArchivos disponibles:\n${files}\n\nEventos permitidos:\nstatus, plan, teacher, activity, patch-file, create-file, delete-file, rename-file, select-file, terminal, test-result, build-result, artifact, done, error.\n\nReglas:\n1. No inventes fileId.\n2. Si no estás seguro, emite plan y artifact, no patch-file.\n3. Cada cambio debe explicar razón pedagógica.\n4. Si runMode es plan-only, no emitas patch-file ni create-file.\n`;
}

export function eventsFromProviderText(text: string): StreamEvent[] {
  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'object' && item !== null) as StreamEvent[];
    }

    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      return [parsed as StreamEvent];
    }
  } catch {
    // Fallback below.
  }

  return [
    {
      type: 'teacher',
      message: {
        id: `provider-text-${Date.now()}`,
        title: 'Respuesta del proveedor',
        concept: 'Salida no estructurada',
        body: trimmed.slice(0, 4000),
        timestamp: new Date().toISOString(),
      },
    },
    {
      type: 'artifact',
      artifact: {
        id: `provider-artifact-${Date.now()}`,
        title: 'Salida convertida a artefacto',
        body: trimmed.slice(0, 6000),
        kind: 'report',
        timestamp: new Date().toISOString(),
      },
    },
    {
      type: 'done',
      summary: 'Proveedor respondió, pero no entregó eventos JSON estructurados.',
    },
  ];
}
