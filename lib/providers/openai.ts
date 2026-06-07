import { buildAgentInstruction, eventsFromProviderText } from '@/lib/providers/provider-utils';
import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

export async function* runOpenAIProvider(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Falta OPENAI_API_KEY en .env.local.');
  }

  yield { type: 'status', value: 'Consultando OpenAI…' };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model || process.env.OPENAI_MODEL || 'gpt-5.5',
      input: buildAgentInstruction(input),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI respondió ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = extractOpenAIText(data);

  for (const event of eventsFromProviderText(text)) {
    yield event;
  }
}

function extractOpenAIText(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'output_text' in data && typeof (data as { output_text?: unknown }).output_text === 'string') {
    return (data as { output_text: string }).output_text;
  }

  const output = (data as { output?: unknown }).output;
  if (Array.isArray(output)) {
    const parts: string[] = [];

    for (const item of output) {
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;

      for (const part of content) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string') parts.push(text);
      }
    }

    if (parts.length > 0) return parts.join('\n');
  }

  return JSON.stringify(data, null, 2);
}
