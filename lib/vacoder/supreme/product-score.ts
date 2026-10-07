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
