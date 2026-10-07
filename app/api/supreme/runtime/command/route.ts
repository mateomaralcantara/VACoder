import { NextResponse } from "next/server";
import { runSupremeTerminalCommand } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runSupremeTerminalCommand({
      projectPath: String(body.projectPath || ""),
      command: String(body.command || ""),
      timeoutMs: Number(body.timeoutMs || 120000),
    });

    return NextResponse.json({
      ok: result.exitCode === 0,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar comando.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
