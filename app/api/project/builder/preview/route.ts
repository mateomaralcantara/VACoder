import path from "node:path";
import { NextResponse } from "next/server";
import { resolveAppsRoot } from "@/lib/security/project-root";
import { buildProjectPlan } from "@/lib/project-builder/templates";
import type { ProjectBuilderRequest } from "@/lib/project-builder/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Devuelve el plan completo (blueprint + archivos con su contenido) que
// despues escribe /api/project/builder/create. No toca el disco.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ProjectBuilderRequest;
    const plan = buildProjectPlan(body);

    return NextResponse.json({
      ...plan,
      destination: path.join(resolveAppsRoot(), plan.blueprint.name),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo generar el preview.",
      },
      { status: 400 },
    );
  }
}
