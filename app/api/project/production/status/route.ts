import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductionStatus = {
  ok: boolean;
  status: "idle" | "running" | "error";
  phase: string;
  running: boolean;
  message: string;
  updatedAt: string;
};

const globalForProduction = globalThis as typeof globalThis & {
  __vacoderProductionStatus?: ProductionStatus;
};

function getDefaultStatus(): ProductionStatus {
  return {
    ok: true,
    status: "idle",
    phase: "idle",
    running: false,
    message: "Production Gate listo. No hay proceso activo en este momento.",
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const status = globalForProduction.__vacoderProductionStatus ?? getDefaultStatus();

  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const nextStatus: ProductionStatus = {
    ok: true,
    status: body.status === "running" || body.status === "error" ? body.status : "idle",
    phase: typeof body.phase === "string" ? body.phase : "manual-update",
    running: Boolean(body.running),
    message:
      typeof body.message === "string"
        ? body.message
        : "Estado de producción actualizado.",
    updatedAt: new Date().toISOString(),
  };

  globalForProduction.__vacoderProductionStatus = nextStatus;

  return NextResponse.json(nextStatus);
}
