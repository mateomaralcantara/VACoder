import { NextResponse } from "next/server";
import { listMarketChangeSets } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const changeSets = await listMarketChangeSets(String(body.projectPath || ""));

    return NextResponse.json({
      ok: true,
      changeSets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo listar change-sets.";

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
    status: "change-set-list-ready",
  });
}
