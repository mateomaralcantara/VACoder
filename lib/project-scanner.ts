import { promises as fs } from 'fs';
import path from 'path';
import {
  classifyFileImportance,
  getFileExtension,
  getFileName,
  isInsideIgnoredDirectory,
  normalizeProjectPath,
  type FileFilterOptions,
} from '@/lib/file-filters';
import {
  createEmptyProjectManifest,
  DEFAULT_SCAN_OPTIONS,
  type DetectedStack,
  type ProjectManifest,
  type ProjectManifestDirectory,
  type ProjectManifestFile,
  type ProjectScanOptions,
} from '@/lib/project-manifest';

interface ScanContext {
  root: string;
  options: Required<ProjectScanOptions>;
  manifest: ProjectManifest;
  directoryMap: Map<string, ProjectManifestDirectory>;
  filesScanned: number;
}

function toRelativeProjectPath(root: string, absolutePath: string): string {
  return normalizeProjectPath(path.relative(root, absolutePath));
}

function mergeOptions(options: ProjectScanOptions = {}): Required<ProjectScanOptions> {
  return {
    ...DEFAULT_SCAN_OPTIONS,
    ...options,
    extraIgnoredDirectories: options.extraIgnoredDirectories ?? DEFAULT_SCAN_OPTIONS.extraIgnoredDirectories,
    extraIgnoredFiles: options.extraIgnoredFiles ?? DEFAULT_SCAN_OPTIONS.extraIgnoredFiles,
  };
}

function getDirectoryRecord(context: ScanContext, relativeDirectory: string): ProjectManifestDirectory {
  const key = relativeDirectory || '.';
  const existing = context.directoryMap.get(key);

  if (existing) {
    return existing;
  }

  const record: ProjectManifestDirectory = {
    path: key,
    fileCount: 0,
    includedFileCount: 0,
  };

  context.directoryMap.set(key, record);
  return record;
}

async function safeReadTextFile(absolutePath: string, maxChars: number): Promise<string | undefined> {
  try {
    const content = await fs.readFile(absolutePath, 'utf8');
    return content.slice(0, maxChars);
  } catch {
    return undefined;
  }
}

function reasonForFile(relativePath: string, importance: ProjectManifestFile['importance']): string {
  const fileName = getFileName(relativePath);

  if (fileName === 'package.json') {
    return 'Define dependencias, scripts y stack principal.';
  }

  if (fileName === 'tsconfig.json' || fileName === 'jsconfig.json') {
    return 'Define configuración de TypeScript, alias e interoperabilidad.';
  }

  if (fileName.startsWith('next.config')) {
    return 'Configura Next.js, build, imágenes, rutas y comportamiento del framework.';
  }

  if (fileName.startsWith('vite.config')) {
    return 'Configura Vite, plugins y build.';
  }

  if (fileName === 'middleware.ts' || fileName === 'middleware.js') {
    return 'Puede afectar autenticación, rutas y seguridad global.';
  }

  if (relativePath.startsWith('app/api/') || relativePath.includes('/api/')) {
    return 'Archivo de API/backend con impacto en datos, seguridad y flujo de servidor.';
  }

  if (relativePath.startsWith('app/') || relativePath.startsWith('pages/')) {
    return 'Ruta principal de aplicación y renderizado.';
  }

  if (relativePath.startsWith('components/')) {
    return 'Componente de UI reutilizable.';
  }

  if (relativePath.startsWith('lib/')) {
    return 'Lógica compartida o de infraestructura.';
  }

  if (importance === 'critical') {
    return 'Archivo crítico para configuración o arranque del proyecto.';
  }

  if (importance === 'high') {
    return 'Archivo relevante para arquitectura y funcionamiento.';
  }

  return 'Archivo fuente incluido para contexto general.';
}

function detectStackFromPackageJson(packageJsonText?: string): DetectedStack[] {
  if (!packageJsonText) {
    return [];
  }

  try {
    const parsed = JSON.parse(packageJsonText) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
    };

    const stacks: DetectedStack[] = [];

    const add = (id: DetectedStack['id'], label: string, packages: string[]) => {
      const evidence = packages.filter((pkg) => deps[pkg]);

      if (evidence.length > 0) {
        stacks.push({
          id,
          label,
          confidence: Math.min(1, 0.55 + evidence.length * 0.15),
          evidence,
        });
      }
    };

    add('next', 'Next.js', ['next']);
    add('react', 'React', ['react', 'react-dom']);
    add('typescript', 'TypeScript', ['typescript', '@types/node', '@types/react']);
    add('vite', 'Vite', ['vite', '@vitejs/plugin-react']);
    add('tailwind', 'Tailwind CSS', ['tailwindcss', '@tailwindcss/postcss']);
    add('supabase', 'Supabase', ['@supabase/supabase-js', '@supabase/ssr']);
    add('prisma', 'Prisma', ['prisma', '@prisma/client']);
    add('express', 'Express', ['express']);

    if (Object.keys(deps).length > 0) {
      stacks.push({
        id: 'node',
        label: 'Node.js',
        confidence: 0.7,
        evidence: ['package.json'],
      });
    }

    return stacks;
  } catch {
    return [];
  }
}

async function scanDirectory(context: ScanContext, absoluteDirectory: string, depth: number): Promise<void> {
  if (depth > context.options.maxDepth) {
    context.manifest.notes.push(`Profundidad máxima alcanzada en ${toRelativeProjectPath(context.root, absoluteDirectory)}.`);
    return;
  }

  let entries: Awaited<ReturnType<typeof fs.readdir>>;

  try {
    entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  } catch {
    context.manifest.notes.push(`No se pudo leer el directorio ${toRelativeProjectPath(context.root, absoluteDirectory)}.`);
    return;
  }

  const relativeDirectory = toRelativeProjectPath(context.root, absoluteDirectory);
  const directoryRecord = getDirectoryRecord(context, relativeDirectory);
  context.manifest.stats.totalDirectories += 1;

  for (const entry of entries) {
    if (context.filesScanned >= context.options.maxFiles) {
      context.manifest.notes.push(`Se alcanzó el límite máximo de archivos: ${context.options.maxFiles}.`);
      return;
    }

    const absoluteEntry = path.join(absoluteDirectory, entry.name);
    const relativeEntry = toRelativeProjectPath(context.root, absoluteEntry);

    if (entry.isDirectory()) {
      const filterOptions: FileFilterOptions = {
        extraIgnoredDirectories: context.options.extraIgnoredDirectories,
        extraIgnoredFiles: context.options.extraIgnoredFiles,
        includeLockFiles: context.options.includeLockFiles,
        maxFileSizeBytes: context.options.maxFileSizeBytes,
      };

      if (isInsideIgnoredDirectory(relativeEntry, filterOptions)) {
        continue;
      }

      await scanDirectory(context, absoluteEntry, depth + 1);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    context.filesScanned += 1;
    context.manifest.stats.totalFiles += 1;
    directoryRecord.fileCount += 1;

    let stat: Awaited<ReturnType<typeof fs.stat>>;

    try {
      stat = await fs.stat(absoluteEntry);
    } catch {
      context.manifest.stats.ignoredFiles += 1;
      continue;
    }

    context.manifest.stats.totalBytes += stat.size;

    const filterOptions: FileFilterOptions = {
      extraIgnoredDirectories: context.options.extraIgnoredDirectories,
      extraIgnoredFiles: context.options.extraIgnoredFiles,
      includeLockFiles: context.options.includeLockFiles,
      maxFileSizeBytes: context.options.maxFileSizeBytes,
    };

    const importance = classifyFileImportance(relativeEntry, stat.size, filterOptions);

    if (importance === 'ignored') {
      context.manifest.stats.ignoredFiles += 1;

      if (context.manifest.ignoredSamples.length < 60) {
        context.manifest.ignoredSamples.push(relativeEntry);
      }

      continue;
    }

    context.manifest.stats.includedFiles += 1;
    context.manifest.stats.includedBytes += stat.size;
    directoryRecord.includedFileCount += 1;

    const record: ProjectManifestFile = {
      path: relativeEntry,
      sizeBytes: stat.size,
      extension: getFileExtension(relativeEntry),
      importance,
      reason: reasonForFile(relativeEntry, importance),
    };

    if (context.options.includeContentPreview && context.manifest.importantFiles.length < context.options.maxImportantFiles) {
      record.contentPreview = await safeReadTextFile(absoluteEntry, context.options.contentPreviewMaxChars);
    }

    context.manifest.importantFiles.push(record);
  }
}

function sortManifest(manifest: ProjectManifest): ProjectManifest {
  const weight = {
    critical: 0,
    high: 1,
    normal: 2,
  };

  manifest.importantFiles = manifest.importantFiles
    .sort((a, b) => {
      const byImportance = weight[a.importance] - weight[b.importance];

      if (byImportance !== 0) {
        return byImportance;
      }

      return a.path.localeCompare(b.path);
    })
    .slice(0, 240);

  manifest.directories = manifest.directories
    .sort((a, b) => b.includedFileCount - a.includedFileCount)
    .slice(0, 120);

  return manifest;
}

export async function scanProject(projectRoot: string, options: ProjectScanOptions = {}): Promise<ProjectManifest> {
  const root = path.resolve(projectRoot);
  const projectName = path.basename(root);
  const mergedOptions = mergeOptions(options);
  const manifest = createEmptyProjectManifest(projectName, root);
  const directoryMap = new Map<string, ProjectManifestDirectory>();

  const context: ScanContext = {
    root,
    options: mergedOptions,
    manifest,
    directoryMap,
    filesScanned: 0,
  };

  await scanDirectory(context, root, 0);

  manifest.directories = Array.from(directoryMap.values());

  const packageJsonFile = manifest.importantFiles.find((file) => file.path === 'package.json');
  manifest.detectedStacks = detectStackFromPackageJson(packageJsonFile?.contentPreview);

  if (manifest.detectedStacks.length === 0) {
    manifest.detectedStacks = [
      {
        id: 'unknown',
        label: 'Stack no detectado',
        confidence: 0.1,
        evidence: [],
      },
    ];
  }

  if (manifest.stats.totalFiles > 1000) {
    manifest.notes.push('Proyecto grande detectado. Se recomienda evaluación por manifiesto y lotes, no enviar todos los archivos al modelo.');
  }

  return sortManifest(manifest);
}

export async function writeProjectManifest(
  projectRoot: string,
  outputPath = 'project-manifest.json',
  options: ProjectScanOptions = {},
): Promise<ProjectManifest> {
  const manifest = await scanProject(projectRoot, options);
  const absoluteOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(projectRoot, outputPath);

  await fs.writeFile(absoluteOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return manifest;
}
