import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

function extractJsonCandidate(text: string): string {
  const stripped = stripMarkdownJsonFence(text);

  if (stripped.startsWith('[') || stripped.startsWith('{')) {
    return stripped;
  }

  const firstArray = stripped.indexOf('[');
  const firstObject = stripped.indexOf('{');

  if (firstArray === -1 && firstObject === -1) {
    return stripped;
  }

  const start =
    firstArray >= 0 && firstObject >= 0
      ? Math.min(firstArray, firstObject)
      : Math.max(firstArray, firstObject);

  return stripped.slice(start).trim();
}

function countPatchLines(patch: string, prefix: '+' | '-'): number {
  return patch
    .split('\n')
    .filter((line) => {
      if (prefix === '+') {
        return line.startsWith('+') && !line.startsWith('+++');
      }

      return line.startsWith('-') && !line.startsWith('---');
    }).length;
}

function normalizePlanSteps(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => stringifyUnknown(item)).filter(Boolean);
  }

  const text = stringifyUnknown(value).trim();

  if (!text) {
    return ['El proveedor no detalló pasos concretos.'];
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : [text];
}

type LegacyProviderEvent = {
  type?: unknown;
  event?: unknown;
  data?: unknown;
  value?: unknown;
  title?: unknown;
  message?: unknown;
  item?: unknown;
  artifact?: unknown;
  fileId?: unknown;
  content?: unknown;
  patch?: unknown;
  command?: unknown;
  output?: unknown;
  error?: unknown;
  summary?: unknown;
  level?: unknown;
};

function normalizeProviderEvent(raw: unknown): StreamEvent[] {
  if (!raw || typeof raw !== 'object') {
    return [
      {
        type: 'teacher',
        message: {
          id: createId('provider-text'),
          title: 'Respuesta del proveedor',
          concept: 'Texto no estructurado',
          body: stringifyUnknown(raw),
          timestamp: timestamp(),
        },
      },
    ];
  }

  const item = raw as LegacyProviderEvent;
  const eventType = String(item.type ?? item.event ?? '').trim();
  const data = item.data ?? item.value ?? item.message ?? item.item ?? item.artifact;

  switch (eventType) {
    case 'status': {
      return [
        {
          type: 'status',
          value: stringifyUnknown(data || item.value || 'Actualizando estado…'),
          timestamp: timestamp(),
        },
      ];
    }

    case 'plan': {
      return [
        {
          type: 'plan',
          title: typeof item.title === 'string' ? item.title : 'Plan del proveedor',
          steps: normalizePlanSteps(data),
          timestamp: timestamp(),
        },
      ];
    }

    case 'teacher': {
      if (data && typeof data === 'object' && 'body' in data) {
        const message = data as Record<string, unknown>;

        return [
          {
            type: 'teacher',
            message: {
              id: typeof message.id === 'string' ? message.id : createId('teacher'),
              title: typeof message.title === 'string' ? message.title : 'Respuesta del proveedor',
              concept: typeof message.concept === 'string' ? message.concept : 'Proveedor real',
              body: stringifyUnknown(message.body),
              timestamp: timestamp(),
            },
          },
        ];
      }

      return [
        {
          type: 'teacher',
          message: {
            id: createId('teacher'),
            title: typeof item.title === 'string' ? item.title : 'Respuesta del proveedor',
            concept: 'Proveedor real',
            body: stringifyUnknown(data),
            timestamp: timestamp(),
          },
        },
      ];
    }

    case 'activity': {
      return [
        {
          type: 'activity',
          item: {
            id: createId('activity'),
            level:
              item.level === 'success' ||
              item.level === 'warning' ||
              item.level === 'error' ||
              item.level === 'info'
                ? item.level
                : 'info',
            message: stringifyUnknown(data),
            timestamp: timestamp(),
          },
        },
      ];
    }

    case 'patch-file': {
      const legacyData = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const fileId = stringifyUnknown(item.fileId ?? legacyData.fileId ?? 'unknown-file');
      const fullContent = item.content ?? legacyData.content;
      const patch = item.patch ?? legacyData.patch;

      if (typeof fullContent === 'string') {
        return [
          {
            type: 'patch-file',
            fileId,
            content: fullContent,
            reason: 'Cambio propuesto por proveedor real.',
            timestamp: timestamp(),
          },
        ];
      }

      if (typeof patch === 'string') {
        return [
          {
            type: 'diff',
            item: {
              fileId,
              path: fileId,
              additions: countPatchLines(patch, '+'),
              deletions: countPatchLines(patch, '-'),
              unified: patch,
            },
            timestamp: timestamp(),
          },
          {
            type: 'artifact',
            artifact: {
              id: createId('patch-artifact'),
              title: `Patch propuesto para ${fileId}`,
              kind: 'code',
              body: patch,
              timestamp: timestamp(),
            },
          },
        ];
      }

      return [
        {
          type: 'teacher',
          message: {
            id: createId('patch-warning'),
            title: 'Patch ignorado',
            concept: 'Formato incompleto',
            body: `El proveedor emitió patch-file para ${fileId}, pero no incluyó content ni patch utilizable.`,
            timestamp: timestamp(),
          },
        },
      ];
    }

    case 'artifact': {
      if (data && typeof data === 'object' && 'body' in data) {
        const artifact = data as Record<string, unknown>;

        return [
          {
            type: 'artifact',
            artifact: {
              id: typeof artifact.id === 'string' ? artifact.id : createId('artifact'),
              title: typeof artifact.title === 'string' ? artifact.title : 'Artefacto del proveedor',
              body: stringifyUnknown(artifact.body),
              kind:
                artifact.kind === 'summary' ||
                artifact.kind === 'code' ||
                artifact.kind === 'report' ||
                artifact.kind === 'checklist' ||
                artifact.kind === 'deploy'
                  ? artifact.kind
                  : 'report',
              timestamp: timestamp(),
            },
          },
        ];
      }

      return [
        {
          type: 'artifact',
          artifact: {
            id: createId('artifact'),
            title: 'Artefacto del proveedor',
            body: stringifyUnknown(data),
            kind: 'report',
            timestamp: timestamp(),
          },
        },
      ];
    }

    case 'terminal': {
      const terminal = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

      return [
        {
          type: 'terminal',
          item: {
            id: createId('terminal'),
            command: stringifyUnknown(item.command ?? terminal.command ?? '$ comando no especificado'),
            output: stringifyUnknown(item.output ?? terminal.output ?? data),
            exitCode: typeof terminal.exitCode === 'number' ? terminal.exitCode : undefined,
            timestamp: timestamp(),
          },
        },
      ];
    }

    case 'done': {
      return [
        {
          type: 'done',
          summary: stringifyUnknown(item.summary ?? data ?? 'Ejecución completada.'),
          timestamp: timestamp(),
        },
      ];
    }

    case 'error': {
      return [
        {
          type: 'error',
          message: stringifyUnknown(item.error ?? data ?? 'Error reportado por proveedor.'),
          timestamp: timestamp(),
        },
      ];
    }

    default: {
      return [
        {
          type: 'teacher',
          message: {
            id: createId('unknown-provider-event'),
            title: 'Evento no reconocido',
            concept: eventType || 'sin tipo',
            body: stringifyUnknown(raw),
            timestamp: timestamp(),
          },
        },
      ];
    }
  }
}

export function buildAgentInstruction(input: NormalizedAgentRunInput): string {
  const files =
    input.files?.map((file) => `- ${file.id}: ${file.path} (${file.language})`).join('\n') ??
    'No se enviaron archivos.';

  return `Eres VACoder Agent OS.

Debes responder SOLO con JSON válido.
No uses Markdown.
No uses bloques \`\`\`json.

Formato obligatorio:
[
  {
    "type": "plan",
    "title": "Plan de evaluación",
    "steps": ["paso 1", "paso 2"]
  },
  {
    "type": "teacher",
    "message": {
      "id": "teacher-1",
      "title": "Diagnóstico",
      "concept": "Arquitectura",
      "body": "explicación"
    }
  },
  {
    "type": "activity",
    "item": {
      "id": "activity-1",
      "level": "info",
      "message": "actividad"
    }
  },
  {
    "type": "artifact",
    "artifact": {
      "id": "report-1",
      "title": "Reporte final",
      "kind": "report",
      "body": "reporte"
    }
  },
  {
    "type": "done",
    "summary": "Evaluación completada"
  }
]

Objetivo del usuario:
${input.prompt}

Estilo de enseñanza: ${input.teachingStyle}
Modo de ejecución: ${input.runMode}
Máximo de pasos: ${input.maxSteps}

Archivos disponibles:
${files}

Eventos permitidos:
status, plan, teacher, activity, patch-file, create-file, delete-file, rename-file, select-file, terminal, test-result, build-result, diff, artifact, done, error.

Reglas estrictas:
1. No inventes fileId.
2. Si no estás seguro, emite plan y artifact, no patch-file.
3. Cada cambio debe explicar razón pedagógica.
4. Si runMode es plan-only, NO emitas patch-file, create-file, delete-file ni rename-file.
5. Para patch-file debes enviar contenido completo en "content", no unified diff.
6. Si solo tienes unified diff, emite "diff" y "artifact", no patch-file.
7. Devuelve JSON puro. Sin \`\`\`, sin texto antes, sin texto después.
`;
}

export function eventsFromProviderText(text: string): StreamEvent[] {
  const trimmed = text.trim();
  const candidate = extractJsonCandidate(trimmed);

  try {
    const parsed = JSON.parse(candidate) as unknown;

    if (Array.isArray(parsed)) {
      const normalized = parsed.flatMap((item) => normalizeProviderEvent(item));

      if (normalized.length > 0) {
        return normalized;
      }
    }

    if (typeof parsed === 'object' && parsed !== null) {
      return normalizeProviderEvent(parsed);
    }
  } catch {
    // Fallback below.
  }

  return [
    {
      type: 'teacher',
      message: {
        id: createId('provider-text'),
        title: 'Respuesta del proveedor',
        concept: 'Salida no estructurada',
        body: trimmed.slice(0, 4000),
        timestamp: timestamp(),
      },
    },
    {
      type: 'artifact',
      artifact: {
        id: createId('provider-artifact'),
        title: 'Salida convertida a artefacto',
        body: trimmed.slice(0, 6000),
        kind: 'report',
        timestamp: timestamp(),
      },
    },
    {
      type: 'done',
      summary: 'Proveedor respondió, pero no entregó eventos JSON estructurados.',
      timestamp: timestamp(),
    },
  ];
}