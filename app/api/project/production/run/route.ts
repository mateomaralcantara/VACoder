import { NextResponse } from 'next/server';
import type { ProductionRunRequest } from '@/lib/production/types';
import { runProductionPipeline } from '@/lib/production/pipeline';
import {
  appendProductionEvent,
  resetProductionState,
  setProductionState,
} from '@/app/api/project/production/state';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProductionRunRequest;

    const cwd = body.cwd?.trim();
    const port = Number(body.port || 3001);
    const maxAttempts = Number(body.maxAttempts || 5);

    if (!cwd) {
      return NextResponse.json(
        { error: 'Debes indicar la ruta del proyecto.' },
        { status: 400 },
      );
    }

    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return NextResponse.json(
        { error: 'Puerto inválido. Usa un puerto entre 1024 y 65535.' },
        { status: 400 },
      );
    }

    resetProductionState({ cwd, port });

    const result = await runProductionPipeline({
      cwd,
      port,
      maxAttempts,
      onEvent: appendProductionEvent,
      onRuntime: (runtimeProcess) => {
        setProductionState({
          process: runtimeProcess,
        });
      },
    });

    setProductionState({
      phase: result.phase,
      cwd: result.cwd,
      port: result.port,
      url: result.url,
      error: result.error,
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido.';

    setProductionState({
      phase: 'failed',
      error: message,
    });

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}