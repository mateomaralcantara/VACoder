import { buildAgentInstruction, eventsFromProviderText } from '@/lib/providers/provider-utils';
import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
};

type GeminiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function getGeminiModels(input: NormalizedAgentRunInput): string[] {
  const envFallbacks = process.env.GEMINI_FALLBACK_MODELS
    ?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);

  return uniqueValues([
    input.model,
    process.env.GEMINI_MODEL,
    ...(envFallbacks ?? []),
    DEFAULT_GEMINI_MODEL,
  ]);
}

function getRetryCount(): number {
  const value = Number(process.env.GEMINI_RETRY_COUNT ?? 2);

  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.min(Math.max(Math.floor(value), 0), 5);
}

function getRetryDelayMs(attempt: number): number {
  const base = Number(process.env.GEMINI_RETRY_DELAY_MS ?? 900);
  const safeBase = Number.isFinite(base) ? Math.max(base, 250) : 900;

  return safeBase * Math.pow(2, attempt);
}

async function readErrorPayload(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as GeminiErrorPayload;
    const code = parsed.error?.code ?? response.status;
    const status = parsed.error?.status ?? response.statusText;
    const message = parsed.error?.message ?? text;

    return `Gemini respondió ${code} ${status}: ${message}`;
  } catch {
    return `Gemini respondió ${response.status}: ${text}`;
  }
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function callGeminiModel(apiKey: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorMessage = await readErrorPayload(response);
    const error = new Error(errorMessage) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as GeminiGenerateContentResponse;
  return extractGeminiText(data);
}

export async function* runGeminiProvider(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en .env.local.');
  }

  const prompt = buildAgentInstruction(input);
  const models = getGeminiModels(input);
  const retryCount = getRetryCount();

  let lastError: unknown = null;

  for (const model of models) {
    yield {
      type: 'status',
      value: `Consultando Gemini con ${model}…`,
      timestamp: new Date().toISOString(),
    };

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        if (attempt > 0) {
          yield {
            type: 'activity',
            item: {
              id: `gemini-retry-${Date.now()}-${attempt}`,
              level: 'warning',
              message: `Reintentando Gemini (${model}), intento ${attempt + 1}/${retryCount + 1}…`,
              timestamp: new Date().toISOString(),
            },
          };
        }

        const text = await callGeminiModel(apiKey, model, prompt);

        yield {
          type: 'activity',
          item: {
            id: `gemini-ok-${Date.now()}`,
            level: 'success',
            message: `Gemini respondió correctamente usando ${model}.`,
            timestamp: new Date().toISOString(),
          },
        };

        for (const event of eventsFromProviderText(text)) {
          yield event;
        }

        return;
      } catch (error) {
        lastError = error;

        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: unknown }).status)
            : 0;

        const message = error instanceof Error ? error.message : String(error);

        yield {
          type: 'activity',
          item: {
            id: `gemini-error-${Date.now()}-${attempt}`,
            level: shouldRetry(status) ? 'warning' : 'error',
            message: `${model}: ${message}`,
            timestamp: new Date().toISOString(),
          },
        };

        if (!shouldRetry(status)) {
          break;
        }

        if (attempt < retryCount) {
          await sleep(getRetryDelayMs(attempt));
        }
      }
    }

    yield {
      type: 'activity',
      item: {
        id: `gemini-fallback-${Date.now()}`,
        level: 'warning',
        message: `Cambiando al siguiente modelo Gemini después de fallar con ${model}.`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  throw new Error(
    lastError instanceof Error
      ? `Gemini no pudo completar la solicitud después de reintentos y fallback. Último error: ${lastError.message}`
      : 'Gemini no pudo completar la solicitud después de reintentos y fallback.',
  );
}

function extractGeminiText(data: GeminiGenerateContentResponse): string {
  const candidates = data.candidates;

  if (Array.isArray(candidates)) {
    const parts: string[] = [];

    for (const candidate of candidates) {
      const candidateParts = candidate.content?.parts;

      if (!Array.isArray(candidateParts)) {
        continue;
      }

      for (const part of candidateParts) {
        if (typeof part.text === 'string') {
          parts.push(part.text);
        }
      }
    }

    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  return JSON.stringify(data, null, 2);
}