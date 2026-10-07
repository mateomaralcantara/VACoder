import fs from 'node:fs/promises';
import path from 'node:path';
import type { RepairContext, RepairResult } from '@/lib/project-builder/production/types';
import { extractLikelyErrorFiles, hasUnterminatedStringError } from '@/lib/project-builder/production/errors';
import { getProjectDisplayName } from '@/lib/project-builder/production/package-json';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeMetadataDescription(projectName: string): string {
  const readableName = titleCase(projectName);
  return `Aplicación profesional ${readableName} creada con VACoder.`;
}

async function repairNextLayoutMetadata(cwd: string): Promise<RepairResult> {
  const layoutPath = path.join(cwd, 'app', 'layout.tsx');

  if (!(await fileExists(layoutPath))) {
    return {
      changed: false,
      summary: 'No existe app/layout.tsx para reparar metadata.',
      files: [],
    };
  }

  const original = await fs.readFile(layoutPath, 'utf8');
  const projectName = await getProjectDisplayName(cwd);
  const title = titleCase(projectName);
  const description = safeMetadataDescription(projectName);

  const metadataBlock = `export const metadata: Metadata = {\n  title: ${JSON.stringify(title)},\n  description: ${JSON.stringify(description)},\n};`;

  let next = original;
  const metadataStart = next.indexOf('export const metadata');

  if (metadataStart >= 0) {
    const defaultExportStart = next.indexOf('export default', metadataStart);

    if (defaultExportStart > metadataStart) {
      const before = next.slice(0, metadataStart).trimEnd();
      const after = next.slice(defaultExportStart).trimStart();
      next = `${before}\n\n${metadataBlock}\n\n${after}\n`;
    } else {
      next = next.replace(/export const metadata[\s\S]*?};/, metadataBlock);
    }
  } else {
    const importMetadata = "import type { Metadata } from 'next';";

    if (!next.includes(importMetadata)) {
      next = `${importMetadata}\n${next}`;
    }

    next = next.replace(/(import[^;]+;\s*)+/m, (imports) => `${imports}\n${metadataBlock}\n\n`);
  }

  if (!next.includes("import './globals.css'")) {
    next = next.replace(/(import[^;]+;\s*)+/m, (imports) => `${imports}import './globals.css';\n`);
  }

  if (next === original) {
    return {
      changed: false,
      summary: 'app/layout.tsx no necesitó cambios de metadata.',
      files: [],
    };
  }

  await fs.writeFile(layoutPath, next, 'utf8');

  return {
    changed: true,
    summary: 'Se reparó metadata en app/layout.tsx usando strings seguros con JSON.stringify.',
    files: ['app/layout.tsx'],
  };
}

async function writeRepairReport(context: RepairContext): Promise<RepairResult> {
  const reportPath = path.join(context.cwd, 'VACODER_REPAIR_NEEDED.md');
  const files = extractLikelyErrorFiles(context.logs);

  const body = [
    '# VACoder Repair Needed',
    '',
    `Intento: ${context.attempt}`,
    '',
    'VACoder no encontró una reparación determinística segura para este error.',
    '',
    '## Archivos detectados',
    '',
    files.length > 0 ? files.map((file) => `- ${file}`).join('\n') : '- No detectado',
    '',
    '## Logs compactados',
    '',
    '```txt',
    context.logs.slice(-12_000),
    '```',
    '',
  ].join('\n');

  await fs.writeFile(reportPath, body, 'utf8');

  return {
    changed: true,
    summary: 'Se creó VACODER_REPAIR_NEEDED.md con la evidencia del error para reparación manual o IA.',
    files: ['VACODER_REPAIR_NEEDED.md'],
  };
}

export async function repairProjectFromLogs(context: RepairContext): Promise<RepairResult> {
  if (hasUnterminatedStringError(context.logs) && context.logs.includes('app/layout.tsx')) {
    return repairNextLayoutMetadata(context.cwd);
  }

  return writeRepairReport(context);
}
