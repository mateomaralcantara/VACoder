import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeProjectPath } from "@/lib/vacoder/core";

export type SupremeFileInfo = {
  path: string;
  size: number;
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".md",
  ".html",
  ".env",
  ".example",
]);

export async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listSupremeProjectFiles(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const results: SupremeFileInfo[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (entry.name.startsWith("_backup")) {
        continue;
      }

      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }

        await walk(full);
        continue;
      }

      const ext = path.extname(entry.name);

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        continue;
      }

      const stat = await fs.stat(full).catch(() => null);

      if (!stat || stat.size > 500000) {
        continue;
      }

      results.push({
        path: path.relative(projectPath, full).replaceAll(path.sep, "/"),
        size: stat.size,
      });
    }
  }

  await walk(projectPath);

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readSupremeFile(projectPathInput: string, relativePath: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const full = path.join(projectPath, relativePath);

  return fs.readFile(full, "utf8");
}

export async function writeSupremeFile(projectPathInput: string, relativePath: string, content: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const full = path.join(projectPath, relativePath);
  const dir = path.dirname(full);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(full, content, "utf8");

  return full;
}

export async function ensureSupremeDir(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const dir = path.join(projectPath, ".vacoder", "supreme");

  await fs.mkdir(dir, { recursive: true });

  return dir;
}
