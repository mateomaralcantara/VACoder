import type { ChildProcess } from 'node:child_process';
import type { LiveProjectRoute, RuntimeStatus } from '@/lib/live-project/types';

export type RuntimeProcessState = {
  process: ChildProcess | null;
  status: RuntimeStatus;
  cwd?: string;
  port?: number;
  url?: string;
  logs: string[];
  error?: string;
  routes: LiveProjectRoute[];
  updatedAt: string;
};

type GlobalRuntime = typeof globalThis & {
  __VACODER_RUNTIME__?: RuntimeProcessState;
};

export function getRuntimeState(): RuntimeProcessState {
  const globalRuntime = globalThis as GlobalRuntime;

  if (!globalRuntime.__VACODER_RUNTIME__) {
    globalRuntime.__VACODER_RUNTIME__ = {
      process: null,
      status: 'idle',
      logs: [],
      routes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return globalRuntime.__VACODER_RUNTIME__;
}

export function pushRuntimeLog(message: string): void {
  const state = getRuntimeState();
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;

  state.logs = [...state.logs, line].slice(-300);
  state.updatedAt = new Date().toISOString();
}

export function setRuntimeStatus(status: RuntimeStatus, error?: string): void {
  const state = getRuntimeState();
  state.status = status;
  state.error = error;
  state.updatedAt = new Date().toISOString();
}

export function resetRuntimeState(): RuntimeProcessState {
  const state = getRuntimeState();

  state.process = null;
  state.status = 'idle';
  state.cwd = undefined;
  state.port = undefined;
  state.url = undefined;
  state.logs = [];
  state.error = undefined;
  state.routes = [];
  state.updatedAt = new Date().toISOString();

  return state;
}