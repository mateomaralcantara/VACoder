export function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

export function compactLog(value: string, maxLength = 12_000): string {
  const clean = stripAnsi(value).replace(/\r/g, '');

  if (clean.length <= maxLength) {
    return clean;
  }

  return clean.slice(clean.length - maxLength);
}

export function extractLikelyErrorFiles(logs: string): string[] {
  const clean = stripAnsi(logs);
  const files = new Set<string>();

  const patterns = [
    /\.\/(app|src|components|lib|pages|server|api)\/[\w./()\-[\] ]+\.(tsx|ts|jsx|js|css|scss)/g,
    /([A-Z]:\\[^\n:]+\.(tsx|ts|jsx|js|css|scss))/g,
    /((app|src|components|lib|pages|server|api)\/[\w./()\-[\] ]+\.(tsx|ts|jsx|js|css|scss))/g,
  ];

  for (const pattern of patterns) {
    for (const match of clean.matchAll(pattern)) {
      const file = match[0].replace(/^\.\//, '').replaceAll('\\', '/').trim();
      files.add(file);
    }
  }

  return [...files];
}

export function hasUnterminatedStringError(logs: string): boolean {
  const clean = stripAnsi(logs).toLowerCase();
  return clean.includes('unterminated string constant') || clean.includes('expected') && clean.includes('got') && clean.includes('parsing ecmascript');
}

export function hasModuleNotFoundError(logs: string): boolean {
  const clean = stripAnsi(logs).toLowerCase();
  return clean.includes('module not found') || clean.includes("can't resolve");
}

export function hasNextBuildSuccess(logs: string): boolean {
  const clean = stripAnsi(logs).toLowerCase();
  return clean.includes('compiled successfully') || clean.includes('generating static pages') || clean.includes('finalizing page optimization');
}
