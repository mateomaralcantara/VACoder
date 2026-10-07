import { NextResponse } from "next/server";
import { stopSupremeRuntime } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await stopSupremeRuntime(String(body.id || ""));

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo detener runtime.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
