import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type {
  ProductionEvent,
  ProductionPhase,
  ProductionStatus,
} from '@/lib/production/types';

interface ProductionState {
  phase: ProductionPhase;
  cwd?: string;
  port?: number;
  url?: string;
  process: ChildProcessWithoutNullStreams | null;
  events: ProductionEvent[];
  updatedAt: string;
  error?: string;
}

type GlobalWithProduction = typeof globalThis & {
  __VACODER_PRODUCTION__?: ProductionState;
};

export function getProductionState(): ProductionState {
  const globalRef = globalThis as GlobalWithProduction;

  if (!globalRef.__VACODER_PRODUCTION__) {
    globalRef.__VACODER_PRODUCTION__ = {
      phase: 'idle',
      process: null,
      events: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return globalRef.__VACODER_PRODUCTION__;
}

export function appendProductionEvent(event: ProductionEvent): void {
  const state = getProductionState();

  state.phase = event.phase;
  state.events = [...state.events, event].slice(-500);
  state.updatedAt = new Date().toISOString();

  if (event.level === 'error') {
    state.error = event.message;
  }
}

export function setProductionState(input: Partial<ProductionState>): void {
  const state = getProductionState();

  Object.assign(state, input, {
    updatedAt: new Date().toISOString(),
  });
}

export function stopProductionProcess(): void {
  const state = getProductionState();

  if (state.process && !state.process.killed) {
    state.process.kill();
  }

  state.process = null;
  state.phase = 'stopped';
  state.updatedAt = new Date().toISOString();
}

export function resetProductionState(input?: {
  cwd?: string;
  port?: number;
}): void {
  stopProductionProcess();

  const state = getProductionState();

  state.phase = 'idle';
  state.cwd = input?.cwd;
  state.port = input?.port;
  state.url = undefined;
  state.process = null;
  state.events = [];
  state.error = undefined;
  state.updatedAt = new Date().toISOString();
}

export function serializeProductionState(): ProductionStatus {
  const state = getProductionState();

  return {
    phase: state.phase,
    cwd: state.cwd,
    port: state.port,
    url: state.url,
    pid: state.process?.pid,
    running: Boolean(state.process && !state.process.killed),
    events: state.events,
    updatedAt: state.updatedAt,
    error: state.error,
  };
}