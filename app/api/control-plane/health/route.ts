import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = getSupabasePublicEnv();
  if (!env.configured) {
    return NextResponse.json({ ok: true, version: "LIVE-2", configured: false, schemaReady: false });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, version: "LIVE-2", configured: false, schemaReady: false });
  }
  const checks = await Promise.all([
    supabase.from("projects").select("id").limit(1),
    supabase.from("workspace_registry").select("id").limit(1),
    supabase.from("project_environments").select("id").limit(1),
  ]);
  const errors = checks.map(item => item.error?.message || null).filter(Boolean);
  return NextResponse.json({
    ok: true,
    version: "LIVE-2",
    configured: true,
    schemaReady: errors.length === 0,
    errors,
    features: {
      projectResolver: true,
      workspaceRegistry: true,
      projectEnvironment: true,
      marketBridge: true,
      supremeBridge: true,
      runtimeBridge: true,
      persistentMemory: true,
      persistentRuntime: true,
      persistentChangeSets: true,
    },
  });
}
