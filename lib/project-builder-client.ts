import type {
    ProjectBuilderCreateResult,
    ProjectBuilderPlan,
    ProjectBuilderRequest,
  } from '@/lib/project-builder/types';
  
  async function readJsonOrThrow<T>(response: Response): Promise<T> {
    const data = (await response.json()) as T & { error?: string };
  
    if (!response.ok) {
      throw new Error(data.error || `Error HTTP ${response.status}`);
    }
  
    return data;
  }
  
  export async function previewProjectBuild(input: ProjectBuilderRequest): Promise<ProjectBuilderPlan> {
    const response = await fetch('/api/project/builder/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  
    return readJsonOrThrow<ProjectBuilderPlan>(response);
  }
  
  export async function createProjectOnDisk(
    input: ProjectBuilderRequest & { overwrite?: boolean },
  ): Promise<ProjectBuilderCreateResult> {
    const response = await fetch('/api/project/builder/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  
    return readJsonOrThrow<ProjectBuilderCreateResult>(response);
  }
  
  export async function runProjectCommand(input: {
    cwd: string;
    command: string;
    timeoutMs?: number;
  }): Promise<{
    command: string;
    cwd: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }> {
    const response = await fetch('/api/project/run-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  
    return readJsonOrThrow(response);
  }