import { NextResponse } from "next/server";
import { generateMarketAgentPlan } from "@/lib/vacoder/market/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await generateMarketAgentPlan({
      projectPath: String(body.projectPath || ""),
      prompt: String(body.prompt || ""),
      model: typeof body.model === "string" ? body.model : undefined,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar plan.";

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
    status: "market-agent-plan-ready",
  });
}
