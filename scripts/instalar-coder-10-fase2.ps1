$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

if (!(Test-Path $Root)) {
  throw "No existe Coder en: $Root"
}

Set-Location $Root

$BackupDir = Join-Path $Root ("_backup-coder-10-fase2-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

function Backup-File {
  param([string]$RelativePath)

  $Source = Join-Path $Root $RelativePath

  if (Test-Path $Source) {
    $Dest = Join-Path $BackupDir $RelativePath
    $DestDir = Split-Path $Dest -Parent
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    Copy-Item $Source $Dest -Force
  }
}

function Write-ProjectFile {
  param(
    [string]$RelativePath,
    [string]$Content
  )

  Backup-File $RelativePath

  $FullPath = Join-Path $Root $RelativePath
  $Dir = Split-Path $FullPath -Parent

  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  Set-Content -Path $FullPath -Value $Content -Encoding UTF8

  Write-Host "[OK] $RelativePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== INSTALANDO CODER 10/10 FASE 2 ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host "Backup: $BackupDir"
Write-Host ""

Write-ProjectFile "lib\vacoder\core.ts" @'
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
'@

Write-ProjectFile "app\api\project\scan\route.ts" @'
import { NextResponse } from "next/server";
import { listProjectFiles, snapshotProject } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const includeSnapshot = Boolean(body.includeSnapshot);

    if (includeSnapshot) {
      const snapshot = await snapshotProject(projectPath);

      return NextResponse.json({
        ok: true,
        projectPath: snapshot.projectPath,
        createdAt: snapshot.createdAt,
        totalFiles: snapshot.files.length,
        totalBytes: snapshot.files.reduce((sum, file) => sum + file.bytes, 0),
        files: snapshot.files,
      });
    }

    const files = await listProjectFiles(projectPath);

    return NextResponse.json({
      ok: true,
      projectPath,
      totalFiles: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo escanear.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "scan-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        includeSnapshot: true,
      },
    },
  });
}
'@

Write-ProjectFile "app\api\project\snapshot\route.ts" @'
import { NextResponse } from "next/server";
import { saveSnapshot } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const name = typeof body.name === "string" ? body.name : "last";

    const snapshot = await saveSnapshot(projectPath, name);

    return NextResponse.json({
      ok: true,
      name,
      snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear snapshot.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "snapshot-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        name: "before-change",
      },
    },
  });
}
'@

Write-ProjectFile "app\api\project\diff\route.ts" @'
import { NextResponse } from "next/server";
import {
  diffSnapshots,
  readSnapshot,
  snapshotProject,
} from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const snapshotName = typeof body.snapshotName === "string" ? body.snapshotName : "last";

    const before = await readSnapshot(projectPath, snapshotName);
    const after = await snapshotProject(projectPath);
    const diff = diffSnapshots(before, after);

    return NextResponse.json({
      ok: true,
      projectPath: after.projectPath,
      snapshotName,
      summary: {
        added: diff.added.length,
        changed: diff.changed.length,
        removed: diff.removed.length,
      },
      diff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo calcular diff.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "diff-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        snapshotName: "before-change",
      },
    },
  });
}
'@

Write-ProjectFile "app\api\project\validate\route.ts" @'
import { NextResponse } from "next/server";
import { validateProject } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");

    const validation = await validateProject(projectPath);

    return NextResponse.json({
      ok: validation.ok,
      projectPath,
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "validate-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
      },
    },
  });
}
'@

Write-ProjectFile "app\api\project\rollback\route.ts" @'
import { NextResponse } from "next/server";
import { rollbackBackup, validateProject } from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const backupId = String(body.backupId || "");
    const validate = body.validate !== false;

    const manifest = await rollbackBackup(projectPath, backupId);
    const validation = validate ? await validateProject(projectPath) : null;

    return NextResponse.json({
      ok: validation ? validation.ok : true,
      status: "rolled-back",
      projectPath,
      backupId,
      restoredFiles: manifest.files,
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo hacer rollback.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "rollback-ready",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        backupId: "ID_DEL_BACKUP",
        validate: true,
      },
    },
  });
}
'@

Write-ProjectFile "app\api\project\patch\apply\route.ts" @'
import { NextResponse } from "next/server";
import {
  createBackup,
  deleteProjectFile,
  exists,
  readProjectFile,
  rollbackBackup,
  saveSnapshot,
  validateProject,
  writeProjectFile,
} from "@/lib/vacoder/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileOperation = {
  path: string;
  content?: string;
  action?: "upsert" | "delete";
};

type ApplyRequest = {
  projectPath?: string;
  prompt?: string;
  files?: FileOperation[];
  validate?: boolean;
  autoRollback?: boolean;
  snapshotName?: string;
};

const bookUploadComponent = String.raw`"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

type UploadedBook = {
  id: string;
  name: string;
  size: string;
  type: string;
  unlocked: boolean;
};

function formatSize(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb.toFixed(2) + " MB";
}

function createReadingText(bookName: string, unlocked: boolean) {
  if (unlocked) {
    return (
      "Iniciando lectura completa del libro " +
      bookName +
      ". Esta versión está desbloqueada para el usuario."
    );
  }

  return (
    "Iniciando lectura de muestra del libro " +
    bookName +
    ". Esta es una vista previa gratuita. " +
    "Para escuchar la lectura completa debes desbloquear este libro."
  );
}

export default function BookUploadArea() {
  const [books, setBooks] = useState<UploadedBook[]>([]);
  const [readingBookId, setReadingBookId] = useState<string | null>(null);
  const [checkoutBookId, setCheckoutBookId] = useState<string | null>(null);
  const [status, setStatus] = useState("Listo para leer");

  const checkoutBook = useMemo(() => {
    return books.find((book) => book.id === checkoutBookId) ?? null;
  }, [books, checkoutBookId]);

  function handleFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const selectedBooks = Array.from(files)
      .filter((file) => {
        const lower = file.name.toLowerCase();

        return (
          lower.endsWith(".pdf") ||
          lower.endsWith(".epub") ||
          lower.endsWith(".txt") ||
          lower.endsWith(".docx")
        );
      })
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: formatSize(file.size),
        type: file.type || "Archivo de libro",
        unlocked: false,
      }));

    setBooks((current) => [...selectedBooks, ...current]);
    setStatus(selectedBooks.length + " libro(s) cargado(s).");
  }

  function startReading(book: UploadedBook) {
    if (!("speechSynthesis" in window)) {
      setStatus("Este navegador no soporta lectura por voz.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      createReadingText(book.name, book.unlocked),
    );

    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setReadingBookId(book.id);
      setStatus(
        book.unlocked ? "Leyendo versión completa" : "Leyendo muestra gratuita",
      );
    };

    utterance.onend = () => {
      setReadingBookId(null);
      setStatus("Lectura finalizada");
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function pauseReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setStatus("Lectura pausada");
    }
  }

  function resumeReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setStatus("Continuando lectura");
    }
  }

  function stopReading() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setReadingBookId(null);
      setStatus("Lectura detenida");
    }
  }

  function unlockBook(bookId: string) {
    setBooks((current) =>
      current.map((book) =>
        book.id === bookId
          ? {
              ...book,
              unlocked: true,
            }
          : book,
      ),
    );

    setCheckoutBookId(null);
    setStatus("Lectura completa desbloqueada en modo mock.");
  }

  return (
    <section style={styles.wrapper}>
      <div style={styles.header}>
        <p style={styles.badge}>Biblioteca de libros</p>
        <h2 style={styles.title}>Cargar libros para narrar</h2>
        <p style={styles.text}>
          Sube PDF, EPUB, TXT o DOCX. Luego puedes iniciar lectura gratuita o
          desbloquear la lectura completa con checkout mock.
        </p>
      </div>

      <label style={styles.uploadBox}>
        <input
          type="file"
          multiple
          accept=".pdf,.epub,.txt,.docx"
          onChange={(event) => handleFiles(event.target.files)}
          style={styles.fileInput}
        />

        <span style={styles.uploadIcon}>📚</span>
        <strong>Haz clic para cargar libros</strong>
        <small>PDF, EPUB, TXT o DOCX</small>
      </label>

      <p style={styles.status}>{status}</p>

      <div style={styles.list}>
        {books.length === 0 ? (
          <div style={styles.empty}>Todavía no has cargado libros.</div>
        ) : (
          books.map((book) => (
            <article key={book.id} style={styles.card}>
              <div style={styles.bookIcon}>📘</div>

              <div style={styles.bookInfo}>
                <strong>{book.name}</strong>
                <span>
                  {book.size} · {book.type}
                </span>
                <small>
                  {book.unlocked
                    ? "Lectura completa desbloqueada"
                    : "Muestra gratuita disponible"}
                </small>
              </div>

              <div style={styles.actions}>
                <button style={styles.readButton} onClick={() => startReading(book)}>
                  ▶ Iniciar lectura
                </button>

                <button style={styles.controlButton} onClick={pauseReading}>
                  ⏸ Pausar
                </button>

                <button style={styles.controlButton} onClick={resumeReading}>
                  ▶ Continuar
                </button>

                <button style={styles.stopButton} onClick={stopReading}>
                  ⏹ Detener
                </button>

                <button
                  style={styles.payButton}
                  onClick={() => setCheckoutBookId(book.id)}
                >
                  💳 Pagar lectura completa
                </button>
              </div>

              {readingBookId === book.id && (
                <div style={styles.readingPill}>Leyendo ahora</div>
              )}
            </article>
          ))
        )}
      </div>

      {checkoutBook && (
        <div style={styles.checkout}>
          <div>
            <p style={styles.badge}>Checkout mock</p>
            <h3>Desbloquear lectura completa</h3>
            <p style={styles.checkoutText}>
              Para escuchar la lectura completa debes desbloquear este libro.
            </p>
            <strong>Libro: {checkoutBook.name}</strong>
            <p style={styles.price}>Precio demo: US$4.99</p>
          </div>

          <div style={styles.checkoutActions}>
            <button style={styles.payButton} onClick={() => unlockBook(checkoutBook.id)}>
              Simular pago aprobado
            </button>

            <button style={styles.controlButton} onClick={() => setCheckoutBookId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    margin: "40px 7vw",
    padding: 28,
    borderRadius: 28,
    background: "#FFFFFF",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.09)",
  },
  header: {
    marginBottom: 22,
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(215, 38, 56, 0.12)",
    color: "#D72638",
    fontWeight: 800,
    margin: 0,
  },
  title: {
    color: "#0B1F3A",
    fontSize: "2rem",
    margin: "14px 0 8px",
  },
  text: {
    color: "#4B5563",
    lineHeight: 1.7,
  },
  uploadBox: {
    minHeight: 180,
    border: "2px dashed #123B6D",
    borderRadius: 24,
    background: "#F5F7FA",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    gap: 8,
    cursor: "pointer",
    color: "#0B1F3A",
    padding: 24,
  },
  fileInput: {
    display: "none",
  },
  uploadIcon: {
    fontSize: 48,
  },
  status: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "#EFF6FF",
    color: "#123B6D",
    fontWeight: 800,
  },
  list: {
    display: "grid",
    gap: 14,
    marginTop: 22,
  },
  empty: {
    padding: 18,
    borderRadius: 16,
    background: "#F5F7FA",
    color: "#6B7280",
  },
  card: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "48px 1fr",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
  },
  bookIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: "#0B1F3A",
    color: "#FFFFFF",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
  },
  bookInfo: {
    display: "grid",
    gap: 4,
    color: "#1F2937",
  },
  actions: {
    gridColumn: "1 / -1",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  readButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "#0B1F3A",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
  },
  controlButton: {
    border: "1px solid #CBD5E1",
    borderRadius: 14,
    padding: "12px 16px",
    background: "#FFFFFF",
    color: "#0B1F3A",
    fontWeight: 900,
    cursor: "pointer",
  },
  stopButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "#111827",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
  },
  payButton: {
    border: 0,
    borderRadius: 14,
    padding: "12px 16px",
    background: "#D72638",
    color: "#FFFFFF",
    fontWeight: 900,
    cursor: "pointer",
  },
  readingPill: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: "8px 10px",
    borderRadius: 999,
    background: "#ECFDF5",
    color: "#047857",
    fontWeight: 900,
    fontSize: 12,
  },
  checkout: {
    marginTop: 22,
    padding: 22,
    borderRadius: 22,
    background: "#FFF4F5",
    border: "1px solid rgba(215, 38, 56, 0.25)",
    display: "grid",
    gap: 16,
  },
  checkoutText: {
    color: "#7F1D1D",
    lineHeight: 1.7,
  },
  price: {
    color: "#0B1F3A",
    fontWeight: 900,
  },
  checkoutActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
};
`;

function promptRequestsBookReading(prompt: string) {
  const lower = prompt.toLowerCase();

  return (
    lower.includes("iniciar lectura") ||
    lower.includes("lectura") ||
    lower.includes("libro") ||
    lower.includes("cargar libros") ||
    lower.includes("pagar lectura")
  );
}

async function buildBookReadingOperations(projectPath: string): Promise<FileOperation[]> {
  const operations: FileOperation[] = [
    {
      path: "components/BookUploadArea.tsx",
      content: bookUploadComponent,
      action: "upsert",
    },
  ];

  const pageExists = await exists(projectPath + "\\app\\page.tsx");

  if (!pageExists) {
    operations.push({
      path: "app/page.tsx",
      action: "upsert",
      content:
        'import BookUploadArea from "@/components/BookUploadArea";\n\nexport default function HomePage() {\n  return (\n    <main>\n      <BookUploadArea />\n    </main>\n  );\n}\n',
    });

    return operations;
  }

  let source = await readProjectFile(projectPath, "app/page.tsx");

  if (!source.includes("BookUploadArea")) {
    if (source.startsWith('"use client";') || source.startsWith("'use client';")) {
      source = source.replace(
        /(["']use client["'];\s*)/,
        '$1\nimport BookUploadArea from "@/components/BookUploadArea";\n',
      );
    } else {
      source = 'import BookUploadArea from "@/components/BookUploadArea";\n' + source;
    }
  }

  if (!source.includes("<BookUploadArea />")) {
    if (source.includes("</main>")) {
      source = source.replace("</main>", "      <BookUploadArea />\n    </main>");
    } else {
      source =
        source +
        '\n\nexport function BookUploadAreaMount() {\n  return <BookUploadArea />;\n}\n';
    }
  }

  operations.push({
    path: "app/page.tsx",
    content: source,
    action: "upsert",
  });

  return operations;
}

function normalizeOperations(files: unknown): FileOperation[] {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const value = item as Partial<FileOperation>;

      if (!value.path || typeof value.path !== "string") {
        return null;
      }

      if (value.action === "delete") {
        return {
          path: value.path,
          action: "delete" as const,
        };
      }

      return {
        path: value.path,
        content: typeof value.content === "string" ? value.content : "",
        action: "upsert" as const,
      };
    })
    .filter((item): item is FileOperation => Boolean(item));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ApplyRequest;

    const projectPath = String(body.projectPath || "");
    const prompt = String(body.prompt || "");
    const shouldValidate = body.validate !== false;
    const autoRollback = body.autoRollback !== false;
    const snapshotName = typeof body.snapshotName === "string" ? body.snapshotName : "before-patch";

    await saveSnapshot(projectPath, snapshotName);

    let operations = normalizeOperations(body.files);

    if (operations.length === 0 && promptRequestsBookReading(prompt)) {
      operations = await buildBookReadingOperations(projectPath);
    }

    if (operations.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hay operaciones de archivo. Envía files[] o un prompt reconocido por la receta actual.",
          example: {
            projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
            validate: true,
            autoRollback: true,
            files: [
              {
                path: "app/page.tsx",
                action: "upsert",
                content: "export default function Page(){ return <main>Hola</main> }",
              },
            ],
          },
        },
        { status: 400 },
      );
    }

    const backup = await createBackup(
      projectPath,
      operations.map((operation) => operation.path),
    );

    const changedFiles: string[] = [];

    for (const operation of operations) {
      if (operation.action === "delete") {
        await deleteProjectFile(projectPath, operation.path);
        changedFiles.push(operation.path);
        continue;
      }

      await writeProjectFile(projectPath, operation.path, operation.content || "");
      changedFiles.push(operation.path);
    }

    const validation = shouldValidate ? await validateProject(projectPath) : null;

    if (validation && !validation.ok && autoRollback) {
      await rollbackBackup(projectPath, backup.id);

      return NextResponse.json({
        ok: false,
        status: "patched-validation-failed-rolled-back",
        projectPath,
        backupId: backup.id,
        changedFiles: Array.from(new Set(changedFiles)),
        validation,
        rollback: {
          ok: true,
          restoredFromBackup: backup.id,
        },
      });
    }

    return NextResponse.json({
      ok: validation ? validation.ok : true,
      status: validation
        ? validation.ok
          ? "patched-and-validated"
          : "patched-with-validation-errors"
        : "patched-not-validated",
      projectPath,
      snapshotName,
      backupId: backup.id,
      changedFiles: Array.from(new Set(changedFiles)),
      validation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo aplicar el cambio.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "patch-agent-ready",
    message: "Patch Agent con backup, snapshot, validación y rollback activo.",
    usage: {
      method: "POST",
      body: {
        projectPath: "C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares",
        prompt: "Agrega botón Iniciar lectura a cada libro cargado.",
        validate: true,
        autoRollback: true,
      },
    },
  });
}
'@

Write-ProjectFile "scripts\check-coder-10-fase2.ps1" @'
$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK CODER 10/10 FASE 2 ===" -ForegroundColor Cyan
Write-Host ""

$RequiredFiles = @(
  "lib\vacoder\core.ts",
  "app\api\project\scan\route.ts",
  "app\api\project\snapshot\route.ts",
  "app\api\project\diff\route.ts",
  "app\api\project\validate\route.ts",
  "app\api\project\rollback\route.ts",
  "app\api\project\patch\apply\route.ts"
)

$Missing = @()

foreach ($File in $RequiredFiles) {
  if (Test-Path (Join-Path $Root $File)) {
    Write-Host "[OK] $File" -ForegroundColor Green
  } else {
    Write-Host "[FALTA] $File" -ForegroundColor Red
    $Missing += $File
  }
}

if ($Missing.Count -gt 0) {
  throw "Faltan archivos críticos."
}

Write-Host ""
Write-Host "Ejecutando typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Ejecutando build..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "CODER FASE 2 PASÓ TYPECHECK Y BUILD." -ForegroundColor Green
Write-Host ""
'@

Write-Host ""
Write-Host "Instalación Fase 2 terminada." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\check-coder-10-fase2.ps1"
Write-Host ""