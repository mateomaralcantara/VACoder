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

  for (const token of lowerPrompt.split(/[^a-z0-9Ã¡Ã©Ã­Ã³ÃºÃ±]+/i).filter(Boolean)) {
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
