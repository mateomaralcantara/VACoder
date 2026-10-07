"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import type { ProjectControlContextPublic } from "@/lib/control-plane/types";

type Tab = "overview" | "workspace" | "runtime" | "supreme" | "market" | "memory" | "certification";
type JsonRecord = Record<string, unknown>;

type Props = {
  projectId: string;
  initialContext: ProjectControlContextPublic;
  initialTab?: Tab;
};

async function parse(response: Response): Promise<JsonRecord> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(typeof data.error === "string" ? data.error : "Control Plane request fallo.");
  }
  return data as JsonRecord;
}
async function getJson(url: string) { return parse(await fetch(url, { cache: "no-store" })); }
async function postJson(url: string, body: JsonRecord = {}) {
  return parse(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}
function pretty(value: unknown) { return JSON.stringify(value, null, 2); }
function nested(source: JsonRecord, key: string) {
  const value = source[key];
  return value && typeof value === "object" ? value as JsonRecord : {};
}

export default function ProjectControlPlane({ projectId, initialContext, initialTab = "overview" }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [context, setContext] = useState(initialContext);
  const [workspacePath, setWorkspacePath] = useState("");
  const [runtimeCommand, setRuntimeCommand] = useState(initialContext.workspace.runtimeCommand);
  const [port, setPort] = useState(initialContext.workspace.defaultPort);
  const [marketPrompt, setMarketPrompt] = useState("Analiza este proyecto y crea un change-set pequeno, seguro y revisable que mejore la calidad sin romper funcionalidad.");
  const [model, setModel] = useState("");
  const [decision, setDecision] = useState("");
  const [lastChangeSet, setLastChangeSet] = useState<{ persistentId: string; legacyId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("Control Plane LIVE 2 listo.");
  const base = "/api/control-plane/projects/" + encodeURIComponent(projectId);

  function push(label: string, value?: unknown) {
    const line = "[" + new Date().toLocaleTimeString() + "] " + label + (typeof value === "undefined" ? "" : "\n" + pretty(value));
    setLog(current => line + "\n\n" + current);
  }
  async function execute(label: string, fn: () => Promise<JsonRecord>) {
    setBusy(true); push(label + "...");
    try { const result = await fn(); push(label + " OK", result); return result; }
    catch (error) { push(label + " FAIL", error instanceof Error ? error.message : "Error desconocido"); return null; }
    finally { setBusy(false); }
  }
  async function refresh() {
    const result = await execute("Refresh Context", () => getJson(base + "/context"));
    if (result?.context && typeof result.context === "object") setContext(result.context as ProjectControlContextPublic);
  }
  async function linkWorkspace() {
    const result = await execute("Link Workspace", () => postJson(base + "/workspace", { workspacePath, runtimeCommand, defaultPort: port }));
    if (result?.context && typeof result.context === "object") {
      setContext(result.context as ProjectControlContextPublic); setWorkspacePath("");
    }
  }
  async function simple(label: string, action: string, body: JsonRecord = {}) { return execute(label, () => postJson(base + "/" + action, body)); }
  async function runtimeStatus() { return execute("Runtime Status", () => getJson(base + "/runtime/status")); }
  async function memoryLoad() { return execute("Load Memory", () => getJson(base + "/memory")); }
  async function marketList() { return execute("List Change-sets", () => getJson(base + "/market/list")); }
  async function createChangeSet() {
    const result = await execute("Create Market Change-set", () => postJson(base + "/market/create", { prompt: marketPrompt, ...(model.trim() ? { model: model.trim() } : {}) }));
    if (!result) return;
    const cp = nested(result, "controlPlane");
    if (typeof cp.persistentId === "string" && cp.persistentId) {
      setLastChangeSet({ persistentId: cp.persistentId, legacyId: typeof cp.legacyId === "string" ? cp.legacyId : "" });
    }
  }
  async function operateChangeSet(action: "apply" | "reject") {
    if (!lastChangeSet) { push("No hay change-set seleccionado."); return; }
    await simple(action === "apply" ? "Apply Change-set" : "Reject Change-set", "market/" + action, lastChangeSet);
  }
  async function saveMemory() {
    const result = await simple("Save Decision", "memory", { decision, patch: { lastManualDecision: decision } });
    if (result) setDecision("");
  }
  async function certify() { return execute("LIVE 2 Certification", () => getJson(base + "/certification")); }

  const tabs: Array<[Tab, string]> = [
    ["overview", "Overview"], ["workspace", "Workspace"], ["runtime", "Runtime"], ["supreme", "Supreme"], ["market", "Market"], ["memory", "Memory"], ["certification", "Certification"],
  ];

  return (
    <main style={s.page}>
      <section style={s.hero}>
        <div>
          <p style={s.kicker}>VACODER LIVE 2</p>
          <h1 style={s.title}>Project Control Plane</h1>
          <p style={s.subtitle}>{context.organization.name} / {context.project.name}</p>
          <p style={s.mono}>Project ID: {projectId}</p>
        </div>
        <div style={s.metrics}>
          <Metric label="Workspace" value={context.workspace.linked ? "LINKED" : "UNLINKED"} />
          <Metric label="Environment" value={context.environment.name + " / " + context.environment.status} />
          <Metric label="Provider" value={context.workspace.provider} />
        </div>
      </section>

      <section style={s.tabs}>
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>{label}</button>)}
      </section>

      {tab === "overview" && <section style={s.grid2}>
        <Card title="Project Identity">
          <Info label="Name" value={context.project.name} />
          <Info label="Status" value={context.project.status} />
          <Info label="Framework" value={context.project.framework || "unknown"} />
          <Info label="Branch" value={context.project.defaultBranch} />
          <Info label="Repository" value={context.project.repositoryUrl || "Not connected"} />
        </Card>
        <Card title="Control Plane Gates">
          <Info label="Version" value={context.project.controlPlaneVersion} />
          <Info label="Workspace" value={context.project.workspaceStatus} />
          <Info label="Environment" value={context.environment.name} />
          <Info label="Preview" value={context.environment.previewUrl || "Not running"} />
          <div style={s.actions}>
            <Action busy={busy} onClick={refresh}>Refresh</Action>
            <Action busy={busy || !context.workspace.linked} onClick={() => simple("Project Scan", "scan")}>Scan</Action>
            <Action busy={busy || !context.workspace.linked} onClick={() => simple("Project Validate", "validate")}>Validate</Action>
          </div>
        </Card>
      </section>}

      {tab === "workspace" && <Card title="Workspace Registry">
        <p style={s.muted}>La ruta local se registra una vez. Las operaciones posteriores viajan por projectId y la ruta no se devuelve al navegador.</p>
        <Field label="Ruta local del proyecto"><input value={workspacePath} onChange={e => setWorkspacePath(e.target.value)} placeholder={"C:\\Users\\...\\VSC\\APPS\\mi-app"} style={s.input} /></Field>
        <Field label="Runtime command"><input value={runtimeCommand} onChange={e => setRuntimeCommand(e.target.value)} style={s.input} /></Field>
        <Field label="Default port"><input type="number" value={port} onChange={e => setPort(Number(e.target.value))} style={s.input} /></Field>
        <div style={s.actions}><Action busy={busy || !workspacePath.trim()} onClick={linkWorkspace}>Vincular Workspace</Action><Action busy={busy} onClick={refresh}>Refresh</Action></div>
      </Card>}

      {tab === "runtime" && <section style={s.grid2}>
        <Card title="Runtime by Project ID">
          <Info label="Provider" value={context.workspace.provider} />
          <Info label="Port" value={String(port)} />
          <Info label="Preview" value={context.environment.previewUrl || "Not running"} />
          <div style={s.actions}>
            <Action busy={busy || !context.workspace.linked} onClick={() => simple("Start Runtime", "runtime/start", { port, command: runtimeCommand })}>Start</Action>
            <Action busy={busy} onClick={runtimeStatus}>Status</Action>
            <Action busy={busy} onClick={() => simple("Preview Check", "runtime/preview")}>Preview Check</Action>
            <Action busy={busy} onClick={() => simple("Stop Runtime", "runtime/stop")}>Stop</Action>
          </div>
        </Card>
        <Card title="Persistent Runtime"><p style={s.muted}>Cada inicio se registra en runtime_sessions y queda unido al projectId, incluso si luego la sesión local termina.</p></Card>
      </section>}

      {tab === "supreme" && <section style={s.grid2}>
        <Card title="Supreme by Project ID"><div style={s.actions}>
          <Action busy={busy || !context.workspace.linked} onClick={() => simple("Supreme Product Score", "supreme/score")}>Product Score</Action>
          <Action busy={busy || !context.workspace.linked} onClick={() => simple("Deploy Status", "supreme/deploy-status")}>Deploy Status</Action>
        </div></Card>
        <Card title="Persistent Supreme Memory"><p style={s.muted}>El Product Score se replica en project_memory.</p><Action busy={busy} onClick={memoryLoad}>Ver memoria</Action></Card>
      </section>}

      {tab === "market" && <Card title="Market Agent by Project ID">
        <Field label="Prompt"><textarea rows={7} value={marketPrompt} onChange={e => setMarketPrompt(e.target.value)} style={s.input} /></Field>
        <Field label="Modelo opcional"><input value={model} onChange={e => setModel(e.target.value)} placeholder="Vacio = modelo default del servidor" style={s.input} /></Field>
        <div style={s.actions}>
          <Action busy={busy || !context.workspace.linked} onClick={createChangeSet}>Crear Change-set</Action>
          <Action busy={busy} onClick={marketList}>Listar</Action>
          <Action busy={busy || !lastChangeSet} onClick={() => operateChangeSet("apply")}>Aprobar + Aplicar</Action>
          <Action busy={busy || !lastChangeSet} onClick={() => operateChangeSet("reject")}>Rechazar</Action>
        </div>
        {lastChangeSet && <pre style={s.smallConsole}>{pretty(lastChangeSet)}</pre>}
      </Card>}

      {tab === "memory" && <section style={s.grid2}>
        <Card title="Persistent Memory">
          <Field label="Decision"><textarea rows={5} value={decision} onChange={e => setDecision(e.target.value)} style={s.input} placeholder="Ejemplo: mantener Next.js como framework principal." /></Field>
          <div style={s.actions}><Action busy={busy || !decision.trim()} onClick={saveMemory}>Guardar decision</Action><Action busy={busy} onClick={memoryLoad}>Leer memoria</Action></div>
        </Card>
        <Card title="Memory Contract"><p style={s.muted}>project_memory mantiene estado consolidado y project_decisions conserva decisiones auditables.</p></Card>
      </section>}

      {tab === "certification" && <Card title="LIVE 2 Certification">
        <p style={s.muted}>Para 100%: resolver proyecto, RLS, workspace, environment, memoria, al menos un runtime persistido y al menos un change-set persistido.</p>
        <Action busy={busy} onClick={certify}>Ejecutar Certification</Action>
      </Card>}

      <section style={s.consoleCard}>
        <div style={s.consoleHeader}><strong>Control Plane Console</strong><button type="button" onClick={() => setLog("Console limpiada.")} style={s.clear}>Limpiar</button></div>
        <pre style={s.console}>{log}</pre>
      </section>
    </main>
  );
}

function Action({ children, onClick, busy }: { children: ReactNode; onClick: () => void; busy: boolean }) {
  return <button type="button" onClick={onClick} disabled={busy} style={{ ...s.button, opacity: busy ? .55 : 1 }}>{children}</button>;
}
function Card({ title, children }: { title: string; children: ReactNode }) { return <section style={s.card}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label style={s.field}><strong>{label}</strong>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div style={s.info}><span style={s.muted}>{label}</span><strong>{value}</strong></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div style={s.metric}><span>{label}</span><strong>{value}</strong></div>; }

const s: Record<string, CSSProperties> = {
  page: { display: "grid", gap: 18 },
  hero: { background: "linear-gradient(135deg,#071426,#0B1F3A,#163B77)", color: "#fff", borderRadius: 30, padding: 28, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,.7fr)", gap: 20 },
  kicker: { color: "#60A5FA", fontWeight: 900, letterSpacing: 1.6, margin: 0 },
  title: { fontSize: 42, margin: "8px 0" }, subtitle: { color: "#DCE8FF", fontSize: 18 }, mono: { fontFamily: "Consolas,monospace", color: "#93C5FD", wordBreak: "break-all" },
  metrics: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }, metric: { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 18, padding: 15, display: "grid", gap: 8 },
  tabs: { display: "flex", flexWrap: "wrap", gap: 8 }, tab: { border: 0, borderRadius: 999, padding: "10px 14px", background: "#fff", color: "#334155", fontWeight: 900, cursor: "pointer" }, tabActive: { background: "#D72638", color: "#fff" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 18 }, card: { background: "#fff", borderRadius: 24, padding: 22, boxShadow: "0 14px 40px rgba(15,23,42,.06)" },
  field: { display: "grid", gap: 7, marginBottom: 14 }, input: { width: "100%", padding: 12, borderRadius: 12, border: "1px solid #CBD5E1", font: "inherit" }, actions: { display: "flex", flexWrap: "wrap", gap: 9, marginTop: 14 },
  button: { border: 0, borderRadius: 12, padding: "11px 14px", background: "#0B1F3A", color: "#fff", fontWeight: 900, cursor: "pointer" }, muted: { color: "#64748B", lineHeight: 1.6 }, info: { display: "grid", gap: 5, padding: "10px 0", borderBottom: "1px solid #EEF2F7" },
  consoleCard: { background: "#0B1220", borderRadius: 24, padding: 18, color: "#fff" }, consoleHeader: { display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }, clear: { border: "1px solid #334155", background: "#111827", color: "#CBD5E1", borderRadius: 10, padding: "7px 10px", cursor: "pointer" },
  console: { minHeight: 320, maxHeight: 700, overflow: "auto", whiteSpace: "pre-wrap", color: "#D1FAE5", fontFamily: "Consolas,monospace", fontSize: 12 }, smallConsole: { marginTop: 14, background: "#111827", color: "#D1FAE5", padding: 12, borderRadius: 12, overflow: "auto" },
};
