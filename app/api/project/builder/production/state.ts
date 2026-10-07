import type {
  ProductionPipelineEvent,
  ProductionPipelineJob,
  ProductionPipelinePhase,
  ProductionPipelineStatus,
} from '@/lib/project-builder/production/types';

interface ProductionGlobalState {
  jobs: Map<string, ProductionPipelineJob>;
  latestJobId?: string;
}

type GlobalWithProductionState = typeof globalThis & {
  __VACODER_PRODUCTION_PIPELINE__?: ProductionGlobalState;
};

function getStore(): ProductionGlobalState {
  const globalValue = globalThis as GlobalWithProductionState;

  if (!globalValue.__VACODER_PRODUCTION_PIPELINE__) {
    globalValue.__VACODER_PRODUCTION_PIPELINE__ = {
      jobs: new Map<string, ProductionPipelineJob>(),
    };
  }

  return globalValue.__VACODER_PRODUCTION_PIPELINE__;
}

export function createProductionJob(input: { cwd: string; port: number }): ProductionPipelineJob {
  const store = getStore();
  const now = new Date().toISOString();
  const job: ProductionPipelineJob = {
    id: crypto.randomUUID(),
    cwd: input.cwd,
    port: input.port,
    status: 'running',
    phase: 'queued',
    startedAt: now,
    updatedAt: now,
    attempts: 0,
    logs: [],
    events: [],
  };

  store.jobs.set(job.id, job);
  store.latestJobId = job.id;

  return job;
}

export function getProductionJob(jobId?: string): ProductionPipelineJob | undefined {
  const store = getStore();
  const id = jobId || store.latestJobId;
  return id ? store.jobs.get(id) : undefined;
}

export function appendProductionEvent(jobId: string, event: ProductionPipelineEvent): void {
  const job = getProductionJob(jobId);
  if (!job) return;

  job.events = [...job.events, event].slice(-500);
  job.phase = event.phase;
  job.updatedAt = new Date().toISOString();
}

export function appendProductionLog(jobId: string, line: string): void {
  const job = getProductionJob(jobId);
  if (!job) return;

  job.logs = [...job.logs, line].slice(-1000);
  job.updatedAt = new Date().toISOString();
}

export function updateProductionJob(
  jobId: string,
  patch: Partial<Pick<ProductionPipelineJob, 'status' | 'phase' | 'error' | 'url' | 'result' | 'attempts'>>,
): void {
  const job = getProductionJob(jobId);
  if (!job) return;

  Object.assign(job, patch, {
    updatedAt: new Date().toISOString(),
    finishedAt: patch.status === 'success' || patch.status === 'error' ? new Date().toISOString() : job.finishedAt,
  });
}

export function normalizeStatusFromPhase(phase: ProductionPipelinePhase): ProductionPipelineStatus {
  if (phase === 'ready') return 'success';
  if (phase === 'failed' || phase === 'cancelled') return 'error';
  return 'running';
}
