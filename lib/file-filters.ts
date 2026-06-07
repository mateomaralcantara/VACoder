export const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  '.github',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  '.cache',
  '.output',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.idea',
  '.vscode',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'vendor',
  'tmp',
  'temp',
  'logs',
]);

export const DEFAULT_IGNORED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development.local',
  '.env.production.local',
  '.DS_Store',
  'Thumbs.db',
  'npm-debug.log',
  'yarn-error.log',
  'pnpm-debug.log',
]);

export const LOCK_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

export const IMPORTANT_FILE_NAMES = new Set([
  'package.json',
  'tsconfig.json',
  'jsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.ts',
  'vite.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'middleware.ts',
  'middleware.js',
  'README.md',
  'README.mdx',
  '.env.example',
  'prisma.schema',
  'schema.prisma',
  'supabase.sql',
]);

export const IMPORTANT_PATH_SEGMENTS = [
  'app',
  'pages',
  'src',
  'components',
  'lib',
  'server',
  'api',
  'prisma',
  'supabase',
  'hooks',
  'utils',
  'services',
  'store',
  'stores',
  'types',
];

export const SOURCE_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.sass',
  '.json',
  '.md',
  '.mdx',
  '.html',
  '.yml',
  '.yaml',
  '.sql',
  '.prisma',
]);

export const BINARY_FILE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.pdf',
  '.zip',
  '.rar',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.mp3',
  '.mp4',
  '.mov',
  '.avi',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

export const DEFAULT_MAX_FILE_SIZE_BYTES = 180_000;

export type FileImportance = 'critical' | 'high' | 'normal' | 'ignored';

export interface FileFilterOptions {
  maxFileSizeBytes?: number;
  includeLockFiles?: boolean;
  extraIgnoredDirectories?: string[];
  extraIgnoredFiles?: string[];
}

export function normalizeProjectPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

export function getPathSegments(relativePath: string): string[] {
  return normalizeProjectPath(relativePath)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getFileName(relativePath: string): string {
  const segments = getPathSegments(relativePath);
  return segments[segments.length - 1] ?? relativePath;
}

export function getFileExtension(relativePath: string): string {
  const fileName = getFileName(relativePath);
  const index = fileName.lastIndexOf('.');

  if (index <= 0) {
    return '';
  }

  return fileName.slice(index).toLowerCase();
}

export function isInsideIgnoredDirectory(relativePath: string, options: FileFilterOptions = {}): boolean {
  const ignored = new Set([
    ...DEFAULT_IGNORED_DIRECTORIES,
    ...(options.extraIgnoredDirectories ?? []),
  ]);

  return getPathSegments(relativePath).some((segment) => ignored.has(segment));
}

export function isIgnoredFile(relativePath: string, options: FileFilterOptions = {}): boolean {
  const fileName = getFileName(relativePath);
  const ignored = new Set([
    ...DEFAULT_IGNORED_FILES,
    ...(options.extraIgnoredFiles ?? []),
  ]);

  if (ignored.has(fileName)) {
    return true;
  }

  if (!options.includeLockFiles && LOCK_FILES.has(fileName)) {
    return true;
  }

  return false;
}

export function isBinaryFile(relativePath: string): boolean {
  return BINARY_FILE_EXTENSIONS.has(getFileExtension(relativePath));
}

export function isLikelySourceFile(relativePath: string): boolean {
  return SOURCE_FILE_EXTENSIONS.has(getFileExtension(relativePath));
}

export function isImportantProjectFile(relativePath: string): boolean {
  const normalized = normalizeProjectPath(relativePath);
  const fileName = getFileName(normalized);

  if (IMPORTANT_FILE_NAMES.has(fileName)) {
    return true;
  }

  return IMPORTANT_PATH_SEGMENTS.some((segment) => {
    return normalized === segment || normalized.startsWith(`${segment}/`);
  });
}

export function classifyFileImportance(
  relativePath: string,
  sizeBytes = 0,
  options: FileFilterOptions = {},
): FileImportance {
  const maxSize = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE_BYTES;

  if (isInsideIgnoredDirectory(relativePath, options)) {
    return 'ignored';
  }

  if (isIgnoredFile(relativePath, options)) {
    return 'ignored';
  }

  if (isBinaryFile(relativePath)) {
    return 'ignored';
  }

  if (sizeBytes > maxSize) {
    return 'ignored';
  }

  const fileName = getFileName(relativePath);

  if (
    fileName === 'package.json' ||
    fileName === 'tsconfig.json' ||
    fileName.startsWith('next.config') ||
    fileName.startsWith('vite.config') ||
    fileName === 'middleware.ts' ||
    fileName === 'middleware.js'
  ) {
    return 'critical';
  }

  if (isImportantProjectFile(relativePath)) {
    return 'high';
  }

  if (isLikelySourceFile(relativePath)) {
    return 'normal';
  }

  return 'ignored';
}

export function shouldIncludeFile(
  relativePath: string,
  sizeBytes = 0,
  options: FileFilterOptions = {},
): boolean {
  return classifyFileImportance(relativePath, sizeBytes, options) !== 'ignored';
}
