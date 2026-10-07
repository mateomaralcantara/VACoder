import fs from 'node:fs/promises';
import path from 'node:path';

export interface RepairResult {
  repaired: boolean;
  changedFiles: string[];
  message: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shouldRepairLayout(log: string): boolean {
  const lower = log.toLowerCase();

  return (
    lower.includes('app/layout.tsx') &&
    (
      lower.includes('unterminated string constant') ||
      lower.includes('unterminated string literal') ||
      lower.includes('expected') ||
      lower.includes('ts1002') ||
      lower.includes('ts1005') ||
      lower.includes('ts1128') ||
      lower.includes('ts1434')
    )
  );
}

function buildSafeLayoutSource(appName: string): string {
  const safeTitle = appName
    .replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñüÜ\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const title = safeTitle || 'VACoder App';

  return `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: ${JSON.stringify(title)},
  description: 'Aplicación web moderna generada y validada por VACoder.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
`;
}

async function readPackageName(cwd: string): Promise<string> {
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    const raw = await fs.readFile(packageJsonPath, 'utf8');
    const data = JSON.parse(raw) as { name?: string };

    return data.name || path.basename(cwd);
  } catch {
    return path.basename(cwd);
  }
}

export async function repairKnownBuildError(cwd: string, log: string): Promise<RepairResult> {
  if (!shouldRepairLayout(log)) {
    return {
      repaired: false,
      changedFiles: [],
      message: 'No encontré una reparación automática para este error.',
    };
  }

  const layoutPath = path.join(cwd, 'app', 'layout.tsx');

  if (!(await exists(layoutPath))) {
    return {
      repaired: false,
      changedFiles: [],
      message: 'El error apunta a app/layout.tsx, pero ese archivo no existe.',
    };
  }

  const appName = await readPackageName(cwd);
  const safeLayoutSource = buildSafeLayoutSource(appName);

  await fs.writeFile(layoutPath, safeLayoutSource, 'utf8');

  return {
    repaired: true,
    changedFiles: ['app/layout.tsx'],
    message:
      'Reparé app/layout.tsx completamente. Eliminé metadata rota y evité meter el prompt largo dentro de description.',
  };
}