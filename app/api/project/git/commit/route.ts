import { NextResponse } from "next/server";
import { commitGitChanges } from "@/lib/vacoder/market/git";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await commitGitChanges(
      String(body.projectPath || ""),
      String(body.message || "vacoder market leader changes"),
    );

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear commit.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
