import { createDemoStream } from '@/lib/demo-run';
import { runProvider } from '@/lib/providers';
import type { NormalizedAgentRunInput, StreamEvent } from '@/lib/types';
import { createRunId, nowIso } from '@/lib/create-run-id';

export async function* runAgent(input: NormalizedAgentRunInput): AsyncGenerator<StreamEvent> {
  const runId = createRunId('agent');

  yield withMeta({ type: 'status', value: 'Preparando ejecución validada…' }, runId);
  yield withMeta({
    type: 'activity',
    item: {
      id: `boot-${runId}`,
      level: 'info',
      message: `$ run --provider ${input.provider} --style ${input.teachingStyle} --mode ${input.runMode}`,
      timestamp: nowIso(),
    },
  }, runId);

  const forceDemo = process.env.DEMO_MODE !== 'false' || input.provider === 'demo';
  const source = forceDemo ? createDemoStream(input) : runProvider(input);

  try {
    for await (const event of source) {
      yield withMeta(event, runId);
    }
  } catch (error) {
    yield withMeta({
      type: 'error',
      message: error instanceof Error ? error.message : 'Falló la ejecución del agente.',
    }, runId);
  }
}

function withMeta<T extends StreamEvent>(event: T, runId: string): T {
  return {
    ...event,
    runId: event.runId ?? runId,
    timestamp: event.timestamp ?? nowIso(),
  };
}
