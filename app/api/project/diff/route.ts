import { NextResponse } from "next/server";
import {
  diffSnapshots,
  readSnapshot,
  snapshotProject,
} from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const snapshotName = typeof body.snapshotName === "string" ? body.snapshotName : "last";

    const before = await readSnapshot(projectPath, snapshotName);
    const after = await snapshotProject(projectPath);
    const diff = diffSnapshots(before, after);

    return NextResponse.json({
      ok: true,
      projectPath: after.projectPath,
      snapshotName,
      summary: {
        added: diff.added.length,
        changed: diff.changed.length,
        removed: diff.removed.length,
      },
      diff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo calcular diff.";

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
    status: "diff-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        snapshotName: "before-change",
      },
    },
  });
}
