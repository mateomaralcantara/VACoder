import type { ProjectManifest, ProjectScanOptions } from '@/lib/project-manifest';

export type ScanProjectClientInput = ProjectScanOptions & {
  projectRoot?: string;
};

export type ScanProjectClientResult =
  | {
      ok: true;
      manifest: ProjectManifest;
    }
  | {
      ok: false;
      error: string;
    };

export async function scanProjectFromClient(input: ScanProjectClientInput): Promise<ScanProjectClientResult> {
  const response = await fetch('/api/project/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as ScanProjectClientResult;

  if (!response.ok && payload.ok === false) {
    return payload;
  }

  return payload;
}
