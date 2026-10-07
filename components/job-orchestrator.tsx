"use client";

import { useCallback, useEffect, useState } from "react";

type Job = {
  id: string;
  status: string;
  priority: number;
  progress: number;
  current_stage: string | null;
  prompt: string | null;
  attempts: number;
  max_attempts: number;
  error: string | null;
  created_at: string;
};

async function json(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export default function JobOrchestrator({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [prompt, setPrompt] = useState("Evaluar el proyecto completo: plan, typecheck, build y pruebas disponibles.");
  const [priority, setPriority] = useState(5);
  const [includeTests, setIncludeTests] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Worker independiente: inicia scripts\\run-orchestrator-worker.ps1.");
  const base = `/api/orchestrator/projects/${encodeURIComponent(projectId)}/jobs`;

  const refresh = useCallback(async () => {
    try {
      const data = await json(await fetch(base, { cache: "no-store" }));
      setJobs(data.jobs || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [base]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function createJob() {
    setBusy(true);
    try {
      const data = await json(await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, priority, includeTests, maxAttempts: 3, timeoutSeconds: 900 }),
      }));
      setMessage(`Job ${data.job.run.id} encolado. Puedes cerrar el navegador.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  async function action(jobId: string, name: "cancel" | "retry") {
    setBusy(true);
    try {
      await json(await fetch(`${base}/${jobId}/${name}`, { method: "POST" }));
      setMessage(`${name} enviado para ${jobId}`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={{ padding: 26, borderRadius: 28, background: "linear-gradient(135deg,#071426,#0B1F3A,#312E81)", color: "white" }}>
        <div style={{ color: "#A5B4FC", fontWeight: 900, letterSpacing: 1.2 }}>VACODER LIVE 3</div>
        <h1 style={{ fontSize: 40, margin: "8px 0" }}>Job Orchestrator</h1>
        <div>{projectName}</div>
        <code style={{ color: "#C7D2FE" }}>{projectId}</code>
      </section>

      <section style={{ padding: 22, borderRadius: 22, background: "white" }}>
        <h2>Nuevo pipeline persistente</h2>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #CBD5E1" }} />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <label>Prioridad (1 alta, 9 baja) <input type="number" min={1} max={9} value={priority} onChange={(e) => setPriority(Number(e.target.value))} style={{ width: 70, padding: 8 }} /></label>
          <label><input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} /> Ejecutar tests si existen</label>
          <button disabled={busy} onClick={createJob} style={{ border: 0, borderRadius: 12, padding: "11px 16px", background: "#0B1F3A", color: "white", fontWeight: 900 }}>Encolar Job</button>
          <button disabled={busy} onClick={() => void refresh()} style={{ border: 0, borderRadius: 12, padding: "11px 16px", background: "#E2E8F0", fontWeight: 900 }}>Refresh</button>
        </div>
        <p style={{ color: "#64748B" }}>{message}</p>
      </section>

      <section style={{ padding: 22, borderRadius: 22, background: "white", overflowX: "auto" }}>
        <h2>Queue / Runs</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Job", "Status", "Stage", "Progress", "Priority", "Attempts", "Acciones"].map(x => <th key={x} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #E2E8F0" }}>{x}</th>)}</tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{job.id.slice(0, 8)}</td>
                <td style={{ padding: 10, fontWeight: 900 }}>{job.status}</td>
                <td style={{ padding: 10 }}>{job.current_stage || "-"}</td>
                <td style={{ padding: 10 }}>{job.progress}%</td>
                <td style={{ padding: 10 }}>{job.priority}</td>
                <td style={{ padding: 10 }}>{job.attempts}/{job.max_attempts}</td>
                <td style={{ padding: 10, display: "flex", gap: 6 }}>
                  {!(["completed", "failed", "cancelled"].includes(job.status)) ? <button disabled={busy} onClick={() => void action(job.id, "cancel")}>Cancelar</button> : null}
                  {(["failed", "cancelled"].includes(job.status)) ? <button disabled={busy} onClick={() => void action(job.id, "retry")}>Retry</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 ? <p style={{ color: "#64748B" }}>Todavia no hay jobs.</p> : null}
      </section>
    </div>
  );
}
