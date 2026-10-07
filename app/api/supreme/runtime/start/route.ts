import { NextResponse } from "next/server";
import { startSupremeRuntime } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const session = await startSupremeRuntime({
      projectPath: String(body.projectPath || ""),
      command: typeof body.command === "string" ? body.command : undefined,
      port: Number(body.port || 3001),
    });

    return NextResponse.json({
      ok: session.status !== "failed",
      session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar runtime.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
