import type { DiffResult, VirtualFile } from '@/lib/types';

export function createSimpleLineDiff(file: VirtualFile): DiffResult {
  const original = file.originalContent ?? '';
  const current = file.content ?? '';
  const oldLines = original.split('\n');
  const newLines = current.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const output: string[] = [`--- a/${file.path}`, `+++ b/${file.path}`];
  let additions = 0;
  let deletions = 0;

  for (let index = 0; index < max; index += 1) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];

    if (oldLine === newLine) {
      if (typeof newLine === 'string') {
        output.push(` ${newLine}`);
      }
      continue;
    }

    if (typeof oldLine === 'string') {
      output.push(`-${oldLine}`);
      deletions += 1;
    }

    if (typeof newLine === 'string') {
      output.push(`+${newLine}`);
      additions += 1;
    }
  }

  return {
    fileId: file.id,
    path: file.path,
    additions,
    deletions,
    unified: output.join('\n'),
  };
}

export function hasFileChanged(file: VirtualFile): boolean {
  return (file.originalContent ?? file.content) !== file.content;
}
