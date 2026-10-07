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

  // Carpetas locales que ensucian el manifiesto.
  'backup',
  'backups',
  'old',
  'archive',
  'archived',
  'prueba',
  'pruebas',
  'sandbox',
  'playground',
]);

export const DEFAULT_IGNORED_DIRECTORY_PREFIXES = [
  'backup-',
  'backup_',
  'old-',
  'old_',
  'copy-',
  'copy_',
  'copia-',
  'copia_',
  'temp-',
  'temp_',
  'tmp-',
  'tmp_',
];

export const DEFAULT_IGNORED_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.env.development.local',
  '.env.production.local',
  '.env.test.local',

  '.DS_Store',
  'Thumbs.db',

  'npm-debug.log',
  'yarn-error.log',
  'pnpm-debug.log',

  'npm-audit-report.json',
  'package-lock.json.bak',
  'tsconfig.tsbuildinfo',
]);

export const DEFAULT_IGNORED_FILE_SUFFIXES = [
  '.bak',
  '.backup',
  '.old',
  '.tmp',
  '.temp',
  '.log',
  '.map',
  '.tsbuildinfo',
];

export const LOCK_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
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
  'vite.config.mjs',

  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',

  'postcss.config.js',
  'postcss.config.mjs',

  'middleware.ts',
  'middleware.js',

  'README.md',
  'README.mdx',

  '.env.example',
  '.env.sample',
  '.env.template',

  'vercel.json',
  'netlify.toml',

  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',

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
  'schemas',
  'models',
  'actions',
  'workers',
  'middleware',
  'routes',
];

export const SOURCE_FILE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',

  '.js',
  '.jsx',
  '.mjs',
  '.cjs',

  '.css',
  '.scss',
  '.sass',
  '.less',

  '.json',
  '.md',
  '.mdx',
  '.html',

  '.yml',
  '.yaml',
  '.toml',

  '.sql',
  '.prisma',

  '.graphql',
  '.gql',
]);

export const BINARY_FILE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',

  '.pdf',

  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',

  '.exe',
  '.dll',
  '.so',
  '.dylib',

  '.mp3',
  '.wav',
  '.ogg',
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',

  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
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
  return value.replaceAll('\\', '/').replace(/^\/+/, '').trim();
}

export function normalizeComparablePath(value: string): string {
  return normalizeProjectPath(value).toLowerCase();
}

export function getPathSegments(relativePath: string): string[] {
  return normalizeProjectPath(relativePath)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getComparablePathSegments(relativePath: string): string[] {
  return getPathSegments(relativePath).map((segment) => segment.toLowerCase());
}

export function getFileName(relativePath: string): string {
  const segments = getPathSegments(relativePath);
  return segments[segments.length - 1] ?? relativePath;
}

export function getComparableFileName(relativePath: string): string {
  return getFileName(relativePath).toLowerCase();
}

export function getFileExtension(relativePath: string): string {
  const fileName = getComparableFileName(relativePath);
  const index = fileName.lastIndexOf('.');

  if (index <= 0) {
    return '';
  }

  return fileName.slice(index);
}

function createComparableSet(values: Iterable<string>): Set<string> {
  return new Set(Array.from(values).map((value) => value.toLowerCase().trim()).filter(Boolean));
}

function isIgnoredDirectorySegment(segment: string, ignoredDirectories: Set<string>): boolean {
  if (ignoredDirectories.has(segment)) {
    return true;
  }

  return DEFAULT_IGNORED_DIRECTORY_PREFIXES.some((prefix) => segment.startsWith(prefix));
}

export function isInsideIgnoredDirectory(relativePath: string, options: FileFilterOptions = {}): boolean {
  const ignoredDirectories = createComparableSet([
    ...DEFAULT_IGNORED_DIRECTORIES,
    ...(options.extraIgnoredDirectories ?? []),
  ]);

  return getComparablePathSegments(relativePath).some((segment) => {
    return isIgnoredDirectorySegment(segment, ignoredDirectories);
  });
}

function isIgnoredEnvFile(fileName: string): boolean {
  if (!fileName.startsWith('.env')) {
    return false;
  }

  return fileName !== '.env.example' && fileName !== '.env.sample' && fileName !== '.env.template';
}

export function isIgnoredFile(relativePath: string, options: FileFilterOptions = {}): boolean {
  const fileName = getComparableFileName(relativePath);
  const ignoredFiles = createComparableSet([
    ...DEFAULT_IGNORED_FILES,
    ...(options.extraIgnoredFiles ?? []),
  ]);

  if (ignoredFiles.has(fileName)) {
    return true;
  }

  if (isIgnoredEnvFile(fileName)) {
    return true;
  }

  if (!options.includeLockFiles && LOCK_FILES.has(fileName)) {
    return true;
  }

  return DEFAULT_IGNORED_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));
}

export function isBinaryFile(relativePath: string): boolean {
  return BINARY_FILE_EXTENSIONS.has(getFileExtension(relativePath));
}

export function isLikelySourceFile(relativePath: string): boolean {
  return SOURCE_FILE_EXTENSIONS.has(getFileExtension(relativePath));
}

export function isImportantProjectFile(relativePath: string): boolean {
  const normalized = normalizeComparablePath(relativePath);
  const fileName = getComparableFileName(normalized);

  const importantFileNames = createComparableSet(IMPORTANT_FILE_NAMES);

  if (importantFileNames.has(fileName)) {
    return true;
  }

  const segments = getComparablePathSegments(normalized);

  return IMPORTANT_PATH_SEGMENTS.some((segment) => {
    const comparableSegment = segment.toLowerCase();

    return (
      normalized === comparableSegment ||
      normalized.startsWith(`${comparableSegment}/`) ||
      segments.includes(comparableSegment)
    );
  });
}

export function isCriticalProjectFile(relativePath: string): boolean {
  const fileName = getComparableFileName(relativePath);
  const normalized = normalizeComparablePath(relativePath);

  if (
    fileName === 'package.json' ||
    fileName === 'tsconfig.json' ||
    fileName === 'jsconfig.json' ||
    fileName.startsWith('next.config') ||
    fileName.startsWith('vite.config') ||
    fileName === 'middleware.ts' ||
    fileName === 'middleware.js'
  ) {
    return true;
  }

  if (
    normalized === 'app/api/agent/stream/route.ts' ||
    normalized === 'app/api/project/scan/route.ts'
  ) {
    return true;
  }

  return false;
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

  if (isCriticalProjectFile(relativePath)) {
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