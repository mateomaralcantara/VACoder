import { NextResponse } from "next/server";
import { assertWorkerRequest } from "@/lib/orchestrator/worker-auth";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: Ctx,
) {
  try {
    assertWorkerRequest(request);

    const { id } = await context.params;
    const projectId = id?.trim();

    if (!projectId) {
      return NextResponse.json(
        {
          ok: false,
          error: "ProjectId requerido.",
        },
        {
          status: 400,
        },
      );
    }

    const admin =
      createOrchestratorAdminClient();

    const {
      data: latestRun,
      error: runError,
    } = await admin
      .from("agent_runs")
      .select(
        "id,project_id,status,progress,current_stage,attempts,max_attempts,error,created_at,updated_at,finished_at",
      )
      .eq("project_id", projectId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (runError) {
      throw new Error(
        `RUN_QUERY_FAIL | ${runError.message}`,
      );
    }

    if (!latestRun) {
      return NextResponse.json({
        ok: true,
        projectId,
        latestRun: null,
        tasks: [],
        events: [],
      });
    }

    const [
      tasksResult,
      eventsResult,
    ] = await Promise.all([
      admin
        .from("agent_tasks")
        .select(
          "id,run_id,title,task_type,stage,status,progress,attempts,max_attempts,error,created_at,started_at,finished_at",
        )
        .eq("run_id", latestRun.id)
        .order("position", {
          ascending: true,
        }),

      admin
        .from("agent_run_events")
        .select(
          "id,run_id,event_type,message,created_at",
        )
        .eq("run_id", latestRun.id)
        .order("created_at", {
          ascending: true,
        })
        .limit(200),
    ]);

    if (tasksResult.error) {
      throw new Error(
        `TASK_QUERY_FAIL | ${tasksResult.error.message}`,
      );
    }

    if (eventsResult.error) {
      throw new Error(
        `EVENT_QUERY_FAIL | ${eventsResult.error.message}`,
      );
    }

    const tasks =
      tasksResult.data || [];

    const events =
      eventsResult.data || [];

    const allTasksCompleted =
      tasks.length > 0 &&
      tasks.every(
        (task) =>
          task.status === "completed",
      );

    const certification = {
      latestJobCompleted:
        latestRun.status ===
        "completed",
      progress100:
        Number(latestRun.progress) ===
        100,
      tasksPersisted:
        tasks.length > 0,
      allTasksCompleted,
      eventsPersisted:
        events.length >= 3,
      retryObserved:
        events.some(
          (event) =>
            event.event_type ===
            "task.retry",
        ),
      completionObserved:
        events.some(
          (event) =>
            event.event_type ===
            "job.completed",
        ),
    };

    const score =
      Object.values(
        certification,
      ).filter(Boolean).length;

    return NextResponse.json({
      ok: true,
      version: "LIVE-3",
      projectId,
      latestRun,
      tasks,
      events,
      certification,
      checksPassed: score,
      checksTotal:
        Object.keys(
          certification,
        ).length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const status =
      /no autorizado/i.test(message)
        ? 401
        : 500;

    console.error(
      "[ORCHESTRATOR][CERTIFICATION]",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status,
      },
    );
  }
}
