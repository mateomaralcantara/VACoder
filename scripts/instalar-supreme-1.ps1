$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

if (!(Test-Path $Root)) {
  throw "No existe Coder en: $Root"
}

Set-Location $Root

$BackupDir = Join-Path $Root ("_backup-supreme-1-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
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
Write-Host "=== INSTALANDO SUPREME 1 ===" -ForegroundColor Cyan
Write-Host "Proyecto: $Root"
Write-Host "Backup: $BackupDir"
Write-Host ""

Write-ProjectFile "lib\vacoder\supreme\types.ts" @'
export type SupremeRisk = "low" | "medium" | "high";

export type SupremeScoreItem = {
  area: string;
  item: string;
  status: "ok" | "warn" | "fail";
  points: number;
  max: number;
  details: string;
};

export type SupremeProductScore = {
  score: number;
  maxScore: number;
  percent: number;
  grade: string;
  readyToSell: boolean;
  items: SupremeScoreItem[];
  missing: string[];
  recommendations: string[];
};

export type SupremeMemory = {
  projectPath: string;
  updatedAt: string;
  productGoal: string;
  decisions: string[];
  modules: string[];
  todos: string[];
  risks: string[];
  lastScore?: SupremeProductScore;
};

export type SupremeModule = {
  id: string;
  name: string;
  category: string;
  description: string;
  businessValue: string;
  files: string[];
};

export type SupremeAgentRole =
  | "CEO"
  | "CTO"
  | "Builder"
  | "Designer"
  | "QA"
  | "Security"
  | "DevOps";

export type SupremeAgentFinding = {
  role: SupremeAgentRole;
  title: string;
  priority: "low" | "medium" | "high";
  recommendation: string;
};

export type SupremeVisualResult = {
  ok: boolean;
  url: string;
  statusCode?: number;
  title?: string;
  bodyLength?: number;
  looksBlank: boolean;
  findings: string[];
};

export type SupremeDeployStatus = {
  gitOk: boolean;
  branch: string;
  hasChanges: boolean;
  statusText: string;
  vercelAvailable: boolean;
  recommendations: string[];
};
'@

Write-ProjectFile "lib\vacoder\supreme\fs.ts" @'
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
'@

Write-ProjectFile "lib\vacoder\supreme\memory.ts" @'
import fs from "node:fs/promises";
import path from "node:path";
import { assertSafeProjectPath } from "@/lib/vacoder/core";
import { ensureSupremeDir, exists } from "@/lib/vacoder/supreme/fs";
import type { SupremeMemory, SupremeProductScore } from "@/lib/vacoder/supreme/types";

async function getMemoryPath(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const dir = await ensureSupremeDir(projectPath);

  return path.join(dir, "memory.json");
}

export async function readSupremeMemory(projectPathInput: string): Promise<SupremeMemory> {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const filePath = await getMemoryPath(projectPath);

  if (!(await exists(filePath))) {
    return {
      projectPath,
      updatedAt: new Date().toISOString(),
      productGoal: "Convertir esta app en un producto premium listo para vender.",
      decisions: [],
      modules: [],
      todos: [],
      risks: [],
    };
  }

  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as SupremeMemory;
}

export async function saveSupremeMemory(memory: SupremeMemory) {
  const filePath = await getMemoryPath(memory.projectPath);

  memory.updatedAt = new Date().toISOString();

  await fs.writeFile(filePath, JSON.stringify(memory, null, 2), "utf8");

  return memory;
}

export async function updateSupremeScore(projectPathInput: string, score: SupremeProductScore) {
  const memory = await readSupremeMemory(projectPathInput);

  memory.lastScore = score;
  memory.todos = Array.from(new Set([...memory.todos, ...score.missing]));
  memory.risks = Array.from(
    new Set([
      ...memory.risks,
      ...score.items
        .filter((item) => item.status === "fail" || item.status === "warn")
        .map((item) => item.area + ": " + item.item),
    ]),
  );

  return saveSupremeMemory(memory);
}

export async function addSupremeDecision(projectPathInput: string, decision: string) {
  const memory = await readSupremeMemory(projectPathInput);

  if (decision.trim()) {
    memory.decisions = Array.from(new Set([decision.trim(), ...memory.decisions])).slice(0, 80);
  }

  return saveSupremeMemory(memory);
}

export async function addSupremeModule(projectPathInput: string, moduleId: string) {
  const memory = await readSupremeMemory(projectPathInput);

  if (moduleId.trim()) {
    memory.modules = Array.from(new Set([moduleId.trim(), ...memory.modules])).slice(0, 80);
  }

  return saveSupremeMemory(memory);
}
'@

Write-ProjectFile "lib\vacoder\supreme\product-score.ts" @'
import path from "node:path";
import { assertSafeProjectPath, validateProject } from "@/lib/vacoder/core";
import {
  exists,
  listSupremeProjectFiles,
  readSupremeFile,
} from "@/lib/vacoder/supreme/fs";
import { updateSupremeScore } from "@/lib/vacoder/supreme/memory";
import type {
  SupremeProductScore,
  SupremeScoreItem,
} from "@/lib/vacoder/supreme/types";

function addItem(
  items: SupremeScoreItem[],
  area: string,
  item: string,
  ok: boolean,
  points: number,
  detailsOk: string,
  detailsFail: string,
  warn = false,
) {
  items.push({
    area,
    item,
    status: ok ? "ok" : warn ? "warn" : "fail",
    points: ok ? points : warn ? Math.floor(points / 2) : 0,
    max: points,
    details: ok ? detailsOk : detailsFail,
  });
}

function hasPath(files: { path: string }[], matcher: RegExp) {
  return files.some((file) => matcher.test(file.path));
}

async function packageHas(projectPath: string, token: string) {
  const packagePath = path.join(projectPath, "package.json");

  if (!(await exists(packagePath))) {
    return false;
  }

  const raw = await readSupremeFile(projectPath, "package.json").catch(() => "");
  return raw.toLowerCase().includes(token.toLowerCase());
}

export async function scoreSupremeProduct(projectPathInput: string): Promise<SupremeProductScore> {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const files = await listSupremeProjectFiles(projectPath);
  const items: SupremeScoreItem[] = [];

  addItem(
    items,
    "Foundation",
    "package.json",
    hasPath(files, /^package\.json$/),
    5,
    "package.json existe.",
    "Falta package.json.",
  );

  addItem(
    items,
    "Foundation",
    "Next.js / React",
    (await packageHas(projectPath, "next")) && (await packageHas(projectPath, "react")),
    8,
    "Next.js y React detectados.",
    "No se detecta stack Next.js/React completo.",
  );

  addItem(
    items,
    "Foundation",
    "TypeScript",
    (await packageHas(projectPath, "typescript")) || hasPath(files, /tsconfig\.json$/),
    7,
    "TypeScript detectado.",
    "Falta TypeScript o tsconfig.",
  );

  addItem(
    items,
    "Product",
    "Landing principal",
    hasPath(files, /^app\/page\.tsx$/) || hasPath(files, /^pages\/index\.tsx$/),
    8,
    "Landing principal detectada.",
    "Falta landing principal clara.",
  );

  addItem(
    items,
    "Product",
    "Dashboard",
    hasPath(files, /dashboard/i),
    8,
    "Dashboard detectado.",
    "Falta dashboard de usuario/admin.",
    true,
  );

  addItem(
    items,
    "Product",
    "Onboarding",
    hasPath(files, /onboarding|welcome|setup/i),
    5,
    "Onboarding detectado.",
    "Falta onboarding.",
    true,
  );

  addItem(
    items,
    "Revenue",
    "Pagos",
    hasPath(files, /payment|checkout|paypal|stripe|cardnet|azul/i),
    9,
    "Modulo de pagos detectado.",
    "Falta modulo de pagos.",
    true,
  );

  addItem(
    items,
    "Revenue",
    "Pricing",
    hasPath(files, /pricing|planes|subscription|billing/i),
    7,
    "Pricing/subscripcion detectado.",
    "Falta pricing o planes.",
    true,
  );

  addItem(
    items,
    "Trust",
    "Legal pages",
    hasPath(files, /privacy|terms|legal|politica|terminos/i),
    6,
    "Paginas legales detectadas.",
    "Faltan politicas/terminos.",
    true,
  );

  addItem(
    items,
    "Trust",
    "Auth",
    hasPath(files, /auth|login|signin|signup|supabase/i),
    9,
    "Autenticacion detectada.",
    "Falta autenticacion real.",
    true,
  );

  addItem(
    items,
    "Operations",
    "API routes",
    hasPath(files, /^app\/api\//),
    8,
    "API routes detectadas.",
    "Faltan API routes.",
  );

  addItem(
    items,
    "Operations",
    "Database layer",
    hasPath(files, /supabase|prisma|drizzle|schema|migration/i),
    8,
    "Capa de base de datos detectada.",
    "Falta base de datos o migraciones.",
    true,
  );

  addItem(
    items,
    "Quality",
    "Reusable components",
    hasPath(files, /^components\//),
    7,
    "Componentes reutilizables detectados.",
    "Falta carpeta components.",
  );

  addItem(
    items,
    "Quality",
    "Responsive / CSS",
    hasPath(files, /globals\.css|tailwind|\.css$/i),
    5,
    "Estilos detectados.",
    "Faltan estilos globales.",
  );

  const validation = await validateProject(projectPath).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Validacion fallo.",
  }));

  addItem(
    items,
    "Quality",
    "Build validation",
    Boolean((validation as { ok?: boolean }).ok),
    15,
    "Typecheck/build pasan.",
    "Typecheck/build fallan.",
  );

  const maxScore = items.reduce((total, item) => total + item.max, 0);
  const score = items.reduce((total, item) => total + item.points, 0);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  const missing = items
    .filter((item) => item.status !== "ok")
    .map((item) => item.area + " - " + item.item + ": " + item.details);

  const recommendations = missing.slice(0, 12);

  const grade =
    percent >= 95
      ? "Premium listo para vender"
      : percent >= 85
        ? "Muy fuerte, faltan piezas comerciales"
        : percent >= 75
          ? "Buen producto, faltan modulos clave"
          : percent >= 60
            ? "MVP incompleto"
            : "No listo para mercado";

  const result: SupremeProductScore = {
    score,
    maxScore,
    percent,
    grade,
    readyToSell: percent >= 90 && missing.length <= 3,
    items,
    missing,
    recommendations,
  };

  await updateSupremeScore(projectPath, result).catch(() => null);

  return result;
}
'@

Write-ProjectFile "lib\vacoder\supreme\modules.ts" @'
import { addSupremeModule } from "@/lib/vacoder/supreme/memory";
import { writeSupremeFile } from "@/lib/vacoder/supreme/fs";
import type { SupremeModule } from "@/lib/vacoder/supreme/types";

export const supremeModules: SupremeModule[] = [
  {
    id: "supabase-auth",
    name: "Supabase Auth Premium",
    category: "Auth",
    description: "Login, registro, sesiones, middleware y roles base.",
    businessValue: "Permite vender apps con usuarios reales.",
    files: ["lib/supabase/client.ts", "app/login/page.tsx", "app/dashboard/page.tsx"],
  },
  {
    id: "payments-paypal-stripe",
    name: "Pagos PayPal / Stripe",
    category: "Revenue",
    description: "Checkout, ordenes, captura de pago y registro de compras.",
    businessValue: "Permite cobrar desde el primer dia.",
    files: ["app/api/payments/create/route.ts", "app/checkout/page.tsx"],
  },
  {
    id: "admin-dashboard",
    name: "Admin Dashboard",
    category: "Operations",
    description: "Panel admin con metricas, usuarios, ventas y actividad.",
    businessValue: "Convierte la app en sistema administrable.",
    files: ["app/admin/page.tsx", "components/admin-metrics.tsx"],
  },
  {
    id: "pdf-documents",
    name: "PDF Documents",
    category: "Documents",
    description: "Generacion de recibos, expedientes, contratos y reportes PDF.",
    businessValue: "Clave para legal, migracion, financiera e inmobiliaria.",
    files: ["lib/pdf/generator.ts", "app/api/pdf/route.ts"],
  },
  {
    id: "appointment-system",
    name: "Sistema de Citas",
    category: "CRM",
    description: "Agenda, disponibilidad, reservas, clientes y estados.",
    businessValue: "Ideal para oficinas, migracion, medicos y servicios.",
    files: ["app/citas/page.tsx", "app/api/appointments/route.ts"],
  },
  {
    id: "product-seo",
    name: "SEO / Landing Premium",
    category: "Growth",
    description: "Metadatos, landing, secciones de conversion y trust blocks.",
    businessValue: "Ayuda a vender y captar clientes.",
    files: ["app/page.tsx", "app/layout.tsx"],
  },
];

export async function installSupremeModule(projectPath: string, moduleId: string) {
  const module = supremeModules.find((item) => item.id === moduleId);

  if (!module) {
    throw new Error("Modulo no encontrado: " + moduleId);
  }

  const content =
    "# Modulo Supreme instalado\n\n" +
    "Modulo: " +
    module.name +
    "\n\n" +
    "Categoria: " +
    module.category +
    "\n\n" +
    "Valor de negocio: " +
    module.businessValue +
    "\n\n" +
    "Archivos sugeridos:\n" +
    module.files.map((file) => "- " + file).join("\n") +
    "\n\n" +
    "Descripcion:\n" +
    module.description +
    "\n";

  await writeSupremeFile(projectPath, ".vacoder/supreme/modules/" + module.id + ".md", content);
  await addSupremeModule(projectPath, module.id);

  return {
    ok: true,
    module,
    message: "Modulo registrado en memoria. Proxima fase: instalador de codigo real por modulo.",
  };
}
'@

Write-ProjectFile "lib\vacoder\supreme\visual-test.ts" @'
import { writeSupremeFile } from "@/lib/vacoder/supreme/fs";
import type { SupremeVisualResult } from "@/lib/vacoder/supreme/types";

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? match[1].trim() : "";
}

function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runSupremeVisualTest(args: {
  projectPath: string;
  url: string;
}) {
  const url = args.url || "http://localhost:3000";
  const findings: string[] = [];

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const html = await response.text();
    const text = stripHtml(html);
    const title = extractTitle(html);
    const looksBlank = text.length < 40;

    if (response.status >= 400) {
      findings.push("La URL responde con status HTTP " + response.status + ".");
    }

    if (!title) {
      findings.push("No se encontro titulo HTML.");
    }

    if (looksBlank) {
      findings.push("La pagina parece vacia o con muy poco contenido visible.");
    }

    if (html.includes("Application error")) {
      findings.push("Se detecto texto de error de aplicacion.");
    }

    if (html.includes("NEXT_NOT_FOUND")) {
      findings.push("Se detecto posible ruta no encontrada.");
    }

    const result: SupremeVisualResult = {
      ok: response.ok && !looksBlank && findings.length === 0,
      url,
      statusCode: response.status,
      title,
      bodyLength: text.length,
      looksBlank,
      findings,
    };

    await writeSupremeFile(
      args.projectPath,
      ".vacoder/supreme/visual-test-latest.json",
      JSON.stringify(result, null, 2),
    ).catch(() => null);

    return result;
  } catch (error) {
    const result: SupremeVisualResult = {
      ok: false,
      url,
      looksBlank: true,
      findings: [
        error instanceof Error ? error.message : "No se pudo ejecutar visual test.",
      ],
    };

    await writeSupremeFile(
      args.projectPath,
      ".vacoder/supreme/visual-test-latest.json",
      JSON.stringify(result, null, 2),
    ).catch(() => null);

    return result;
  }
}
'@

Write-ProjectFile "lib\vacoder\supreme\deploy.ts" @'
import { runCommand } from "@/lib/vacoder/core";
import type { SupremeDeployStatus } from "@/lib/vacoder/supreme/types";

export async function getSupremeDeployStatus(projectPath: string): Promise<SupremeDeployStatus> {
  const gitStatus = await runCommand(projectPath, "git status --short", 60000).catch((error) => ({
    exitCode: 1,
    stdout: "",
    stderr: error instanceof Error ? error.message : "Git fallo.",
  }));

  const branch = await runCommand(projectPath, "git branch --show-current", 60000).catch(() => ({
    exitCode: 1,
    stdout: "",
    stderr: "",
  }));

  const vercel = await runCommand(projectPath, "npx vercel --version", 60000).catch(() => ({
    exitCode: 1,
    stdout: "",
    stderr: "",
  }));

  const hasChanges = Boolean(gitStatus.stdout.trim());

  const recommendations: string[] = [];

  if (gitStatus.exitCode !== 0) {
    recommendations.push("Inicializar Git o corregir repositorio.");
  }

  if (hasChanges) {
    recommendations.push("Crear commit antes de deploy.");
  }

  if (vercel.exitCode !== 0) {
    recommendations.push("Instalar/configurar Vercel CLI si se quiere deploy automatico.");
  }

  return {
    gitOk: gitStatus.exitCode === 0,
    branch: branch.stdout.trim(),
    hasChanges,
    statusText: gitStatus.stdout || gitStatus.stderr || "Sin cambios.",
    vercelAvailable: vercel.exitCode === 0,
    recommendations,
  };
}

export async function runSupremeVercelDeploy(projectPath: string, production: boolean) {
  const command = production ? "npx vercel --prod --yes" : "npx vercel --yes";
  const result = await runCommand(projectPath, command, 180000);

  return {
    ok: result.exitCode === 0,
    command,
    result,
  };
}
'@

Write-ProjectFile "lib\vacoder\supreme\team.ts" @'
import type {
  SupremeAgentFinding,
  SupremeProductScore,
} from "@/lib/vacoder/supreme/types";

export function runSupremeTeamReview(score: SupremeProductScore): SupremeAgentFinding[] {
  const findings: SupremeAgentFinding[] = [];

  if (!score.readyToSell) {
    findings.push({
      role: "CEO",
      title: "Producto aun no esta listo para venta fuerte",
      priority: "high",
      recommendation:
        "Completar las piezas de monetizacion, onboarding, trust y deploy antes de venderlo como SaaS premium.",
    });
  }

  if (score.missing.some((item) => item.toLowerCase().includes("auth"))) {
    findings.push({
      role: "CTO",
      title: "Falta autenticacion real",
      priority: "high",
      recommendation:
        "Agregar Supabase Auth o proveedor equivalente con roles, sesiones y proteccion de rutas.",
    });
  }

  if (score.missing.some((item) => item.toLowerCase().includes("pagos"))) {
    findings.push({
      role: "CEO",
      title: "Falta motor de ingresos",
      priority: "high",
      recommendation:
        "Instalar checkout PayPal/Stripe y registrar compras o suscripciones.",
    });
  }

  if (score.missing.some((item) => item.toLowerCase().includes("dashboard"))) {
    findings.push({
      role: "Designer",
      title: "Falta dashboard de control",
      priority: "medium",
      recommendation:
        "Crear un dashboard con metricas, acciones principales, estados vacios y navegacion clara.",
    });
  }

  if (score.items.some((item) => item.area === "Quality" && item.status !== "ok")) {
    findings.push({
      role: "QA",
      title: "Faltan garantias de calidad",
      priority: "medium",
      recommendation:
        "Agregar prueba visual, revision responsive y validacion de rutas criticas.",
    });
  }

  if (score.percent >= 90) {
    findings.push({
      role: "DevOps",
      title: "Listo para preparar release",
      priority: "medium",
      recommendation:
        "Crear commit, configurar variables, desplegar y verificar URL publica.",
    });
  }

  findings.push({
    role: "Security",
    title: "Escaneo de seguridad continuo",
    priority: "medium",
    recommendation:
      "Mantener scanner de secretos, rutas permitidas, rollback y auditoria por cada cambio aplicado.",
  });

  return findings;
}
'@

Write-ProjectFile "app\api\supreme\score\route.ts" @'
import { NextResponse } from "next/server";
import { scoreSupremeProduct } from "@/lib/vacoder/supreme/product-score";
import { runSupremeTeamReview } from "@/lib/vacoder/supreme/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");
    const score = await scoreSupremeProduct(projectPath);
    const team = runSupremeTeamReview(score);

    return NextResponse.json({
      ok: true,
      score,
      team,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo evaluar producto.";

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

Write-ProjectFile "app\api\supreme\memory\route.ts" @'
import { NextResponse } from "next/server";
import {
  addSupremeDecision,
  readSupremeMemory,
} from "@/lib/vacoder/supreme/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const projectPath = String(body.projectPath || "");

    if (typeof body.decision === "string" && body.decision.trim()) {
      const memory = await addSupremeDecision(projectPath, body.decision);

      return NextResponse.json({
        ok: true,
        memory,
      });
    }

    const memory = await readSupremeMemory(projectPath);

    return NextResponse.json({
      ok: true,
      memory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer memoria.";

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

Write-ProjectFile "app\api\supreme\modules\route.ts" @'
import { NextResponse } from "next/server";
import {
  installSupremeModule,
  supremeModules,
} from "@/lib/vacoder/supreme/modules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    modules: supremeModules,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await installSupremeModule(
      String(body.projectPath || ""),
      String(body.moduleId || ""),
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo instalar modulo.";

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

Write-ProjectFile "app\api\supreme\visual-test\route.ts" @'
import { NextResponse } from "next/server";
import { runSupremeVisualTest } from "@/lib/vacoder/supreme/visual-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runSupremeVisualTest({
      projectPath: String(body.projectPath || ""),
      url: String(body.url || "http://localhost:3000"),
    });

    return NextResponse.json({
      ok: result.ok,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar visual test.";

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

Write-ProjectFile "app\api\supreme\deploy\status\route.ts" @'
import { NextResponse } from "next/server";
import { getSupremeDeployStatus } from "@/lib/vacoder/supreme/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const status = await getSupremeDeployStatus(String(body.projectPath || ""));

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar deploy status.";

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

Write-ProjectFile "app\api\supreme\deploy\vercel\route.ts" @'
import { NextResponse } from "next/server";
import { runSupremeVercelDeploy } from "@/lib/vacoder/supreme/deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await runSupremeVercelDeploy(
      String(body.projectPath || ""),
      body.production !== false,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar deploy.";

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

Write-ProjectFile "components\supreme-command-center.tsx" @'
"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

type ScoreItem = {
  area: string;
  item: string;
  status: "ok" | "warn" | "fail";
  points: number;
  max: number;
  details: string;
};

type ProductScore = {
  score: number;
  maxScore: number;
  percent: number;
  grade: string;
  readyToSell: boolean;
  items: ScoreItem[];
  missing: string[];
  recommendations: string[];
};

type TeamFinding = {
  role: string;
  title: string;
  priority: string;
  recommendation: string;
};

type SupremeModule = {
  id: string;
  name: string;
  category: string;
  description: string;
  businessValue: string;
  files: string[];
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

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Fallo solicitud: " + url);
  }

  return data as T;
}

function statusColor(status: string) {
  if (status === "ok") return "#059669";
  if (status === "warn") return "#B45309";
  return "#DC2626";
}

export default function SupremeCommandCenter() {
  const [projectPath, setProjectPath] = useState("C:\\Users\\martin\\Desktop\\VSC\\APPS\\avatares");
  const [previewUrl, setPreviewUrl] = useState("http://localhost:3000");
  const [score, setScore] = useState<ProductScore | null>(null);
  const [team, setTeam] = useState<TeamFinding[]>([]);
  const [modules, setModules] = useState<SupremeModule[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("Supreme Command Center listo.");

  function pushLog(message: string) {
    setLog((current) => "[" + new Date().toLocaleTimeString() + "] " + message + "\n" + current);
  }

  async function runProductScore() {
    setBusy(true);
    pushLog("Ejecutando Product Score...");

    try {
      const data = await postJson<{ score: ProductScore; team: TeamFinding[] }>("/api/supreme/score", {
        projectPath,
      });

      setScore(data.score);
      setTeam(data.team);
      pushLog("Product Score: " + data.score.percent + "% - " + data.score.grade);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error evaluando producto.");
    } finally {
      setBusy(false);
    }
  }

  async function loadModules() {
    setBusy(true);
    pushLog("Cargando Module Store...");

    try {
      const data = await getJson<{ modules: SupremeModule[] }>("/api/supreme/modules");
      setModules(data.modules);
      pushLog("Modulos cargados: " + data.modules.length);
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error cargando modulos.");
    } finally {
      setBusy(false);
    }
  }

  async function installModule(moduleId: string) {
    setBusy(true);
    pushLog("Registrando modulo: " + moduleId);

    try {
      const data = await postJson<{ message: string }>("/api/supreme/modules", {
        projectPath,
        moduleId,
      });

      pushLog(data.message || "Modulo registrado.");
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error instalando modulo.");
    } finally {
      setBusy(false);
    }
  }

  async function visualTest() {
    setBusy(true);
    pushLog("Ejecutando Visual Tester...");

    try {
      const data = await postJson<{ result: unknown }>("/api/supreme/visual-test", {
        projectPath,
        url: previewUrl,
      });

      pushLog(JSON.stringify(data.result, null, 2));
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error ejecutando visual test.");
    } finally {
      setBusy(false);
    }
  }

  async function deployStatus() {
    setBusy(true);
    pushLog("Consultando Deploy Status...");

    try {
      const data = await postJson<{ status: unknown }>("/api/supreme/deploy/status", {
        projectPath,
      });

      pushLog(JSON.stringify(data.status, null, 2));
    } catch (error) {
      pushLog(error instanceof Error ? error.message : "Error consultando deploy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.badge}>VACoder Supreme</p>
          <h1 style={styles.title}>Command Center para superar el mercado</h1>
          <p style={styles.text}>
            Evalua si una app esta lista para vender, activa equipo multiagente,
            registra memoria, prueba preview, prepara deploy y administra modulos premium.
          </p>
        </div>

        <div style={styles.scoreBox}>
          <span>Structural Core</span>
          <strong>10/10</strong>
          <small>Base lista para evolucionar</small>
        </div>
      </section>

      <section style={styles.grid2}>
        <div style={styles.card}>
          <h2>Proyecto objetivo</h2>

          <label style={styles.field}>
            <span>Ruta</span>
            <input value={projectPath} onChange={(event) => setProjectPath(event.target.value)} />
          </label>

          <label style={styles.field}>
            <span>Preview URL</span>
            <input value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
          </label>

          <div style={styles.actions}>
            <button type="button" disabled={busy} onClick={runProductScore}>
              Product Score
            </button>
            <button type="button" disabled={busy} onClick={visualTest}>
              Visual Test
            </button>
            <button type="button" disabled={busy} onClick={deployStatus}>
              Deploy Status
            </button>
            <button type="button" disabled={busy} onClick={loadModules}>
              Module Store
            </button>
          </div>
        </div>

        <div style={styles.cardDark}>
          <h2>Resultado ejecutivo</h2>

          {score ? (
            <>
              <div style={styles.bigScore}>{score.percent}%</div>
              <strong>{score.grade}</strong>
              <p>Score: {score.score} / {score.maxScore}</p>
              <p>{score.readyToSell ? "Lista para venta fuerte." : "Todavia faltan piezas para venta fuerte."}</p>
            </>
          ) : (
            <p>Ejecuta Product Score para medir la app como negocio digital.</p>
          )}
        </div>
      </section>

      <section style={styles.grid3}>
        <div style={styles.card}>
          <h2>Quality Gates</h2>

          {score ? (
            <div style={styles.list}>
              {score.items.map((item) => (
                <div key={item.area + item.item} style={styles.row}>
                  <span style={{ ...styles.dot, background: statusColor(item.status) }} />
                  <div>
                    <strong>{item.area} / {item.item}</strong>
                    <p>{item.points} / {item.max} - {item.details}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Sin evaluacion todavia.</p>
          )}
        </div>

        <div style={styles.card}>
          <h2>Multi-Agent Team</h2>

          <div style={styles.list}>
            {team.length ? (
              team.map((item) => (
                <div key={item.role + item.title} style={styles.agentCard}>
                  <span>{item.role} · {item.priority}</span>
                  <strong>{item.title}</strong>
                  <p>{item.recommendation}</p>
                </div>
              ))
            ) : (
              <p>El equipo se activa despues del Product Score.</p>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <h2>Module Store</h2>

          <div style={styles.list}>
            {modules.length ? (
              modules.map((module) => (
                <div key={module.id} style={styles.moduleCard}>
                  <span>{module.category}</span>
                  <strong>{module.name}</strong>
                  <p>{module.businessValue}</p>
                  <button type="button" disabled={busy} onClick={() => installModule(module.id)}>
                    Registrar modulo
                  </button>
                </div>
              ))
            ) : (
              <p>Presiona Module Store para cargar modulos premium.</p>
            )}
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2>Supreme Console</h2>
        <pre style={styles.console}>{log}</pre>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#EEF2F7",
    color: "#0B1F3A",
    padding: "32px 5vw",
    display: "grid",
    gap: 18,
  },
  hero: {
    background: "linear-gradient(135deg, #FFFFFF, #F8FAFC, #EEF2FF)",
    borderRadius: 32,
    padding: 30,
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    boxShadow: "0 22px 60px rgba(15,23,42,.08)",
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(215,38,56,.12)",
    color: "#D72638",
    fontWeight: 900,
    margin: 0,
  },
  title: {
    fontSize: 44,
    lineHeight: 1,
    margin: "14px 0",
  },
  text: {
    color: "#475569",
    lineHeight: 1.7,
    maxWidth: 880,
  },
  scoreBox: {
    minWidth: 230,
    borderRadius: 28,
    background: "#0B1F3A",
    color: "#FFFFFF",
    padding: 24,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1.2fr .8fr",
    gap: 18,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 18,
  },
  card: {
    background: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 48px rgba(15,23,42,.07)",
  },
  cardDark: {
    background: "#0B1F3A",
    color: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 18px 48px rgba(15,23,42,.12)",
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
  },
  bigScore: {
    fontSize: 76,
    fontWeight: 900,
    lineHeight: 1,
  },
  list: {
    display: "grid",
    gap: 12,
    maxHeight: 620,
    overflow: "auto",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    gap: 12,
    alignItems: "start",
    padding: 12,
    borderRadius: 16,
    background: "#F8FAFC",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 6,
  },
  agentCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 14,
    background: "#F8FAFC",
  },
  moduleCard: {
    border: "1px solid #E5E7EB",
    borderRadius: 18,
    padding: 14,
    background: "#FFFFFF",
    display: "grid",
    gap: 8,
  },
  console: {
    background: "#111827",
    color: "#E5E7EB",
    borderRadius: 18,
    padding: 18,
    minHeight: 260,
    maxHeight: 520,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontFamily: "Consolas, monospace",
  },
};
'@

Write-ProjectFile "app\supreme\page.tsx" @'
import SupremeCommandCenter from "@/components/supreme-command-center";

export default function SupremePage() {
  return <SupremeCommandCenter />;
}
'@

Write-ProjectFile "scripts\check-supreme-1.ps1" @'
$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"
Set-Location $Root

Write-Host ""
Write-Host "=== CHECK SUPREME 1 ===" -ForegroundColor Cyan
Write-Host ""

$Files = @(
  "lib\vacoder\supreme\types.ts",
  "lib\vacoder\supreme\fs.ts",
  "lib\vacoder\supreme\memory.ts",
  "lib\vacoder\supreme\product-score.ts",
  "lib\vacoder\supreme\modules.ts",
  "lib\vacoder\supreme\visual-test.ts",
  "lib\vacoder\supreme\deploy.ts",
  "lib\vacoder\supreme\team.ts",
  "app\api\supreme\score\route.ts",
  "app\api\supreme\memory\route.ts",
  "app\api\supreme\modules\route.ts",
  "app\api\supreme\visual-test\route.ts",
  "app\api\supreme\deploy\status\route.ts",
  "app\api\supreme\deploy\vercel\route.ts",
  "components\supreme-command-center.tsx",
  "app\supreme\page.tsx"
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
Write-Host "SUPREME 1 INSTALADO Y VALIDADO." -ForegroundColor Green
Write-Host ""
Write-Host "Abre: http://localhost:3000/supreme"
Write-Host ""
'@

Write-Host ""
Write-Host "SUPREME 1 instalado." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora ejecuta:"
Write-Host 'powershell -ExecutionPolicy Bypass -File ".\scripts\check-supreme-1.ps1"'
Write-Host ""