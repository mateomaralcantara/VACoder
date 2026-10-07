import { requireWorkspace, resolveProject } from "@/lib/control-plane/project";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";
import type { CreateJobInput } from "@/lib/orchestrator/types";

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.max(
    min,
    Math.min(max, Math.round(n)),
  );
}

function errorMessage(
  prefix: string,
  error: { message?: string; code?: string; details?: string; hint?: string } | null,
) {
  if (!error) {
    return prefix;
  }

  return [
    prefix,
    error.message || "",
    error.code ? `code=${error.code}` : "",
    error.details ? `details=${error.details}` : "",
    error.hint ? `hint=${error.hint}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export async function createProjectJob(
  projectId: string,
  input: CreateJobInput,
) {
  // IMPORTANTE:
  // 1. requireWorkspace valida usuario, organizacion, proyecto y workspace usando RLS.
  // 2. Solo DESPUES de esa autorizacion usamos admin para persistir la cola interna.
  const { ctx } = await requireWorkspace(projectId);

  const admin = createOrchestratorAdminClient();

  const priority = clamp(
    input.priority,
    1,
    9,
    5,
  );

  const maxAttempts = clamp(
    input.maxAttempts,
    1,
    5,
    3,
  );

  const timeoutSeconds = clamp(
    input.timeoutSeconds,
    30,
    3600,
    900,
  );

  const prompt =
    input.prompt?.trim() ||
    "Evaluar el proyecto con pipeline de calidad VACoder.";

  const { data: run, error: runError } =
    await admin
      .from("agent_runs")
      .insert({
        organization_id:
          ctx.project.organization_id,
        project_id: ctx.project.id,
        created_by: ctx.user.id,
        run_type: "quality_pipeline",
        status: "queued",
        priority,
        progress: 0,
        current_stage: "queued",
        prompt,
        payload: {
          includeTests:
            input.includeTests !== false,
          controlPlaneVersion: "live3",
        },
        attempts: 0,
        max_attempts: maxAttempts,
        timeout_seconds: timeoutSeconds,
        cancel_requested: false,
        available_at:
          new Date().toISOString(),
      })
      .select("*")
      .single();

  if (runError || !run) {
    throw new Error(
      errorMessage(
        "AGENT_RUN_INSERT_FAIL",
        runError,
      ),
    );
  }

  const tasks = [
    {
      task_type: "plan",
      title: "Planificar proyecto",
      stage: "planning",
      position: 1,
    },
    {
      task_type: "typecheck",
      title: "Validar TypeScript",
      stage: "running",
      position: 2,
    },
    {
      task_type: "build",
      title: "Construir proyecto",
      stage: "validating",
      position: 3,
    },
    ...(input.includeTests === false
      ? []
      : [
          {
            task_type: "test",
            title: "Ejecutar pruebas",
            stage: "testing",
            position: 4,
          },
        ]),
  ].map((task) => ({
    organization_id:
      ctx.project.organization_id,
    project_id: ctx.project.id,
    run_id: run.id,
    created_by: ctx.user.id,
    ...task,
    status: "queued",
    progress: 0,
    attempts: 0,
    max_attempts: maxAttempts,
    timeout_seconds: timeoutSeconds,
    payload: {},
    available_at:
      new Date().toISOString(),
  }));

  const { error: taskError } =
    await admin
      .from("agent_tasks")
      .insert(tasks);

  if (taskError) {
    await admin
      .from("agent_runs")
      .delete()
      .eq("id", run.id);

    throw new Error(
      errorMessage(
        "AGENT_TASK_INSERT_FAIL",
        taskError,
      ),
    );
  }

  const { error: eventError } =
    await admin
      .from("agent_run_events")
      .insert({
        organization_id:
          ctx.project.organization_id,
        project_id: ctx.project.id,
        run_id: run.id,
        event_type: "job.created",
        message: "Job encolado",
        data: {
          priority,
          maxAttempts,
          timeoutSeconds,
        },
      });

  if (eventError) {
    console.error(
      "[ORCHESTRATOR][EVENT_INSERT]",
      eventError,
    );
  }

  return getProjectJob(
    projectId,
    run.id,
  );
}

export async function listProjectJobs(
  projectId: string,
) {
  const ctx =
    await resolveProject(projectId);

  const { data, error } =
    await ctx.supabase
      .from("agent_runs")
      .select(
        "id, project_id, status, priority, progress, current_stage, prompt, attempts, max_attempts, error, cancel_requested, created_at, updated_at",
      )
      .eq(
        "project_id",
        ctx.project.id,
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(50);

  if (error) {
    throw new Error(
      errorMessage(
        "AGENT_RUN_LIST_FAIL",
        error,
      ),
    );
  }

  return data || [];
}

export async function getProjectJob(
  projectId: string,
  jobId: string,
) {
  const ctx =
    await resolveProject(projectId);

  const { data: run, error } =
    await ctx.supabase
      .from("agent_runs")
      .select("*")
      .eq(
        "project_id",
        ctx.project.id,
      )
      .eq("id", jobId)
      .maybeSingle();

  if (error || !run) {
    throw new Error(
      error
        ? errorMessage(
            "AGENT_RUN_GET_FAIL",
            error,
          )
        : "Job no encontrado.",
    );
  }

  const [tasks, events] =
    await Promise.all([
      ctx.supabase
        .from("agent_tasks")
        .select("*")
        .eq("run_id", jobId)
        .order("position", {
          ascending: true,
        }),

      ctx.supabase
        .from("agent_run_events")
        .select("*")
        .eq("run_id", jobId)
        .order("created_at", {
          ascending: false,
        })
        .limit(100),
    ]);

  if (tasks.error) {
    throw new Error(
      errorMessage(
        "AGENT_TASK_LIST_FAIL",
        tasks.error,
      ),
    );
  }

  if (events.error) {
    throw new Error(
      errorMessage(
        "AGENT_EVENT_LIST_FAIL",
        events.error,
      ),
    );
  }

  return {
    run,
    tasks: tasks.data || [],
    events: events.data || [],
  };
}

export async function cancelProjectJob(
  projectId: string,
  jobId: string,
) {
  // Autoriza por RLS antes de usar admin.
  const ctx =
    await resolveProject(projectId);

  const { data: visibleRun, error: visibleError } =
    await ctx.supabase
      .from("agent_runs")
      .select("id,status")
      .eq(
        "project_id",
        ctx.project.id,
      )
      .eq("id", jobId)
      .maybeSingle();

  if (visibleError || !visibleRun) {
    throw new Error(
      visibleError
        ? errorMessage(
            "JOB_CANCEL_ACCESS_FAIL",
            visibleError,
          )
        : "Job no encontrado.",
    );
  }

  if (
    [
      "completed",
      "failed",
      "cancelled",
    ].includes(visibleRun.status)
  ) {
    return getProjectJob(
      projectId,
      jobId,
    );
  }

  const admin =
    createOrchestratorAdminClient();

  const immediate =
    visibleRun.status === "queued";

  const patch: Record<
    string,
    unknown
  > = {
    cancel_requested: true,
  };

  if (immediate) {
    patch.status = "cancelled";
    patch.current_stage = "cancelled";
    patch.finished_at =
      new Date().toISOString();
  }

  const { error: updateError } =
    await admin
      .from("agent_runs")
      .update(patch)
      .eq("id", jobId);

  if (updateError) {
    throw new Error(
      errorMessage(
        "JOB_CANCEL_FAIL",
        updateError,
      ),
    );
  }

  if (immediate) {
    await admin
      .from("agent_tasks")
      .update({
        status: "cancelled",
        finished_at:
          new Date().toISOString(),
      })
      .eq("run_id", jobId)
      .neq("status", "completed");
  }

  await admin
    .from("agent_run_events")
    .insert({
      organization_id:
        ctx.project.organization_id,
      project_id: ctx.project.id,
      run_id: jobId,
      event_type:
        "job.cancel_requested",
      message: immediate
        ? "Job cancelado antes de iniciar"
        : "Cancelacion solicitada",
      data: {},
    });

  return getProjectJob(
    projectId,
    jobId,
  );
}

export async function retryProjectJob(
  projectId: string,
  jobId: string,
) {
  // Autoriza por RLS antes de usar admin.
  const ctx =
    await resolveProject(projectId);

  const { data: visibleRun, error: visibleError } =
    await ctx.supabase
      .from("agent_runs")
      .select("id,status")
      .eq(
        "project_id",
        ctx.project.id,
      )
      .eq("id", jobId)
      .maybeSingle();

  if (visibleError || !visibleRun) {
    throw new Error(
      visibleError
        ? errorMessage(
            "JOB_RETRY_ACCESS_FAIL",
            visibleError,
          )
        : "Job no encontrado.",
    );
  }

  if (
    ![
      "failed",
      "cancelled",
    ].includes(visibleRun.status)
  ) {
    throw new Error(
      "Solo se puede reintentar un job failed/cancelled.",
    );
  }

  const admin =
    createOrchestratorAdminClient();

  const { error: tasksError } =
    await admin
      .from("agent_tasks")
      .update({
        status: "queued",
        error: null,
        progress: 0,
        attempts: 0,
        started_at: null,
        finished_at: null,
        available_at:
          new Date().toISOString(),
      })
      .eq("run_id", jobId)
      .in("status", [
        "failed",
        "cancelled",
        "running",
      ]);

  if (tasksError) {
    throw new Error(
      errorMessage(
        "JOB_RETRY_TASKS_FAIL",
        tasksError,
      ),
    );
  }

  const { error: updateError } =
    await admin
      .from("agent_runs")
      .update({
        status: "queued",
        current_stage: "queued",
        error: null,
        attempts: 0,
        cancel_requested: false,
        finished_at: null,
        locked_by: null,
        locked_at: null,
        lease_expires_at: null,
        available_at:
          new Date().toISOString(),
      })
      .eq("id", jobId);

  if (updateError) {
    throw new Error(
      errorMessage(
        "JOB_RETRY_FAIL",
        updateError,
      ),
    );
  }

  await admin
    .from("agent_run_events")
    .insert({
      organization_id:
        ctx.project.organization_id,
      project_id: ctx.project.id,
      run_id: jobId,
      event_type: "job.retry",
      message:
        "Job reenviado a cola",
      data: {},
    });

  return getProjectJob(
    projectId,
    jobId,
  );
}



