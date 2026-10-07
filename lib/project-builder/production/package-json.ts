import fs from 'node:fs/promises';
import path from 'node:path';

export interface ProjectPackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function readProjectPackageJson(cwd: string): Promise<ProjectPackageJson> {
  const packageJsonPath = path.join(cwd, 'package.json');
  const raw = await fs.readFile(packageJsonPath, 'utf8');
  return JSON.parse(raw) as ProjectPackageJson;
}

export async function hasPackageScript(cwd: string, scriptName: string): Promise<boolean> {
  try {
    const pkg = await readProjectPackageJson(cwd);
    return Boolean(pkg.scripts?.[scriptName]);
  } catch {
    return false;
  }
}

export async function getProjectDisplayName(cwd: string): Promise<string> {
  try {
    const pkg = await readProjectPackageJson(cwd);
    return pkg.name || path.basename(cwd);
  } catch {
    return path.basename(cwd);
  }
}
