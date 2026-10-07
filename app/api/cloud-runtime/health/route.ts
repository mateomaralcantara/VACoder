import { NextResponse } from "next/server";
import { orchestratorServerEnv, createOrchestratorAdminClient } from "@/lib/orchestrator/admin";
import { cloudRuntimeEnv } from "@/lib/cloud-runtime/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const server = orchestratorServerEnv();
  const cloud = cloudRuntimeEnv();

  if (!server.serviceKey) {
    return NextResponse.json({
      ok: true,
      version: "LIVE-4",
      configured: false,
      e2bConfigured: cloud.e2bConfigured,
      serverKeyConfigured: false,
      workerTokenConfigured: Boolean(server.workerToken),
      schemaReady: false,
    });
  }

  try {
    const admin = createOrchestratorAdminClient();

    const checks = await Promise.all([
      admin.from("workspace_snapshots").select("id").limit(1),
      admin.from("cloud_runtime_sessions").select("id").limit(1),
      admin.from("cloud_runtime_events").select("id").limit(1),
    ]);

    const errors = checks
      .map((result) => result.error?.message || null)
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      version: "LIVE-4",
      configured:
        Boolean(server.serviceKey) &&
        Boolean(server.workerToken) &&
        cloud.e2bConfigured,
      e2bConfigured: cloud.e2bConfigured,
      serverKeyConfigured: Boolean(server.serviceKey),
      workerTokenConfigured: Boolean(server.workerToken),
      schemaReady: errors.length === 0,
      provider: cloud.provider,
      snapshotBucket: cloud.snapshotBucket,
      errors,
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      version: "LIVE-4",
      configured: false,
      e2bConfigured: cloud.e2bConfigured,
      serverKeyConfigured: Boolean(server.serviceKey),
      workerTokenConfigured: Boolean(server.workerToken),
      schemaReady: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
