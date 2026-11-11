// Ejecucion de procesos sin shell, valida para Windows, macOS y Linux.
//
// Los comandos se pasan como argv. En Windows, npm/npx/pnpm/yarn son archivos
// .cmd y Node exige pasar por cmd.exe para ejecutarlos; en ese caso se
// rechazan los argumentos con metacaracteres en lugar de intentar escaparlos.

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";

export type ProcessResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

const WINDOWS_CMD_SHIMS = new Set(["npm", "npx", "pnpm", "yarn"]);
const CMD_UNSAFE = /[&|<>^%!"`\r\n();\s]/;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

export function tokenizeCommand(command: string) {
  return command.trim().split(/[ \t]+/).filter(Boolean);
}

export function resolveSpawnTarget(
  file: string,
  args: string[],
  platform: string = process.platform,
): { file: string; args: string[] } {
  if (!file) {
    throw new Error("El comando es obligatorio.");
  }

  if (platform !== "win32" || !WINDOWS_CMD_SHIMS.has(file.toLowerCase())) {
    return { file, args };
  }

  for (const arg of args) {
    if (CMD_UNSAFE.test(arg)) {
      throw new Error("Argumento no permitido para " + file + ": " + arg);
    }
  }

  return {
    file: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", file + ".cmd", ...args],
  };
}

export type EnvOverrides = Record<string, string | undefined>;

// NODE_ENV del proceso hijo. El servidor de VACoder corre con su propio
// NODE_ENV (development bajo `next dev`) y heredarlo rompe a los proyectos:
// `next build` con NODE_ENV=development falla al prerenderizar, y
// `npm install` con NODE_ENV=production omite las devDependencies.
// Un build siempre es de produccion; el resto decide por si mismo.
export function nodeEnvForCommand(file: string, args: string[]) {
  const [first = "", second = ""] = args.map((arg) => arg.toLowerCase());
  const program = file.toLowerCase();

  const isBuild =
    (["npm", "pnpm", "yarn"].includes(program) && first === "run" && second === "build") ||
    (["pnpm", "yarn"].includes(program) && first === "build") ||
    (program === "npx" && first === "next" && second === "build");

  return isBuild ? "production" : undefined;
}

function baseEnv(file: string, args: string[], extra?: EnvOverrides): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: nodeEnvForCommand(file, args),
    ...extra,
  } as NodeJS.ProcessEnv;
}

export function spawnArgv(
  cwd: string,
  file: string,
  args: string[],
  options: { env?: EnvOverrides; detached?: boolean } = {},
): ChildProcess {
  // Sin esta comprobacion Node informa "spawn npm ENOENT", que parece decir
  // que falta npm cuando lo que falta es la carpeta del proyecto.
  if (!existsSync(cwd)) {
    throw new Error("La carpeta del proyecto no existe: " + cwd);
  }

  const target = resolveSpawnTarget(file, args);

  const spawnOptions: SpawnOptions = {
    cwd,
    env: baseEnv(file, args, options.env),
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    // En POSIX el hijo lidera su propio grupo para poder detener el arbol
    // completo (npm -> node -> next) con una sola senal.
    detached: Boolean(options.detached) && process.platform !== "win32",
  };

  return spawn(target.file, target.args, spawnOptions);
}

export function killProcessTree(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    const pid = child.pid;

    if (!pid) {
      resolve();
      return;
    }

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });

      killer.on("close", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    try {
      // PID negativo = grupo de procesos (requiere spawn con detached).
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        // El proceso ya termino.
      }
    }

    resolve();
  });
}

export function runArgv(
  cwd: string,
  file: string,
  args: string[],
  timeoutMs = 1000 * 60 * 3,
  env?: EnvOverrides,
): Promise<ProcessResult> {
  const command = [file, ...args].join(" ");

  return new Promise((resolve) => {
    let child: ChildProcess;

    try {
      child = spawnArgv(cwd, file, args, { env, detached: true });
    } catch (error) {
      resolve({
        command,
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        timedOut: false,
      });
      return;
    }

    const stdout: string[] = [];
    const stderr: string[] = [];
    let bytes = 0;
    let settled = false;
    let timedOut = false;

    const collect = (bucket: string[]) => (chunk: Buffer) => {
      bytes += chunk.length;

      if (bytes <= MAX_OUTPUT_BYTES) {
        bucket.push(chunk.toString("utf8"));
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      void killProcessTree(child);
    }, timeoutMs);

    const finish = (exitCode: number, extraError = "") => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      resolve({
        command,
        exitCode,
        stdout: stdout.join(""),
        stderr: stderr.join("") + extraError,
        timedOut,
      });
    };

    child.stdout?.on("data", collect(stdout));
    child.stderr?.on("data", collect(stderr));
    child.on("error", (error) => finish(1, "\n" + error.message));
    child.on("close", (code) => finish(timedOut ? 124 : code ?? 1));
  });
}
