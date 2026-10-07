import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type {
  ProductionEvent,
  ProductionPhase,
  ProductionRunResult,
} from '@/lib/production/types';
import { runCommand } from '@/lib/production/run-command';
import { repairKnownBuildError } from '@/lib/production/repair-layout';

interface RunProductionPipelineOptions {
  cwd: string;
  port: number;
  maxAttempts?: number;
  onEvent?: (event: ProductionEvent) => void;
  onRuntime?: (runtime: ChildProcessWithoutNullStreams | null) => void;
}

function createEvent(
  phase: ProductionPhase,
  level: ProductionEvent['level'],
  message: string,
  details?: string,
): ProductionEvent {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    phase,
    level,
    message,
    details,
  };
}

function assertSafeCwd(cwd: string): string {
  const resolved = path.resolve(cwd);
  const parsed = path.parse(resolved);

  if (!path.isAbsolute(resolved)) {
    throw new Error('La ruta del proyecto debe ser absoluta.');
  }

  if (resolved === parsed.root) {
    throw new Error('No ejecuto comandos en la raíz del disco.');
  }

  if (resolved.includes(`${path.sep}node_modules${path.sep}`)) {
    throw new Error('No ejecuto comandos dentro de node_modules.');
  }

  return resolved;
}

async function directoryExists(cwd: string): Promise<boolean> {
  try {
    const stat = await fs.stat(cwd);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function removeDirectoryIfExists(targetPath: string): Promise<void> {
  try {
    await fs.rm(targetPath, {
      recursive: true,
      force: true,
    });
  } catch {
    // No bloqueamos por limpieza.
  }
}

async function readPackageJson(cwd: string): Promise<{
  scripts?: Record<string, string>;
}> {
  const packagePath = path.join(cwd, 'package.json');
  const raw = await fs.readFile(packagePath, 'utf8');

  return JSON.parse(raw) as {
    scripts?: Record<string, string>;
  };
}

function createRuntimeEnv(port: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    SystemRoot: process.env.SystemRoot || 'C:\\Windows',
    WINDIR: process.env.WINDIR || 'C:\\Windows',
    ComSpec: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
  } as NodeJS.ProcessEnv;
}

async function waitForHttp(url: string, timeoutMs = 1000 * 45): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
      });

      if (response.status < 500) {
        return true;
      }
    } catch {
      // Todavía no responde.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}

async function startRuntime({
  cwd,
  port,
  emit,
}: {
  cwd: string;
  port: number;
  emit: (
    phase: ProductionPhase,
    level: ProductionEvent['level'],
    message: string,
    details?: string,
  ) => void;
}): Promise<{
  success: boolean;
  runtime?: ChildProcessWithoutNullStreams;
  url?: string;
  error?: string;
}> {
  const url = `http://localhost:${port}`;

  emit('starting', 'info', `Iniciando servidor local en ${url}`);

  const runtime = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--port', String(port)],
    {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: 'pipe',
      env: createRuntimeEnv(port),
    },
  );

  runtime.stdout.on('data', (chunk: Buffer) => {
    chunk
      .toString('utf8')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => emit('starting', 'info', line));
  });

  runtime.stderr.on('data', (chunk: Buffer) => {
    chunk
      .toString('utf8')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => emit('starting', 'warning', line));
  });

  const ok = await waitForHttp(url);

  if (!ok) {
    runtime.kill();

    return {
      success: false,
      error: `El servidor no respondió correctamente en ${url}`,
    };
  }

  return {
    success: true,
    runtime,
    url,
  };
}

export async function runProductionPipeline({
  cwd,
  port,
  maxAttempts = 5,
  onEvent,
  onRuntime,
}: RunProductionPipelineOptions): Promise<ProductionRunResult> {
  const events: ProductionEvent[] = [];
  const resolvedCwd = assertSafeCwd(cwd);
  let attempts = 0;

  const emit = (
    phase: ProductionPhase,
    level: ProductionEvent['level'],
    message: string,
    details?: string,
  ) => {
    const event = createEvent(phase, level, message, details);
    events.push(event);
    onEvent?.(event);
  };

  try {
    emit('installing', 'info', `Validando carpeta: ${resolvedCwd}`);

    if (!(await directoryExists(resolvedCwd))) {
      throw new Error(`La carpeta no existe: ${resolvedCwd}`);
    }

    const packageJson = await readPackageJson(resolvedCwd);

    emit('installing', 'info', 'Instalando dependencias...');
    const install = await runCommand({
      cwd: resolvedCwd,
      command: 'npm install',
      timeoutMs: 1000 * 60 * 10,
      onLine: (line) => emit('installing', 'info', line),
    });

    if (install.exitCode !== 0) {
      throw new Error(`npm install falló:\n${install.stderr || install.stdout}`);
    }

    if (!packageJson.scripts?.build) {
      throw new Error('package.json no tiene script build.');
    }

    for (attempts = 1; attempts <= maxAttempts; attempts += 1) {
      await removeDirectoryIfExists(path.join(resolvedCwd, '.next'));

      if (packageJson.scripts?.typecheck) {
        emit('typechecking', 'info', `Ejecutando typecheck intento ${attempts}/${maxAttempts}...`);

        const typecheck = await runCommand({
          cwd: resolvedCwd,
          command: 'npm run typecheck',
          timeoutMs: 1000 * 60 * 5,
          onLine: (line) => emit('typechecking', 'info', line),
        });

        if (typecheck.exitCode !== 0) {
          const typecheckLog = `${typecheck.stdout}\n${typecheck.stderr}`;

          emit(
            'repairing',
            'warning',
            'Typecheck falló. Reparando antes de ejecutar build...',
            typecheckLog,
          );

          const repair = await repairKnownBuildError(resolvedCwd, typecheckLog);

          emit(
            'repairing',
            repair.repaired ? 'success' : 'warning',
            repair.message,
            repair.changedFiles.join('\n'),
          );

          if (!repair.repaired) {
            throw new Error(`No pude reparar automáticamente el typecheck:\n${typecheckLog}`);
          }

          continue;
        }
      } else {
        emit('typechecking', 'warning', 'No existe script typecheck. Saltando.');
      }

      emit('building', 'info', `Ejecutando build intento ${attempts}/${maxAttempts}...`);

      const build = await runCommand({
        cwd: resolvedCwd,
        command: 'npm run build',
        timeoutMs: 1000 * 60 * 10,
        env: {
          NODE_ENV: 'production',
        },
        onLine: (line) => emit('building', 'info', line),
      });

      if (build.exitCode === 0) {
        emit('building', 'success', 'Build exitoso.');
        break;
      }

      const buildLog = `${build.stdout}\n${build.stderr}`;

      emit('repairing', 'warning', 'Build falló. Intentando reparación automática...', buildLog);

      const repair = await repairKnownBuildError(resolvedCwd, buildLog);

      emit(
        'repairing',
        repair.repaired ? 'success' : 'warning',
        repair.message,
        repair.changedFiles.join('\n'),
      );

      if (!repair.repaired) {
        throw new Error(`No pude reparar automáticamente el build:\n${buildLog}`);
      }
    }

    if (attempts > maxAttempts) {
      throw new Error(`No se pudo compilar después de ${maxAttempts} intentos.`);
    }

    if (!packageJson.scripts?.dev) {
      emit('ready', 'warning', 'Build OK, pero no existe script dev para validar localhost.');

      return {
        success: true,
        phase: 'ready',
        cwd: resolvedCwd,
        port,
        attempts,
        events,
      };
    }

    const runtime = await startRuntime({
      cwd: resolvedCwd,
      port,
      emit,
    });

    if (!runtime.success || !runtime.runtime || !runtime.url) {
      throw new Error(runtime.error || 'No se pudo validar runtime.');
    }

    onRuntime?.(runtime.runtime);

    emit('verifying', 'success', `Servidor validado correctamente: ${runtime.url}`);
    emit('ready', 'success', 'App funcionando sin errores críticos.');

    return {
      success: true,
      phase: 'ready',
      cwd: resolvedCwd,
      port,
      url: runtime.url,
      attempts,
      events,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';

    emit('failed', 'error', message);

    return {
      success: false,
      phase: 'failed',
      cwd: resolvedCwd,
      port,
      attempts,
      events,
      error: message,
    };
  }
}