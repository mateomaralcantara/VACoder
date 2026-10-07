import path from 'node:path';
import type {
  ProductionPipelineEvent,
  ProductionPipelinePhase,
  ProductionPipelineResult,
  ProductionPipelineStartRequest,
} from '@/lib/project-builder/production/types';
import { compactLog } from '@/lib/project-builder/production/errors';
import { hasPackageScript } from '@/lib/project-builder/production/package-json';
import { repairProjectFromLogs } from '@/lib/project-builder/production/repair-agent';
import { runCommand } from '@/lib/project-builder/production/run-command';
import { startRuntimeAndVerify } from '@/lib/project-builder/production/runtime-check';

export interface PipelineExecutionOptions extends Required<Omit<ProductionPipelineStartRequest, 'cwd'>> {
  cwd: string;
  onEvent?: (event: ProductionPipelineEvent) => void;
  onLog?: (line: string) => void;
}

function createEvent(
  phase: ProductionPipelinePhase,
  level: ProductionPipelineEvent['level'],
  message: string,
  data?: unknown,
): ProductionPipelineEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    phase,
    level,
    message,
    data,
  };
}

function assertSafeProjectPath(cwd: string): string {
  const resolved = path.resolve(cwd);
  const root = path.parse(resolved).root;

  if (!path.isAbsolute(resolved)) {
    throw new Error('La ruta del proyecto debe ser absoluta.');
  }

  if (resolved === root) {
    throw new Error('No se permite ejecutar el pipeline en la raíz del disco.');
  }

  if (resolved.includes(`${path.sep}node_modules${path.sep}`) || resolved.includes(`${path.sep}.git${path.sep}`)) {
    throw new Error('Ruta no permitida. No ejecutes el pipeline dentro de node_modules ni .git.');
  }

  return resolved;
}

export async function runProductionPipeline(options: PipelineExecutionOptions): Promise<ProductionPipelineResult> {
  const cwd = assertSafeProjectPath(options.cwd);
  const port = options.port;
  const events: ProductionPipelineEvent[] = [];
  const logs: string[] = [];

  const emit = (
    phase: ProductionPipelinePhase,
    level: ProductionPipelineEvent['level'],
    message: string,
    data?: unknown,
  ) => {
    const event = createEvent(phase, level, message, data);
    events.push(event);
    options.onEvent?.(event);
  };

  const log = (line: string) => {
    logs.push(line);
    options.onLog?.(line);
  };

  emit('queued', 'info', `Pipeline iniciado en ${cwd}`);

  if (options.installDependencies) {
    emit('installing', 'info', 'Instalando dependencias con npm install...');
    const install = await runCommand({
      cwd,
      command: 'npm install',
      timeoutMs: 1000 * 60 * 12,
      onOutput: log,
    });

    if (install.exitCode !== 0) {
      emit('failed', 'error', 'npm install falló.', install);
      return {
        success: false,
        cwd,
        port,
        attempts: 0,
        error: compactLog(`${install.stdout}\n${install.stderr}`),
        logs,
        events,
      };
    }

    emit('installing', 'success', 'Dependencias instaladas correctamente.');
  }

  if (options.runTypecheck && (await hasPackageScript(cwd, 'typecheck'))) {
    emit('typechecking', 'info', 'Ejecutando npm run typecheck...');
    const typecheck = await runCommand({
      cwd,
      command: 'npm run typecheck',
      timeoutMs: 1000 * 60 * 6,
      onOutput: log,
    });

    if (typecheck.exitCode !== 0) {
      emit('repairing', 'warning', 'Typecheck falló. Intentando reparación determinística...', typecheck);
      const repair = await repairProjectFromLogs({
        cwd,
        logs: compactLog(`${typecheck.stdout}\n${typecheck.stderr}`),
        attempt: 1,
      });
      emit('repairing', repair.changed ? 'success' : 'warning', repair.summary, repair);
    } else {
      emit('typechecking', 'success', 'Typecheck correcto.');
    }
  }

  let lastError = '';

  if (options.runBuild) {
    for (let attempt = 1; attempt <= options.maxRepairAttempts; attempt += 1) {
      emit('building', 'info', `Ejecutando npm run build. Intento ${attempt}/${options.maxRepairAttempts}...`);

      const build = await runCommand({
        cwd,
        command: 'npm run build',
        timeoutMs: 1000 * 60 * 10,
        onOutput: log,
      });

      if (build.exitCode === 0) {
        emit('building', 'success', 'Build exitoso.');
        lastError = '';
        break;
      }

      lastError = compactLog(`${build.stdout}\n${build.stderr}`);
      emit('repairing', 'warning', 'Build falló. Reparando antes de repetir...', {
        attempt,
        error: lastError,
      });

      const repair = await repairProjectFromLogs({
        cwd,
        logs: lastError,
        attempt,
      });

      emit('repairing', repair.changed ? 'success' : 'warning', repair.summary, repair);

      if (!repair.changed) {
        break;
      }
    }

    if (lastError) {
      emit('failed', 'error', 'No se pudo completar el build sin errores.', lastError);
      return {
        success: false,
        cwd,
        port,
        attempts: options.maxRepairAttempts,
        error: lastError,
        logs,
        events,
      };
    }
  }

  if (options.runRuntimeCheck) {
    emit('starting-runtime', 'info', `Iniciando runtime en puerto ${port}...`);
    const runtime = await startRuntimeAndVerify({ cwd, port });
    logs.push(...runtime.logs);

    if (!runtime.success) {
      emit('failed', 'error', runtime.error || 'Runtime falló.', runtime);
      return {
        success: false,
        cwd,
        port,
        url: runtime.url,
        attempts: options.maxRepairAttempts,
        error: runtime.error || 'Runtime falló.',
        logs,
        events,
      };
    }

    emit('ready', 'success', `App funcionando en ${runtime.url}`);

    return {
      success: true,
      cwd,
      port,
      url: runtime.url,
      attempts: options.maxRepairAttempts,
      logs,
      events,
    };
  }

  emit('ready', 'success', 'App validada correctamente.');

  return {
    success: true,
    cwd,
    port,
    attempts: options.maxRepairAttempts,
    logs,
    events,
  };
}
