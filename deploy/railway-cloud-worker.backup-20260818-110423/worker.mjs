import os from "node:os";

import { createClient } from "@supabase/supabase-js";
import { Sandbox, CommandExitError } from "e2b";

const env = process.env;

const SUPABASE_URL =
  env.NEXT_PUBLIC_SUPABASE_URL ||
  env.SUPABASE_URL ||
  "";

const SUPABASE_KEY =
  env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

const E2B_API_KEY = env.E2B_API_KEY || "";

const E2B_TEMPLATE =
  env.VACODER_E2B_TEMPLATE ||
  "vacoder-node22";

const SNAPSHOT_BUCKET =
  env.VACODER_SNAPSHOT_BUCKET ||
  "vacoder-workspaces";

const POLL_MS = Math.max(
  1000,
  Number(env.VACODER_CLOUD_WORKER_POLL_MS || 2500) || 2500,
);

const WORKER_ID =
  env.VACODER_CLOUD_WORKER_ID ||
  `cloud-${os.hostname()}-${process.pid}`;

if (!SUPABASE_URL) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL.");
}
if (!SUPABASE_KEY) {
  throw new Error("Falta SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY.");
}
if (!E2B_API_KEY) {
  throw new Error("Falta E2B_API_KEY.");
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const iso = () => new Date().toISOString();

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function tail(value, max = 100_000) {
  const s = String(value || "");
  return s.length > max ? s.slice(-max) : s;
}

async function addRunEvent(run, eventType, message, data = {}) {
  const { error } = await admin.from("agent_run_events").insert({
    organization_id: run.organization_id,
    project_id: run.project_id,
    run_id: run.id,
    event_type: eventType,
    message,
    data,
  });

  if (error) {
    console.error("agent_run_events:", error.message);
  }
}

async function addCloudEvent(
  run,
  runtimeId,
  eventType,
  message,
  data = {},
) {
  const { error } = await admin.from("cloud_runtime_events").insert({
    organization_id: run.organization_id,
    project_id: run.project_id,
    run_id: run.id,
    runtime_id: runtimeId || null,
    event_type: eventType,
    message,
    data,
  });

  if (error) {
    console.error("cloud_runtime_events:", error.message);
  }
}

async function releaseRun(runId, patch) {
  const { error } = await admin
    .from("agent_runs")
    .update({
      ...patch,
      locked_by: null,
      locked_at: null,
      lease_expires_at: null,
      updated_at: iso(),
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`RELEASE_RUN_FAIL | ${error.message}`);
  }
}

async function getRuntimeForRun(run) {
  const { data, error } = await admin
    .from("cloud_runtime_sessions")
    .select("*")
    .eq("run_id", run.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`RUNTIME_QUERY_FAIL | ${error.message}`);
  }

  return data;
}

async function createRuntime(run) {
  const snapshotId = run.payload?.workspaceSnapshotId;

  if (!snapshotId) {
    throw new Error("Cloud run sin workspaceSnapshotId.");
  }

  const { data: snapshot, error: snapshotError } = await admin
    .from("workspace_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .eq("project_id", run.project_id)
    .eq("status", "ready")
    .single();

  if (snapshotError || !snapshot) {
    throw new Error(
      `SNAPSHOT_NOT_READY | ${snapshotError?.message || snapshotId}`,
    );
  }

  const timeoutSeconds = Math.max(
    300,
    Math.min(3600, num(run.timeout_seconds, 1200)),
  );

  const { data: runtimeRow, error: runtimeInsertError } = await admin
    .from("cloud_runtime_sessions")
    .insert({
      organization_id: run.organization_id,
      project_id: run.project_id,
      run_id: run.id,
      snapshot_id: snapshot.id,
      provider: "e2b",
      status: "creating",
      timeout_seconds: timeoutSeconds,
      metadata: { workerId: WORKER_ID },
    })
    .select("*")
    .single();

  if (runtimeInsertError || !runtimeRow) {
    throw new Error(
      `RUNTIME_ROW_CREATE_FAIL | ${runtimeInsertError?.message || "sin fila"}`,
    );
  }

  let sandbox;

  try {
    sandbox = await Sandbox.create(
      E2B_TEMPLATE,
      {
        apiKey: E2B_API_KEY,
        timeoutMs: timeoutSeconds * 1000,
        metadata: {
        vacoder: "live4",
        projectId: String(run.project_id),
        runId: String(run.id),
          runtimeId: String(runtimeRow.id),
        },
      },
    );

    await admin
      .from("cloud_runtime_sessions")
      .update({
        external_id: sandbox.sandboxId,
        status: "provisioning",
        started_at: iso(),
      })
      .eq("id", runtimeRow.id);

    await addCloudEvent(
      run,
      runtimeRow.id,
      "cloud.sandbox.created",
      "E2B sandbox creado",
      { sandboxId: sandbox.sandboxId },
    );

    const { data: blob, error: downloadError } = await admin.storage
      .from(snapshot.storage_bucket || SNAPSHOT_BUCKET)
      .download(snapshot.storage_path);

    if (downloadError || !blob) {
      throw new Error(
        `SNAPSHOT_DOWNLOAD_FAIL | ${downloadError?.message || "sin blob"}`,
      );
    }

    const archive = Buffer.from(await blob.arrayBuffer());

    await sandbox.files.write(
      "/tmp/vacoder-workspace.tar.gz",
      archive,
    );

    await sandbox.commands.run(
      "rm -rf /home/user/project && mkdir -p /home/user/project && tar -xzf /tmp/vacoder-workspace.tar.gz -C /home/user/project",
      { timeoutMs: 120_000 },
    );

    await admin
      .from("cloud_runtime_sessions")
      .update({ status: "running" })
      .eq("id", runtimeRow.id);

    await addCloudEvent(
      run,
      runtimeRow.id,
      "cloud.workspace.ready",
      "Workspace restaurado dentro de E2B",
      {
        bytes: snapshot.bytes,
        sha256: snapshot.sha256,
      },
    );

    return {
      runtime: {
        ...runtimeRow,
        external_id: sandbox.sandboxId,
        status: "running",
      },
      sandbox,
    };
  } catch (error) {
    await admin
      .from("cloud_runtime_sessions")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finished_at: iso(),
      })
      .eq("id", runtimeRow.id);

    if (sandbox) {
      await sandbox.kill().catch(() => {});
    }

    throw error;
  }
}

async function connectRuntime(run, runtime) {
  if (!runtime?.external_id) {
    return createRuntime(run);
  }

  try {
    const sandbox = await Sandbox.connect(runtime.external_id, {
      apiKey: E2B_API_KEY,
    });

    return { runtime, sandbox };
  } catch (error) {
    await admin
      .from("cloud_runtime_sessions")
      .update({
        status: "failed",
        error: `Reconnect failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        finished_at: iso(),
      })
      .eq("id", runtime.id);

    return createRuntime(run);
  }
}

async function ensureRuntime(run) {
  const existing = await getRuntimeForRun(run);
  return existing
    ? connectRuntime(run, existing)
    : createRuntime(run);
}

async function runCloudCommand(
  sandbox,
  command,
  timeoutSeconds,
  envs = {},
) {
  const stdout = [];
  const stderr = [];

  try {
    const result = await sandbox.commands.run(command, {
      cwd: "/home/user/project",
      timeoutMs: timeoutSeconds * 1000,
      envs,
      onStdout: (data) => stdout.push(data),
      onStderr: (data) => stderr.push(data),
    });

    return {
      ok: true,
      exitCode: 0,
      stdout: tail(result.stdout || stdout.join("")),
      stderr: tail(result.stderr || stderr.join("")),
    };
  } catch (error) {
    if (error instanceof CommandExitError) {
      return {
        ok: false,
        exitCode: error.exitCode,
        stdout: tail(stdout.join("")),
        stderr: tail(stderr.join("")),
      };
    }

    throw error;
  }
}

async function executeTask(sandbox, task, timeoutSeconds) {
  const type = text(task.task_type);

  if (type === "plan") {
    const installCommand =
      "if [ -f package-lock.json ]; then " +
      "(npm ci --no-audit --no-fund || " +
      "(echo 'VACODER: npm ci fallo; usando npm install por lockfile desincronizado' && " +
      "npm install --no-audit --no-fund)); " +
      "else npm install --no-audit --no-fund; fi";

    const install = await runCloudCommand(
      sandbox,
      installCommand,
      Math.max(timeoutSeconds, 600),
      { NODE_ENV: "development", CI: "1" },
    );

    if (!install.ok) {
      return { ...install, command: installCommand };
    }

    const inspect = await runCloudCommand(
      sandbox,
      "node -e \"const p=require('./package.json'); console.log(JSON.stringify({name:p.name,scripts:p.scripts||{}},null,2))\"",
      60,
    );

    return {
      ...inspect,
      command: "provision + inspect",
      installStdout: tail(install.stdout, 20_000),
      installStderr: tail(install.stderr, 20_000),
    };
  }

  if (type === "typecheck") {
    const packageResult = await runCloudCommand(
      sandbox,
      "node -e \"const p=require('./package.json'); process.stdout.write(JSON.stringify(p.scripts||{}))\"",
      30,
    );

    let scripts = {};
    try {
      scripts = JSON.parse(packageResult.stdout || "{}");
    } catch {}

    const command = scripts.typecheck
      ? "npm run typecheck"
      : "if [ -f tsconfig.json ]; then npx tsc --noEmit; else echo 'SKIP: no tsconfig'; fi";

    return {
      ...(await runCloudCommand(
        sandbox,
        command,
        timeoutSeconds,
        { CI: "1" },
      )),
      command,
    };
  }

  if (type === "build") {
    return {
      ...(await runCloudCommand(
        sandbox,
        "npm run build",
        timeoutSeconds,
        { CI: "1", NODE_ENV: "production" },
      )),
      command: "npm run build",
    };
  }

  if (type === "test") {
    const packageResult = await runCloudCommand(
      sandbox,
      "node -e \"const p=require('./package.json'); process.stdout.write(JSON.stringify(p.scripts||{}))\"",
      30,
    );

    let scripts = {};
    try {
      scripts = JSON.parse(packageResult.stdout || "{}");
    } catch {}

    const testScript = scripts.test || "";

    if (!testScript || /no test specified/i.test(testScript)) {
      return {
        ok: true,
        exitCode: 0,
        stdout: "SKIP: no executable test suite",
        stderr: "",
        command: "skip tests",
        skipped: true,
      };
    }

    return {
      ...(await runCloudCommand(
        sandbox,
        "npm test",
        timeoutSeconds,
        { CI: "1", NODE_ENV: "test" },
      )),
      command: "npm test",
    };
  }

  throw new Error(`Unsupported cloud task: ${type}`);
}

async function terminateRuntime(
  runtime,
  sandbox,
  status,
  error = null,
) {
  if (sandbox) {
    await sandbox.kill().catch(() => {});
  }

  if (runtime?.id) {
    await admin
      .from("cloud_runtime_sessions")
      .update({
        status,
        error,
        finished_at: iso(),
      })
      .eq("id", runtime.id);
  }
}

async function processOne() {
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_next_cloud_agent_run",
    {
      p_worker_id: WORKER_ID,
      p_lease_seconds: 1200,
    },
  );

  if (claimError) {
    throw new Error(`CLOUD_CLAIM_FAIL | ${claimError.message}`);
  }

  const run = Array.isArray(claimed) ? claimed[0] : null;

  if (!run) {
    return { idle: true };
  }

  const runId = run.id;

  const { data: freshRun, error: freshError } = await admin
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (freshError || !freshRun) {
    throw new Error(
      `RUN_REFRESH_FAIL | ${freshError?.message || runId}`,
    );
  }

  if (freshRun.cancel_requested === true) {
    const runtime = await getRuntimeForRun(freshRun);
    let sandbox = null;

    if (runtime?.external_id) {
      sandbox = await Sandbox.connect(runtime.external_id, {
        apiKey: E2B_API_KEY,
      }).catch(() => null);
    }

    await terminateRuntime(runtime, sandbox, "cancelled");

    await admin
      .from("agent_tasks")
      .update({ status: "cancelled", finished_at: iso() })
      .eq("run_id", runId)
      .neq("status", "completed");

    await releaseRun(runId, {
      status: "cancelled",
      current_stage: "cancelled",
      finished_at: iso(),
    });

    await addCloudEvent(
      freshRun,
      runtime?.id,
      "cloud.job.cancelled",
      "Cloud job cancelado",
    );

    return {
      idle: false,
      jobId: runId,
      status: "cancelled",
    };
  }

  const { data: tasks, error: tasksError } = await admin
    .from("agent_tasks")
    .select("*")
    .eq("run_id", runId)
    .order("position", { ascending: true });

  if (tasksError) {
    throw new Error(`TASKS_QUERY_FAIL | ${tasksError.message}`);
  }

  const allTasks = tasks || [];
  const pending = allTasks.find(
    (task) => !["completed", "cancelled"].includes(text(task.status)),
  );

  if (!pending) {
    const runtime = await getRuntimeForRun(freshRun);
    let sandbox = null;

    if (runtime?.external_id) {
      sandbox = await Sandbox.connect(runtime.external_id, {
        apiKey: E2B_API_KEY,
      }).catch(() => null);
    }

    await terminateRuntime(runtime, sandbox, "completed");

    await releaseRun(runId, {
      status: "completed",
      current_stage: "completed",
      progress: 100,
      error: null,
      finished_at: iso(),
    });

    await addCloudEvent(
      freshRun,
      runtime?.id,
      "cloud.job.completed",
      "Cloud pipeline completado",
    );

    return {
      idle: false,
      jobId: runId,
      status: "completed",
      progress: 100,
    };
  }

  const availableAt = text(pending.available_at);

  if (availableAt && new Date(availableAt).getTime() > Date.now()) {
    await releaseRun(runId, {
      status: "queued",
      current_stage: "queued",
      available_at: availableAt,
    });

    return {
      idle: false,
      jobId: runId,
      status: "waiting-retry",
    };
  }

  const attempts = num(pending.attempts, 0) + 1;
  const taskMaxAttempts = Math.max(1, num(pending.max_attempts, 3));
  const runAttempts = num(freshRun.attempts, 0);
  const runMaxAttempts = Math.max(1, num(freshRun.max_attempts, 3));
  const timeoutSeconds = Math.max(
    60,
    num(
      pending.timeout_seconds,
      num(freshRun.timeout_seconds, 1200),
    ),
  );

  let runtime = null;
  let sandbox = null;

  try {
    const ensured = await ensureRuntime(freshRun);
    runtime = ensured.runtime;
    sandbox = ensured.sandbox;

    await admin
      .from("agent_tasks")
      .update({
        status: "running",
        attempts,
        started_at: pending.started_at || iso(),
        error: null,
      })
      .eq("id", pending.id);

    await admin
      .from("agent_runs")
      .update({
        status: pending.stage || "running",
        current_stage: pending.stage || "running",
        started_at: freshRun.started_at || iso(),
      })
      .eq("id", runId);

    await addCloudEvent(
      freshRun,
      runtime.id,
      "cloud.task.started",
      `${pending.task_type} iniciado en E2B`,
      {
        taskId: pending.id,
        sandboxId: runtime.external_id,
        attempts,
      },
    );

    const result = await executeTask(
      sandbox,
      pending,
      timeoutSeconds,
    );

    if (!result.ok) {
      throw new Error(
        tail(
          [
            `Cloud task ${pending.task_type} fallo con exitCode ${result.exitCode}`,
            result.stderr,
            result.stdout,
          ]
            .filter(Boolean)
            .join("\n"),
          100_000,
        ),
      );
    }

    await admin
      .from("agent_tasks")
      .update({
        status: "completed",
        progress: 100,
        result,
        error: null,
        finished_at: iso(),
      })
      .eq("id", pending.id);

    await addRunEvent(
      freshRun,
      "cloud.task.completed",
      `${pending.task_type} completado en E2B`,
      {
        taskId: pending.id,
        sandboxId: runtime.external_id,
      },
    );

    await addCloudEvent(
      freshRun,
      runtime.id,
      "cloud.task.completed",
      `${pending.task_type} completado`,
      {
        taskId: pending.id,
        result: {
          command: result.command,
          skipped: Boolean(result.skipped),
        },
      },
    );

    const completed =
      allTasks.filter((task) => task.status === "completed").length + 1;

    const progress = Math.min(
      100,
      Math.round((completed / Math.max(1, allTasks.length)) * 100),
    );

    const remaining = allTasks.filter(
      (task) =>
        task.id !== pending.id &&
        !["completed", "cancelled"].includes(text(task.status)),
    );

    if (remaining.length === 0) {
      await terminateRuntime(runtime, sandbox, "completed");

      await releaseRun(runId, {
        status: "completed",
        current_stage: "completed",
        progress: 100,
        error: null,
        finished_at: iso(),
      });

      await addCloudEvent(
        freshRun,
        runtime.id,
        "cloud.job.completed",
        "Cloud pipeline completado",
        { progress: 100 },
      );

      return {
        idle: false,
        jobId: runId,
        status: "completed",
        progress: 100,
        task: pending.task_type,
      };
    }

    await releaseRun(runId, {
      status: remaining[0].stage || "running",
      current_stage: remaining[0].stage || "running",
      progress,
      error: null,
      available_at: iso(),
    });

    return {
      idle: false,
      jobId: runId,
      status: remaining[0].stage || "running",
      progress,
      task: pending.task_type,
      sandboxId: runtime.external_id,
    };
  } catch (error) {
    const message = tail(
      error instanceof Error ? error.message : String(error),
      100_000,
    );

    const nextRunAttempts = runAttempts + 1;
    const retry =
      attempts < taskMaxAttempts &&
      nextRunAttempts < runMaxAttempts;

    if (retry) {
      const delaySeconds = Math.min(
        60,
        5 * 2 ** Math.max(0, attempts - 1),
      );

      const next = new Date(
        Date.now() + delaySeconds * 1000,
      ).toISOString();

      await admin
        .from("agent_tasks")
        .update({
          status: "queued",
          error: message,
          available_at: next,
        })
        .eq("id", pending.id);

      await releaseRun(runId, {
        status: "queued",
        current_stage: "queued",
        error: message,
        attempts: nextRunAttempts,
        available_at: next,
      });

      await addCloudEvent(
        freshRun,
        runtime?.id,
        "cloud.task.retry",
        `${pending.task_type} sera reintentado`,
        {
          attempts,
          delaySeconds,
          error: tail(message, 4000),
        },
      );

      return {
        idle: false,
        jobId: runId,
        status: "queued",
        retry: true,
        delaySeconds,
        task: pending.task_type,
        error: tail(message, 5000),
      };
    }

    await admin
      .from("agent_tasks")
      .update({
        status: "failed",
        error: message,
        finished_at: iso(),
      })
      .eq("id", pending.id);

    await terminateRuntime(
      runtime,
      sandbox,
      "failed",
      message,
    );

    await releaseRun(runId, {
      status: "failed",
      current_stage: "failed",
      error: message,
      attempts: nextRunAttempts,
      finished_at: iso(),
    });

    await addCloudEvent(
      freshRun,
      runtime?.id,
      "cloud.job.failed",
      "Cloud pipeline fallo",
      {
        task: pending.task_type,
        attempts,
        error: tail(message, 5000),
      },
    );

    return {
      idle: false,
      jobId: runId,
      status: "failed",
      retry: false,
      task: pending.task_type,
      error: tail(message, 12_000),
    };
  }
}

let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});

process.on("SIGTERM", () => {
  stopping = true;
});

console.log("==========================================");
console.log(" VACODER LIVE 4 - CLOUD WORKER");
console.log("==========================================");
console.log("Worker :", WORKER_ID);
console.log("Runtime: E2B");
console.log("Mode   : Supabase direct queue");
console.log("Este worker NO depende de Next.js para procesar jobs.");

while (!stopping) {
  try {
    const result = await processOne();

    if (!result.idle) {
      console.log(
        new Date().toISOString(),
        JSON.stringify(result),
      );
    }

    await sleep(result.idle ? POLL_MS : 500);
  } catch (error) {
    console.error(
      new Date().toISOString(),
      error instanceof Error ? error.message : String(error),
    );

    await sleep(5000);
  }
}

console.log("Cloud worker detenido.");

