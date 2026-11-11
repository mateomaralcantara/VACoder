import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertInsideAppsRoot, resolveAppsRoot } from "@/lib/security/project-root";
import { buildProjectPlan } from "@/lib/project-builder/templates";
import { isUnsafeRelativeFilePath } from "@/lib/project-builder/validation";
import type {
  ProjectBuilderCreateResult,
  ProjectBuilderRequest,
} from "@/lib/project-builder/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

// Escribe en disco el mismo plan que muestra el preview. El proyecto siempre
// queda dentro de la raiz de proyectos; los archivos que ya existen se
// respetan salvo que se pida overwrite.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ProjectBuilderRequest;
    const plan = buildProjectPlan(body);

    const root = body.rootPath?.trim() || resolveAppsRoot();
    const projectPath = assertInsideAppsRoot(path.join(root, plan.blueprint.name));
    const overwrite = body.overwrite === true;

    const result: ProjectBuilderCreateResult = {
      projectPath,
      created: [],
      skipped: [],
      errors: [],
    };

    await fs.mkdir(projectPath, { recursive: true });

    for (const file of plan.files) {
      try {
        if (isUnsafeRelativeFilePath(file.path) || path.isAbsolute(file.path)) {
          throw new Error("Ruta de archivo no permitida.");
        }

        const target = path.join(projectPath, file.path);

        if (!overwrite && (await exists(target))) {
          result.skipped.push(file.path);
          continue;
        }

        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, file.content, "utf8");
        result.created.push(file.path);
      } catch (error) {
        result.errors.push({
          path: file.path,
          message: error instanceof Error ? error.message : "No se pudo escribir.",
        });
      }
    }

    return NextResponse.json(result, {
      status: result.errors.length && !result.created.length ? 500 : 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear el proyecto.",
      },
      { status: 400 },
    );
  }
}
