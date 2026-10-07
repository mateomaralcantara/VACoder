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
    return JSON.parse(repairJsonCandidate(candidate)) as unknown;
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
    return value.map((item) => stringifyUnknown(item)).filter(Boolean).slice(0, 6);
  }

  const text = stringifyUnknown(value).trim();

  if (!text) {
    return ['Analizar manifiesto.', 'Detectar riesgos.', 'Priorizar archivos.', 'Entregar reporte.'];
  }

  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

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
      return JSON.stringify(parsed, null, 2).slice(0, 9000);
    }
  } catch {
    // El body ya es texto plano o Markdown simple.
  }

  return body.slice(0, 9000);
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
  steps?: unknown;
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
  const eventType = String(item.type ?? item.event ?? '').trim().toLowerCase();
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
          title: typeof item.title === 'string' ? item.title : 'Plan de evaluación',
          steps: normalizePlanSteps(data ?? item.steps),
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
              title: typeof message.title === 'string' ? message.title : 'Criterio de evaluación',
              concept: typeof message.concept === 'string' ? message.concept : 'Diagnóstico técnico',
              body: stringifyUnknown(message.body).slice(0, 2500),
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
            title: typeof item.title === 'string' ? item.title : 'Criterio de evaluación',
            concept: 'Diagnóstico técnico',
            body: stringifyUnknown(data).slice(0, 2500),
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
            message: stringifyUnknown(data).slice(0, 1000),
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
              title: typeof artifactData.title === 'string' ? artifactData.title : 'Reporte final',
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
            title: typeof item.title === 'string' ? item.title : 'Reporte final',
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
          summary: stringifyUnknown(item.summary ?? data ?? 'Evaluación completada.'),
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
            body: stringifyUnknown(raw).slice(0, 2500),
            timestamp: timestamp(),
          },
        },
      ];
    }
  }
}

function extractCompleteObjectsFromArray(text: string): string[] {
  const candidate = extractJsonCandidate(text);
  const start = candidate.indexOf('[');

  if (start === -1) {
    return [];
  }

  const objects: string[] = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start + 1; index < candidate.length; index += 1) {
    const char = candidate[index];

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

    if (char === '{') {
      if (depth === 0) {
        objectStart = index;
      }

      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0 && objectStart >= 0) {
        objects.push(candidate.slice(objectStart, index + 1));
        objectStart = -1;
      }
    }
  }

  return objects;
}

function recoverPartialProviderEvents(text: string): StreamEvent[] {
  const objects = extractCompleteObjectsFromArray(text);

  if (objects.length === 0) {
    return [];
  }

  const recovered: StreamEvent[] = [];

  for (const objectText of objects) {
    try {
      const parsed = JSON.parse(repairJsonCandidate(objectText)) as unknown;
      recovered.push(...normalizeProviderEvent(parsed));
    } catch {
      // Ignorar objetos incompletos.
    }
  }

  if (recovered.length === 0) {
    return [];
  }

  recovered.push({
    type: 'activity',
    item: {
      id: createId('partial-recovery'),
      level: 'warning',
      message: 'Se recuperaron eventos completos de una respuesta parcialmente cortada.',
      timestamp: timestamp(),
    },
  });

  recovered.push({
    type: 'done',
    summary: 'Evaluación recuperada parcialmente.',
    timestamp: timestamp(),
  });

  return recovered;
}

export function buildAgentInstruction(input: NormalizedAgentRunInput): string {
  const files =
    input.files?.map((file) => `- ${file.id}: ${file.path} (${file.language})`).join('\n') ??
    'No se enviaron archivos.';

  return `Eres VACoder Agent OS. Responde SOLO JSON válido.

Devuelve exactamente 4 eventos:
[
  {
    "type": "plan",
    "title": "Plan de evaluación",
    "steps": [
      "Analizar manifiesto",
      "Detectar riesgos",
      "Priorizar archivos",
      "Entregar reporte final"
    ]
  },
  {
    "type": "teacher",
    "message": {
      "id": "teacher-1",
      "title": "Criterio de evaluación",
      "concept": "Diagnóstico técnico",
      "body": "Un párrafo breve sobre el criterio usado."
    }
  },
  {
    "type": "artifact",
    "artifact": {
      "id": "report-1",
      "title": "Reporte final",
      "kind": "report",
      "body": "Diagnóstico completo en texto plano o Markdown simple."
    }
  },
  {
    "type": "done",
    "summary": "Evaluación completada"
  }
]

Reglas:
- JSON puro. Sin Markdown fuera del JSON.
- Sin bloques de código.
- Sin texto antes ni después.
- No uses JSON anidado dentro de artifact.body.
- artifact.body máximo 4500 caracteres.
- Un solo artifact.
- Un solo teacher.
- No modifiques archivos en plan-only.
- No emitas patch-file/create-file/delete-file/rename-file en plan-only.
- No inventes fileId.
- Si falta código fuente, dilo claramente en el reporte.

Contexto:
- Estilo: ${input.teachingStyle}
- Modo: ${input.runMode}
- Máximo de pasos: ${input.maxSteps}

Archivos disponibles:
${files}

Solicitud:
${input.prompt}
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
    const partial = recoverPartialProviderEvents(trimmed);

    if (partial.length > 0) {
      return partial;
    }
  }

  const recovered = recoverUsefulProviderText(trimmed);

  return [
    {
      type: 'teacher',
      message: {
        id: createId('provider-text'),
        title: 'Respuesta recuperada del proveedor',
        concept: 'Salida parcialmente estructurada',
        body: recovered.slice(0, 3000),
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
      summary: 'Proveedor respondió. La salida fue recuperada como reporte.',
      timestamp: timestamp(),
    },
  ];
}