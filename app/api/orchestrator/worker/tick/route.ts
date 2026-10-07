import { NextResponse } from "next/server";
import { assertWorkerRequest } from "@/lib/orchestrator/worker-auth";
import { processOneOrchestratorTick } from "@/lib/orchestrator/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertWorkerRequest(request);
    const body = await request.json().catch(() => ({}));
    if (body.probeOnly === true) return NextResponse.json({ ok: true, probe: true, authenticated: true });
    const workerId = typeof body.workerId === "string" && body.workerId.trim() ? body.workerId.trim().slice(0, 160) : "local-worker";
    return NextResponse.json(await processOneOrchestratorTick(workerId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /no autorizado/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
