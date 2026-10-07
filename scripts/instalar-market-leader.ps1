$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

if (!(Test-Path $Root)) {
  throw "No existe Coder en: $Root"
}

Set-Location $Root

$BackupDir = Join-Path $Root ("_backup-market-leader-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
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
Write-Host "=== INSTALANDO MARKET LEADER MODE ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host "Backup: $BackupDir"
Write-Host ""

Write-ProjectFile "lib\vacoder\market\types.ts" @'
export type MarketRiskLevel = "low" | "medium" | "high";

export type MarketFileOperation = {
  path: string;
  action: "upsert" | "delete";
  content?: string;
  reason?: string;
};

export type MarketPlanFile = {
  path: string;
  reason: string;
};

export type MarketAgentPlan = {
  summary: string;
  risk: MarketRiskLevel;
  steps: string[];
  filesToRead: MarketPlanFile[];
  operations: MarketFileOperation[];
  notes: string[];
};

export type MarketChangeEntry = {
  path: string;
  action: "upsert" | "delete";
  before: string | null;
  after: string | null;
  reason: string;
};

export type MarketChangeSet = {
  id: string;
  projectPath: string;
  prompt: string;
  model: string;
  status: "created" | "applied" | "rejected" | "failed";
  createdAt: string;
  updatedAt: string;
  summary: string;
  risk: MarketRiskLevel;
  steps: string[];
  entries: MarketChangeEntry[];
  notes: string[];
  backupId?: string;
  validation?: unknown;
};
'@

Write-ProjectFile "lib\vacoder\market\agent.ts" @'
import fs from "node:fs/promises";
import path from "node:path";
import {
  assertSafeProjectPath,
  assertSafeRelativePath,
  exists,
  listProjectFiles,
  readProjectFile,
} from "@/lib/vacoder/core";
import type {
  MarketAgentPlan,
  MarketFileOperation,
  MarketRiskLevel,
} from "@/lib/vacoder/market/types";

type ContextFile = {
  path: string;
  content: string;
};

const DEFAULT_MODEL = process.env.VACODER_MODEL || "gpt-5.1-codex-mini";

function scoreFile(filePath: string, prompt: string) {
  const lowerPath = filePath.toLowerCase();
  const lowerPrompt = prompt.toLowerCase();

  let score = 0;

  if (lowerPath.endsWith("package.json")) score += 20;
  if (lowerPath.endsWith("app/page.tsx")) score += 18;
  if (lowerPath.endsWith("app/layout.tsx")) score += 12;
  if (lowerPath.includes("/api/")) score += 8;
  if (lowerPath.includes("components/")) score += 8;
  if (lowerPath.includes("lib/")) score += 7;
  if (lowerPath.includes("types")) score += 6;
  if (lowerPath.endsWith(".tsx")) score += 6;
  if (lowerPath.endsWith(".ts")) score += 5;
  if (lowerPath.endsWith(".css")) score += 3;

  for (const token of lowerPrompt.split(/[^a-z0-9áéíóúñ]+/i).filter(Boolean)) {
    if (token.length >= 4 && lowerPath.includes(token)) {
      score += 10;
    }
  }

  return score;
}

async function buildContext(projectPathInput: string, prompt: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const files = await listProjectFiles(projectPath);

  const ranked = files
    .map((file) => ({
      ...file,
      score: scoreFile(file.path, prompt),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 28);

  const contextFiles: ContextFile[] = [];
  let budget = 0;
  const maxBudget = 65000;

  for (const file of ranked) {
    if (budget >= maxBudget) {
      break;
    }

    try {
      const content = await readProjectFile(projectPath, file.path);
      const trimmed = content.slice(0, 9000);

      budget += trimmed.length;

      contextFiles.push({
        path: file.path,
        content: trimmed,
      });
    } catch {
      // ignorar archivos que no se puedan leer
    }
  }

  return {
    projectPath,
    files,
    contextFiles,
  };
}

function extractResponseText(data: unknown): string {
  const value = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };

  if (typeof value.output_text === "string") {
    return value.output_text;
  }

  const chunks: string[] = [];

  for (const output of value.output || []) {
    for (const content of output.content || []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function parseJsonObject(text: string) {
  const clean = text
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(clean.slice(firstBrace, lastBrace + 1));
  }

  return JSON.parse(clean);
}

function sanitizeRisk(value: unknown): MarketRiskLevel {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return "medium";
}

function sanitizeOperations(value: unknown): MarketFileOperation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const operations: MarketFileOperation[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const operation = item as Partial<MarketFileOperation>;

    if (typeof operation.path !== "string" || operation.path.trim().length === 0) {
      continue;
    }

    const safePath = assertSafeRelativePath(operation.path);

    if (operation.action === "delete") {
      operations.push({
        path: safePath,
        action: "delete",
        reason: typeof operation.reason === "string" ? operation.reason : "Eliminar archivo.",
      });
      continue;
    }

    operations.push({
      path: safePath,
      action: "upsert",
      content: typeof operation.content === "string" ? operation.content : "",
      reason: typeof operation.reason === "string" ? operation.reason : "Actualizar archivo.",
    });
  }

  return operations.slice(0, 40);
}

function normalizePlan(raw: unknown, prompt: string): MarketAgentPlan {
  const value = raw as Partial<MarketAgentPlan>;

  return {
    summary:
      typeof value.summary === "string" && value.summary.trim()
        ? value.summary
        : "Plan generado para aplicar cambios multiarchivo.",
    risk: sanitizeRisk(value.risk),
    steps: Array.isArray(value.steps)
      ? value.steps.filter((item): item is string => typeof item === "string").slice(0, 20)
      : ["Analizar proyecto", "Generar cambios", "Validar build"],
    filesToRead: Array.isArray(value.filesToRead)
      ? value.filesToRead
          .filter((item): item is { path: string; reason: string } => {
            return (
              item &&
              typeof item === "object" &&
              typeof item.path === "string" &&
              typeof item.reason === "string"
            );
          })
          .slice(0, 30)
      : [],
    operations: sanitizeOperations(value.operations),
    notes: Array.isArray(value.notes)
      ? value.notes.filter((item): item is string => typeof item === "string").slice(0, 20)
      : ["Prompt: " + prompt],
  };
}

function fallbackPlan(prompt: string): MarketAgentPlan {
  const now = new Date().toISOString();

  return {
    summary:
      "Plan local creado porque no hay OPENAI_API_KEY configurada o el proveedor IA no respondio.",
    risk: "low",
    steps: [
      "Crear un documento de plan dentro del proyecto.",
      "Registrar el prompt original.",
      "Dejar listo el change-set para aprobacion y validacion.",
    ],
    filesToRead: [],
    operations: [
      {
        path: ".vacoder/market-leader-plan.md",
        action: "upsert",
        reason: "Registrar el plan solicitado para ejecucion posterior.",
        content:
          "# VACoder Market Leader Plan\n\n" +
          "Fecha: " +
          now +
          "\n\n" +
          "Prompt solicitado:\n\n" +
          prompt +
          "\n\n" +
          "Para activar IA real multiarchivo configura OPENAI_API_KEY en .env.local y reinicia Coder.\n",
      },
    ],
    notes: [
      "Modo fallback activo.",
      "Configura OPENAI_API_KEY para generar operaciones inteligentes multiarchivo.",
    ],
  };
}

async function callOpenAIPlanner(args: {
  prompt: string;
  projectPath: string;
  contextFiles: ContextFile[];
  model: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackPlan(args.prompt);
  }

  const systemPrompt = [
    "Eres VACoder Market Leader Agent.",
    "Debes modificar proyectos Next.js/React de forma profesional.",
    "Devuelve exclusivamente JSON valido con summary, risk, steps, filesToRead, operations y notes.",
    "Las operations deben usar rutas relativas seguras.",
    "Nunca escribas fuera del proyecto.",
    "No borres archivos importantes salvo que sea estrictamente necesario.",
    "Prioriza cambios que compilen con TypeScript.",
  ].join("\n");

  const userPayload = {
    task: args.prompt,
    projectPath: args.projectPath,
    contextFiles: args.contextFiles,
    requiredJsonShape: {
      summary: "string",
      risk: "low | medium | high",
      steps: ["string"],
      filesToRead: [{ path: "string", reason: "string" }],
      operations: [
        {
          path: "string",
          action: "upsert | delete",
          content: "string opcional para upsert",
          reason: "string",
        },
      ],
      notes: ["string"],
    },
  };

  const body = {
    model: args.model,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(userPayload),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "vacoder_market_plan",
        strict: false,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            risk: { type: "string", enum: ["low", "medium", "high"] },
            steps: { type: "array", items: { type: "string" } },
            filesToRead: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  path: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["path", "reason"],
              },
            },
            operations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  path: { type: "string" },
                  action: { type: "string", enum: ["upsert", "delete"] },
                  content: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["path", "action", "content", "reason"],
              },
            },
            notes: { type: "array", items: { type: "string" } },
          },
          required: ["summary", "risk", "steps", "filesToRead", "operations", "notes"],
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error("OpenAI planner fallo: HTTP " + response.status + " " + errorText);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  const parsed = parseJsonObject(text);

  return normalizePlan(parsed, args.prompt);
}

export async function generateMarketAgentPlan(args: {
  projectPath: string;
  prompt: string;
  model?: string;
}) {
  const prompt = args.prompt.trim();

  if (!prompt) {
    throw new Error("El prompt es obligatorio.");
  }

  const context = await buildContext(args.projectPath, prompt);
  const model = args.model || DEFAULT_MODEL;

  try {
    const plan = await callOpenAIPlanner({
      prompt,
      projectPath: context.projectPath,
      contextFiles: context.contextFiles,
      model,
    });

    return {
      projectPath: context.projectPath,
      model,
      contextFiles: context.contextFiles.map((file) => file.path),
      totalFiles: context.files.length,
      plan,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fallo IA desconocido.";
    const plan = fallbackPlan(prompt);

    return {
      projectPath: context.projectPath,
      model: "fallback-local",
      contextFiles: context.contextFiles.map((file) => file.path),
      totalFiles: context.files.length,
      plan: {
        ...plan,
        notes: [...plan.notes, message],
      },
    };
  }
}

export async function readBeforeForOperation(projectPathInput: string, operation: MarketFileOperation) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const relativePath = assertSafeRelativePath(operation.path);
  const full = path.join(projectPath, relativePath);

  if (!(await exists(full))) {
    return null;
  }

  if (operation.action === "delete") {
    return fs.readFile(full, "utf8").catch(() => null);
  }

  return fs.readFile(full, "utf8").catch(() => null);
}
'@

Write-ProjectFile "lib\vacoder\market\change-set.ts" @'
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assertSafeProjectPath,
  assertSafeRelativePath,
  createBackup,
  deleteProjectFile,
  ensureVacoderDir,
  validateProject,
  writeProjectFile,
} from "@/lib/vacoder/core";
import {
  generateMarketAgentPlan,
  readBeforeForOperation,
} from "@/lib/vacoder/market/agent";
import type {
  MarketChangeEntry,
  MarketChangeSet,
} from "@/lib/vacoder/market/types";

async function getChangeSetDir(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const vacoderDir = await ensureVacoderDir(projectPath);
  const dir = path.join(vacoderDir, "change-sets");

  await fs.mkdir(dir, { recursive: true });

  return dir;
}

function assertSafeId(id: string) {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) {
    throw new Error("changeSetId inseguro.");
  }

  return id;
}

export async function createMarketChangeSet(args: {
  projectPath: string;
  prompt: string;
  model?: string;
}) {
  const generated = await generateMarketAgentPlan({
    projectPath: args.projectPath,
    prompt: args.prompt,
    model: args.model,
  });

  const now = new Date().toISOString();
  const id = now.replace(/[:.]/g, "-") + "-" + crypto.randomUUID();

  const entries: MarketChangeEntry[] = [];

  for (const operation of generated.plan.operations) {
    const safePath = assertSafeRelativePath(operation.path);
    const before = await readBeforeForOperation(generated.projectPath, operation);

    entries.push({
      path: safePath,
      action: operation.action,
      before,
      after: operation.action === "delete" ? null : operation.content || "",
      reason: operation.reason || "Cambio generado por VACoder.",
    });
  }

  const changeSet: MarketChangeSet = {
    id,
    projectPath: generated.projectPath,
    prompt: args.prompt,
    model: generated.model,
    status: "created",
    createdAt: now,
    updatedAt: now,
    summary: generated.plan.summary,
    risk: generated.plan.risk,
    steps: generated.plan.steps,
    entries,
    notes: [
      ...generated.plan.notes,
      "Archivos usados como contexto: " + generated.contextFiles.join(", "),
      "Total de archivos detectados: " + generated.totalFiles,
    ],
  };

  const dir = await getChangeSetDir(generated.projectPath);

  await fs.writeFile(
    path.join(dir, id + ".json"),
    JSON.stringify(changeSet, null, 2),
    "utf8",
  );

  return changeSet;
}

export async function readMarketChangeSet(projectPathInput: string, changeSetId: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const id = assertSafeId(changeSetId);
  const dir = await getChangeSetDir(projectPath);
  const raw = await fs.readFile(path.join(dir, id + ".json"), "utf8");

  return JSON.parse(raw) as MarketChangeSet;
}

export async function saveMarketChangeSet(changeSet: MarketChangeSet) {
  const dir = await getChangeSetDir(changeSet.projectPath);

  changeSet.updatedAt = new Date().toISOString();

  await fs.writeFile(
    path.join(dir, changeSet.id + ".json"),
    JSON.stringify(changeSet, null, 2),
    "utf8",
  );

  return changeSet;
}

export async function listMarketChangeSets(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const dir = await getChangeSetDir(projectPath);
  const files = await fs.readdir(dir).catch(() => []);

  const results: MarketChangeSet[] = [];

  for (const file of files.filter((item) => item.endsWith(".json")).slice(-50)) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      results.push(JSON.parse(raw) as MarketChangeSet);
    } catch {
      // ignorar corruptos
    }
  }

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function applyMarketChangeSet(args: {
  projectPath: string;
  changeSetId: string;
  validate?: boolean;
  autoRollback?: boolean;
}) {
  const changeSet = await readMarketChangeSet(args.projectPath, args.changeSetId);

  if (changeSet.status !== "created") {
    throw new Error("Este change-set ya no esta en estado created.");
  }

  const backup = await createBackup(
    changeSet.projectPath,
    changeSet.entries.map((entry) => entry.path),
  );

  for (const entry of changeSet.entries) {
    if (entry.action === "delete") {
      await deleteProjectFile(changeSet.projectPath, entry.path);
    } else {
      await writeProjectFile(changeSet.projectPath, entry.path, entry.after || "");
    }
  }

  const validation = args.validate === false ? null : await validateProject(changeSet.projectPath);

  if (validation && !validation.ok && args.autoRollback !== false) {
    for (const entry of changeSet.entries) {
      if (entry.before === null) {
        await deleteProjectFile(changeSet.projectPath, entry.path);
      } else {
        await writeProjectFile(changeSet.projectPath, entry.path, entry.before);
      }
    }

    changeSet.status = "failed";
    changeSet.backupId = backup.id;
    changeSet.validation = validation;

    await saveMarketChangeSet(changeSet);

    return {
      ok: false,
      status: "failed-rolled-back",
      changeSet,
      validation,
    };
  }

  changeSet.status = validation && !validation.ok ? "failed" : "applied";
  changeSet.backupId = backup.id;
  changeSet.validation = validation;

  await saveMarketChangeSet(changeSet);

  return {
    ok: validation ? validation.ok : true,
    status: changeSet.status,
    changeSet,
    validation,
  };
}

export async function rejectMarketChangeSet(args: {
  projectPath: string;
  changeSetId: string;
}) {
  const changeSet = await readMarketChangeSet(args.projectPath, args.changeSetId);

  changeSet.status = "rejected";

  await saveMarketChangeSet(changeSet);

  return changeSet;
}
'@

Write-ProjectFile "lib\vacoder\market\git.ts" @'
import {
  assertSafeProjectPath,
  runCommand,
} from "@/lib/vacoder/core";

export async function getGitStatus(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const status = await runCommand(projectPath, "git status --short", 60000);
  const branch = await runCommand(projectPath, "git branch --show-current", 60000);

  return {
    ok: status.exitCode === 0,
    branch: branch.stdout.trim(),
    status,
  };
}

export async function commitGitChanges(projectPathInput: string, messageInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const safeMessage = (messageInput || "vacoder market leader changes")
    .replaceAll('"', "'")
    .replaceAll("`", "'")
    .trim();

  const add = await runCommand(projectPath, "git add .", 60000);

  if (add.exitCode !== 0) {
    return {
      ok: false,
      step: "git add",
      add,
    };
  }

  const commit = await runCommand(
    projectPath,
    'git commit -m "' + safeMessage + '"',
    60000,
  );

  return {
    ok: commit.exitCode === 0,
    step: "git commit",
    add,
    commit,
  };
}
'@

Write-ProjectFile "app\api\project\agent\plan\route.ts" @'
import { NextResponse } from "next/server";
import { generateMarketAgentPlan } from "@/lib/vacoder/market/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await generateMarketAgentPlan({
      projectPath: String(body.projectPath || ""),
      prompt: String(body.prompt || ""),
      model: typeof body.model === "string" ? body.model : undefined,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar plan.";

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
    status: "market-agent-plan-ready",
  });
}
'@

Write-ProjectFile "app\api\project\change-set\create\route.ts" @'
import { NextResponse } from "next/server";
import { createMarketChangeSet } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const changeSet = await createMarketChangeSet({
      projectPath: String(body.projectPath || ""),
      prompt: String(body.prompt || ""),
      model: typeof body.model === "string" ? body.model : undefined,
    });

    return NextResponse.json({
      ok: true,
      changeSet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear change-set.";

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
    status: "change-set-create-ready",
  });
}
'@

Write-ProjectFile "app\api\project\change-set\apply\route.ts" @'
import { NextResponse } from "next/server";
import { applyMarketChangeSet } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await applyMarketChangeSet({
      projectPath: String(body.projectPath || ""),
      changeSetId: String(body.changeSetId || ""),
      validate: body.validate !== false,
      autoRollback: body.autoRollback !== false,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo aplicar change-set.";

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
    status: "change-set-apply-ready",
  });
}
'@

Write-ProjectFile "app\api\project\change-set\reject\route.ts" @'
import { NextResponse } from "next/server";
import { rejectMarketChangeSet } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const changeSet = await rejectMarketChangeSet({
      projectPath: String(body.projectPath || ""),
      changeSetId: String(body.changeSetId || ""),
    });

    return NextResponse.json({
      ok: true,
      changeSet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo rechazar change-set.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "app\api\project\change-set\list\route.ts" @'
import { NextResponse } from "next/server";
import { listMarketChangeSets } from "@/lib/vacoder/market/change-set";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const changeSets = await listMarketChangeSets(String(body.projectPath || ""));

    return NextResponse.json({
      ok: true,
      changeSets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo listar change-sets.";

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
    status: "change-set-list-ready",
  });
}
'@

Write-ProjectFile "app\api\project\git\status\route.ts" @'
import { NextResponse } from "next/server";
import { getGitStatus } from "@/lib/vacoder/market/git";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await getGitStatus(String(body.projectPath || ""));

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar Git.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "app\api\project\git\commit\route.ts" @'
import { NextResponse } from "next/server";
import { commitGitChanges } from "@/lib/vacoder/market/git";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await commitGitChanges(
      String(body.projectPath || ""),
      String(body.message || "vacoder market leader changes"),
    );

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear commit.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
'@

Write-ProjectFile "components\market-leader-panel.tsx" @'
"use client";

import { useMemo, useState } from "react";

type ChangeEntry = {
  path: string;
  action: "upsert" | "delete";
  before: string | null;
  after: string | null;
  reason: string;
};

type ChangeSet = {
  id: string;
  projectPath: string;
  prompt: string;
  model: string;
  status: string;
  summary: string;
  risk: "low" | "medium" | "high";
  steps: string[];
  entries: ChangeEntry[];
  notes: string[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Fallo solicitud: " + url);
  }

  return data as T;
}

function shortCode(value: string | null) {
  if (!value) {
    return "Archivo no existia o sera eliminado.";
  }

  return value.length > 6000 ? value.slice(0, 6000) + "\n\n...recortado..." : value;
}

export default function MarketLeaderPanel() {
  const [projectPath, setProjectPath] = useState("C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares");
  const [model, setModel] = useState("gpt-5.1-codex-mini");
  const [prompt, setPrompt] = useState(
    "Mejora esta app para que tenga login, dashboard premium, estado vacio profesional y estructura lista para vender.",
  );
  const [changeSet, setChangeSet] = useState<ChangeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [selectedPath, setSelectedPath] = useState<string>("");

  const selectedEntry = useMemo(() => {
    if (!changeSet) {
      return null;
    }

    return changeSet.entries.find((entry) => entry.path === selectedPath) || changeSet.entries[0] || null;
  }, [changeSet, selectedPath]);

  async function createChangeSet() {
    setBusy(true);
    setLog("Creando change-set con agente multiarchivo...");

    try {
      const data = await postJson<{ changeSet: ChangeSet }>("/api/project/change-set/create", {
        projectPath,
        prompt,
        model,
      });

      setChangeSet(data.changeSet);
      setSelectedPath(data.changeSet.entries[0]?.path || "");
      setLog("Change-set creado. Revisa el diff antes de aplicar.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function applyChangeSet() {
    if (!changeSet) {
      return;
    }

    setBusy(true);
    setLog("Aplicando cambios, validando y preparando rollback si falla...");

    try {
      const data = await postJson<{ ok: boolean; status: string; changeSet: ChangeSet }>("/api/project/change-set/apply", {
        projectPath,
        changeSetId: changeSet.id,
        validate: true,
        autoRollback: true,
      });

      setChangeSet(data.changeSet);
      setLog("Resultado: " + data.status);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectChangeSet() {
    if (!changeSet) {
      return;
    }

    setBusy(true);
    setLog("Rechazando change-set...");

    try {
      const data = await postJson<{ changeSet: ChangeSet }>("/api/project/change-set/reject", {
        projectPath,
        changeSetId: changeSet.id,
      });

      setChangeSet(data.changeSet);
      setLog("Change-set rechazado.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function gitStatus() {
    setBusy(true);
    setLog("Consultando Git...");

    try {
      const data = await postJson<{ result: { branch: string; status: { stdout: string; stderr: string } } }>(
        "/api/project/git/status",
        { projectPath },
      );

      setLog(
        "Rama: " +
          data.result.branch +
          "\n\n" +
          (data.result.status.stdout || data.result.status.stderr || "Sin cambios."),
      );
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  async function gitCommit() {
    setBusy(true);
    setLog("Creando commit...");

    try {
      const data = await postJson<{ ok: boolean; result: { commit?: { stdout: string; stderr: string } } }>(
        "/api/project/git/commit",
        {
          projectPath,
          message: "feat: cambios aplicados por VACoder Market Leader",
        },
      );

      setLog(JSON.stringify(data, null, 2));
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Error desconocido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.badge}>VACoder Market Leader</p>
        <h1 style={styles.title}>IA multiarchivo + diff visual + aprobacion + Git</h1>
        <p style={styles.description}>
          Este modo genera un change-set antes de tocar el proyecto. Puedes revisar,
          aprobar, rechazar, validar, hacer rollback y crear commit.
        </p>
      </section>

      <section style={styles.panel}>
        <label style={styles.field}>
          <span>Ruta del proyecto objetivo</span>
          <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
        </label>

        <label style={styles.field}>
          <span>Modelo</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} />
        </label>

        <label style={styles.field}>
          <span>Prompt de producto</span>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
        </label>

        <div style={styles.actions}>
          <button type="button" onClick={createChangeSet} disabled={busy}>
            Crear change-set IA
          </button>

          <button type="button" onClick={applyChangeSet} disabled={busy || !changeSet}>
            Aprobar + aplicar + validar
          </button>

          <button type="button" onClick={rejectChangeSet} disabled={busy || !changeSet}>
            Rechazar
          </button>

          <button type="button" onClick={gitStatus} disabled={busy}>
            Git status
          </button>

          <button type="button" onClick={gitCommit} disabled={busy}>
            Git commit
          </button>
        </div>

        {log ? <pre style={styles.log}>{log}</pre> : null}
      </section>

      {changeSet ? (
        <section style={styles.panel}>
          <div style={styles.changeHeader}>
            <div>
              <p style={styles.badge}>Change-set</p>
              <h2>{changeSet.summary}</h2>
              <p>Estado: {changeSet.status} | Riesgo: {changeSet.risk} | Modelo: {changeSet.model}</p>
            </div>

            <strong>{changeSet.entries.length} archivo(s)</strong>
          </div>

          <div style={styles.steps}>
            {changeSet.steps.map((step, index) => (
              <div key={index} style={styles.step}>
                {index + 1}. {step}
              </div>
            ))}
          </div>

          <div style={styles.diffLayout}>
            <aside style={styles.fileList}>
              {changeSet.entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => setSelectedPath(entry.path)}
                  style={{
                    ...styles.fileButton,
                    borderColor: selectedEntry?.path === entry.path ? "#D72638" : "#E5E7EB",
                  }}
                >
                  <strong>{entry.path}</strong>
                  <span>{entry.action}</span>
                </button>
              ))}
            </aside>

            {selectedEntry ? (
              <section style={styles.diffViewer}>
                <h3>{selectedEntry.path}</h3>
                <p>{selectedEntry.reason}</p>

                <div style={styles.columns}>
                  <div>
                    <h4>Antes</h4>
                    <pre style={styles.code}>{shortCode(selectedEntry.before)}</pre>
                  </div>

                  <div>
                    <h4>Despues</h4>
                    <pre style={styles.code}>{shortCode(selectedEntry.after)}</pre>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <details style={styles.notes}>
            <summary>Notas tecnicas</summary>
            <pre>{changeSet.notes.join("\n")}</pre>
          </details>
        </section>
      ) : null}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F5F7FA",
    padding: "32px 6vw",
    color: "#0B1F3A",
  },
  hero: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    marginBottom: 18,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
  badge: {
    display: "inline-flex",
    background: "rgba(215, 38, 56, 0.12)",
    color: "#D72638",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
    margin: 0,
  },
  title: {
    fontSize: "2.6rem",
    margin: "16px 0 8px",
  },
  description: {
    color: "#4B5563",
    lineHeight: 1.7,
    maxWidth: 900,
  },
  panel: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
  },
  field: {
    display: "grid",
    gap: 8,
    marginBottom: 14,
    fontWeight: 900,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  log: {
    background: "#0B1F3A",
    color: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    whiteSpace: "pre-wrap",
    marginTop: 16,
  },
  changeHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "start",
  },
  steps: {
    display: "grid",
    gap: 8,
    margin: "18px 0",
  },
  step: {
    padding: 12,
    borderRadius: 14,
    background: "#F8FAFC",
    color: "#1F2937",
    fontWeight: 700,
  },
  diffLayout: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: 18,
  },
  fileList: {
    display: "grid",
    gap: 8,
    alignContent: "start",
  },
  fileButton: {
    display: "grid",
    gap: 6,
    textAlign: "left",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    cursor: "pointer",
    color: "#0B1F3A",
  },
  diffViewer: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 18,
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  code: {
    background: "#111827",
    color: "#E5E7EB",
    padding: 14,
    borderRadius: 14,
    overflow: "auto",
    maxHeight: 520,
    whiteSpace: "pre-wrap",
    fontSize: 12,
  },
  notes: {
    marginTop: 18,
  },
};
'@

Write-ProjectFile "app\market\page.tsx" @'
import MarketLeaderPanel from "@/components/market-leader-panel";

export default function MarketPage() {
  return <MarketLeaderPanel />;
}
'@

Write-ProjectFile "scripts\check-market-leader.ps1" @'
$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK MARKET LEADER MODE ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "lib\vacoder\market\types.ts",
  "lib\vacoder\market\agent.ts",
  "lib\vacoder\market\change-set.ts",
  "lib\vacoder\market\git.ts",
  "app\api\project\agent\plan\route.ts",
  "app\api\project\change-set\create\route.ts",
  "app\api\project\change-set\apply\route.ts",
  "app\api\project\change-set\reject\route.ts",
  "app\api\project\change-set\list\route.ts",
  "app\api\project\git\status\route.ts",
  "app\api\project\git\commit\route.ts",
  "components\market-leader-panel.tsx",
  "app\market\page.tsx"
)

foreach ($File in $Files) {
  if (Test-Path (Join-Path $Root $File)) {
    Write-Host "[OK] $File" -ForegroundColor Green
  } else {
    throw "Falta archivo: $File"
  }
}

Write-Host ""
Write-Host "Ejecutando typecheck..." -ForegroundColor Cyan
npm run typecheck

Write-Host ""
Write-Host "Ejecutando build..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "MARKET LEADER MODE INSTALADO Y VALIDADO." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/market"
Write-Host ""
'@

Write-Host ""
Write-Host "Market Leader Mode instalado." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\check-market-leader.ps1"
Write-Host ""