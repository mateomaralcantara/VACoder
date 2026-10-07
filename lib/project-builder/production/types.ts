export type ProductionPipelinePhase =
  | 'queued'
  | 'installing'
  | 'typechecking'
  | 'building'
  | 'repairing'
  | 'starting-runtime'
  | 'verifying-runtime'
  | 'ready'
  | 'failed'
  | 'cancelled';

export type ProductionPipelineStatus = 'idle' | 'running' | 'success' | 'error';

export interface ProductionPipelineEvent {
  id: string;
  timestamp: string;
  phase: ProductionPipelinePhase;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  data?: unknown;
}

export interface ProductionPipelineStartRequest {
  cwd: string;
  port?: number;
  maxRepairAttempts?: number;
  installDependencies?: boolean;
  runTypecheck?: boolean;
  runBuild?: boolean;
  runRuntimeCheck?: boolean;
}

export interface ProductionPipelineResult {
  success: boolean;
  cwd: string;
  port: number;
  url?: string;
  attempts: number;
  error?: string;
  logs: string[];
  events: ProductionPipelineEvent[];
}

export interface ProductionPipelineJob {
  id: string;
  cwd: string;
  port: number;
  status: ProductionPipelineStatus;
  phase: ProductionPipelinePhase;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  attempts: number;
  url?: string;
  error?: string;
  logs: string[];
  events: ProductionPipelineEvent[];
  result?: ProductionPipelineResult;
}

export interface CommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface RunCommandOptions {
  cwd: string;
  command: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  onOutput?: (line: string, stream: 'stdout' | 'stderr') => void;
}

export interface RepairContext {
  cwd: string;
  logs: string;
  attempt: number;
}

export interface RepairResult {
  changed: boolean;
  summary: string;
  files: string[];
}
