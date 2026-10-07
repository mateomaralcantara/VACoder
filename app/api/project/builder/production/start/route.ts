import path from 'node:path';
import { NextResponse } from 'next/server';
import type { ProductionPipelineStartRequest } from '@/lib/project-builder/production/types';
import { runProductionPipeline } from '@/lib/project-builder/production/pipeline';
import {
  appendProductionEvent,
  appendProductionLog,
  createProductionJob,
  normalizeStatusFromPhase,
  updateProductionJob,
} from '@/app/api/project/builder/production/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizePort(value?: number): number {
  const port = Number(value || 3000);

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Puerto inválido. Usa un puerto entre 1024 y 65535.');
  }

  return port;
}

function normalizeCwd(value: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error('Debes enviar la ruta absoluta del proyecto.');
  }

  return path.resolve(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductionPipelineStartRequest;
    const cwd = normalizeCwd(body.cwd);
    const port = normalizePort(body.port);
    const maxRepairAttempts = Math.min(Math.max(Number(body.maxRepairAttempts || 5), 1), 10);

    const job = createProductionJob({ cwd, port });

    void runProductionPipeline({
      cwd,
      port,
      maxRepairAttempts,
      installDependencies: body.installDependencies ?? true,
      runTypecheck: body.runTypecheck ?? true,
      runBuild: body.runBuild ?? true,
      runRuntimeCheck: body.runRuntimeCheck ?? true,
      onEvent: (event) => {
        appendProductionEvent(job.id, event);
        updateProductionJob(job.id, {
          phase: event.phase,
          status: normalizeStatusFromPhase(event.phase),
        });
      },
      onLog: (line) => appendProductionLog(job.id, line),
    })
      .then((result) => {
        updateProductionJob(job.id, {
          status: result.success ? 'success' : 'error',
          phase: result.success ? 'ready' : 'failed',
          error: result.error,
          url: result.url,
          result,
          attempts: result.attempts,
        });
      })
      .catch((error) => {
        updateProductionJob(job.id, {
          status: 'error',
          phase: 'failed',
          error: error instanceof Error ? error.message : 'Error desconocido en pipeline.',
        });
      });

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'No se pudo iniciar el pipeline.',
      },
      { status: 400 },
    );
  }
}
