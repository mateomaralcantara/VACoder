import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { CommandResult } from '@/lib/production/types';

interface RunCommandOptions {
  cwd: string;
  command: string;
  timeoutMs?: number;
  env?: Partial<NodeJS.ProcessEnv>;
  onLine?: (line: string) => void;
}

interface SpawnCommand {
  file: string;
  args: string[];
}

async function assertValidCwd(cwd: string): Promise<void> {
  try {
    const stat = await fs.stat(cwd);

    if (!stat.isDirectory()) {
      throw new Error(`La ruta no es una carpeta: ${cwd}`);
    }
  } catch {
    throw new Error(`La carpeta del proyecto no existe o no es accesible: ${cwd}`);
  }
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

function getWindowsShell(): string {
  const candidates = [
    process.env.ComSpec,
    process.env.comspec,
    'C:\\Windows\\System32\\cmd.exe',
    'C:\\Windows\\Sysnative\\cmd.exe',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return 'cmd.exe';
}

function parseNonWindowsCommand(command: string): SpawnCommand {
  const parts = command.trim().split(/\s+/g).filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Comando vacío.');
  }

  return {
    file: parts[0],
    args: parts.slice(1),
  };
}

function createSpawnCommand(command: string): SpawnCommand {
  const clean = command.trim();

  if (!clean) {
    throw new Error('Comando vacío.');
  }

  if (isWindows()) {
    return {
      file: getWindowsShell(),
      args: ['/d', '/s', '/c', clean],
    };
  }

  return parseNonWindowsCommand(clean);
}

function createSafeEnv(extraEnv: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  const nodeEnv = extraEnv.NODE_ENV || process.env.NODE_ENV || 'development';

  const safeEnv = {
    ...process.env,
    ...extraEnv,

    NODE_ENV: nodeEnv,
    SystemRoot: extraEnv.SystemRoot || process.env.SystemRoot || 'C:\\Windows',
    WINDIR: extraEnv.WINDIR || process.env.WINDIR || 'C:\\Windows',
    ComSpec:
      extraEnv.ComSpec ||
      process.env.ComSpec ||
      'C:\\Windows\\System32\\cmd.exe',
  };

  return safeEnv as NodeJS.ProcessEnv;
}

function emitLines(text: string, onLine?: (line: string) => void): void {
  text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => onLine?.(line));
}

export async function runCommand({
  cwd,
  command,
  timeoutMs = 1000 * 60 * 10,
  env,
  onLine,
}: RunCommandOptions): Promise<CommandResult> {
  await assertValidCwd(cwd);

  const startedAt = Date.now();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const parsed = createSpawnCommand(command);

  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = (result: CommandResult) => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      resolve(result);
    };

    let child: ReturnType<typeof spawn>;

    try {
      child = spawn(parsed.file, parsed.args, {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: createSafeEnv(env),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido ejecutando spawn.';

      finish({
        command,
        cwd,
        exitCode: 1,
        stdout: '',
        stderr: [
          `Error ejecutando "${command}"`,
          `Binario usado: ${parsed.file}`,
          `Argumentos: ${parsed.args.join(' ')}`,
          `Detalle: ${message}`,
        ].join('\n'),
        durationMs: Date.now() - startedAt,
      });

      return;
    }

    timer = setTimeout(() => {
      child.kill();

      finish({
        command,
        cwd,
        exitCode: 124,
        stdout: stdout.join(''),
        stderr: [...stderr, `\nTimeout ejecutando: ${command}`].join(''),
        durationMs: Date.now() - startedAt,
      });
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout.push(text);
      emitLines(text, onLine);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr.push(text);
      emitLines(text, onLine);
    });

    child.on('error', (error) => {
      finish({
        command,
        cwd,
        exitCode: 1,
        stdout: stdout.join(''),
        stderr: [
          ...stderr,
          `\nError ejecutando "${command}"`,
          `Binario usado: ${parsed.file}`,
          `Argumentos: ${parsed.args.join(' ')}`,
          `Detalle: ${error.message}`,
        ].join('\n'),
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('close', (code) => {
      finish({
        command,
        cwd,
        exitCode: code ?? 1,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        durationMs: Date.now() - startedAt,
      });
    });
  });
}