export function createRunId(prefix = 'run'): string {
  const time = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${time}-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}-${time}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
