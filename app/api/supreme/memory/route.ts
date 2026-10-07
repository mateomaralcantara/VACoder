import { NextResponse } from "next/server";
import {
  addSupremeDecision,
  readSupremeMemory,
} from "@/lib/vacoder/supreme/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");

    if (typeof body.decision === "string" && body.decision.trim()) {
      const memory = await addSupremeDecision(projectPath, body.decision);

      return NextResponse.json({
        ok: true,
        memory,
      });
    }

    const memory = await readSupremeMemory(projectPath);

    return NextResponse.json({
      ok: true,
      memory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer memoria.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
