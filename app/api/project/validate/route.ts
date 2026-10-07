import { NextResponse } from "next/server";
import { validateProject } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");

    const validation = await validateProject(projectPath);

    return NextResponse.json({
      ok: validation.ok,
      projectPath,
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar.";

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
    status: "validate-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
      },
    },
  });
}
