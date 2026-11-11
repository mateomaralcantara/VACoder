import { spawnArgv } from '@/lib/security/process';
import { NextResponse } from 'next/server';
import type { RuntimeStartRequest } from '@/lib/live-project/types';
import {
  assertSafeCwd,
  createDefaultRoutes,
  normalizePort,
  serializeRuntimeState,
} from '@/app/api/project/runtime/helpers';
import {
  getRuntimeState,
  pushRuntimeLog,
  setRuntimeStatus,
} from '@/app/api/project/runtime/state';

export const runtime = 'nodejs';

function markRunningIfReady(output: string, port: number): void {
  const cleanOutput = output.toLowerCase();

  if (
    cleanOutput.includes('ready') ||
    cleanOutput.includes('local:') ||
    cleanOutput.includes(`localhost:${port}`) ||
    cleanOutput.includes(`127.0.0.1:${port}`)
  ) {
    setRuntimeStatus('running');
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RuntimeStartRequest;
    const cwd = assertSafeCwd(body.cwd);
    const port = normalizePort(body.port);
    const state = getRuntimeState();

    if (state.process && !state.process.killed && state.status !== 'error') {
      pushRuntimeLog('Ya existe un runtime activo. Detén el anterior antes de iniciar otro.');
      return NextResponse.json(serializeRuntimeState());
    }

    state.process = null;
    state.cwd = cwd;
    state.port = port;
    state.url = `http://localhost:${port}`;
    state.routes = createDefaultRoutes();
    state.logs = [];
    state.error = undefined;

    setRuntimeStatus('starting');
    pushRuntimeLog(`Iniciando proyecto en ${cwd}`);
    pushRuntimeLog(`URL esperada: http://localhost:${port}`);

    pushRuntimeLog(`Comando: npm run dev -- --port ${port}`);

    // Sin shell y como lider de grupo, para poder detener el arbol completo.
    const child = spawnArgv(cwd, 'npm', ['run', 'dev', '--', '--port', String(port)], {
      env: { NODE_ENV: 'development', PORT: String(port), BROWSER: 'none' },
      detached: true,
    });

    state.process = child;

    child.stdout?.on('data', (chunk: Buffer) => {
      const output = chunk.toString('utf8');

      output
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => pushRuntimeLog(line));

      markRunningIfReady(output, port);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const output = chunk.toString('utf8');

      output
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => pushRuntimeLog(line));

      if (output.toLowerCase().includes('error')) {
        setRuntimeStatus('error', output.trim().slice(0, 1200));
      }

      markRunningIfReady(output, port);
    });

    child.on('error', (error) => {
      const currentState = getRuntimeState();

      pushRuntimeLog(`Error iniciando runtime: ${error.message}`);
      currentState.process = null;
      setRuntimeStatus('error', error.message);
    });

    child.on('exit', (code) => {
      const currentState = getRuntimeState();

      pushRuntimeLog(`Runtime detenido con código ${code ?? 'desconocido'}`);
      currentState.process = null;

      if (currentState.status !== 'stopped') {
        setRuntimeStatus(
          code === 0 ? 'stopped' : 'error',
          code === 0 ? undefined : `Exit code ${code}`,
        );
      }
    });

    return NextResponse.json(serializeRuntimeState());
  } catch (error) {
    const state = getRuntimeState();
    const message = error instanceof Error ? error.message : 'No se pudo iniciar el runtime.';

    state.process = null;
    setRuntimeStatus('error', message);

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}