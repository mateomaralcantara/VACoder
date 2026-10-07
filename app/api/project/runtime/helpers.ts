import path from 'node:path';
import type { LiveProjectRoute, RuntimeStatusResponse } from '@/lib/live-project/types';
import { getRuntimeState } from '@/app/api/project/runtime/state';

export function assertSafeCwd(cwd: string): string {
  const resolved = path.resolve(cwd);

  if (!path.isAbsolute(resolved)) {
    throw new Error('La ruta del proyecto debe ser absoluta.');
  }

  const parsed = path.parse(resolved);

  if (resolved === parsed.root) {
    throw new Error('No puedes ejecutar comandos en la raíz del disco.');
  }

  if (
    resolved.includes(`${path.sep}.git${path.sep}`) ||
    resolved.includes(`${path.sep}node_modules${path.sep}`)
  ) {
    throw new Error('Ruta de proyecto no permitida.');
  }

  return resolved;
}

export function normalizePort(value?: number): number {
  const port = Number(value || 3000);

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Puerto inválido. Usa un puerto entre 1024 y 65535.');
  }

  return port;
}

export function createDefaultRoutes(): LiveProjectRoute[] {
  return [
    { path: '/', label: 'Home', status: 'ready' },
    { path: '/dashboard', label: 'Dashboard', status: 'pending' },
    { path: '/admin', label: 'Admin', status: 'pending' },
    { path: '/login', label: 'Login', status: 'pending' },
    { path: '/api/health', label: 'Health API', status: 'pending' },
  ];
}

export function serializeRuntimeState(): RuntimeStatusResponse {
  const state = getRuntimeState();

  return {
    status: state.status,
    cwd: state.cwd,
    port: state.port,
    url: state.url,
    pid: state.process?.pid,
    logs: state.logs,
    error: state.error,
    routes: state.routes,
    updatedAt: state.updatedAt,
  };
}