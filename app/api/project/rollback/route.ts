import { EXAMPLE_PROJECT_PATH } from "@/lib/security/project-root";
import { NextResponse } from "next/server";
import { rollbackBackup, validateProject } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const backupId = String(body.backupId || "");
    const validate = body.validate !== false;

    const manifest = await rollbackBackup(projectPath, backupId);
    const validation = validate ? await validateProject(projectPath) : null;

    return NextResponse.json({
      ok: validation ? validation.ok : true,
      status: "rolled-back",
      projectPath,
      backupId,
      restoredFiles: manifest.files,
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo hacer rollback.";

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
    status: "rollback-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: EXAMPLE_PROJECT_PATH,
        backupId: "ID_DEL_BACKUP",
        validate: true,
      },
    },
  });
}
