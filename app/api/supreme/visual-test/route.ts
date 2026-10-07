import { NextResponse } from "next/server";
import { runSupremeVisualTest } from "@/lib/vacoder/supreme/visual-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runSupremeVisualTest({
      projectPath: String(body.projectPath || ""),
      url: String(body.url || "http://localhost:3000"),
    });

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar visual test.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
