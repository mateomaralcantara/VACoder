import { NextResponse } from "next/server";
import { assertWorkerRequest } from "@/lib/orchestrator/worker-auth";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    assertWorkerRequest(request);

    const { id } = await context.params;
    const admin = createOrchestratorAdminClient();

    const { data: run, error: runError } = await admin
      .from("agent_runs")
      .select("*")
      .eq("project_id", id)
      .eq("run_type", "cloud_quality_pipeline")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) throw new Error(runError.message);

    if (!run) {
      return NextResponse.json({
        ok: true,
        version: "LIVE-4",
        projectId: id,
        latestRun: null,
      });
    }

    const [tasks, runtimeSession, snapshots, events] = await Promise.all([
      admin
        .from("agent_tasks")
        .select("*")
        .eq("run_id", run.id)
        .order("position", { ascending: true }),

      admin
        .from("cloud_runtime_sessions")
        .select("*")
        .eq("run_id", run.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      admin
        .from("workspace_snapshots")
        .select("*")
        .eq("project_id", id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),

      admin
        .from("cloud_runtime_events")
        .select("*")
        .eq("run_id", run.id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    const errors = [
      tasks.error,
      runtimeSession.error,
      snapshots.error,
      events.error,
    ]
      .filter(Boolean)
      .map((error) => error?.message);

    if (errors.length > 0) {
      throw new Error(errors.join(" | "));
    }

    const checks = {
      cloudJobCompleted: run.status === "completed",
      progress100: Number(run.progress) === 100,
      tasksPersisted: (tasks.data?.length || 0) > 0,
      allTasksCompleted:
        (tasks.data?.length || 0) > 0 &&
        (tasks.data || []).every((task) => task.status === "completed"),
      snapshotReady: (snapshots.data?.length || 0) > 0,
      e2bRuntimeCreated:
        runtimeSession.data?.provider === "e2b" &&
        Boolean(runtimeSession.data?.external_id),
      runtimeEventsPersisted: (events.data?.length || 0) >= 3,
      cloudExecutionObserved: (events.data || []).some(
        (event) => event.event_type === "cloud.task.completed",
      ),
    };

    return NextResponse.json({
      ok: true,
      version: "LIVE-4",
      projectId: id,
      latestRun: run,
      tasks: tasks.data || [],
      runtime: runtimeSession.data || null,
      latestSnapshot: snapshots.data?.[0] || null,
      events: events.data || [],
      checks,
      certified: Object.values(checks).every(Boolean),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: /no autorizado/i.test(message) ? 401 : 500 },
    );
  }
}
