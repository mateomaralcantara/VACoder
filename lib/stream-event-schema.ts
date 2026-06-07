import type { StreamEvent } from '@/lib/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string' && value[key].trim().length > 0;
}

export function isStreamEvent(value: unknown): value is StreamEvent {
  if (!isRecord(value) || !hasString(value, 'type')) {
    return false;
  }

  switch (value.type) {
    case 'status':
      return hasString(value, 'value');
    case 'plan':
      return hasString(value, 'title') && Array.isArray(value.steps);
    case 'teacher':
      return isRecord(value.message) && hasString(value.message, 'id') && hasString(value.message, 'title') && hasString(value.message, 'body');
    case 'activity':
      return isRecord(value.item) && hasString(value.item, 'id') && hasString(value.item, 'level') && hasString(value.item, 'message');
    case 'patch-file':
      return hasString(value, 'fileId') && typeof value.content === 'string';
    case 'create-file':
      return isRecord(value.file) && hasString(value.file, 'id') && hasString(value.file, 'path') && typeof value.file.content === 'string';
    case 'delete-file':
      return hasString(value, 'fileId');
    case 'rename-file':
      return hasString(value, 'fileId') && hasString(value, 'nextPath');
    case 'select-file':
      return hasString(value, 'fileId');
    case 'terminal':
    case 'test-result':
    case 'build-result':
    case 'diff':
      return isRecord(value.item);
    case 'artifact':
      return isRecord(value.artifact) && hasString(value.artifact, 'id') && hasString(value.artifact, 'title') && hasString(value.artifact, 'body');
    case 'done':
      return hasString(value, 'summary');
    case 'error':
      return hasString(value, 'message');
    default:
      return false;
  }
}

export function parseStreamEvent(line: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isStreamEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
