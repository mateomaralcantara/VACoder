import { NextResponse } from "next/server";
import { rejectMarketChangeSet } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const changeSet = await rejectMarketChangeSet({
      projectPath: String(body.projectPath || ""),
      changeSetId: String(body.changeSetId || ""),
    });

    return NextResponse.json({
      ok: true,
      changeSet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo rechazar change-set.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
