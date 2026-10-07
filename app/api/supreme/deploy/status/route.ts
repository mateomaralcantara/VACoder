import { NextResponse } from "next/server";
import { getSupremeDeployStatus } from "@/lib/vacoder/supreme/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const status = await getSupremeDeployStatus(String(body.projectPath || ""));

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar deploy status.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
