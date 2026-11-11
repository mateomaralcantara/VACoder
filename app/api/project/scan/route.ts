import { EXAMPLE_PROJECT_PATH } from "@/lib/security/project-root";
import { NextResponse } from "next/server";
import { assertSafeProjectPath, listProjectFiles, snapshotProject } from "@/lib/vacoder/core";
import { scanProject } from "@/lib/project-scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    // El Studio pide un manifiesto (stack detectado, archivos clave y vistas
    // previas) enviando projectRoot; el control plane pide el listado plano
    // enviando projectPath.
    if (typeof body.projectRoot === "string") {
      const { projectRoot, ...options } = body;
      const manifest = await scanProject(assertSafeProjectPath(projectRoot), options);

      return NextResponse.json({ ok: true, manifest });
    }

    const projectPath = String(body.projectPath || "");
    const includeSnapshot = Boolean(body.includeSnapshot);

    if (includeSnapshot) {
      const snapshot = await snapshotProject(projectPath);

      return NextResponse.json({
        ok: true,
        projectPath: snapshot.projectPath,
        createdAt: snapshot.createdAt,
        totalFiles: snapshot.files.length,
        totalBytes: snapshot.files.reduce((sum, file) => sum + file.bytes, 0),
        files: snapshot.files,
      });
    }

    const files = await listProjectFiles(projectPath);

    return NextResponse.json({
      ok: true,
      projectPath,
      totalFiles: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo escanear.";

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
    status: "scan-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: EXAMPLE_PROJECT_PATH,
        includeSnapshot: true,
      },
    },
  });
}
