import type { VirtualFile } from '@/lib/types';
import { nowIso } from '@/lib/create-run-id';

export function cloneFiles(files: VirtualFile[]): VirtualFile[] {
  return files.map((file) => ({
    ...file,
    originalContent: file.originalContent ?? file.content,
    dirty: file.dirty ?? false,
  }));
}

export function patchFile(files: VirtualFile[], fileId: string, content: string): VirtualFile[] {
  return files.map((file) => {
    if (file.id !== fileId) {
      return file;
    }

    return {
      ...file,
      content,
      dirty: (file.originalContent ?? file.content) !== content,
      lastTouchedAt: nowIso(),
    };
  });
}

export function createFile(files: VirtualFile[], file: VirtualFile): VirtualFile[] {
  const exists = files.some((item) => item.id === file.id || item.path === file.path);

  if (exists) {
    return files;
  }

  return [
    ...files,
    {
      ...file,
      originalContent: file.originalContent ?? '',
      dirty: true,
      lastTouchedAt: nowIso(),
    },
  ];
}

export function deleteFile(files: VirtualFile[], fileId: string): VirtualFile[] {
  return files.filter((file) => file.id !== fileId);
}

export function renameFile(files: VirtualFile[], fileId: string, nextPath: string): VirtualFile[] {
  return files.map((file) => (file.id === fileId ? { ...file, path: nextPath, dirty: true, lastTouchedAt: nowIso() } : file));
}

export function revertFile(files: VirtualFile[], fileId: string): VirtualFile[] {
  return files.map((file) => {
    if (file.id !== fileId) {
      return file;
    }

    return {
      ...file,
      content: file.originalContent ?? file.content,
      dirty: false,
      lastTouchedAt: nowIso(),
    };
  });
}
