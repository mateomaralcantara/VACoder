import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export type ExecutorResult = {
  ok: boolean;
  skipped?: boolean;
  command?: string;
  exitCode?: number;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
  data?: Record<string, unknown>;
};

function cap(value: string, max = 200_000) {
  if (value.length <= max) return value;

  const headSize = Math.min(20_000, Math.floor(max * 0.1));
  const tailSize = Math.max(0, max - headSize);

  return [
    value.slice(0, headSize),
    "\n...[middle truncated; preserving final build error]...\n",
    value.slice(-tailSize),
  ].join("");
}

async function readPackage(projectPath: string) {
  const file = path.join(projectPath, "package.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
}

function runCommand(
  projectPath: string,
  command: string,
  timeoutSeconds: number,
  envOverride: Record<string, string | undefined> = {},
): Promise<ExecutorResult> {
  return new Promise((resolve) => {
    exec(command, {
      cwd: projectPath,
      timeout: Math.max(30, timeoutSeconds) * 1000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 10,
      env: { ...process.env, CI: "1", ...envOverride },
    }, (error, stdout, stderr) => {
      const e = error as (NodeJS.ErrnoException & { killed?: boolean; code?: unknown }) | null;
      const exitCode = error ? (typeof e?.code === "number" ? e.code : 1) : 0;
      resolve({
        ok: exitCode === 0,
        command,
        exitCode,
        timedOut: Boolean(e?.killed),
        stdout: cap(stdout || ""),
        stderr: cap(stderr || ""),
      });
    });
  });
}

export async function executeOrchestratorTask(args: {
  taskType: string;
  projectPath: string;
  timeoutSeconds: number;
}): Promise<ExecutorResult> {
  const { taskType, projectPath, timeoutSeconds } = args;
  const pkg = await readPackage(projectPath);
  const scripts = pkg.scripts || {};

  if (taskType === "plan") {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const important = ["app", "src", "lib", "components", "pages", "package.json", "tsconfig.json"]
      .filter((name) => entries.some((entry) => entry.name === name));
    return {
      ok: true,
      data: {
        scripts: Object.keys(scripts),
        importantEntries: important,
        hasBuild: Boolean(scripts.build),
        hasTypecheck: Boolean(scripts.typecheck),
        hasTests: Boolean(scripts.test),
      },
    };
  }

  if (taskType === "typecheck") {
    if (scripts.typecheck) return runCommand(projectPath, "npm run typecheck", timeoutSeconds);
    const tsconfig = await fs.stat(path.join(projectPath, "tsconfig.json")).catch(() => null);
    if (tsconfig?.isFile()) return runCommand(projectPath, "npx tsc --noEmit", timeoutSeconds);
    return { ok: true, skipped: true, data: { reason: "No typecheck script/tsconfig" } };
  }

  if (taskType === "build") {
    if (!scripts.build) return { ok: true, skipped: true, data: { reason: "No build script" } };
    return runCommand(
      projectPath,
      "npm run build",
      timeoutSeconds,
      { NODE_ENV: "production" },
    );
  }

  if (taskType === "test") {
    const testScript = scripts.test || "";
    if (!testScript || /no test specified/i.test(testScript)) {
      return { ok: true, skipped: true, data: { reason: "No executable test suite" } };
    }
    return runCommand(projectPath, "npm test", timeoutSeconds);
  }

  throw new Error("Task type no soportado: " + taskType);
}

