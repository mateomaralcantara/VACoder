import { NextResponse } from "next/server";
import { checkSupremePreview } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await checkSupremePreview(String(body.url || ""));

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo verificar preview.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
