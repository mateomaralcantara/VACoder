"use client";

import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  id: string;
  status: string;
  bytes: number | null;
  created_at: string;
};

type Run = {
  id: string;
  status: string;
  progress: number;
  current_stage: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
};

type Runtime = {
  id: string;
  run_id: string;
  provider: string;
  external_id: string | null;
  status: string;
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

export default function CloudRuntimePanel({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [message, setMessage] = useState(
    "Crea un snapshot seguro y luego encola un Cloud Job.",
  );
  const [busy, setBusy] = useState(false);

  const base = `/api/cloud-runtime/projects/${encodeURIComponent(projectId)}`;

  const refresh = useCallback(async () => {
    try {
      const data = await readJson(
        await fetch(`${base}/jobs`, { cache: "no-store" }),
      );
      setSnapshots(data.snapshots || []);
      setRuns(data.runs || []);
      setRuntimes(data.runtimes || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [base]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function createSnapshot() {
    setBusy(true);
    try {
      const data = await readJson(
        await fetch(`${base}/snapshot`, { method: "POST" }),
      );
      setMessage(`Snapshot READY: ${data.snapshot.id}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function createCloudJob() {
    setBusy(true);
    try {
      const data = await readJson(
        await fetch(`${base}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            priority: 5,
            maxAttempts: 3,
            timeoutSeconds: 1200,
            includeTests: true,
            prompt:
              "Ejecutar pipeline completo en E2B: provision, typecheck, build y tests.",
          }),
        }),
      );
      setMessage(`Cloud Job ${data.job.run.id} encolado.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const latestSnapshot = snapshots[0];

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          padding: 26,
          borderRadius: 28,
          background:
            "linear-gradient(135deg,#071426,#12264A,#4C1D95)",
          color: "white",
        }}
      >
        <div
          style={{
            color: "#C4B5FD",
            fontWeight: 900,
            letterSpacing: 1.2,
          }}
        >
          VACODER LIVE 4
        </div>
        <h1 style={{ fontSize: 40, margin: "8px 0" }}>
          Real Cloud Runtime
        </h1>
        <div>{projectName}</div>
        <code style={{ color: "#DDD6FE" }}>{projectId}</code>
      </section>

      <section
        style={{
          padding: 22,
          borderRadius: 22,
          background: "white",
        }}
      >
        <h2>Workspace Snapshot</h2>
        <p>
          Excluye node_modules, .git, .next, .env*, claves y certificados.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button disabled={busy} onClick={createSnapshot}>
            Crear Cloud Snapshot
          </button>
          <button
            disabled={busy || latestSnapshot?.status !== "ready"}
            onClick={createCloudJob}
          >
            Encolar Cloud Job
          </button>
          <button disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        <p>{message}</p>
      </section>

      <section
        style={{
          padding: 22,
          borderRadius: 22,
          background: "white",
          overflowX: "auto",
        }}
      >
        <h2>Cloud Jobs</h2>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Job", "Status", "Stage", "Progress", "Attempts"].map(
                (label) => (
                  <th
                    key={label}
                    style={{ textAlign: "left", padding: 9 }}
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td style={{ padding: 9, fontFamily: "monospace" }}>
                  {run.id.slice(0, 8)}
                </td>
                <td style={{ padding: 9, fontWeight: 900 }}>
                  {run.status}
                </td>
                <td style={{ padding: 9 }}>
                  {run.current_stage || "-"}
                </td>
                <td style={{ padding: 9 }}>{run.progress}%</td>
                <td style={{ padding: 9 }}>
                  {run.attempts}/{run.max_attempts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section
        style={{
          padding: 22,
          borderRadius: 22,
          background: "white",
        }}
      >
        <h2>E2B Runtime Sessions</h2>

        {runtimes.length === 0 ? (
          <p>Todavía no hay runtime cloud.</p>
        ) : (
          runtimes.map((runtime) => (
            <div
              key={runtime.id}
              style={{
                borderTop: "1px solid #E2E8F0",
                padding: "10px 0",
              }}
            >
              <strong>{runtime.status}</strong> — {runtime.provider} —{" "}
              <code>{runtime.external_id || "pending"}</code>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
