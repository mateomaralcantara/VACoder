$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

if (!(Test-Path $Root)) {
  throw "No existe Coder en: $Root"
}

Set-Location $Root

$BackupDir = Join-Path $Root ("_backup-market-premium-view-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

function Backup-File {
  param([string]$RelativePath)

  $Source = Join-Path $Root $RelativePath

  if (Test-Path $Source) {
    $Dest = Join-Path $BackupDir $RelativePath
    $DestDir = Split-Path $Dest -Parent

    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    Copy-Item $Source $Dest -Force
  }
}

function Write-ProjectFile {
  param(
    [string]$RelativePath,
    [string]$Content
  )

  Backup-File $RelativePath

  $FullPath = Join-Path $Root $RelativePath
  $Dir = Split-Path $FullPath -Parent

  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  Set-Content -Path $FullPath -Value $Content -Encoding UTF8

  Write-Host "[OK] $RelativePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== INSTALANDO VISTA MARKET PREMIUM ===" -ForegroundColor Cyan
Write-Host "Backup: $BackupDir"
Write-Host ""

Write-ProjectFile "components\market-leader-premium-view.tsx" @'
"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

type ChangeEntry = {
  path: string;
  action: "upsert" | "delete";
  before: string | null;
  after: string | null;
  reason: string;
};

type ChangeSet = {
  id: string;
  projectPath: string;
  prompt: string;
  model: string;
  status: string;
  summary: string;
  risk: "low" | "medium" | "high";
  steps: string[];
  entries: ChangeEntry[];
  notes: string[];
};

type ApiChangeSetResponse = {
  ok?: boolean;
  changeSet: ChangeSet;
};

type ApiApplyResponse = {
  ok?: boolean;
  status: string;
  changeSet: ChangeSet;
  validation?: unknown;
};

type GitStatusResponse = {
  ok?: boolean;
  result: {
    branch: string;
    status: {
      stdout: string;
      stderr: string;
      exitCode?: number;
    };
  };
};

type GitCommitResponse = {
  ok?: boolean;
  result: unknown;
};

const marketPlaybooks = [
  {
    title: "App SaaS Premium",
    detail: "Dashboard, login, roles, pricing, estados vacios y panel admin.",
  },
  {
    title: "Migracion / Visas",
    detail: "CRM legal, expedientes, checklist, citas, pagos y documentos PDF.",
  },
  {
    title: "Marketplace",
    detail: "Catalogo, checkout, ordenes, autores, vendedores y comisiones.",
  },
  {
    title: "Transporte / Courier",
    detail: "Roles, conductor, pasajero, courier, mapa, creditos y wallet.",
  },
];

const agentModes = [
  {
    name: "Architect",
    score: "Plan",
    text: "Analiza estructura, rutas, riesgos y dependencias antes de tocar codigo.",
  },
  {
    name: "Builder",
    score: "Code",
    text: "Genera operaciones multiarchivo con rutas seguras y contenido completo.",
  },
  {
    name: "Reviewer",
    score: "Diff",
    text: "Muestra antes/despues, razon del cambio y nivel de riesgo.",
  },
  {
    name: "Release",
    score: "Ship",
    text: "Aplica, valida, rollback si falla y deja listo para Git commit.",
  },
];

function getRiskStyle(risk?: string): CSSProperties {
  if (risk === "high") {
    return {
      background: "rgba(220, 38, 38, 0.12)",
      color: "#991B1B",
      borderColor: "rgba(220, 38, 38, 0.25)",
    };
  }

  if (risk === "medium") {
    return {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#92400E",
      borderColor: "rgba(245, 158, 11, 0.25)",
    };
  }

  return {
    background: "rgba(5, 150, 105, 0.12)",
    color: "#065F46",
    borderColor: "rgba(5, 150, 105, 0.25)",
  };
}

function shortCode(value: string | null) {
  if (!value) {
    return "Archivo no existia o sera eliminado.";
  }

  if (value.length > 12000) {
    return value.slice(0, 12000) + "\n\n...contenido recortado para vista...";
  }

  return value;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Fallo solicitud: " + url);
  }

  return data as T;
}

export default function MarketLeaderPremiumView() {
  const [projectPath, setProjectPath] = useState("C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares");
  const [model, setModel] = useState("gpt-5.1-codex-mini");
  const [prompt, setPrompt] = useState(
    "Analiza esta app y conviertela en un producto premium listo para vender. Agrega dashboard profesional, estados vacios, navegacion clara, componentes reutilizables, estructura visual moderna y validacion completa. No rompas el build.",
  );
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [consoleLog, setConsoleLog] = useState("Market Leader listo. Crea un change-set para iniciar.");
  const [activeTab, setActiveTab] = useState<"overview" | "diff" | "release">("overview");

  const selectedEntry = useMemo(() => {
    if (!changeSet) {
      return null;
    }

    return changeSet.entries.find((entry) => entry.path === selectedPath) || changeSet.entries[0] || null;
  }, [changeSet, selectedPath]);

  const upserts = useMemo(() => {
    return changeSet?.entries.filter((entry) => entry.action === "upsert").length || 0;
  }, [changeSet]);

  const deletes = useMemo(() => {
    return changeSet?.entries.filter((entry) => entry.action === "delete").length || 0;
  }, [changeSet]);

  const pipeline = useMemo(() => {
    return [
      {
        title: "1. Context Scan",
        state: "ready",
        detail: "Lee archivos relevantes del proyecto.",
      },
      {
        title: "2. Agent Plan",
        state: changeSet ? "done" : "pending",
        detail: "Produce plan, riesgo, notas y pasos.",
      },
      {
        title: "3. Change-set",
        state: changeSet ? "done" : "pending",
        detail: "Prepara operaciones sin modificar todavia.",
      },
      {
        title: "4. Human Approval",
        state: changeSet?.status === "created" ? "ready" : changeSet ? "done" : "pending",
        detail: "Revisas antes/despues y apruebas o rechazas.",
      },
      {
        title: "5. Validate / Rollback",
        state: changeSet?.status === "applied" ? "done" : "pending",
        detail: "Aplica, valida y revierte si falla.",
      },
    ];
  }, [changeSet]);

  function appendLog(message: string) {
    setConsoleLog((current) => {
      const time = new Date().toLocaleTimeString();
      return "[" + time + "] " + message + "\n" + current;
    });
  }

  async function createChangeSet() {
    setBusy(true);
    appendLog("Creando change-set IA multiarchivo...");
    setActiveTab("overview");

    try {
      const data = await postJson<ApiChangeSetResponse>("/api/project/change-set/create", {
        projectPath,
        prompt,
        model,
      });

      setChangeSet(data.changeSet);
      setSelectedPath(data.changeSet.entries[0]?.path || "");
      setActiveTab("diff");
      appendLog("Change-set creado: " + data.changeSet.entries.length + " archivo(s).");
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "Error desconocido creando change-set.");
    } finally {
      setBusy(false);
    }
  }

  async function applyChangeSet() {
    if (!changeSet) {
      return;
    }

    setBusy(true);
    appendLog("Aplicando cambios con validacion y rollback automatico...");
    setActiveTab("release");

    try {
      const data = await postJson<ApiApplyResponse>("/api/project/change-set/apply", {
        projectPath,
        changeSetId: changeSet.id,
        validate: true,
        autoRollback: true,
      });

      setChangeSet(data.changeSet);
      appendLog("Resultado apply: " + data.status);
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "Error desconocido aplicando change-set.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectChangeSet() {
    if (!changeSet) {
      return;
    }

    setBusy(true);
    appendLog("Rechazando change-set...");

    try {
      const data = await postJson<ApiChangeSetResponse>("/api/project/change-set/reject", {
        projectPath,
        changeSetId: changeSet.id,
      });

      setChangeSet(data.changeSet);
      appendLog("Change-set rechazado.");
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "Error desconocido rechazando change-set.");
    } finally {
      setBusy(false);
    }
  }

  async function gitStatus() {
    setBusy(true);
    appendLog("Consultando Git status...");

    try {
      const data = await postJson<GitStatusResponse>("/api/project/git/status", {
        projectPath,
      });

      appendLog(
        "Git branch: " +
          data.result.branch +
          "\n" +
          (data.result.status.stdout || data.result.status.stderr || "Sin cambios visibles."),
      );
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "Error desconocido consultando Git.");
    } finally {
      setBusy(false);
    }
  }

  async function gitCommit() {
    setBusy(true);
    appendLog("Creando Git commit...");

    try {
      const data = await postJson<GitCommitResponse>("/api/project/git/commit", {
        projectPath,
        message: "feat: market leader changes by VACoder",
      });

      appendLog(JSON.stringify(data, null, 2));
    } catch (error) {
      appendLog(error instanceof Error ? error.message : "Error desconocido creando commit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.logoBox}>
          <div style={styles.logoMark}>VA</div>
          <div>
            <strong>VACoder</strong>
            <span>Market Leader OS</span>
          </div>
        </div>

        <nav style={styles.nav}>
          <button style={styles.navActive}>Command Center</button>
          <button>Agent Planner</button>
          <button>Change-sets</button>
          <button>Quality Gates</button>
          <button>Release Room</button>
        </nav>

        <div style={styles.sideCard}>
          <span>Scanner</span>
          <strong>10 / 10</strong>
          <p>Build, TypeScript, Core, Security y APIs base limpios.</p>
        </div>

        <div style={styles.sideCardDark}>
          <span>Market Goal</span>
          <strong>Idea → App vendible</strong>
          <p>Plan, diff, aprobacion, validacion, rollback y commit.</p>
        </div>
      </aside>

      <section style={styles.content}>
        <header style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>Premium Agent Command Center</p>
            <h1 style={styles.title}>Market Leader Studio</h1>
            <p style={styles.subtitle}>
              Un panel especializado para convertir una idea en cambios multiarchivo revisables,
              aplicables, validados y listos para Git.
            </p>
          </div>

          <div style={styles.heroScore}>
            <span>Structural Score</span>
            <strong>10/10</strong>
            <small>0 fallas · 0 warnings</small>
          </div>
        </header>

        <section style={styles.kpiGrid}>
          <div style={styles.kpiCard}>
            <span>Estado</span>
            <strong>{changeSet ? changeSet.status : "standby"}</strong>
            <p>Change-set actual</p>
          </div>

          <div style={styles.kpiCard}>
            <span>Archivos</span>
            <strong>{changeSet ? changeSet.entries.length : 0}</strong>
            <p>{upserts} upsert · {deletes} delete</p>
          </div>

          <div style={styles.kpiCard}>
            <span>Riesgo</span>
            <strong>{changeSet ? changeSet.risk : "none"}</strong>
            <p>Evaluacion del agente</p>
          </div>

          <div style={styles.kpiCard}>
            <span>Modelo</span>
            <strong>{model}</strong>
            <p>IA configurada</p>
          </div>
        </section>

        <section style={styles.controlGrid}>
          <div style={styles.commandPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Agent Input</p>
                <h2>Orden de producto</h2>
              </div>
              <span style={styles.pill}>Safe write · Diff first</span>
            </div>

            <label style={styles.field}>
              <span>Proyecto objetivo</span>
              <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
            </label>

            <label style={styles.field}>
              <span>Modelo</span>
              <input value={model} onChange={(event) => setModel(event.target.value)} />
            </label>

            <label style={styles.field}>
              <span>Instruccion premium</span>
              <textarea rows={8} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>

            <div style={styles.actionBar}>
              <button style={styles.primaryButton} type="button" disabled={busy} onClick={createChangeSet}>
                Crear change-set IA
              </button>

              <button style={styles.successButton} type="button" disabled={busy || !changeSet} onClick={applyChangeSet}>
                Aprobar + aplicar
              </button>

              <button style={styles.dangerButton} type="button" disabled={busy || !changeSet} onClick={rejectChangeSet}>
                Rechazar
              </button>

              <button style={styles.secondaryButton} type="button" disabled={busy} onClick={gitStatus}>
                Git status
              </button>

              <button style={styles.secondaryButton} type="button" disabled={busy} onClick={gitCommit}>
                Git commit
              </button>
            </div>
          </div>

          <div style={styles.agentPanel}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.eyebrow}>Agent Modes</p>
                <h2>Motor Market Leader</h2>
              </div>
            </div>

            <div style={styles.modeGrid}>
              {agentModes.map((mode) => (
                <article key={mode.name} style={styles.modeCard}>
                  <div>
                    <strong>{mode.name}</strong>
                    <span>{mode.score}</span>
                  </div>
                  <p>{mode.text}</p>
                </article>
              ))}
            </div>

            <div style={styles.pipeline}>
              {pipeline.map((item) => (
                <div key={item.title} style={styles.pipelineRow}>
                  <span style={{
                    ...styles.statusDot,
                    background:
                      item.state === "done"
                        ? "#059669"
                        : item.state === "ready"
                          ? "#D72638"
                          : "#CBD5E1",
                  }} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.workspace}>
          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              style={activeTab === "overview" ? styles.tabActive : styles.tab}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diff")}
              style={activeTab === "diff" ? styles.tabActive : styles.tab}
            >
              Diff Review
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("release")}
              style={activeTab === "release" ? styles.tabActive : styles.tab}
            >
              Release Console
            </button>
          </div>

          {activeTab === "overview" ? (
            <div style={styles.overviewGrid}>
              <div style={styles.summaryCard}>
                <p style={styles.eyebrow}>Current Change-set</p>
                <h2>{changeSet ? changeSet.summary : "Todavia no hay change-set generado"}</h2>

                {changeSet ? (
                  <>
                    <span style={{ ...styles.riskPill, ...getRiskStyle(changeSet.risk) }}>
                      Riesgo: {changeSet.risk}
                    </span>

                    <div style={styles.stepsBox}>
                      {changeSet.steps.map((step, index) => (
                        <div key={index} style={styles.stepItem}>
                          <span>{index + 1}</span>
                          <p>{step}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={styles.muted}>
                    Escribe una instruccion y presiona Crear change-set IA.
                  </p>
                )}
              </div>

              <div style={styles.playbookGrid}>
                {marketPlaybooks.map((playbook) => (
                  <article key={playbook.title} style={styles.playbookCard}>
                    <strong>{playbook.title}</strong>
                    <p>{playbook.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "diff" ? (
            <div style={styles.diffGrid}>
              <aside style={styles.fileRail}>
                <p style={styles.eyebrow}>Modified Files</p>

                {changeSet?.entries.length ? (
                  changeSet.entries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      onClick={() => setSelectedPath(entry.path)}
                      style={{
                        ...styles.fileButton,
                        borderColor: selectedEntry?.path === entry.path ? "#D72638" : "#E5E7EB",
                        background: selectedEntry?.path === entry.path ? "#FFF1F2" : "#FFFFFF",
                      }}
                    >
                      <strong>{entry.path}</strong>
                      <span>{entry.action} · {entry.reason}</span>
                    </button>
                  ))
                ) : (
                  <p style={styles.muted}>No hay archivos para revisar todavia.</p>
                )}
              </aside>

              <section style={styles.diffViewer}>
                {selectedEntry ? (
                  <>
                    <div style={styles.diffHeader}>
                      <div>
                        <p style={styles.eyebrow}>Selected File</p>
                        <h2>{selectedEntry.path}</h2>
                        <p>{selectedEntry.reason}</p>
                      </div>

                      <span style={styles.pill}>{selectedEntry.action}</span>
                    </div>

                    <div style={styles.codeColumns}>
                      <div>
                        <h3>Antes</h3>
                        <pre style={styles.codeBlock}>{shortCode(selectedEntry.before)}</pre>
                      </div>

                      <div>
                        <h3>Despues</h3>
                        <pre style={styles.codeBlock}>{shortCode(selectedEntry.after)}</pre>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={styles.emptyState}>
                    <strong>Diff visual pendiente</strong>
                    <p>Crea un change-set para ver comparacion antes/despues.</p>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "release" ? (
            <div style={styles.releaseGrid}>
              <div style={styles.qualityCard}>
                <p style={styles.eyebrow}>Quality Gates</p>
                <h2>Checklist de salida</h2>

                <div style={styles.checkList}>
                  <div><strong>✓</strong> Typecheck obligatorio</div>
                  <div><strong>✓</strong> Build obligatorio</div>
                  <div><strong>✓</strong> Rollback automatico si falla</div>
                  <div><strong>✓</strong> Git status antes de commit</div>
                  <div><strong>✓</strong> Registro del change-set</div>
                </div>
              </div>

              <div style={styles.consoleCard}>
                <p style={styles.eyebrow}>Live Console</p>
                <pre style={styles.console}>{consoleLog}</pre>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    background: "#EEF2F7",
    color: "#0B1F3A",
  },
  sidebar: {
    background: "linear-gradient(180deg, #061427 0%, #0B1F3A 52%, #111827 100%)",
    color: "#FFFFFF",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  logoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg, #D72638, #2563EB)",
    fontWeight: 900,
  },
  nav: {
    display: "grid",
    gap: 8,
  },
  navActive: {
    background: "rgba(255,255,255,0.14)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 14,
    padding: "12px 14px",
    textAlign: "left",
    fontWeight: 800,
  },
  sideCard: {
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 22,
    padding: 18,
  },
  sideCardDark: {
    background: "rgba(215, 38, 56, 0.22)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 22,
    padding: 18,
  },
  content: {
    padding: 28,
    display: "grid",
    gap: 18,
  },
  hero: {
    background: "linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 55%, #EEF2FF 100%)",
    borderRadius: 30,
    padding: 28,
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: 22,
    alignItems: "center",
  },
  eyebrow: {
    color: "#D72638",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: 900,
    margin: 0,
  },
  title: {
    fontSize: 46,
    lineHeight: 1,
    margin: "10px 0",
  },
  subtitle: {
    color: "#475569",
    maxWidth: 860,
    lineHeight: 1.7,
    margin: 0,
  },
  heroScore: {
    minWidth: 210,
    borderRadius: 26,
    padding: 22,
    background: "#0B1F3A",
    color: "#FFFFFF",
    display: "grid",
    gap: 6,
    textAlign: "center",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  kpiCard: {
    background: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 16px 42px rgba(15, 23, 42, 0.06)",
  },
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 18,
  },
  commandPanel: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 16px 42px rgba(15, 23, 42, 0.06)",
  },
  agentPanel: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 16px 42px rgba(15, 23, 42, 0.06)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
  },
  pill: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(37, 99, 235, 0.10)",
    color: "#1D4ED8",
    fontWeight: 900,
    fontSize: 12,
  },
  field: {
    display: "grid",
    gap: 8,
    marginBottom: 14,
    fontWeight: 900,
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    background: "#D72638",
    color: "#FFFFFF",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  successButton: {
    background: "#059669",
    color: "#FFFFFF",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    background: "#111827",
    color: "#FFFFFF",
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#F8FAFC",
    color: "#0B1F3A",
    border: "1px solid #E5E7EB",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  modeGrid: {
    display: "grid",
    gap: 10,
  },
  modeCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 14,
    background: "#F8FAFC",
  },
  pipeline: {
    display: "grid",
    gap: 12,
    marginTop: 18,
  },
  pipelineRow: {
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    gap: 12,
    alignItems: "start",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 5,
  },
  workspace: {
    background: "#FFFFFF",
    borderRadius: 30,
    padding: 24,
    boxShadow: "0 16px 42px rgba(15, 23, 42, 0.06)",
  },
  tabs: {
    display: "flex",
    gap: 10,
    borderBottom: "1px solid #E5E7EB",
    paddingBottom: 14,
    marginBottom: 18,
  },
  tab: {
    background: "#F8FAFC",
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabActive: {
    background: "#0B1F3A",
    color: "#FFFFFF",
    border: "1px solid #0B1F3A",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  summaryCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 24,
    padding: 20,
  },
  riskPill: {
    display: "inline-flex",
    border: "1px solid",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
  },
  stepsBox: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  stepItem: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: 10,
    alignItems: "start",
    background: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
  },
  playbookGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  playbookCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 20,
    padding: 16,
    background: "linear-gradient(180deg, #FFFFFF, #F8FAFC)",
  },
  diffGrid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 18,
  },
  fileRail: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  fileButton: {
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gap: 6,
    textAlign: "left",
    cursor: "pointer",
    color: "#0B1F3A",
  },
  diffViewer: {
    border: "1px solid #E5E7EB",
    borderRadius: 24,
    padding: 20,
    minHeight: 520,
  },
  diffHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "start",
    marginBottom: 16,
  },
  codeColumns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  codeBlock: {
    background: "#111827",
    color: "#E5E7EB",
    borderRadius: 18,
    padding: 16,
    minHeight: 420,
    maxHeight: 620,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "Consolas, monospace",
    fontSize: 12,
  },
  emptyState: {
    minHeight: 420,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    color: "#64748B",
  },
  releaseGrid: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.3fr",
    gap: 18,
  },
  qualityCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 24,
    padding: 20,
  },
  checkList: {
    display: "grid",
    gap: 12,
    marginTop: 16,
  },
  consoleCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 24,
    padding: 20,
  },
  console: {
    background: "#0B1F3A",
    color: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    minHeight: 360,
    maxHeight: 560,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "Consolas, monospace",
  },
  muted: {
    color: "#64748B",
    lineHeight: 1.6,
  },
};
'@

Write-ProjectFile "app\market\page.tsx" @'
import MarketLeaderPremiumView from "@/components/market-leader-premium-view";

export default function MarketPage() {
  return <MarketLeaderPremiumView />;
}
'@

Write-ProjectFile "scripts\check-market-premium-view.ps1" @'
$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK MARKET PREMIUM VIEW ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "components\market-leader-premium-view.tsx",
  "app\market\page.tsx"
)

foreach ($File in $Files) {
  if (Test-Path (Join-Path $Root $File)) {
    Write-Host "[OK] $File" -ForegroundColor Green
  } else {
    throw "Falta archivo: $File"
  }
}

Write-Host ""
Write-Host "Ejecutando typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Ejecutando build..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "VISTA MARKET PREMIUM VALIDADA." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/market"
Write-Host ""
'@

Write-Host ""
Write-Host "Vista Market Premium instalada." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\check-market-premium-view.ps1"
Write-Host ""