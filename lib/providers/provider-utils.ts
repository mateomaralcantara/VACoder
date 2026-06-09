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

  const exactFence = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);

  if (exactFence?.[1]) {
    return exactFence[1].trim();
  }

  const anyFence = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);

  if (anyFence?.[1]) {
    return anyFence[1].trim();
  }

  return trimmed;
}

function normalizeProviderText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function extractJsonCandidate(text: string): string {
  const stripped = normalizeProviderText(stripMarkdownJsonFence(text));

  const firstArray = stripped.indexOf('[');
  const firstObject = stripped.indexOf('{');

  if (firstArray === -1 && firstObject === -1) {
    return stripped;
  }

  const start =
    firstArray >= 0 && firstObject >= 0
      ? Math.min(firstArray, firstObject)
      : Math.max(firstArray, firstObject);

  const source = stripped.slice(start);
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '[' || char === '{') {
      stack.push(char);
      continue;
    }

    if (char === ']' || char === '}') {
      const last = stack[stack.length - 1];

      if ((char === ']' && last === '[') || (char === '}' && last === '{')) {
        stack.pop();

        if (stack.length === 0) {
          return source.slice(0, index + 1).trim();
        }
      }
    }
  }

  return source.trim();
}

function escapeControlCharactersInsideStrings(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      output += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      output += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        output += '\\n';
        continue;
      }

      if (char === '\r') {
        continue;
      }

      if (char === '\t') {
        output += '\\t';
        continue;
      }
    }

    output += char;
  }

  return output;
}

function removeTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1');
}

function repairJsonCandidate(input: string): string {
  return removeTrailingCommas(escapeControlCharactersInsideStrings(input.trim()));
}

function parseProviderJson(text: string): unknown {
  const candidate = extractJsonCandidate(text);

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    const repaired = repairJsonCandidate(candidate);
    return JSON.parse(repaired) as unknown;
  }
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

function normalizeReportBody(value: unknown): string {
  const body = stringifyUnknown(value).trim();

  if (!body) {
    return 'El proveedor no entregó contenido para el reporte.';
  }

  try {
    const parsed = JSON.parse(body) as unknown;

    if (parsed && typeof parsed === 'object') {
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    // El body ya es texto plano o JSON parcial. Se deja como texto.
  }

  return body;
}

function recoverUsefulProviderText(text: string): string {
  const cleaned = stripMarkdownJsonFence(text).trim();

  if (!cleaned) {
    return 'El proveedor respondió, pero la salida llegó vacía.';
  }

  return cleaned.slice(0, 12000);
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
  path?: unknown;
  content?: unknown;
  patch?: unknown;
  command?: unknown;
  output?: unknown;
  error?: unknown;
  summary?: unknown;
  level?: unknown;
  kind?: unknown;
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
      const fileId = stringifyUnknown(item.fileId ?? legacyData.fileId ?? item.path ?? legacyData.path ?? 'unknown-file');
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
      const artifactData = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;

      if (artifactData) {
        const kind = artifactData.kind;

        return [
          {
            type: 'artifact',
            artifact: {
              id: typeof artifactData.id === 'string' ? artifactData.id : createId('artifact'),
              title: typeof artifactData.title === 'string' ? artifactData.title : 'Reporte del proveedor',
              body: normalizeReportBody(artifactData.body ?? artifactData.content ?? artifactData.report ?? data),
              kind:
                kind === 'summary' ||
                kind === 'code' ||
                kind === 'report' ||
                kind === 'checklist' ||
                kind === 'deploy'
                  ? kind
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
            title: typeof item.title === 'string' ? item.title : 'Reporte del proveedor',
            body: normalizeReportBody(data),
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
No escribas texto antes ni después del JSON.

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
      "body": "reporte en texto plano, no JSON anidado"
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
7. artifact.body debe ser texto plano o Markdown simple dentro de un string JSON válido.
8. No pongas JSON anidado dentro de artifact.body.
9. Escapa correctamente saltos de línea como \\n si usas texto largo.
10. Devuelve JSON puro. Sin \`\`\`, sin texto antes, sin texto después.
`;
}

export function eventsFromProviderText(text: string): StreamEvent[] {
  const trimmed = text.trim();

  try {
    const parsed = parseProviderJson(trimmed);

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

  const recovered = recoverUsefulProviderText(trimmed);

  return [
    {
      type: 'teacher',
      message: {
        id: createId('provider-text'),
        title: 'Respuesta recuperada del proveedor',
        concept: 'Salida parcialmente estructurada',
        body: recovered.slice(0, 4000),
        timestamp: timestamp(),
      },
    },
    {
      type: 'artifact',
      artifact: {
        id: createId('provider-artifact'),
        title: 'Reporte recuperado del proveedor',
        body: recovered,
        kind: 'report',
        timestamp: timestamp(),
      },
    },
    {
      type: 'done',
      summary: 'Proveedor respondió. La salida fue recuperada como reporte porque no cumplió completamente el contrato JSON.',
      timestamp: timestamp(),
    },
  ];
}