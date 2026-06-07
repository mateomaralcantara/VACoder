import path from 'path';
import { NextResponse } from 'next/server';
import { scanProject } from '@/lib/project-scanner';
import type { ProjectScanOptions } from '@/lib/project-manifest';

export const runtime = 'nodejs';

type ScanProjectRequestBody = ProjectScanOptions & {
  projectRoot?: string;
};

function isProductionScanDisabled(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.PROJECT_SCAN_ENABLED !== 'true';
}

function normalizeRoot(projectRoot?: string): string {
  const requestedRoot = projectRoot?.trim();

  if (!requestedRoot) {
    return process.cwd();
  }

  if (path.isAbsolute(requestedRoot)) {
    return requestedRoot;
  }

  return path.resolve(process.cwd(), requestedRoot);
}

export async function POST(request: Request) {
  if (isProductionScanDisabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'El escaneo de carpetas locales está desactivado en producción. Activa PROJECT_SCAN_ENABLED=true solo en entornos controlados.',
      },
      { status: 403 },
    );
  }

  let body: ScanProjectRequestBody;

  try {
    body = (await request.json()) as ScanProjectRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'JSON inválido.',
      },
      { status: 400 },
    );
  }

  const projectRoot = normalizeRoot(body.projectRoot);

  try {
    const manifest = await scanProject(projectRoot, {
      maxDepth: body.maxDepth ?? 12,
      maxFiles: body.maxFiles ?? 15000,
      maxImportantFiles: body.maxImportantFiles ?? 160,
      maxFileSizeBytes: body.maxFileSizeBytes ?? 180000,
      includeContentPreview: body.includeContentPreview ?? true,
      contentPreviewMaxChars: body.contentPreviewMaxChars ?? 8000,
      includeLockFiles: body.includeLockFiles ?? false,
      extraIgnoredDirectories: body.extraIgnoredDirectories ?? [],
      extraIgnoredFiles: body.extraIgnoredFiles ?? [],
    });

    return NextResponse.json({
      ok: true,
      manifest,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo escanear el proyecto.',
      },
      { status: 500 },
    );
  }
}
