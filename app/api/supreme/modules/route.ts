import { NextResponse } from "next/server";
import {
  installSupremeModule,
  supremeModules,
} from "@/lib/vacoder/supreme/modules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    modules: supremeModules,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await installSupremeModule(
      String(body.projectPath || ""),
      String(body.moduleId || ""),
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo instalar modulo.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
