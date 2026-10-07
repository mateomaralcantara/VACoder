import { NextResponse } from "next/server";
import { createOrchestratorAdminClient, orchestratorServerEnv } from "@/lib/orchestrator/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = orchestratorServerEnv();
  if (!env.url) return NextResponse.json({ ok: true, version: "LIVE-3", configured: false, schemaReady: false, serviceRoleConfigured: false, workerTokenConfigured: Boolean(env.workerToken) });
  if (!env.serviceKey) return NextResponse.json({ ok: true, version: "LIVE-3", configured: false, schemaReady: false, serverKeyConfigured: false, serviceRoleConfigured: false, workerTokenConfigured: Boolean(env.workerToken) });

  try {
    const admin = createOrchestratorAdminClient();
    const checks = await Promise.all([
      admin.from("agent_runs").select("id").limit(1),
      admin.from("agent_tasks").select("id").limit(1),
      admin.from("agent_run_events").select("id").limit(1),
    ]);
    const errors = checks.map((x) => x.error?.message || null).filter(Boolean);
    return NextResponse.json({
      ok: true,
      version: "LIVE-3",
      configured: Boolean(env.serviceKey && env.workerToken),
      schemaReady: errors.length === 0,
      serverKeyConfigured: Boolean(env.serviceKey),
      serviceRoleConfigured: Boolean(env.serviceKey),
      workerTokenConfigured: Boolean(env.workerToken),
      errors,
      capabilities: {
        durableQueue: true,
        priorities: true,
        retries: true,
        timeouts: true,
        cancellation: true,
        progress: true,
        leases: true,
        persistentEvents: true,
        browserIndependentWorker: true,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: true, version: "LIVE-3", configured: false, schemaReady: false, error: error instanceof Error ? error.message : String(error) });
  }
}
