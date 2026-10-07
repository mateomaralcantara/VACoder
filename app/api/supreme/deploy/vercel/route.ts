import { NextResponse } from "next/server";
import { runSupremeVercelDeploy } from "@/lib/vacoder/supreme/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runSupremeVercelDeploy(
      String(body.projectPath || ""),
      body.production !== false,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar deploy.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
