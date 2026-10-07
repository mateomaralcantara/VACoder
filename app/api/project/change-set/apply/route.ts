import { NextResponse } from "next/server";
import { applyMarketChangeSet } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await applyMarketChangeSet({
      projectPath: String(body.projectPath || ""),
      changeSetId: String(body.changeSetId || ""),
      validate: body.validate !== false,
      autoRollback: body.autoRollback !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo aplicar change-set.";

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
    status: "change-set-apply-ready",
  });
}
