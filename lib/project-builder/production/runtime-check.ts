import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface RuntimeCheckResult {
  success: boolean;
  url: string;
  logs: string[];
  error?: string;
  process?: ChildProcessWithoutNullStreams;
}

async function waitForHttp(url: string, timeoutMs: number, logs: string[]): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });

      if (response.status < 500) {
        logs.push(`HTTP OK ${response.status}: ${url}`);
        return true;
      }

      logs.push(`HTTP ${response.status}: ${url}`);
    } catch {
      logs.push(`Esperando respuesta de ${url}...`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return false;
}

export async function startRuntimeAndVerify(options: {
  cwd: string;
  port: number;
  timeoutMs?: number;
}): Promise<RuntimeCheckResult> {
  const logs: string[] = [];
  const url = `http://localhost:${options.port}`;

  const child = spawn(`npm run dev -- --port ${options.port}`, {
    cwd: options.cwd,
    shell: true,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  child.stdout.on('data', (chunk: Buffer) => {
    logs.push(chunk.toString());
  });

  child.stderr.on('data', (chunk: Buffer) => {
    logs.push(chunk.toString());
  });

  const ok = await waitForHttp(url, options.timeoutMs ?? 1000 * 45, logs);

  if (!ok) {
    child.kill('SIGTERM');

    return {
      success: false,
      url,
      logs,
      error: `El servidor no respondió correctamente en ${url}.`,
    };
  }

  return {
    success: true,
    url,
    logs,
    process: child,
  };
}
