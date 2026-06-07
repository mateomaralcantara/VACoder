export type ProjectStackId =
  | 'next'
  | 'react'
  | 'typescript'
  | 'vite'
  | 'tailwind'
  | 'supabase'
  | 'prisma'
  | 'node'
  | 'express'
  | 'unknown';

export interface DetectedStack {
  id: ProjectStackId;
  label: string;
  confidence: number;
  evidence: string[];
}

export interface ProjectManifestFile {
  path: string;
  sizeBytes: number;
  extension: string;
  importance: 'critical' | 'high' | 'normal';
  reason: string;
  contentPreview?: string;
}

export interface ProjectManifestDirectory {
  path: string;
  fileCount: number;
  includedFileCount: number;
}

export interface ProjectManifestStats {
  totalFiles: number;
  includedFiles: number;
  ignoredFiles: number;
  totalDirectories: number;
  totalBytes: number;
  includedBytes: number;
}

export interface ProjectManifest {
  projectName: string;
  projectRoot: string;
  generatedAt: string;
  stats: ProjectManifestStats;
  detectedStacks: DetectedStack[];
  importantFiles: ProjectManifestFile[];
  directories: ProjectManifestDirectory[];
  ignoredSamples: string[];
  notes: string[];
}

export interface ProjectScanOptions {
  maxDepth?: number;
  maxFiles?: number;
  maxImportantFiles?: number;
  maxFileSizeBytes?: number;
  includeContentPreview?: boolean;
  contentPreviewMaxChars?: number;
  includeLockFiles?: boolean;
  extraIgnoredDirectories?: string[];
  extraIgnoredFiles?: string[];
}

export const DEFAULT_SCAN_OPTIONS: Required<ProjectScanOptions> = {
  maxDepth: 12,
  maxFiles: 15_000,
  maxImportantFiles: 160,
  maxFileSizeBytes: 180_000,
  includeContentPreview: true,
  contentPreviewMaxChars: 8_000,
  includeLockFiles: false,
  extraIgnoredDirectories: [],
  extraIgnoredFiles: [],
};

export function createEmptyProjectManifest(projectName: string, projectRoot: string): ProjectManifest {
  return {
    projectName,
    projectRoot,
    generatedAt: new Date().toISOString(),
    stats: {
      totalFiles: 0,
      includedFiles: 0,
      ignoredFiles: 0,
      totalDirectories: 0,
      totalBytes: 0,
      includedBytes: 0,
    },
    detectedStacks: [],
    importantFiles: [],
    directories: [],
    ignoredSamples: [],
    notes: [],
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;

  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${(mb / 1024).toFixed(1)} GB`;
}

export function summarizeManifestForPrompt(manifest: ProjectManifest): string {
  const stacks = manifest.detectedStacks
    .map((stack) => `${stack.label} (${Math.round(stack.confidence * 100)}%)`)
    .join(', ') || 'No detectado';

  const importantFiles = manifest.importantFiles
    .slice(0, 80)
    .map((file) => `- [${file.importance}] ${file.path} (${formatBytes(file.sizeBytes)}): ${file.reason}`)
    .join('\n');

  const directories = manifest.directories
    .slice(0, 60)
    .map((directory) => `- ${directory.path}: ${directory.includedFileCount}/${directory.fileCount} archivos incluidos`)
    .join('\n');

  const notes = manifest.notes.length > 0
    ? manifest.notes.map((note) => `- ${note}`).join('\n')
    : '- Sin notas adicionales.';

  return [
    `Nombre del proyecto: ${manifest.projectName}`,
    `Ruta raíz: ${manifest.projectRoot}`,
    `Fecha del manifiesto: ${manifest.generatedAt}`,
    '',
    'Estadísticas:',
    `- Archivos totales: ${manifest.stats.totalFiles}`,
    `- Archivos incluidos: ${manifest.stats.includedFiles}`,
    `- Archivos ignorados: ${manifest.stats.ignoredFiles}`,
    `- Directorios: ${manifest.stats.totalDirectories}`,
    `- Tamaño total escaneado: ${formatBytes(manifest.stats.totalBytes)}`,
    `- Tamaño incluido: ${formatBytes(manifest.stats.includedBytes)}`,
    '',
    `Stack detectado: ${stacks}`,
    '',
    'Directorios principales:',
    directories || '- No hay directorios registrados.',
    '',
    'Archivos importantes:',
    importantFiles || '- No hay archivos importantes registrados.',
    '',
    'Notas:',
    notes,
  ].join('\n');
}
