import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPS_ROOT = "C:\\Users\\martin\\Desktop\\VSC\\APPS";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

async function exists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function assertSafeAppPath(projectPath: string) {
  const resolvedRoot = path.resolve(APPS_ROOT);
  const resolvedProject = path.resolve(projectPath);

  if (!resolvedProject.toLowerCase().startsWith(resolvedRoot.toLowerCase())) {
    throw new Error("Ruta insegura. Solo se permite crear apps dentro de C:\\Users\\martin\\Desktop\\VSC\\APPS");
  }

  return resolvedProject;
}

async function writeFileSafe(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function packageJson(projectName: string) {
  return JSON.stringify(
    {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        typecheck: "tsc --noEmit"
      },
      dependencies: {
        next: "15.5.18",
        react: "19.1.0",
        "react-dom": "19.1.0"
      },
      devDependencies: {
        "@types/node": "24.10.1",
        "@types/react": "19.1.12",
        "@types/react-dom": "19.1.9",
        eslint: "9.39.1",
        "eslint-config-next": "15.5.18",
        typescript: "5.8.2"
      }
    },
    null,
    2
  );
}

function layoutSource(title: string) {
  return `import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: ${JSON.stringify(title)},
  description: "Aplicación creada por VACoder Agent OS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
`;
}

function pageSource(title: string, description: string) {
  return `export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="badge">VACoder App</p>
        <h1>${title}</h1>
        <p>${description}</p>
        <a href="/dashboard" className="button">
          Abrir dashboard
        </a>
      </section>
    </main>
  );
}
`;
}

const globalsCss = `:root {
  --blue: #0B1F3A;
  --blue-2: #123B6D;
  --red: #D72638;
  --bg: #F5F7FA;
  --text: #1F2937;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.hero {
  width: 100%;
  max-width: 980px;
  border-radius: 32px;
  padding: 48px;
  background: linear-gradient(135deg, var(--blue), var(--blue-2));
  color: white;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
}

.badge {
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(215, 38, 56, 0.18);
  color: white;
  font-weight: 800;
}

h1 {
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  line-height: 1;
  margin: 18px 0;
}

p {
  line-height: 1.7;
  color: rgba(255,255,255,0.86);
}

.button {
  display: inline-flex;
  margin-top: 18px;
  padding: 14px 20px;
  border-radius: 14px;
  background: var(--red);
  color: white;
  text-decoration: none;
  font-weight: 900;
}
`;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const rawName =
      body.projectName ||
      body.name ||
      body.appName ||
      body.title ||
      "vacoder-app";

    const projectName = slugify(String(rawName)) || "vacoder-app";
    const title = String(body.title || body.projectName || projectName);
    const description =
      typeof body.description === "string"
        ? body.description
        : typeof body.prompt === "string"
          ? body.prompt.slice(0, 220)
          : "Aplicación profesional creada por VACoder Agent OS.";

    const projectPath = assertSafeAppPath(path.join(APPS_ROOT, projectName));

    if (await exists(projectPath)) {
      return NextResponse.json(
        {
          ok: false,
          error: "La carpeta del proyecto ya existe.",
          projectPath,
        },
        { status: 409 },
      );
    }

    await fs.mkdir(projectPath, { recursive: true });

    await writeFileSafe(path.join(projectPath, "package.json"), packageJson(projectName));
    await writeFileSafe(path.join(projectPath, "tsconfig.json"), JSON.stringify({
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }]
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"]
    }, null, 2));

    await writeFileSafe(path.join(projectPath, "next.config.ts"), `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
`);

    await writeFileSafe(path.join(projectPath, "app", "layout.tsx"), layoutSource(title));
    await writeFileSafe(path.join(projectPath, "app", "page.tsx"), pageSource(title, description));
    await writeFileSafe(path.join(projectPath, "app", "globals.css"), globalsCss);
    await writeFileSafe(path.join(projectPath, "app", "dashboard", "page.tsx"), `export default function DashboardPage() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Dashboard</h1>
      <p>Panel inicial generado por VACoder Agent OS.</p>
    </main>
  );
}
`);

    await writeFileSafe(path.join(projectPath, "app", "api", "health", "route.ts"), `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "healthy",
    app: ${JSON.stringify(projectName)},
    updatedAt: new Date().toISOString(),
  });
}
`);

    return NextResponse.json({
      ok: true,
      status: "created",
      projectName,
      projectPath,
      files: [
        "package.json",
        "tsconfig.json",
        "next.config.ts",
        "app/layout.tsx",
        "app/page.tsx",
        "app/globals.css",
        "app/dashboard/page.tsx",
        "app/api/health/route.ts",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el proyecto.";

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
    status: "builder-create-ready",
    message: "Endpoint de creación del Project Builder activo.",
  });
}
