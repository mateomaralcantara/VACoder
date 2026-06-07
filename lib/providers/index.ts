import { runAnthropicProvider } from '@/lib/providers/anthropic';
import { runGeminiProvider } from '@/lib/providers/gemini';
import { runOpenAIProvider } from '@/lib/providers/openai';
import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';

export async function* runProvider(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  if (input.provider === 'openai') {
    yield* runOpenAIProvider(input);
    return;
  }

  if (input.provider === 'anthropic') {
    yield* runAnthropicProvider(input);
    return;
  }

  if (input.provider === 'gemini') {
    yield* runGeminiProvider(input);
    return;
  }

  throw new Error(`Proveedor no implementado: ${input.provider}`);
}
