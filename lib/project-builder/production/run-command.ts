import { spawn } from 'node:child_process';
import type { CommandResult, RunCommandOptions } from '@/lib/project-builder/production/types';

export function runCommand(options: RunCommandOptions): Promise<CommandResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 1000 * 60 * 8;
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;

    const child = spawn(options.command, {
      cwd: options.cwd,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        ...options.env,
      },
    });

    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      resolve({
        command: options.command,
        cwd: options.cwd,
        exitCode,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      stderrChunks.push(`\nCommand timed out after ${timeoutMs}ms\n`);
      options.onOutput?.(`Command timed out after ${timeoutMs}ms`, 'stderr');
      child.kill('SIGTERM');
      finish(124);
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutChunks.push(text);
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        options.onOutput?.(line, 'stdout');
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrChunks.push(text);
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        options.onOutput?.(line, 'stderr');
      }
    });

    child.on('error', (error) => {
      stderrChunks.push(error.message);
      options.onOutput?.(error.message, 'stderr');
      finish(1);
    });

    child.on('close', (code) => {
      finish(code ?? 1);
    });
  });
}
