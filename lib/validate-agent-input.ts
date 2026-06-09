import type { AgentRunInput, NormalizedAgentRunInput, Provider, RunMode, TeachingStyle } from '@/lib/types';

const providers = new Set<Provider>(['demo', 'openai', 'anthropic', 'gemini']);
const teachingStyles = new Set<TeachingStyle>(['mentor', 'strict', 'fast-track', 'business', 'beginner']);
const runModes = new Set<RunMode>(['plan-only', 'safe-patch', 'auto-patch']);

const MAX_PROMPT_CHARS = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeModel(value: unknown): string | undefined {
  const model = readString(value);

  if (!model) {
    return undefined;
  }

  // Evita valores genéricos que rompen proveedores reales.
  if (model.toLowerCase() === 'gemini') {
    return undefined;
  }

  if (model.toLowerCase() === 'openai') {
    return undefined;
  }

  if (model.toLowerCase() === 'anthropic') {
    return undefined;
  }

  return model;
}

export function validateAgentRunInput(value: unknown): NormalizedAgentRunInput {
  if (!isRecord(value)) {
    throw new Error('El cuerpo de la solicitud debe ser un objeto JSON.');
  }

  const prompt = readString(value.prompt);

  if (prompt.length < 3) {
    throw new Error('El prompt es demasiado corto.');
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`El prompt supera el límite de ${MAX_PROMPT_CHARS} caracteres. Reduce el manifiesto o baja contentPreviewMaxChars.`);
  }

  const providerValue = readString(value.provider, 'demo') as Provider;
  const teachingStyleValue = readString(value.teachingStyle, 'mentor') as TeachingStyle;
  const runModeValue = readString(value.runMode, 'safe-patch') as RunMode;

  if (!providers.has(providerValue)) {
    throw new Error(`Proveedor no permitido: ${providerValue}`);
  }

  if (!teachingStyles.has(teachingStyleValue)) {
    throw new Error(`Estilo de enseñanza no permitido: ${teachingStyleValue}`);
  }

  if (!runModes.has(runModeValue)) {
    throw new Error(`Modo de ejecución no permitido: ${runModeValue}`);
  }

  const maxSteps =
    typeof value.maxSteps === 'number' && Number.isFinite(value.maxSteps)
      ? Math.min(Math.max(Math.floor(value.maxSteps), 1), 30)
      : 12;

  const temperature =
    typeof value.temperature === 'number' && Number.isFinite(value.temperature)
      ? Math.min(Math.max(value.temperature, 0), 1.5)
      : undefined;

  return {
    prompt,
    provider: providerValue,
    teachingStyle: teachingStyleValue,
    runMode: runModeValue,
    model: normalizeModel(value.model),
    temperature,
    maxSteps,
    projectId: readString(value.projectId) || undefined,
    files: Array.isArray(value.files) ? (value.files as AgentRunInput['files']) : [],
  };
}