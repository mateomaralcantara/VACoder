import { NextResponse } from "next/server";
import { createMarketChangeSet } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const changeSet = await createMarketChangeSet({
      projectPath: String(body.projectPath || ""),
      prompt: String(body.prompt || ""),
      model: typeof body.model === "string" ? body.model : undefined,
    });

    return NextResponse.json({
      ok: true,
      changeSet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear change-set.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "change-set-create-ready",
  });
}
