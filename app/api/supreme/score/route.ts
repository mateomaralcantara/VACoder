import { NextResponse } from "next/server";
import { scoreSupremeProduct } from "@/lib/vacoder/supreme/product-score";
import { runSupremeTeamReview } from "@/lib/vacoder/supreme/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const score = await scoreSupremeProduct(projectPath);
    const team = runSupremeTeamReview(score);

    return NextResponse.json({
      ok: true,
      score,
      team,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo evaluar producto.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
