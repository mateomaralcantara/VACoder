$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

if (!(Test-Path $Root)) {
  throw "No existe Coder en: $Root"
}

Set-Location $Root

$BackupDir = Join-Path $Root ("_backup-supreme-2-runtime-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
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
Write-Host "=== INSTALANDO SUPREME 2 RUNTIME ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host "Backup: $BackupDir"
Write-Host ""

Write-ProjectFile "lib\vacoder\supreme\runtime.ts" @'
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { assertSafeProjectPath, runCommand } from "@/lib/vacoder/core";

export type SupremeRuntimeStatus = "starting" | "running" | "stopped" | "failed";

export type SupremeRuntimeSession = {
  id: string;
  projectPath: string;
  command: string;
  port: number;
  previewUrl: string;
  status: SupremeRuntimeStatus;
  startedAt: string;
  stoppedAt?: string;
  pid?: number;
  exitCode?: number | null;
  logs: string[];
  process?: ChildProcessWithoutNullStreams;
};

export type SupremeRuntimePublicSession = Omit<SupremeRuntimeSession, "process">;

type RuntimeGlobal = typeof globalThis & {
  __vacoderSupremeRuntime?: Map<string, SupremeRuntimeSession>;
};

const runtimeGlobal = globalThis as RuntimeGlobal;

function getRuntimeStore() {
  if (!runtimeGlobal.__vacoderSupremeRuntime) {
    runtimeGlobal.__vacoderSupremeRuntime = new Map<string, SupremeRuntimeSession>();
  }

  return runtimeGlobal.__vacoderSupremeRuntime;
}

function toPublicSession(session: SupremeRuntimeSession): SupremeRuntimePublicSession {
  return {
    id: session.id,
    projectPath: session.projectPath,
    command: session.command,
    port: session.port,
    previewUrl: session.previewUrl,
    status: session.status,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    pid: session.pid,
    exitCode: session.exitCode,
    logs: session.logs.slice(-500),
  };
}

function pushLog(session: SupremeRuntimeSession, text: string) {
  const clean = text.replace(/\u001b\[[0-9;]*m/g, "").trimEnd();

  if (!clean) {
    return;
  }

  const lines = clean.split(/\r?\n/g);

  for (const line of lines) {
    session.logs.push("[" + new Date().toLocaleTimeString() + "] " + line);
  }

  session.logs = session.logs.slice(-1000);
}

export async function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

export async function findFreePorts(start = 3000, end = 3025) {
  const ports: Array<{ port: number; free: boolean }> = [];

  for (let port = start; port <= end; port++) {
    ports.push({
      port,
      free: await isPortFree(port),
    });
  }

  return ports;
}

export function listSupremeRuntimes() {
  return Array.from(getRuntimeStore().values()).map(toPublicSession);
}

export function getSupremeRuntime(id: string) {
  const session = getRuntimeStore().get(id);

  return session ? toPublicSession(session) : null;
}

export async function startSupremeRuntime(args: {
  projectPath: string;
  command?: string;
  port?: number;
}) {
  const projectPath = assertSafeProjectPath(args.projectPath);
  const port = Number(args.port || 3001);
  const command = String(args.command || "npm run dev -- --port " + port);

  const id = randomUUID();
  const previewUrl = "http://localhost:" + port;

  const session: SupremeRuntimeSession = {
    id,
    projectPath,
    command,
    port,
    previewUrl,
    status: "starting",
    startedAt: new Date().toISOString(),
    logs: [],
  };

  getRuntimeStore().set(id, session);

  const free = await isPortFree(port);

  if (!free) {
    session.status = "failed";
    session.exitCode = 1;
    pushLog(session, "Puerto ocupado: " + port);
    return toPublicSession(session);
  }

  pushLog(session, "Iniciando runtime en " + projectPath);
  pushLog(session, "Comando: " + command);

  const child = spawn("cmd.exe", ["/c", command], {
    cwd: projectPath,
    env: {
      ...process.env,
      PORT: String(port),
      BROWSER: "none",
    },
    windowsHide: false,
  });

  session.process = child;
  session.pid = child.pid;
  session.status = "running";

  child.stdout.on("data", (chunk) => {
    pushLog(session, chunk.toString());
  });

  child.stderr.on("data", (chunk) => {
    pushLog(session, chunk.toString());
  });

  child.on("error", (error) => {
    session.status = "failed";
    session.exitCode = 1;
    pushLog(session, "ERROR: " + error.message);
  });

  child.on("close", (code) => {
    session.status = code === 0 ? "stopped" : "failed";
    session.exitCode = code;
    session.stoppedAt = new Date().toISOString();
    pushLog(session, "Proceso finalizado con codigo: " + code);
  });

  return toPublicSession(session);
}

export async function stopSupremeRuntime(id: string) {
  const session = getRuntimeStore().get(id);

  if (!session) {
    throw new Error("Runtime no encontrado: " + id);
  }

  if (session.process && session.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(session.pid), "/T", "/F"], {
        windowsHide: true,
      });

      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
    });
  }

  session.status = "stopped";
  session.stoppedAt = new Date().toISOString();
  pushLog(session, "Runtime detenido manualmente.");

  return toPublicSession(session);
}

export async function runSupremeTerminalCommand(args: {
  projectPath: string;
  command: string;
  timeoutMs?: number;
}) {
  const projectPath = assertSafeProjectPath(args.projectPath);
  const command = String(args.command || "").trim();

  if (!command) {
    throw new Error("El comando es obligatorio.");
  }

  const blocked = [
    "format c:",
    "del /s c:",
    "rd /s c:",
    "remove-item c:",
  ];

  const lower = command.toLowerCase();

  if (blocked.some((item) => lower.includes(item))) {
    throw new Error("Comando bloqueado por seguridad.");
  }

  return runCommand(projectPath, command, args.timeoutMs || 120000);
}

export async function checkSupremePreview(url: string) {
  const target = String(url || "").trim();

  if (!target.startsWith("http://localhost:") && !target.startsWith("http://127.0.0.1:")) {
    throw new Error("Solo se permiten previews locales.");
  }

  try {
    const started = Date.now();
    const response = await fetch(target, {
      cache: "no-store",
    });

    const text = await response.text();
    const elapsedMs = Date.now() - started;

    return {
      ok: response.ok,
      url: target,
      status: response.status,
      elapsedMs,
      bodyLength: text.length,
      title: text.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "",
      blank: text.replace(/<[^>]+>/g, " ").trim().length < 40,
    };
  } catch (error) {
    return {
      ok: false,
      url: target,
      status: 0,
      elapsedMs: 0,
      bodyLength: 0,
      title: "",
      blank: true,
      error: error instanceof Error ? error.message : "Preview fallo.",
    };
  }
}
'@

Write-ProjectFile "app\api\supreme\runtime\start\route.ts" @'
import { NextResponse } from "next/server";
import { startSupremeRuntime } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const session = await startSupremeRuntime({
      projectPath: String(body.projectPath || ""),
      command: typeof body.command === "string" ? body.command : undefined,
      port: Number(body.port || 3001),
    });

    return NextResponse.json({
      ok: session.status !== "failed",
      session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar runtime.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "app\api\supreme\runtime\stop\route.ts" @'
import { NextResponse } from "next/server";
import { stopSupremeRuntime } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await stopSupremeRuntime(String(body.id || ""));

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo detener runtime.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "app\api\supreme\runtime\status\route.ts" @'
import { NextResponse } from "next/server";
import {
  getSupremeRuntime,
  listSupremeRuntimes,
} from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    return NextResponse.json({
      ok: true,
      session: getSupremeRuntime(id),
    });
  }

  return NextResponse.json({
    ok: true,
    sessions: listSupremeRuntimes(),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";

  if (id) {
    return NextResponse.json({
      ok: true,
      session: getSupremeRuntime(id),
    });
  }

  return NextResponse.json({
    ok: true,
    sessions: listSupremeRuntimes(),
  });
}
'@

Write-ProjectFile "app\api\supreme\runtime\ports\route.ts" @'
import { NextResponse } from "next/server";
import { findFreePorts } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = Number(url.searchParams.get("start") || 3000);
  const end = Number(url.searchParams.get("end") || 3025);

  const ports = await findFreePorts(start, end);

  return NextResponse.json({
    ok: true,
    ports,
  });
}
'@

Write-ProjectFile "app\api\supreme\runtime\command\route.ts" @'
import { NextResponse } from "next/server";
import { runSupremeTerminalCommand } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runSupremeTerminalCommand({
      projectPath: String(body.projectPath || ""),
      command: String(body.command || ""),
      timeoutMs: Number(body.timeoutMs || 120000),
    });

    return NextResponse.json({
      ok: result.exitCode === 0,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar comando.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "app\api\supreme\runtime\preview\route.ts" @'
import { NextResponse } from "next/server";
import { checkSupremePreview } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await checkSupremePreview(String(body.url || ""));

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo verificar preview.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "components\supreme-runtime-center.tsx" @'
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
                  <span>{session.status} · PID {session.pid || "N/A"}</span>
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
'@

Write-ProjectFile "app\runtime\page.tsx" @'
import SupremeRuntimeCenter from "@/components/supreme-runtime-center";

export default function RuntimePage() {
  return <SupremeRuntimeCenter />;
}
'@

Write-ProjectFile "scripts\check-supreme-2-runtime.ps1" @'
$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK SUPREME 2 RUNTIME ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "lib\vacoder\supreme\runtime.ts",
  "app\api\supreme\runtime\start\route.ts",
  "app\api\supreme\runtime\stop\route.ts",
  "app\api\supreme\runtime\status\route.ts",
  "app\api\supreme\runtime\ports\route.ts",
  "app\api\supreme\runtime\command\route.ts",
  "app\api\supreme\runtime\preview\route.ts",
  "components\supreme-runtime-center.tsx",
  "app\runtime\page.tsx"
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
Write-Host "SUPREME 2 RUNTIME INSTALADO Y VALIDADO." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/runtime"
Write-Host ""
'@

Write-Host ""
Write-Host "SUPREME 2 Runtime instalado." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host 'powershell -ExecutionPolicy Bypass -File ".\scripts\check-supreme-2-runtime.ps1"'
Write-Host ""