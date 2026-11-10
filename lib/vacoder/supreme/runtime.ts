import type { ChildProcess } from "node:child_process";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { assertSafeProjectPath, runCommand } from "@/lib/vacoder/core";
import {
  assertRuntimeCommand,
  assertTerminalCommand,
} from "@/lib/security/command-policy";
import {
  killProcessTree,
  spawnArgv,
  tokenizeCommand,
} from "@/lib/security/process";

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
  process?: ChildProcess;
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

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Puerto invalido: usa un entero entre 1024 y 65535.");
  }

  const command = assertRuntimeCommand(
    args.command || "npm run dev -- --port " + port,
  );

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

  const [file, ...commandArgs] = tokenizeCommand(command);

  const child = spawnArgv(projectPath, file, commandArgs, {
    env: {
      PORT: String(port),
      BROWSER: "none",
    },
    detached: true,
  });

  session.process = child;
  session.pid = child.pid;
  session.status = "running";

  child.stdout?.on("data", (chunk) => {
    pushLog(session, chunk.toString());
  });

  child.stderr?.on("data", (chunk) => {
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
    await killProcessTree(session.process);
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
  // Lista blanca: ver lib/security/command-policy.ts
  const command = assertTerminalCommand(args.command);
  const timeoutMs = Math.min(
    Math.max(Number(args.timeoutMs) || 120000, 5000),
    300000,
  );

  return runCommand(projectPath, command, timeoutMs);
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
