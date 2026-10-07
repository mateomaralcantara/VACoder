import { exec } from 'node:child_process';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_COMMANDS = new Set([
  'npm install',
  'npm run build',
  'npm run typecheck',
  'npm run lint',
  'npm test',
  'npx tsc --noEmit',
]);

type RunCommandBody = {
  cwd: string;
  command: string;
  timeoutMs?: number;
};

function runCommand(command: string, cwd: string, timeoutMs: number) {
  return new Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }>((resolve) => {
    const child = exec(
      command,
      {
        cwd,
        timeout: timeoutMs,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 5,
      },
      (error, stdout, stderr) => {
        const exitCode =
          error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
            ? ((error as NodeJS.ErrnoException & { code?: number }).code ?? 1)
            : error
              ? 1
              : 0;

        resolve({
          stdout,
          stderr,
          exitCode,
          timedOut: Boolean((error as NodeJS.ErrnoException & { killed?: boolean } | null)?.killed),
        });
      },
    );

    child.stdin?.end();
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunCommandBody;
    const cwd = path.resolve(body.cwd || '');
    const command = body.command?.trim();

    if (!path.isAbsolute(cwd)) {
      throw new Error('cwd debe ser una ruta absoluta.');
    }

    if (!ALLOWED_COMMANDS.has(command)) {
      throw new Error(`Comando no permitido: ${command}`);
    }

    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs ?? 120_000), 10_000), 300_000);
    const result = await runCommand(command, cwd, timeoutMs);

    return NextResponse.json({
      command,
      cwd,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'No se pudo ejecutar el comando.',
      },
      { status: 400 },
    );
  }
}