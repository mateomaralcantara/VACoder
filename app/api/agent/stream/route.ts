import { runAgent } from '@/lib/agent-runner';
import { validateAgentRunInput } from '@/lib/validate-agent-input';
import type { StreamEvent } from '@/lib/types';

const encoder = new TextEncoder();

function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

function errorEvent(message: string): StreamEvent {
  return {
    type: 'error',
    message,
    timestamp: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  let input;

  try {
    input = validateAgentRunInput(await request.json());
  } catch (error) {
    return new Response(JSON.stringify(errorEvent(error instanceof Error ? error.message : 'Solicitud inválida.')), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runAgent(input)) {
          controller.enqueue(encodeEvent(event));
        }
      } catch (error) {
        controller.enqueue(encodeEvent(errorEvent(error instanceof Error ? error.message : 'Error inesperado en el stream.')));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
