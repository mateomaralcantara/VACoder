"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

type ScoreItem = {
  area: string;
  item: string;
  status: "ok" | "warn" | "fail";
  points: number;
  max: number;
  details: string;
};

type ProductScore = {
  score: number;
  maxScore: number;
  percent: number;
  grade: string;
  readyToSell: boolean;
  items: ScoreItem[];
  missing: string[];
  recommendations: string[];
};

type TeamFinding = {
  role: string;
  title: string;
  priority: string;
  recommendation: string;
};

type SupremeModule = {
  id: string;
  name: string;
  category: string;
  description: string;
  businessValue: string;
  files: string[];
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

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Fallo solicitud: " + url);
  }

  return data as T;
}

function statusColor(status: string) {
  if (status === "ok") return "#059669";
  if (status === "warn") return "#B45309";
  return "#DC2626";
}

export default function SupremeCommandCenter() {
  const [projectPath, setProjectPath] = useState("C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares");
  const [previewUrl, setPreviewUrl] = useState("http://localhost:3000");
  const [score, setScore] = useState<ProductScore | null>(null);
  const [team, setTeam] = useState<TeamFinding[]>([]);
  const [modules, setModules] = useState<SupremeModule[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("Supreme Command Center listo.");

  function pushLog(message: string) {
    setLog((current) => "[" + new Date().toLocaleTimeString() + "] " + message + "\n" + current);
  }

  async function runProductScore() {
    setBusy(true);
    pushLog("Ejecutando Product Score...");

    try {
      const data = await postJson<{ score: ProductScore; team: TeamFinding[] }>("/api/supreme/score", {
        projectPath,
      });

      setScore(data.score);
      setTeam(data.team);
      pushLog("Product Score: " + data.score.percent + "% - " + data.score.grade);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error evaluando producto.");
    } finally {
      setBusy(false);
    }
  }

  async function loadModules() {
    setBusy(true);
    pushLog("Cargando Module Store...");

    try {
      const data = await getJson<{ modules: SupremeModule[] }>("/api/supreme/modules");
      setModules(data.modules);
      pushLog("Modulos cargados: " + data.modules.length);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error cargando modulos.");
    } finally {
      setBusy(false);
    }
  }

  async function installModule(moduleId: string) {
    setBusy(true);
    pushLog("Registrando modulo: " + moduleId);

    try {
      const data = await postJson<{ message: string }>("/api/supreme/modules", {
        projectPath,
        moduleId,
      });

      pushLog(data.message || "Modulo registrado.");
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error instalando modulo.");
    } finally {
      setBusy(false);
    }
  }

  async function visualTest() {
    setBusy(true);
    pushLog("Ejecutando Visual Tester...");

    try {
      const data = await postJson<{ result: unknown }>("/api/supreme/visual-test", {
        projectPath,
        url: previewUrl,
      });

      pushLog(JSON.stringify(data.result, null, 2));
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error ejecutando visual test.");
    } finally {
      setBusy(false);
    }
  }

  async function deployStatus() {
    setBusy(true);
    pushLog("Consultando Deploy Status...");

    try {
      const data = await postJson<{ status: unknown }>("/api/supreme/deploy/status", {
        projectPath,
      });

      pushLog(JSON.stringify(data.status, null, 2));
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error consultando deploy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.badge}>VACoder Supreme</p>
          <h1 style={styles.title}>Command Center para superar el mercado</h1>
          <p style={styles.text}>
            Evalua si una app esta lista para vender, activa equipo multiagente,
            registra memoria, prueba preview, prepara deploy y administra modulos premium.
          </p>
        </div>

        <div style={styles.scoreBox}>
          <span>Structural Core</span>
          <strong>10/10</strong>
          <small>Base lista para evolucionar</small>
        </div>
      </section>

      <section style={styles.grid2}>
        <div style={styles.card}>
          <h2>Proyecto objetivo</h2>

          <label style={styles.field}>
            <span>Ruta</span>
            <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Preview URL</span>
            <input value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
          </label>

          <div style={styles.actions}>
            <button type="button" disabled={busy} onClick={runProductScore}>
              Product Score
            </button>
            <button type="button" disabled={busy} onClick={visualTest}>
              Visual Test
            </button>
            <button type="button" disabled={busy} onClick={deployStatus}>
              Deploy Status
            </button>
            <button type="button" disabled={busy} onClick={loadModules}>
              Module Store
            </button>
          </div>
        </div>

        <div style={styles.cardDark}>
          <h2>Resultado ejecutivo</h2>

          {score ? (
            <>
              <div style={styles.bigScore}>{score.percent}%</div>
              <strong>{score.grade}</strong>
              <p>Score: {score.score} / {score.maxScore}</p>
              <p>{score.readyToSell ? "Lista para venta fuerte." : "Todavia faltan piezas para venta fuerte."}</p>
            </>
          ) : (
            <p>Ejecuta Product Score para medir la app como negocio digital.</p>
          )}
        </div>
      </section>

      <section style={styles.grid3}>
        <div style={styles.card}>
          <h2>Quality Gates</h2>

          {score ? (
            <div style={styles.list}>
              {score.items.map((item) => (
                <div key={item.area + item.item} style={styles.row}>
                  <span style={{ ...styles.dot, background: statusColor(item.status) }} />
                  <div>
                    <strong>{item.area} / {item.item}</strong>
                    <p>{item.points} / {item.max} - {item.details}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Sin evaluacion todavia.</p>
          )}
        </div>

        <div style={styles.card}>
          <h2>Multi-Agent Team</h2>

          <div style={styles.list}>
            {team.length ? (
              team.map((item) => (
                <div key={item.role + item.title} style={styles.agentCard}>
                  <span>{item.role} Â· {item.priority}</span>
                  <strong>{item.title}</strong>
                  <p>{item.recommendation}</p>
                </div>
              ))
            ) : (
              <p>El equipo se activa despues del Product Score.</p>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <h2>Module Store</h2>

          <div style={styles.list}>
            {modules.length ? (
              modules.map((module) => (
                <div key={module.id} style={styles.moduleCard}>
                  <span>{module.category}</span>
                  <strong>{module.name}</strong>
                  <p>{module.businessValue}</p>
                  <button type="button" disabled={busy} onClick={() => installModule(module.id)}>
                    Registrar modulo
                  </button>
                </div>
              ))
            ) : (
              <p>Presiona Module Store para cargar modulos premium.</p>
            )}
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2>Supreme Console</h2>
        <pre style={styles.console}>{log}</pre>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#EEF2F7",
    color: "#0B1F3A",
    padding: "32px 5vw",
    display: "grid",
    gap: 18,
  },
  hero: {
    background: "linear-gradient(135deg, #FFFFFF, #F8FAFC, #EEF2FF)",
    borderRadius: 32,
    padding: 30,
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    boxShadow: "0 22px 60px rgba(15,23,42,.08)",
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(215,38,56,.12)",
    color: "#D72638",
    fontWeight: 900,
    margin: 0,
  },
  title: {
    fontSize: 44,
    lineHeight: 1,
    margin: "14px 0",
  },
  text: {
    color: "#475569",
    lineHeight: 1.7,
    maxWidth: 880,
  },
  scoreBox: {
    minWidth: 230,
    borderRadius: 28,
    background: "#0B1F3A",
    color: "#FFFFFF",
    padding: 24,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr",
    gap: 18,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 18,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 48px rgba(15,23,42,.07)",
  },
  cardDark: {
    background: "#0B1F3A",
    color: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 48px rgba(15,23,42,.12)",
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
  },
  bigScore: {
    fontSize: 76,
    fontWeight: 900,
    lineHeight: 1,
  },
  list: {
    display: "grid",
    gap: 12,
    maxHeight: 620,
    overflow: "auto",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    gap: 12,
    alignItems: "start",
    padding: 12,
    borderRadius: 16,
    background: "#F8FAFC",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
  },
  agentCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 14,
    background: "#F8FAFC",
  },
  moduleCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 14,
    background: "#FFFFFF",
    display: "grid",
    gap: 8,
  },
  console: {
    background: "#111827",
    color: "#E5E7EB",
    borderRadius: 18,
    padding: 18,
    minHeight: 260,
    maxHeight: 520,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "Consolas, monospace",
  },
};
