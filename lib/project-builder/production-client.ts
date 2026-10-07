import type { ProductionPipelineJob, ProductionPipelineStartRequest } from '@/lib/project-builder/production/types';

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }

  return data;
}

export async function startProductionPipeline(
  input: ProductionPipelineStartRequest,
): Promise<ProductionPipelineJob> {
  const response = await fetch('/api/project/builder/production/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return readJsonOrThrow<ProductionPipelineJob>(response);
}

export async function getProductionPipelineStatus(jobId?: string): Promise<ProductionPipelineJob> {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : '';
  const response = await fetch(`/api/project/builder/production/status${query}`, {
    cache: 'no-store',
  });

  return readJsonOrThrow<ProductionPipelineJob>(response);
}
