import type {
    ProductionRunRequest,
    ProductionRunResult,
    ProductionStatus,
  } from '@/lib/production/types';
  
  async function readJsonOrThrow<T>(response: Response): Promise<T> {
    const data = (await response.json()) as T & {
      error?: string;
    };
  
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
  
    return data;
  }
  
  export async function startProductionRun(
    input: ProductionRunRequest,
  ): Promise<ProductionRunResult> {
    const response = await fetch('/api/project/production/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  
    return readJsonOrThrow<ProductionRunResult>(response);
  }
  
  export async function getProductionStatus(): Promise<ProductionStatus> {
    const response = await fetch('/api/project/production/status', {
      cache: 'no-store',
    });
  
    return readJsonOrThrow<ProductionStatus>(response);
  }
  
  export async function stopProductionRun(): Promise<ProductionStatus> {
    const response = await fetch('/api/project/production/stop', {
      method: 'POST',
    });
  
    return readJsonOrThrow<ProductionStatus>(response);
  }