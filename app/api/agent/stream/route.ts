import { runAgent } from "@/lib/agent-runner";
import { validateAgentRunInput } from "@/lib/validate-agent-input";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El cliente (hooks/use-agent-run.ts) lee NDJSON: un evento JSON por linea.

const encoder = new TextEncoder();

// El prompt puede incluir el manifiesto del proyecto; se acota el cuerpo
// para que una peticion no pueda agotar la memoria del servidor.
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function encodeEvent(event: StreamEvent): Uint8Array {
  return encoder.encode(JSON.stringify(event) + "\n");
}

function errorEvent(message: string): StreamEvent {
  return {
    type: "error",
    message,
    timestamp: new Date().toISOString(),
  };
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify(errorEvent(message)), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  let input;

  try {
    const raw = await request.text();

    if (encoder.encode(raw).length > MAX_BODY_BYTES) {
      return errorResponse("La solicitud es demasiado grande.", 413);
    }

    input = validateAgentRunInput(JSON.parse(raw));
  } catch (error) {
    return errorResponse(
      error instanceof SyntaxError
        ? "El cuerpo de la solicitud debe ser JSON valido."
        : error instanceof Error
          ? error.message
          : "Solicitud invalida.",
      400,
    );
  }

  const events = runAgent(input);
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          if (cancelled) {
            break;
          }

          controller.enqueue(encodeEvent(event));
        }
      } catch (error) {
        if (!cancelled) {
          controller.enqueue(
            encodeEvent(
              errorEvent(
                error instanceof Error
                  ? error.message
                  : "Error inesperado en el stream.",
              ),
            ),
          );
        }
      } finally {
        if (!cancelled) {
          controller.close();
        }
      }
    },

    // El usuario cancelo o cerro la pestana: se deja de consumir el agente.
    async cancel() {
      cancelled = true;
      await events.return(undefined).catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
