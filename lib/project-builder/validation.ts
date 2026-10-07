import type { ProjectBuilderRequest } from '@/lib/project-builder/types';

export function sanitizeProjectName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function assertValidBuilderRequest(input: ProjectBuilderRequest): ProjectBuilderRequest {
  const projectName = sanitizeProjectName(input.projectName);

  if (!projectName) {
    throw new Error('El nombre del proyecto es obligatorio.');
  }

  const description = input.description?.trim();

  if (!description || description.length < 12) {
    throw new Error('Describe la app con al menos 12 caracteres.');
  }

  return {
    ...input,
    projectName,
    description,
    appType: input.appType?.trim() || 'web app',
    stack: input.stack || 'next-css-supabase',
    deploy: input.deploy || 'vercel',
    style: input.style?.trim() || 'moderna, limpia y profesional',
  };
}

export function isUnsafeRelativeFilePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll('\\', '/');

  return (
    normalized.startsWith('/') ||
    normalized.includes('../') ||
    normalized === '..' ||
    normalized.includes('/.git/') ||
    normalized.startsWith('.git/') ||
    normalized.includes('/node_modules/') ||
    normalized.startsWith('node_modules/') ||
    normalized.endsWith('.env') ||
    normalized === '.env' ||
    normalized === '.env.local'
  );
}