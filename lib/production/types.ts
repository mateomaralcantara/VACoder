export type ProductionPhase =
  | 'idle'
  | 'installing'
  | 'typechecking'
  | 'building'
  | 'repairing'
  | 'starting'
  | 'verifying'
  | 'ready'
  | 'failed'
  | 'stopped';

export type ProductionEventLevel = 'info' | 'success' | 'warning' | 'error';

export interface ProductionEvent {
  id: string;
  at: string;
  phase: ProductionPhase;
  level: ProductionEventLevel;
  message: string;
  details?: string;
}

export interface ProductionRunRequest {
  cwd: string;
  port?: number;
  maxAttempts?: number;
}

export interface ProductionRunResult {
  success: boolean;
  phase: ProductionPhase;
  cwd: string;
  port: number;
  url?: string;
  attempts: number;
  events: ProductionEvent[];
  error?: string;
}

export interface ProductionStatus {
  phase: ProductionPhase;
  cwd?: string;
  port?: number;
  url?: string;
  pid?: number;
  running: boolean;
  events: ProductionEvent[];
  updatedAt: string;
  error?: string;
}

export interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}