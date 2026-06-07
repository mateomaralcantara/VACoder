import { buildAgentInstruction, eventsFromProviderText } from '@/lib/providers/provider-utils';
import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

export async function* runAnthropicProvider(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Falta ANTHROPIC_API_KEY en .env.local.');
  }

  yield { type: 'status', value: 'Consultando Anthropic…' };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model || process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: buildAgentInstruction(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic respondió ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text = extractAnthropicText(data);

  for (const event of eventsFromProviderText(text)) {
    yield event;
  }
}

function extractAnthropicText(data: unknown): string {
  const content = (data as { content?: unknown }).content;

  if (Array.isArray(content)) {
    const parts = content
      .map((item) => (item as { text?: unknown }).text)
      .filter((item): item is string => typeof item === 'string');

    if (parts.length > 0) return parts.join('\n');
  }

  return JSON.stringify(data, null, 2);
}
