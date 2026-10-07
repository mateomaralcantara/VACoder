import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const APPS_ROOT = "C:\\Users\\martin\\Desktop\\VSC\\APPS";

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vacoder",
  ".turbo",
  "dist",
  "build",
  "coverage",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".md",
  ".mjs",
  ".cjs",
  ".html",
  ".txt",
]);

export type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
};

export type FileSnapshot = {
  path: string;
  hash: string;
  bytes: number;
  modifiedAt: string;
};

export type ProjectSnapshot = {
  id: string;
  projectPath: string;
  createdAt: string;
  files: FileSnapshot[];
};

export type SnapshotDiff = {
  added: FileSnapshot[];
  changed: FileSnapshot[];
  removed: FileSnapshot[];
};

export type BackupManifest = {
  id: string;
  projectPath: string;
  createdAt: string;
  files: Array<{
    path: string;
    existed: boolean;
  }>;
};

export type ValidationResult = {
  ok: boolean;
  commands: CommandResult[];
};

export function assertSafeProjectPath(projectPath: string) {
  if (!projectPath || typeof projectPath !== "string") {
    throw new Error("projectPath es obligatorio.");
  }

  const resolvedRoot = path.resolve(APPS_ROOT);
  const resolvedProject = path.resolve(projectPath);

  if (!resolvedProject.toLowerCase().startsWith(resolvedRoot.toLowerCase())) {
    throw new Error(
      "Ruta insegura. Solo se permite modificar proyectos dentro de C:\\Users\\martin\\Desktop\\VSC\\APPS",
    );
  }

  return resolvedProject;
}

export function assertSafeRelativePath(relativePath: string) {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("La ruta relativa del archivo es obligatoria.");
  }

  const normalized = relativePath.replaceAll("\\", "/");

  if (
    normalized.startsWith("/") ||
    normalized.includes("../") ||
    normalized.includes("..\\") ||
    path.isAbsolute(normalized)
  ) {
    throw new Error("Ruta relativa insegura: " + relativePath);
  }

  const parts = normalized.split("/").filter(Boolean);

  for (const part of parts) {
    if (SKIP_DIRS.has(part)) {
      throw new Error("Ruta no permitida dentro de carpeta protegida: " + relativePath);
    }
  }

  return normalized;
}

export function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

export async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath: string) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function shouldIncludeFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export async function listProjectFiles(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const files: FileSnapshot[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!shouldIncludeFile(fullPath)) {
        continue;
      }

      const stat = await fs.stat(fullPath);

      if (stat.size > 1024 * 1024 * 2) {
        continue;
      }

      const relativePath = toPosixPath(path.relative(projectPath, fullPath));

      files.push({
        path: relativePath,
        hash: await sha256File(fullPath),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }

  await walk(projectPath);

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function snapshotProject(projectPathInput: string): Promise<ProjectSnapshot> {
  const projectPath = assertSafeProjectPath(projectPathInput);

  return {
    id: crypto.randomUUID(),
    projectPath,
    createdAt: new Date().toISOString(),
    files: await listProjectFiles(projectPath),
  };
}

export async function ensureVacoderDir(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const dir = path.join(projectPath, ".vacoder");

  await fs.mkdir(dir, { recursive: true });

  return dir;
}

export async function saveSnapshot(projectPathInput: string, name = "last") {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const snapshot = await snapshotProject(projectPath);
  const vacoderDir = await ensureVacoderDir(projectPath);
  const snapshotsDir = path.join(vacoderDir, "snapshots");

  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.writeFile(
    path.join(snapshotsDir, name + ".json"),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );

  return snapshot;
}

export async function readSnapshot(projectPathInput: string, name = "last") {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const filePath = path.join(projectPath, ".vacoder", "snapshots", name + ".json");
  const raw = await fs.readFile(filePath, "utf8");

  return JSON.parse(raw) as ProjectSnapshot;
}

export function diffSnapshots(before: ProjectSnapshot, after: ProjectSnapshot): SnapshotDiff {
  const beforeMap = new Map(before.files.map((file) => [file.path, file]));
  const afterMap = new Map(after.files.map((file) => [file.path, file]));

  const added: FileSnapshot[] = [];
  const changed: FileSnapshot[] = [];
  const removed: FileSnapshot[] = [];

  for (const file of after.files) {
    const previous = beforeMap.get(file.path);

    if (!previous) {
      added.push(file);
    } else if (previous.hash !== file.hash) {
      changed.push(file);
    }
  }

  for (const file of before.files) {
    if (!afterMap.has(file.path)) {
      removed.push(file);
    }
  }

  return {
    added,
    changed,
    removed,
  };
}

export async function createBackup(projectPathInput: string, relativePaths: string[]) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID();
  const backupRoot = path.join(projectPath, ".vacoder", "backups", id);
  const filesRoot = path.join(backupRoot, "files");

  await fs.mkdir(filesRoot, { recursive: true });

  const uniquePaths = Array.from(new Set(relativePaths.map(assertSafeRelativePath)));

  const manifest: BackupManifest = {
    id,
    projectPath,
    createdAt: new Date().toISOString(),
    files: [],
  };

  for (const relativePath of uniquePaths) {
    const target = path.join(projectPath, relativePath);
    const existedBefore = await exists(target);

    manifest.files.push({
      path: relativePath,
      existed: existedBefore,
    });

    if (existedBefore) {
      const backupFile = path.join(filesRoot, relativePath);
      await fs.mkdir(path.dirname(backupFile), { recursive: true });
      await fs.copyFile(target, backupFile);
    }
  }

  await fs.writeFile(
    path.join(backupRoot, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return manifest;
}

export async function rollbackBackup(projectPathInput: string, backupId: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);

  if (!backupId || backupId.includes("..") || backupId.includes("/") || backupId.includes("\\")) {
    throw new Error("backupId inseguro.");
  }

  const backupRoot = path.join(projectPath, ".vacoder", "backups", backupId);
  const manifestPath = path.join(backupRoot, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as BackupManifest;

  for (const file of manifest.files) {
    const relativePath = assertSafeRelativePath(file.path);
    const target = path.join(projectPath, relativePath);
    const backupFile = path.join(backupRoot, "files", relativePath);

    if (file.existed) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(backupFile, target);
    } else {
      await fs.rm(target, { force: true });
    }
  }

  return manifest;
}

export async function writeProjectFile(
  projectPathInput: string,
  relativePathInput: string,
  content: string,
) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const relativePath = assertSafeRelativePath(relativePathInput);
  const target = path.join(projectPath, relativePath);

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");

  return {
    path: relativePath,
    bytes: Buffer.byteLength(content, "utf8"),
  };
}

export async function deleteProjectFile(projectPathInput: string, relativePathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const relativePath = assertSafeRelativePath(relativePathInput);
  const target = path.join(projectPath, relativePath);

  await fs.rm(target, { force: true });

  return {
    path: relativePath,
    deleted: true,
  };
}

export async function readProjectFile(projectPathInput: string, relativePathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const relativePath = assertSafeRelativePath(relativePathInput);
  const target = path.join(projectPath, relativePath);

  return fs.readFile(target, "utf8");
}

export function runCommand(
  cwd: string,
  command: string,
  timeoutMs = 1000 * 60 * 3,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        command,
      ],
      {
        cwd,
        windowsHide: true,
        shell: false,
        stdio: "pipe",
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "development",
          SystemRoot: process.env.SystemRoot || "C:\\Windows",
          WINDIR: process.env.WINDIR || "C:\\Windows",
          ComSpec: process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
        },
      },
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    let finished = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      if (!finished) {
        timedOut = true;
        child.kill();
      }
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout.push(chunk.toString("utf8"));
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr.push(chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      finished = true;
      clearTimeout(timer);

      resolve({
        command,
        exitCode: 1,
        stdout: stdout.join(""),
        stderr: stderr.join("") + "\n" + error.message,
        timedOut,
      });
    });

    child.on("close", (code) => {
      finished = true;
      clearTimeout(timer);

      resolve({
        command,
        exitCode: timedOut ? 124 : code ?? 1,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
        timedOut,
      });
    });
  });
}

async function readPackageJson(projectPath: string) {
  const packagePath = path.join(projectPath, "package.json");

  if (!(await exists(packagePath))) {
    return null;
  }

  return JSON.parse(await fs.readFile(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };
}

export async function validateProject(projectPathInput: string): Promise<ValidationResult> {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const packageJson = await readPackageJson(projectPath);
  const commands: CommandResult[] = [];

  if (!packageJson) {
    return {
      ok: false,
      commands: [
        {
          command: "read package.json",
          exitCode: 1,
          stdout: "",
          stderr: "No existe package.json en el proyecto.",
        },
      ],
    };
  }

  if (packageJson.scripts?.typecheck) {
    commands.push(await runCommand(projectPath, "npm run typecheck"));
  } else {
    commands.push({
      command: "npm run typecheck",
      exitCode: 0,
      stdout: "Omitido: el proyecto no tiene script typecheck.",
      stderr: "",
    });
  }

  if (commands.some((command) => command.exitCode !== 0)) {
    return {
      ok: false,
      commands,
    };
  }

  if (packageJson.scripts?.build) {
    commands.push(await runCommand(projectPath, "npm run build"));
  } else {
    commands.push({
      command: "npm run build",
      exitCode: 0,
      stdout: "Omitido: el proyecto no tiene script build.",
      stderr: "",
    });
  }

  return {
    ok: commands.every((command) => command.exitCode === 0),
    commands,
  };
}
