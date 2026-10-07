import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const rawName =
    body.projectName ||
    body.name ||
    body.appName ||
    body.title ||
    "vacoder-app";

  const projectName = slugify(String(rawName)) || "vacoder-app";
  const description =
    typeof body.description === "string"
      ? body.description
      : typeof body.prompt === "string"
        ? body.prompt.slice(0, 280)
        : "Aplicación generada por VACoder Agent OS.";

  return NextResponse.json({
    ok: true,
    status: "preview-ready",
    projectName,
    description,
    destination: `C:\\Users\\martin\\Desktop\\VSC\\APPS\\${projectName}`,
    routes: [
      "/",
      "/dashboard",
      "/admin",
      "/api/health",
    ],
    files: [
      "package.json",
      "app/layout.tsx",
      "app/page.tsx",
      "app/globals.css",
      "app/api/health/route.ts",
    ],
    warnings: [
      "Este endpoint evita el error 404/build y devuelve un blueprint seguro.",
      "La creación física del proyecto se realiza en /api/project/builder/create.",
    ],
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "builder-preview-ready",
    message: "Endpoint de preview del Project Builder activo.",
  });
}
