"use client";

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

function shortCode(value: string | null) {
  if (!value) {
    return "Archivo no existia o sera eliminado.";
  }

  return value.length > 6000 ? value.slice(0, 6000) + "\n\n...recortado..." : value;
}

export default function MarketLeaderPanel() {
  const [projectPath, setProjectPath] = useState("C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares");
  const [model, setModel] = useState("gpt-5.1-codex-mini");
  const [prompt, setPrompt] = useState(
    "Mejora esta app para que tenga login, dashboard premium, estado vacio profesional y estructura lista para vender.",
  );
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [selectedPath, setSelectedPath] = useState<string>("");

  const selectedEntry = useMemo(() => {
    if (!changeSet) {
      return null;
    }

    return changeSet.entries.find((entry) => entry.path === selectedPath) || changeSet.entries[0] || null;
  }, [changeSet, selectedPath]);

  async function createChangeSet() {
    setBusy(true);
    setLog("Creando change-set con agente multiarchivo...");

    try {
      const data = await postJson<{ changeSet: ChangeSet }>("/api/project/change-set/create", {
        projectPath,
        prompt,
        model,
      });

      setChangeSet(data.changeSet);
      setSelectedPath(data.changeSet.entries[0]?.path || "");
      setLog("Change-set creado. Revisa el diff antes de aplicar.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function applyChangeSet() {
    if (!changeSet) {
      return;
    }

    setBusy(true);
    setLog("Aplicando cambios, validando y preparando rollback si falla...");

    try {
      const data = await postJson<{ ok: boolean; status: string; changeSet: ChangeSet }>("/api/project/change-set/apply", {
        projectPath,
        changeSetId: changeSet.id,
        validate: true,
        autoRollback: true,
      });

      setChangeSet(data.changeSet);
      setLog("Resultado: " + data.status);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectChangeSet() {
    if (!changeSet) {
      return;
    }

    setBusy(true);
    setLog("Rechazando change-set...");

    try {
      const data = await postJson<{ changeSet: ChangeSet }>("/api/project/change-set/reject", {
        projectPath,
        changeSetId: changeSet.id,
      });

      setChangeSet(data.changeSet);
      setLog("Change-set rechazado.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function gitStatus() {
    setBusy(true);
    setLog("Consultando Git...");

    try {
      const data = await postJson<{ result: { branch: string; status: { stdout: string; stderr: string } } }>(
        "/api/project/git/status",
        { projectPath },
      );

      setLog(
        "Rama: " +
          data.result.branch +
          "\n\n" +
          (data.result.status.stdout || data.result.status.stderr || "Sin cambios."),
      );
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function gitCommit() {
    setBusy(true);
    setLog("Creando commit...");

    try {
      const data = await postJson<{ ok: boolean; result: { commit?: { stdout: string; stderr: string } } }>(
        "/api/project/git/commit",
        {
          projectPath,
          message: "feat: cambios aplicados por VACoder Market Leader",
        },
      );

      setLog(JSON.stringify(data, null, 2));
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.badge}>VACoder Market Leader</p>
        <h1 style={styles.title}>IA multiarchivo + diff visual + aprobacion + Git</h1>
        <p style={styles.description}>
          Este modo genera un change-set antes de tocar el proyecto. Puedes revisar,
          aprobar, rechazar, validar, hacer rollback y crear commit.
        </p>
      </section>

      <section style={styles.panel}>
        <label style={styles.field}>
          <span>Ruta del proyecto objetivo</span>
          <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
        </label>

        <label style={styles.field}>
          <span>Modelo</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} />
        </label>

        <label style={styles.field}>
          <span>Prompt de producto</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
        </label>

        <div style={styles.actions}>
          <button type="button" onClick={createChangeSet} disabled={busy}>
            Crear change-set IA
          </button>

          <button type="button" onClick={applyChangeSet} disabled={busy || !changeSet}>
            Aprobar + aplicar + validar
          </button>

          <button type="button" onClick={rejectChangeSet} disabled={busy || !changeSet}>
            Rechazar
          </button>

          <button type="button" onClick={gitStatus} disabled={busy}>
            Git status
          </button>

          <button type="button" onClick={gitCommit} disabled={busy}>
            Git commit
          </button>
        </div>

        {log ? <pre style={styles.log}>{log}</pre> : null}
      </section>

      {changeSet ? (
        <section style={styles.panel}>
          <div style={styles.changeHeader}>
            <div>
              <p style={styles.badge}>Change-set</p>
              <h2>{changeSet.summary}</h2>
              <p>Estado: {changeSet.status} | Riesgo: {changeSet.risk} | Modelo: {changeSet.model}</p>
            </div>

            <strong>{changeSet.entries.length} archivo(s)</strong>
          </div>

          <div style={styles.steps}>
            {changeSet.steps.map((step, index) => (
              <div key={index} style={styles.step}>
                {index + 1}. {step}
              </div>
            ))}
          </div>

          <div style={styles.diffLayout}>
            <aside style={styles.fileList}>
              {changeSet.entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => setSelectedPath(entry.path)}
                  style={{
                    ...styles.fileButton,
                    borderColor: selectedEntry?.path === entry.path ? "#D72638" : "#E5E7EB",
                  }}
                >
                  <strong>{entry.path}</strong>
                  <span>{entry.action}</span>
                </button>
              ))}
            </aside>

            {selectedEntry ? (
              <section style={styles.diffViewer}>
                <h3>{selectedEntry.path}</h3>
                <p>{selectedEntry.reason}</p>

                <div style={styles.columns}>
                  <div>
                    <h4>Antes</h4>
                    <pre style={styles.code}>{shortCode(selectedEntry.before)}</pre>
                  </div>

                  <div>
                    <h4>Despues</h4>
                    <pre style={styles.code}>{shortCode(selectedEntry.after)}</pre>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <details style={styles.notes}>
            <summary>Notas tecnicas</summary>
            <pre>{changeSet.notes.join("\n")}</pre>
          </details>
        </section>
      ) : null}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F5F7FA",
    padding: "32px 6vw",
    color: "#0B1F3A",
  },
  hero: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    marginBottom: 18,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
  badge: {
    display: "inline-flex",
    background: "rgba(215, 38, 56, 0.12)",
    color: "#D72638",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
    margin: 0,
  },
  title: {
    fontSize: "2.6rem",
    margin: "16px 0 8px",
  },
  description: {
    color: "#4B5563",
    lineHeight: 1.7,
    maxWidth: 900,
  },
  panel: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
  field: {
    display: "grid",
    gap: 8,
    marginBottom: 14,
    fontWeight: 900,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  log: {
    background: "#0B1F3A",
    color: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    whiteSpace: "pre-wrap",
    marginTop: 16,
  },
  changeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "start",
  },
  steps: {
    display: "grid",
    gap: 8,
    margin: "18px 0",
  },
  step: {
    padding: 12,
    borderRadius: 14,
    background: "#F8FAFC",
    color: "#1F2937",
    fontWeight: 700,
  },
  diffLayout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 18,
  },
  fileList: {
    display: "grid",
    gap: 8,
    alignContent: "start",
  },
  fileButton: {
    display: "grid",
    gap: 6,
    textAlign: "left",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    cursor: "pointer",
    color: "#0B1F3A",
  },
  diffViewer: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 18,
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  code: {
    background: "#111827",
    color: "#E5E7EB",
    padding: 14,
    borderRadius: 14,
    overflow: "auto",
    maxHeight: 520,
    whiteSpace: "pre-wrap",
    fontSize: 12,
  },
  notes: {
    marginTop: 18,
  },
};
