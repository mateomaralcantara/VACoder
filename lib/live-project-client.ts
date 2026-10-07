import type { RuntimeStartRequest, RuntimeStatusResponse } from '@/lib/live-project/types';

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`);
  }

  return data;
}

export async function startLiveRuntime(input: RuntimeStartRequest): Promise<RuntimeStatusResponse> {
  const response = await fetch('/api/project/runtime/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return readJsonOrThrow<RuntimeStatusResponse>(response);
}

export async function stopLiveRuntime(): Promise<RuntimeStatusResponse> {
  const response = await fetch('/api/project/runtime/stop', {
    method: 'POST',
  });

  return readJsonOrThrow<RuntimeStatusResponse>(response);
}

export async function getLiveRuntimeStatus(): Promise<RuntimeStatusResponse> {
  const response = await fetch('/api/project/runtime/status', {
    cache: 'no-store',
  });

  return readJsonOrThrow<RuntimeStatusResponse>(response);
}