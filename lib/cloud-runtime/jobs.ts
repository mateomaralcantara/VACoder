import { resolveProject } from "@/lib/control-plane/project";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";
import type { CloudJobInput } from "@/lib/cloud-runtime/types";

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function createCloudProjectJob(
  projectId: string,
  input: CloudJobInput,
) {
  const ctx = await resolveProject(projectId);
  const admin = createOrchestratorAdminClient();

  let snapshotQuery = admin
    .from("workspace_snapshots")
    .select("*")
    .eq("project_id", ctx.project.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.snapshotId) {
    snapshotQuery = admin
      .from("workspace_snapshots")
      .select("*")
      .eq("project_id", ctx.project.id)
      .eq("id", input.snapshotId)
      .eq("status", "ready")
      .limit(1);
  }

  const { data: snapshots, error: snapshotError } = await snapshotQuery;

  if (snapshotError) {
    throw new Error(`SNAPSHOT_QUERY_FAIL | ${snapshotError.message}`);
  }

  const snapshot = snapshots?.[0];

  if (!snapshot) {
    throw new Error(
      "No existe un workspace snapshot READY. Crea un Cloud Snapshot primero.",
    );
  }

  const priority = clamp(input.priority, 1, 9, 5);
  const maxAttempts = clamp(input.maxAttempts, 1, 5, 3);
  const timeoutSeconds = clamp(input.timeoutSeconds, 60, 3600, 1200);
  const prompt =
    input.prompt?.trim() ||
    "Evaluar el proyecto en runtime cloud aislado.";

  const { data: run, error: runError } = await admin
    .from("agent_runs")
    .insert({
      organization_id: ctx.project.organization_id,
      project_id: ctx.project.id,
      created_by: ctx.user.id,
      run_type: "cloud_quality_pipeline",
      status: "queued",
      priority,
      progress: 0,
      current_stage: "queued",
      prompt,
      payload: {
        executionProvider: "e2b",
        workspaceSnapshotId: snapshot.id,
        includeTests: input.includeTests !== false,
        controlPlaneVersion: "live4",
      },
      attempts: 0,
      max_attempts: maxAttempts,
      timeout_seconds: timeoutSeconds,
      cancel_requested: false,
      available_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (runError || !run) {
    throw new Error(`CLOUD_RUN_CREATE_FAIL | ${runError?.message || "sin fila"}`);
  }

  const taskDefinitions = [
    {
      task_type: "plan",
      title: "Provisionar runtime cloud",
      stage: "planning",
      position: 1,
    },
    {
      task_type: "typecheck",
      title: "Typecheck en E2B",
      stage: "running",
      position: 2,
    },
    {
      task_type: "build",
      title: "Build en E2B",
      stage: "validating",
      position: 3,
    },
    ...(input.includeTests === false
      ? []
      : [
          {
            task_type: "test",
            title: "Tests en E2B",
            stage: "testing",
            position: 4,
          },
        ]),
  ];

  const tasks = taskDefinitions.map((task) => ({
    organization_id: ctx.project.organization_id,
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
    available_at: new Date().toISOString(),
  }));

  const { error: taskError } = await admin
    .from("agent_tasks")
    .insert(tasks);

  if (taskError) {
    await admin.from("agent_runs").delete().eq("id", run.id);
    throw new Error(`CLOUD_TASK_CREATE_FAIL | ${taskError.message}`);
  }

  await admin.from("agent_run_events").insert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    run_id: run.id,
    event_type: "cloud.job.created",
    message: "Cloud job encolado",
    data: {
      provider: "e2b",
      snapshotId: snapshot.id,
    },
  });

  return { run, snapshot, tasks };
}

export async function listCloudProjectData(projectId: string) {
  const ctx = await resolveProject(projectId);

  const [snapshots, runs, runtimes] = await Promise.all([
    ctx.supabase
      .from("workspace_snapshots")
      .select("*")
      .eq("project_id", ctx.project.id)
      .order("created_at", { ascending: false })
      .limit(20),

    ctx.supabase
      .from("agent_runs")
      .select(
        "id,status,progress,current_stage,prompt,attempts,max_attempts,error,payload,created_at,updated_at",
      )
      .eq("project_id", ctx.project.id)
      .eq("run_type", "cloud_quality_pipeline")
      .order("created_at", { ascending: false })
      .limit(30),

    ctx.supabase
      .from("cloud_runtime_sessions")
      .select("*")
      .eq("project_id", ctx.project.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (snapshots.error) {
    throw new Error(`SNAPSHOT_LIST_FAIL | ${snapshots.error.message}`);
  }
  if (runs.error) {
    throw new Error(`CLOUD_RUN_LIST_FAIL | ${runs.error.message}`);
  }
  if (runtimes.error) {
    throw new Error(`RUNTIME_LIST_FAIL | ${runtimes.error.message}`);
  }

  return {
    snapshots: snapshots.data || [],
    runs: runs.data || [],
    runtimes: runtimes.data || [],
  };
}
