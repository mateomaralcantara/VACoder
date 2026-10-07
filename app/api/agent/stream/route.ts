export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          sse({
            ok: true,
            type: "ready",
            message: "VACoder Agent Stream activo.",
            updatedAt: new Date().toISOString(),
          }),
        ),
      );

      controller.enqueue(
        encoder.encode(
          sse({
            ok: true,
            type: "idle",
            message: "Esperando instrucciones del agente.",
          }),
        ),
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt : "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          sse({
            ok: true,
            type: "received",
            message: "Prompt recibido por VACoder Agent OS.",
            promptLength: prompt.length,
          }),
        ),
      );

      controller.enqueue(
        encoder.encode(
          sse({
            ok: true,
            type: "analysis",
            message:
              "Esta ruta de stream ya no falla en build. El motor IA real debe conectarse en la siguiente fase.",
          }),
        ),
      );

      controller.enqueue(
        encoder.encode(
          sse({
            ok: true,
            type: "done",
            message: "Stream finalizado correctamente.",
          }),
        ),
      );

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
