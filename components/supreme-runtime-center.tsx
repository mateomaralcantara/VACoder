"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type RuntimeSession = {
  id: string;
  projectPath: string;
  command: string;
  port: number;
  previewUrl: string;
  status: "starting" | "running" | "stopped" | "failed";
  startedAt: string;
  stoppedAt?: string;
  pid?: number;
  exitCode?: number | null;
  logs: string[];
};

type PortInfo = {
  port: number;
  free: boolean;
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

function statusStyle(status?: string): CSSProperties {
  if (status === "running") {
    return {
      background: "rgba(5,150,105,.12)",
      color: "#065F46",
    };
  }

  if (status === "failed") {
    return {
      background: "rgba(220,38,38,.12)",
      color: "#991B1B",
    };
  }

  if (status === "stopped") {
    return {
      background: "rgba(71,85,105,.12)",
      color: "#334155",
    };
  }

  return {
    background: "rgba(245,158,11,.12)",
    color: "#92400E",
  };
}

export default function SupremeRuntimeCenter() {
  const [projectPath, setProjectPath] = useState("C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares");
  const [port, setPort] = useState(3001);
  const [command, setCommand] = useState("npm run dev -- --port 3001");
  const [terminalCommand, setTerminalCommand] = useState("npm run build");
  const [sessions, setSessions] = useState<RuntimeSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [consoleLog, setConsoleLog] = useState("Runtime Center listo.");
  const [busy, setBusy] = useState(false);

  const activeSession = useMemo(() => {
    return sessions.find((session) => session.id === activeId) || sessions[0] || null;
  }, [sessions, activeId]);

  function pushLog(message: string) {
    setConsoleLog((current) => "[" + new Date().toLocaleTimeString() + "] " + message + "\n" + current);
  }

  async function refreshSessions() {
    try {
      const data = await getJson<{ sessions: RuntimeSession[] }>("/api/supreme/runtime/status");
      setSessions(data.sessions || []);

      if (!activeId && data.sessions?.[0]) {
        setActiveId(data.sessions[0].id);
      }
    } catch {
      // evitar ruido en refresco automatico
    }
  }

  async function scanPorts() {
    setBusy(true);
    pushLog("Escaneando puertos 3000-3025...");

    try {
      const data = await getJson<{ ports: PortInfo[] }>("/api/supreme/runtime/ports?start=3000&end=3025");
      setPorts(data.ports);
      const firstFree = data.ports.find((item) => item.free);

      if (firstFree) {
        setPort(firstFree.port);
        setCommand("npm run dev -- --port " + firstFree.port);
      }

      pushLog("Puertos escaneados.");
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "No se pudo escanear puertos.");
    } finally {
      setBusy(false);
    }
  }

  async function startRuntime() {
    setBusy(true);
    pushLog("Iniciando runtime...");

    try {
      const data = await postJson<{ session: RuntimeSession }>("/api/supreme/runtime/start", {
        projectPath,
        command,
        port,
      });

      setActiveId(data.session.id);
      pushLog("Runtime iniciado: " + data.session.previewUrl);
      await refreshSessions();
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "No se pudo iniciar runtime.");
    } finally {
      setBusy(false);
    }
  }

  async function stopRuntime() {
    if (!activeSession) {
      return;
    }

    setBusy(true);
    pushLog("Deteniendo runtime...");

    try {
      await postJson<{ session: RuntimeSession }>("/api/supreme/runtime/stop", {
        id: activeSession.id,
      });

      pushLog("Runtime detenido.");
      await refreshSessions();
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "No se pudo detener runtime.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommand() {
    setBusy(true);
    pushLog("Ejecutando comando: " + terminalCommand);

    try {
      const data = await postJson<{
        ok: boolean;
        result: {
          exitCode: number;
          stdout: string;
          stderr: string;
        };
      }>("/api/supreme/runtime/command", {
        projectPath,
        command: terminalCommand,
        timeoutMs: 180000,
      });

      pushLog(
        "ExitCode: " +
          data.result.exitCode +
          "\nSTDOUT:\n" +
          data.result.stdout +
          "\nSTDERR:\n" +
          data.result.stderr,
      );
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "No se pudo ejecutar comando.");
    } finally {
      setBusy(false);
    }
  }

  async function checkPreview() {
    const url = activeSession?.previewUrl || "http://localhost:" + port;

    setBusy(true);
    pushLog("Verificando preview: " + url);

    try {
      const data = await postJson<{ result: unknown }>("/api/supreme/runtime/preview", {
        url,
      });

      pushLog(JSON.stringify(data.result, null, 2));
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "No se pudo verificar preview.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshSessions();
    const timer = window.setInterval(refreshSessions, 2500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.badge}>SUPREME 2</p>
          <h1 style={styles.title}>Runtime Center</h1>
          <p style={styles.text}>
            Controla apps objetivo desde Coder: puertos, previews, logs,
            comandos, procesos y estado de ejecucion.
          </p>
        </div>

        <div style={styles.heroCard}>
          <span>Runtime Status</span>
          <strong>{activeSession?.status || "standby"}</strong>
          <small>{activeSession?.previewUrl || "Sin preview activo"}</small>
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.eyebrow}>Target Project</p>
              <h2>Control de ejecucion</h2>
            </div>
            <span style={styles.pill}>Local Cloud Runtime</span>
          </div>

          <label style={styles.field}>
            <span>Ruta del proyecto</span>
            <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
          </label>

          <div style={styles.twoCols}>
            <label style={styles.field}>
              <span>Puerto</span>
              <input
                type="number"
                value={port}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setPort(value);
                  setCommand("npm run dev -- --port " + value);
                }}
              />
            </label>

            <label style={styles.field}>
              <span>Comando runtime</span>
              <input value={command} onChange={(event) => setCommand(event.target.value)} />
            </label>
          </div>

          <div style={styles.actions}>
            <button type="button" disabled={busy} onClick={scanPorts}>
              Escanear puertos
            </button>
            <button type="button" disabled={busy} onClick={startRuntime}>
              Iniciar runtime
            </button>
            <button type="button" disabled={busy || !activeSession} onClick={stopRuntime}>
              Detener runtime
            </button>
            <button type="button" disabled={busy} onClick={checkPreview}>
              Verificar preview
            </button>
          </div>

          <div style={styles.ports}>
            {ports.map((item) => (
              <button
                key={item.port}
                type="button"
                onClick={() => {
                  setPort(item.port);
                  setCommand("npm run dev -- --port " + item.port);
                }}
                style={{
                  ...styles.portButton,
                  background: item.free ? "#ECFDF5" : "#FEF2F2",
                  color: item.free ? "#065F46" : "#991B1B",
                }}
              >
                {item.port} {item.free ? "libre" : "ocupado"}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.cardDark}>
          <p style={styles.eyebrowLight}>Active Session</p>
          <h2>{activeSession ? activeSession.id.slice(0, 8) : "Sin sesion"}</h2>

          {activeSession ? (
            <>
              <span style={{ ...styles.statusPill, ...statusStyle(activeSession.status) }}>
                {activeSession.status}
              </span>

              <p>PID: {activeSession.pid || "N/A"}</p>
              <p>Puerto: {activeSession.port}</p>
              <p>Preview: {activeSession.previewUrl}</p>

              <a style={styles.previewLink} href={activeSession.previewUrl} target="_blank">
                Abrir preview
              </a>
            </>
          ) : (
            <p>Inicia un runtime para ver informacion aqui.</p>
          )}
        </div>
      </section>

      <section style={styles.grid2}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.eyebrow}>Sessions</p>
              <h2>Procesos activos</h2>
            </div>
          </div>

          <div style={styles.sessionList}>
            {sessions.length ? (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveId(session.id)}
                  style={{
                    ...styles.sessionButton,
                    borderColor: activeSession?.id === session.id ? "#D72638" : "#E5E7EB",
                  }}
                >
                  <strong>{session.previewUrl}</strong>
                  <span>{session.status} Â· PID {session.pid || "N/A"}</span>
                </button>
              ))
            ) : (
              <p>No hay sesiones activas.</p>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.eyebrow}>Terminal</p>
              <h2>Comandos controlados</h2>
            </div>
          </div>

          <label style={styles.field}>
            <span>Comando</span>
            <input value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} />
          </label>

          <div style={styles.actions}>
            <button type="button" disabled={busy} onClick={runCommand}>
              Ejecutar comando
            </button>
          </div>

          <p style={styles.muted}>
            Recomendados: npm run typecheck, npm run build, npm install, git status.
          </p>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <p style={styles.eyebrow}>Runtime Logs</p>
            <h2>Logs y consola</h2>
          </div>
        </div>

        <div style={styles.logsGrid}>
          <pre style={styles.console}>{consoleLog}</pre>

          <pre style={styles.console}>
            {activeSession?.logs?.length
              ? activeSession.logs.join("\n")
              : "Sin logs del runtime seleccionado."}
          </pre>
        </div>
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
    fontSize: 46,
    lineHeight: 1,
    margin: "14px 0",
  },
  text: {
    color: "#475569",
    lineHeight: 1.7,
    maxWidth: 840,
  },
  heroCard: {
    minWidth: 260,
    borderRadius: 28,
    background: "#0B1F3A",
    color: "#FFFFFF",
    padding: 24,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.35fr .65fr",
    gap: 18,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "start",
    marginBottom: 16,
  },
  eyebrow: {
    color: "#D72638",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: 900,
    margin: 0,
  },
  eyebrowLight: {
    color: "#93C5FD",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: 900,
    margin: 0,
  },
  pill: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(37,99,235,.10)",
    color: "#1D4ED8",
    fontWeight: 900,
  },
  statusPill: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
  },
  field: {
    display: "grid",
    gap: 8,
    marginBottom: 14,
    fontWeight: 900,
  },
  twoCols: {
    display: "grid",
    gridTemplateColumns: ".35fr .65fr",
    gap: 14,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  ports: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  portButton: {
    border: "1px solid #E5E7EB",
    borderRadius: 999,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 900,
  },
  previewLink: {
    display: "inline-flex",
    background: "#D72638",
    color: "#FFFFFF",
    borderRadius: 14,
    padding: "12px 14px",
    textDecoration: "none",
    fontWeight: 900,
    marginTop: 10,
  },
  sessionList: {
    display: "grid",
    gap: 10,
    maxHeight: 360,
    overflow: "auto",
  },
  sessionButton: {
    display: "grid",
    gap: 6,
    textAlign: "left",
    padding: 12,
    borderRadius: 16,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    color: "#0B1F3A",
    cursor: "pointer",
  },
  logsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  console: {
    background: "#111827",
    color: "#E5E7EB",
    borderRadius: 18,
    padding: 18,
    minHeight: 360,
    maxHeight: 620,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "Consolas, monospace",
    fontSize: 12,
  },
  muted: {
    color: "#64748B",
    lineHeight: 1.6,
  },
};
