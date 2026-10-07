import { NextResponse } from "next/server";
import { saveSnapshot } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const name = typeof body.name === "string" ? body.name : "last";

    const snapshot = await saveSnapshot(projectPath, name);

    return NextResponse.json({
      ok: true,
      name,
      snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear snapshot.";

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
    status: "snapshot-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        name: "before-change",
      },
    },
  });
}
