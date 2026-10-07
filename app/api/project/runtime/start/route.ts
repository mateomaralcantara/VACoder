import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
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

function isWindows(): boolean {
  return process.platform === 'win32';
}

function createSafeEnv(port: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(port),
    SystemRoot: process.env.SystemRoot || 'C:\\Windows',
    WINDIR: process.env.WINDIR || 'C:\\Windows',
    ComSpec: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
  } as NodeJS.ProcessEnv;
}

function getWindowsPowerShell(): string {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';

  const candidates = [
    `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
    `${systemRoot}\\Sysnative\\WindowsPowerShell\\v1.0\\powershell.exe`,
    'powershell.exe',
  ];

  for (const candidate of candidates) {
    if (candidate === 'powershell.exe' || existsSync(candidate)) {
      return candidate;
    }
  }

  return 'powershell.exe';
}

function createRuntimeCommand(port: number): {
  file: string;
  args: string[];
} {
  const commandText = `npm run dev -- --port ${port}`;

  if (isWindows()) {
    return {
      file: getWindowsPowerShell(),
      args: [
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        commandText,
      ],
    };
  }

  return {
    file: 'sh',
    args: ['-lc', commandText],
  };
}

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

    const runtimeCommand = createRuntimeCommand(port);

    pushRuntimeLog(`Ejecutor: ${runtimeCommand.file}`);
    pushRuntimeLog(`Comando: ${runtimeCommand.args.join(' ')}`);

    const child = spawn(runtimeCommand.file, runtimeCommand.args, {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: 'pipe',
        env: createSafeEnv(port),
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