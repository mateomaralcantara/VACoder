import { assertSafeProjectPath } from "@/lib/vacoder/core";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";
import { executeOrchestratorTask } from "@/lib/orchestrator/executors";

function text(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function num(value: unknown, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function now() { return new Date().toISOString(); }

async function event(admin: ReturnType<typeof createOrchestratorAdminClient>, run: Record<string, unknown>, type: string, message: string, data: Record<string, unknown> = {}) {
  await admin.from("agent_run_events").insert({
    organization_id: run.organization_id,
    project_id: run.project_id,
    run_id: run.id,
    event_type: type,
    message,
    data,
  });
}

async function release(admin: ReturnType<typeof createOrchestratorAdminClient>, runId: string, patch: Record<string, unknown>) {
  await admin.from("agent_runs").update({
    ...patch,
    locked_by: null,
    locked_at: null,
    lease_expires_at: null,
    updated_at: now(),
  }).eq("id", runId);
}

export async function processOneOrchestratorTick(workerId: string) {
  const admin = createOrchestratorAdminClient();
  const { data: claimed, error: claimError } = await admin.rpc("claim_next_agent_run", {
    p_worker_id: workerId,
    p_lease_seconds: 900,
  });
  if (claimError) throw new Error("claim_next_agent_run: " + claimError.message);
  const run = Array.isArray(claimed) ? claimed[0] as Record<string, unknown> | undefined : undefined;
  if (!run) return { ok: true, idle: true };

  const runId = text(run.id);
  const projectId = text(run.project_id);
  if (!runId || !projectId) throw new Error("Run reclamado sin ids validos.");

  const { data: freshRun } = await admin.from("agent_runs").select("*").eq("id", runId).single();
  const activeRun = (freshRun || run) as Record<string, unknown>;

  if (activeRun.cancel_requested === true) {
    await admin.from("agent_tasks").update({ status: "cancelled", finished_at: now() })
      .eq("run_id", runId).in("status", ["queued", "running", "failed"]);
    await release(admin, runId, { status: "cancelled", current_stage: "cancelled", finished_at: now() });
    await event(admin, activeRun, "job.cancelled", "Job cancelado por solicitud del usuario");
    return { ok: true, jobId: runId, status: "cancelled" };
  }

  const { data: workspace, error: workspaceError } = await admin.from("workspace_registry")
    .select("workspace_path,status").eq("project_id", projectId).maybeSingle();
  if (workspaceError || !workspace?.workspace_path) {
    await release(admin, runId, { status: "failed", current_stage: "failed", error: workspaceError?.message || "Workspace no vinculado", finished_at: now() });
    return { ok: false, jobId: runId, status: "failed", error: "Workspace no vinculado" };
  }
  const projectPath = assertSafeProjectPath(String(workspace.workspace_path));

  const { data: tasks, error: taskError } = await admin.from("agent_tasks")
    .select("*").eq("run_id", runId).order("position", { ascending: true });
  if (taskError) throw new Error(taskError.message);
  const allTasks = (tasks || []) as Record<string, unknown>[];
  const pending = allTasks.find((task) => !["completed", "cancelled"].includes(text(task.status)));

  if (!pending) {
    await release(admin, runId, { status: "completed", current_stage: "completed", progress: 100, error: null, finished_at: now(), result: { tasks: allTasks.length } });
    await event(admin, activeRun, "job.completed", "Pipeline completado", { tasks: allTasks.length });
    return { ok: true, jobId: runId, status: "completed", progress: 100 };
  }

  const availableAt = text(pending.available_at);
  if (availableAt && new Date(availableAt).getTime() > Date.now()) {
    await release(admin, runId, { status: "queued", current_stage: "queued", available_at: availableAt });
    return { ok: true, jobId: runId, status: "waiting-retry" };
  }

  const taskId = text(pending.id);
  const taskType = text(pending.task_type);
  const stage = text(pending.stage, "running");
  const attempts = num(pending.attempts, 0) + 1;
  const taskMaxAttempts = Math.max(1, num(pending.max_attempts, 3));
  const timeoutSeconds = Math.max(30, num(pending.timeout_seconds, num(activeRun.timeout_seconds, 900)));

  await admin.from("agent_tasks").update({
    status: "running",
    attempts,
    started_at: now(),
    error: null,
  }).eq("id", taskId);
  await admin.from("agent_runs").update({
    status: stage,
    current_stage: stage,
    started_at: activeRun.started_at || now(),
    updated_at: now(),
  }).eq("id", runId);
  await event(admin, activeRun, "task.started", taskType + " iniciado", { taskId, attempts, stage });

  try {
    const result = await executeOrchestratorTask({ taskType, projectPath, timeoutSeconds });
    if (!result.ok) {
      const message = result.timedOut
        ? `Task ${taskType} excedio timeout de ${timeoutSeconds}s`
        : `Task ${taskType} fallo con exitCode ${result.exitCode ?? 1}`;
      const rawDetail = [message, result.stderr || "", result.stdout || ""]
        .filter(Boolean)
        .join("\n");

      const detail =
        rawDetail.length > 100_000
          ? rawDetail.slice(-100_000)
          : rawDetail;

      throw new Error(detail);
    }

    await admin.from("agent_tasks").update({
      status: "completed",
      progress: 100,
      result,
      error: null,
      finished_at: now(),
    }).eq("id", taskId);
    await event(admin, activeRun, "task.completed", taskType + " completado", { taskId, skipped: Boolean(result.skipped) });

    const completed = allTasks.filter((task) => text(task.status) === "completed").length + 1;
    const progress = Math.min(100, Math.round((completed / Math.max(1, allTasks.length)) * 100));
    const remaining = allTasks.filter((task) => text(task.id) !== taskId && !["completed", "cancelled"].includes(text(task.status)));

    if (remaining.length === 0) {
      await release(admin, runId, { status: "completed", current_stage: "completed", progress: 100, error: null, finished_at: now(), result: { tasks: allTasks.length, lastTask: taskType } });
      await event(admin, activeRun, "job.completed", "Pipeline completado", { progress: 100 });
      return { ok: true, jobId: runId, status: "completed", progress: 100, task: taskType };
    }

    const nextStage = text(remaining[0].stage, "running");
    await release(admin, runId, { status: nextStage, current_stage: nextStage, progress, error: null, available_at: now() });
    return { ok: true, jobId: runId, status: nextStage, progress, task: taskType };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 100000);
    const runAttempts = num(activeRun.attempts, 0) + 1;
    const runMaxAttempts = Math.max(1, num(activeRun.max_attempts, 3));
    const retry = attempts < taskMaxAttempts && runAttempts < runMaxAttempts;

    if (retry) {
      const delaySeconds = Math.min(60, 5 * (2 ** Math.max(0, attempts - 1)));
      const next = new Date(Date.now() + delaySeconds * 1000).toISOString();
      await admin.from("agent_tasks").update({ status: "queued", error: message, available_at: next }).eq("id", taskId);
      await release(admin, runId, { status: "queued", current_stage: "queued", error: message, attempts: runAttempts, available_at: next });
      await event(admin, activeRun, "task.retry", taskType + " sera reintentado", { taskId, attempts, delaySeconds, error: message.slice(0, 2000) });
      return { ok: false, jobId: runId, status: "queued", retry: true, delaySeconds, task: taskType };
    }

    await admin.from("agent_tasks").update({ status: "failed", error: message, finished_at: now() }).eq("id", taskId);
    await release(admin, runId, { status: "failed", current_stage: "failed", error: message, attempts: runAttempts, finished_at: now() });
    await event(admin, activeRun, "job.failed", "Pipeline fallo", { taskId, taskType, attempts, error: message.slice(0, 4000) });
    return {
      ok: false,
      jobId: runId,
      status: "failed",
      retry: false,
      task: taskType,
      error: message.length > 12_000 ? message.slice(-12_000) : message,
    };
  }
}

