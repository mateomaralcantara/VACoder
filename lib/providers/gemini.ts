import { buildAgentInstruction, eventsFromProviderText } from '@/lib/providers/provider-utils';
import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

export async function* runGeminiProvider(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en .env.local.');
  }

  yield { type: 'status', value: 'Consultando Gemini…' };

  const model = input.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
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
              text: buildAgentInstruction(input),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini respondió ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = extractGeminiText(data);

  for (const event of eventsFromProviderText(text)) {
    yield event;
  }
}

function extractGeminiText(data: unknown): string {
  const candidates = (data as { candidates?: unknown }).candidates;

  if (Array.isArray(candidates)) {
    const parts: string[] = [];

    for (const candidate of candidates) {
      const content = (candidate as { content?: { parts?: unknown } }).content;
      const candidateParts = content?.parts;

      if (!Array.isArray(candidateParts)) continue;

      for (const part of candidateParts) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string') parts.push(text);
      }
    }

    if (parts.length > 0) return parts.join('\n');
  }

  return JSON.stringify(data, null, 2);
}
