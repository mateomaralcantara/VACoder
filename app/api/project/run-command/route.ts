import path from 'node:path';
import { NextResponse } from 'next/server';
import { assertInsideAppsRoot } from '@/lib/security/project-root';
import { runArgv, tokenizeCommand } from '@/lib/security/process';

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
  const [file, ...args] = tokenizeCommand(command);

  return runArgv(cwd, file, args, timeoutMs);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunCommandBody;
    const cwd = assertInsideAppsRoot(path.resolve(body.cwd || ''));
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
      ...result,
      command,
      cwd,
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