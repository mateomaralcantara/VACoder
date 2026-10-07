$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

if (!(Test-Path $Root)) {
    throw "No existe Coder en: $Root"
}

Set-Location $Root

$BackupDir = Join-Path $Root (
    "_backup-live1-saas-" + (Get-Date -Format "yyyyMMdd-HHmmss")
)

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

function Backup-File {
    param([string]$RelativePath)

    $Source = Join-Path $Root $RelativePath

    if (Test-Path $Source) {
        $Destination = Join-Path $BackupDir $RelativePath
        $DestinationDir = Split-Path $Destination -Parent

        New-Item `
            -ItemType Directory `
            -Force `
            -Path $DestinationDir |
            Out-Null

        Copy-Item `
            -LiteralPath $Source `
            -Destination $Destination `
            -Force
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

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $Dir |
        Out-Null

    Set-Content `
        -LiteralPath $FullPath `
        -Value $Content `
        -Encoding UTF8

    Write-Host "[OK] $RelativePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " BLOQUE 1 - LIVE SAAS CORE" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup: $BackupDir"
Write-Host ""

Write-Host "Instalando dependencias Supabase..." -ForegroundColor Cyan

npm install @supabase/supabase-js @supabase/ssr

if ($LASTEXITCODE -ne 0) {
    throw "npm install fallo."
}

# =========================================================
# ENV
# =========================================================

Write-ProjectFile ".env.live1.example" @'
# VACoder LIVE SaaS Core

NEXT_PUBLIC_SUPABASE_URL=

# Llave publica recomendada por tu proyecto Supabase.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Compatibilidad con proyectos que todavia muestran ANON KEY.
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

NEXT_PUBLIC_SITE_URL=http://localhost:3000
'@

# =========================================================
# SUPABASE ENV
# =========================================================

Write-ProjectFile "lib\supabase\env.ts" @'
export type SupabasePublicEnv = {
  url: string;
  key: string;
  configured: boolean;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  return {
    url,
    key,
    configured: Boolean(url && key),
  };
}
'@

# =========================================================
# SUPABASE SERVER CLIENT
# =========================================================

Write-ProjectFile "lib\supabase\server.ts" @'
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const env = getSupabasePublicEnv();

  if (!env.configured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          for (const item of cookiesToSet) {
            cookieStore.set(item.name, item.value, item.options);
          }
        } catch {
          // Un Server Component puede no permitir escritura de cookies.
          // El middleware se encarga de refrescarlas cuando sea necesario.
        }
      },
    },
  });
}
'@

# =========================================================
# BROWSER CLIENT
# =========================================================

Write-ProjectFile "lib\supabase\client.ts" @'
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    throw new Error(
      "Supabase no esta configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y la llave publica.",
    );
  }

  return createBrowserClient(url, key);
}
'@

# =========================================================
# MIDDLEWARE CLIENT
# =========================================================

Write-ProjectFile "lib\supabase\middleware.ts" @'
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSupabaseSession(request: NextRequest) {
  const env = getSupabasePublicEnv();

  let response = NextResponse.next({
    request,
  });

  if (!env.configured) {
    return {
      response,
      user: null,
      configured: false,
    };
  }

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        for (const item of cookiesToSet) {
          request.cookies.set(item.name, item.value);
        }

        response = NextResponse.next({
          request,
        });

        for (const item of cookiesToSet) {
          response.cookies.set(item.name, item.value, item.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user,
    configured: true,
  };
}
'@

# =========================================================
# ROOT MIDDLEWARE
# =========================================================

Write-ProjectFile "middleware.ts" @'
import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function redirectPreservingCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;

  const redirectResponse = NextResponse.redirect(redirectUrl);

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const result = await updateSupabaseSession(request);

  const pathname = request.nextUrl.pathname;

  const protectedRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");

  const authRoute =
    pathname === "/login" ||
    pathname === "/signup";

  if (protectedRoute && !result.configured) {
    return redirectPreservingCookies(
      request,
      result.response,
      "/setup",
    );
  }

  if (protectedRoute && !result.user) {
    return redirectPreservingCookies(
      request,
      result.response,
      "/login",
    );
  }

  if (authRoute && result.user) {
    return redirectPreservingCookies(
      request,
      result.response,
      "/dashboard",
    );
  }

  return result.response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
  ],
};
'@

# =========================================================
# AUTH / ACCESS
# =========================================================

Write-ProjectFile "lib\live1\auth.ts" @'
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireLiveUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/setup");
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return {
    supabase,
    user,
  };
}

export async function getOptionalLiveUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      supabase: null,
      user: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}
'@

# =========================================================
# DATA ACCESS
# =========================================================

Write-ProjectFile "lib\live1\data.ts" @'
import { requireLiveUser } from "@/lib/live1/auth";

export type LiveOrganization = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  role: string;
};

export type LiveProject = {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  framework: string | null;
  repository_url: string | null;
  default_branch: string;
  created_at: string;
};

export async function getLiveOrganizations() {
  const { supabase, user } = await requireLiveUser();

  const { data: memberships, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id);

  if (membershipError) {
    return [];
  }

  const ids = Array.from(
    new Set(
      (memberships || [])
        .map((row) => row.organization_id)
        .filter(Boolean),
    ),
  );

  if (!ids.length) {
    return [];
  }

  const { data: organizations, error } =
    await supabase
      .from("organizations")
      .select("id, name, slug, owner_id, plan")
      .in("id", ids)
      .order("created_at", {
        ascending: true,
      });

  if (error) {
    return [];
  }

  return (organizations || []).map((organization) => {
    const membership = (memberships || []).find(
      (row) => row.organization_id === organization.id,
    );

    return {
      ...organization,
      role: membership?.role || "viewer",
    } as LiveOrganization;
  });
}

export async function getLiveProjects() {
  const { supabase } = await requireLiveUser();

  const { data, error } =
    await supabase
      .from("projects")
      .select(
        "id, organization_id, owner_id, name, slug, description, status, framework, repository_url, default_branch, created_at",
      )
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    return [];
  }

  return (data || []) as LiveProject[];
}

export async function getLiveProject(projectId: string) {
  const { supabase } = await requireLiveUser();

  const { data, error } =
    await supabase
      .from("projects")
      .select(
        "id, organization_id, owner_id, name, slug, description, status, framework, repository_url, default_branch, created_at",
      )
      .eq("id", projectId)
      .maybeSingle();

  if (error) {
    return null;
  }

  return data as LiveProject | null;
}
'@

# =========================================================
# AUTH ACTIONS
# =========================================================

Write-ProjectFile "app\login\actions.ts" @'
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/setup");
  }

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      "/login?error=" +
        encodeURIComponent(error.message),
    );
  }

  redirect("/dashboard");
}
'@

Write-ProjectFile "app\signup\actions.ts" @'
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/setup");
  }

  const fullName =
    String(formData.get("fullName") || "").trim();

  const email =
    String(formData.get("email") || "").trim();

  const password =
    String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/signup?error=missing");
  }

  const { data, error } =
    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

  if (error) {
    redirect(
      "/signup?error=" +
        encodeURIComponent(error.message),
    );
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/login?registered=1");
}
'@

# =========================================================
# DASHBOARD ACTIONS
# =========================================================

Write-ProjectFile "app\dashboard\actions.ts" @'
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveUser } from "@/lib/live1/auth";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniqueSlug(name: string) {
  const base = slugify(name) || "workspace";

  const suffix =
    Math.random()
      .toString(36)
      .slice(2, 8);

  return base + "-" + suffix;
}

export async function signOutAction() {
  const { supabase } = await requireLiveUser();

  await supabase.auth.signOut();

  redirect("/login");
}

export async function createOrganizationAction(
  formData: FormData,
) {
  const { supabase, user } = await requireLiveUser();

  const name =
    String(formData.get("name") || "").trim();

  if (!name) {
    throw new Error(
      "El nombre de la organizacion es obligatorio.",
    );
  }

  const slug = uniqueSlug(name);

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from("organizations")
      .insert({
        name,
        slug,
        owner_id: user.id,
        plan: "free",
      })
      .select("id")
      .single();

  if (organizationError || !organization) {
    throw new Error(
      organizationError?.message ||
        "No se pudo crear la organizacion.",
    );
  }

  const { error: memberError } =
    await supabase
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: "owner",
      });

  if (memberError) {
    throw new Error(memberError.message);
  }

  await supabase
    .from("subscriptions")
    .insert({
      organization_id: organization.id,
      plan: "free",
      status: "active",
    });

  await supabase
    .from("credits")
    .insert({
      organization_id: organization.id,
      balance: 0,
    });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");

  redirect("/dashboard/projects/new");
}

export async function createProjectAction(
  formData: FormData,
) {
  const { supabase, user } = await requireLiveUser();

  const organizationId =
    String(
      formData.get("organizationId") || "",
    ).trim();

  const name =
    String(formData.get("name") || "").trim();

  const description =
    String(
      formData.get("description") || "",
    ).trim();

  const framework =
    String(
      formData.get("framework") || "nextjs",
    ).trim();

  if (!organizationId || !name) {
    throw new Error(
      "Organizacion y nombre son obligatorios.",
    );
  }

  const slug = uniqueSlug(name);

  const {
    data: project,
    error,
  } =
    await supabase
      .from("projects")
      .insert({
        organization_id: organizationId,
        owner_id: user.id,
        name,
        slug,
        description:
          description || null,
        status: "draft",
        framework:
          framework || "nextjs",
        default_branch: "main",
      })
      .select("id")
      .single();

  if (error || !project) {
    throw new Error(
      error?.message ||
        "No se pudo crear el proyecto.",
    );
  }

  await supabase
    .from("project_members")
    .insert({
      organization_id: organizationId,
      project_id: project.id,
      user_id: user.id,
      role: "owner",
    });

  await supabase
    .from("project_memory")
    .insert({
      organization_id: organizationId,
      project_id: project.id,
      product_goal:
        "Convertir el proyecto en una aplicacion premium lista para vender.",
      memory: {},
    });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");

  redirect(
    "/dashboard/projects/" + project.id,
  );
}
'@

# =========================================================
# AUTH UI
# =========================================================

Write-ProjectFile "app\login\page.tsx" @'
import Link from "next/link";
import { signInAction } from "@/app/login/actions";

const cardStyle: React.CSSProperties = {
  width: "min(460px, 92vw)",
  background: "#FFFFFF",
  borderRadius: 28,
  padding: 30,
  boxShadow: "0 24px 70px rgba(15,23,42,.12)",
};

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg,#061427,#0B1F3A,#1D4ED8)",
      }}
    >
      <section style={cardStyle}>
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
            margin: 0,
          }}
        >
          VACoder LIVE
        </p>

        <h1>Entrar a Coder</h1>

        <p style={{ color: "#64748B" }}>
          Accede a tus organizaciones,
          proyectos y agentes.
        </p>

        <form
          action={signInAction}
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <label>
            <strong>Email</strong>
            <input
              name="email"
              type="email"
              required
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <label>
            <strong>Contrasena</strong>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              padding: 13,
              border: 0,
              borderRadius: 14,
              background: "#D72638",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>
        </form>

        <p>
          No tienes cuenta?{" "}
          <Link href="/signup">
            Crear cuenta
          </Link>
        </p>
      </section>
    </main>
  );
}
'@

Write-ProjectFile "app\signup\page.tsx" @'
import Link from "next/link";
import { signUpAction } from "@/app/signup/actions";

export default function SignupPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg,#061427,#0B1F3A,#1D4ED8)",
      }}
    >
      <section
        style={{
          width: "min(480px,92vw)",
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 30,
          boxShadow:
            "0 24px 70px rgba(15,23,42,.12)",
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          VACoder LIVE
        </p>

        <h1>Crear cuenta</h1>

        <form
          action={signUpAction}
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          <label>
            <strong>Nombre</strong>
            <input
              name="fullName"
              type="text"
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <label>
            <strong>Email</strong>
            <input
              name="email"
              type="email"
              required
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <label>
            <strong>Contrasena</strong>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 6,
                borderRadius: 12,
                border: "1px solid #CBD5E1",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              padding: 13,
              border: 0,
              borderRadius: 14,
              background: "#D72638",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Crear cuenta
          </button>
        </form>

        <p>
          Ya tienes cuenta?{" "}
          <Link href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
'@

# =========================================================
# SETUP PAGE
# =========================================================

Write-ProjectFile "app\setup\page.tsx" @'
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const env = getSupabasePublicEnv();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#EEF2F7",
        padding: "40px 6vw",
        color: "#0B1F3A",
      }}
    >
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#FFFFFF",
          padding: 30,
          borderRadius: 28,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          LIVE 1 SETUP
        </p>

        <h1>Configurar Coder SaaS Core</h1>

        <p>
          Estado de variables:{" "}
          <strong>
            {env.configured
              ? "CONFIGURADAS"
              : "PENDIENTES"}
          </strong>
        </p>

        <h2>Variables requeridas</h2>

        <pre
          style={{
            background: "#111827",
            color: "#E5E7EB",
            padding: 18,
            borderRadius: 16,
            overflow: "auto",
          }}
        >
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
        </pre>

        <h2>Migration SQL</h2>

        <p>
          Ejecuta el archivo:
        </p>

        <pre
          style={{
            background: "#F8FAFC",
            padding: 16,
            borderRadius: 14,
          }}
        >
          supabase/migrations/20260817_live1_saas_core.sql
        </pre>
      </section>
    </main>
  );
}
'@

# =========================================================
# DASHBOARD LAYOUT
# =========================================================

Write-ProjectFile "app\dashboard\layout.tsx" @'
import Link from "next/link";
import type { ReactNode } from "react";
import { requireLiveUser } from "@/lib/live1/auth";
import { signOutAction } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireLiveUser();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#EEF2F7",
        color: "#0B1F3A",
      }}
    >
      <header
        style={{
          padding: "14px 4vw",
          background: "#061427",
          color: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 22 }}>
            VACoder LIVE
          </strong>

          <span
            style={{
              marginLeft: 12,
              color: "#93C5FD",
            }}
          >
            {user.email}
          </span>
        </div>

        <nav
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/dashboard"
            style={navStyle}
          >
            Inicio
          </Link>

          <Link
            href="/dashboard/projects"
            style={navStyle}
          >
            Proyectos
          </Link>

          <Link
            href="/dashboard/team"
            style={navStyle}
          >
            Equipo
          </Link>

          <Link
            href="/dashboard/billing"
            style={navStyle}
          >
            Billing
          </Link>

          <Link
            href="/supreme"
            style={navStyle}
          >
            Supreme
          </Link>

          <Link
            href="/runtime"
            style={navStyle}
          >
            Runtime
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                ...navStyle,
                border: "1px solid rgba(255,255,255,.15)",
                cursor: "pointer",
              }}
            >
              Salir
            </button>
          </form>
        </nav>
      </header>

      <section
        style={{
          padding: "28px 4vw 60px",
        }}
      >
        {children}
      </section>
    </main>
  );
}

const navStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "9px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,.08)",
  color: "#FFFFFF",
  textDecoration: "none",
  fontWeight: 800,
};
'@

# =========================================================
# DASHBOARD HOME
# =========================================================

Write-ProjectFile "app\dashboard\page.tsx" @'
import Link from "next/link";
import {
  getLiveOrganizations,
  getLiveProjects,
} from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [organizations, projects] =
    await Promise.all([
      getLiveOrganizations(),
      getLiveProjects(),
    ]);

  return (
    <div
      style={{
        display: "grid",
        gap: 20,
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg,#FFFFFF,#F8FAFC,#EEF2FF)",
          borderRadius: 30,
          padding: 28,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          LIVE CONTROL PLANE
        </p>

        <h1
          style={{
            fontSize: 42,
            margin: "8px 0",
          }}
        >
          Coder SaaS Dashboard
        </h1>

        <p style={{ color: "#64748B" }}>
          Usuarios, organizaciones y proyectos
          persistentes.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 14,
        }}
      >
        <Metric
          title="Organizaciones"
          value={organizations.length}
        />

        <Metric
          title="Proyectos"
          value={projects.length}
        />

        <Metric
          title="Runtime"
          value="Supreme 2"
        />

        <Metric
          title="SaaS Core"
          value="LIVE 1"
        />
      </section>

      {!organizations.length ? (
        <section style={cardStyle}>
          <h2>Crea tu primera organizacion</h2>

          <p>
            Antes de crear proyectos necesitas
            un workspace.
          </p>

          <Link href="/dashboard/team">
            Crear organizacion
          </Link>
        </section>
      ) : null}

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: "#D72638",
                fontWeight: 900,
              }}
            >
              PROJECTS
            </p>

            <h2>Proyectos recientes</h2>
          </div>

          <Link href="/dashboard/projects/new">
            Nuevo proyecto
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {projects.slice(0, 8).map((project) => (
            <Link
              key={project.id}
              href={
                "/dashboard/projects/" +
                project.id
              }
              style={{
                padding: 14,
                borderRadius: 16,
                border: "1px solid #E5E7EB",
                textDecoration: "none",
                color: "#0B1F3A",
              }}
            >
              <strong>{project.name}</strong>

              <div
                style={{
                  color: "#64748B",
                  marginTop: 5,
                }}
              >
                {project.status} ·{" "}
                {project.framework || "unknown"}
              </div>
            </Link>
          ))}

          {!projects.length ? (
            <p>No hay proyectos todavia.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <article style={cardStyle}>
      <span style={{ color: "#64748B" }}>
        {title}
      </span>

      <strong
        style={{
          display: "block",
          fontSize: 30,
          marginTop: 8,
        }}
      >
        {value}
      </strong>
    </article>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 24,
  padding: 20,
  boxShadow:
    "0 16px 45px rgba(15,23,42,.06)",
};
'@

# =========================================================
# PROJECTS LIST
# =========================================================

Write-ProjectFile "app\dashboard\projects\page.tsx" @'
import Link from "next/link";
import { getLiveProjects } from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getLiveProjects();

  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 28,
        padding: 26,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              color: "#D72638",
              fontWeight: 900,
            }}
          >
            CONTROL PLANE
          </p>

          <h1>Proyectos</h1>
        </div>

        <Link href="/dashboard/projects/new">
          Crear proyecto
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 20,
        }}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={
              "/dashboard/projects/" +
              project.id
            }
            style={{
              padding: 16,
              borderRadius: 18,
              border: "1px solid #E5E7EB",
              textDecoration: "none",
              color: "#0B1F3A",
            }}
          >
            <strong>{project.name}</strong>

            <p style={{ color: "#64748B" }}>
              {project.description ||
                "Sin descripcion"}
            </p>

            <small>
              {project.status} ·{" "}
              {project.default_branch}
            </small>
          </Link>
        ))}

        {!projects.length ? (
          <p>No hay proyectos registrados.</p>
        ) : null}
      </div>
    </section>
  );
}
'@

# =========================================================
# NEW PROJECT
# =========================================================

Write-ProjectFile "app\dashboard\projects\new\page.tsx" @'
import Link from "next/link";
import { getLiveOrganizations } from "@/lib/live1/data";
import { createProjectAction } from "@/app/dashboard/actions";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const organizations =
    await getLiveOrganizations();

  if (!organizations.length) {
    return (
      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 28,
        }}
      >
        <h1>No existe una organizacion</h1>

        <p>
          Crea primero tu workspace.
        </p>

        <Link href="/dashboard/team">
          Ir a Equipo
        </Link>
      </section>
    );
  }

  return (
    <section
      style={{
        maxWidth: 760,
        background: "#FFFFFF",
        borderRadius: 28,
        padding: 28,
      }}
    >
      <p
        style={{
          color: "#D72638",
          fontWeight: 900,
        }}
      >
        NEW PROJECT
      </p>

      <h1>Crear proyecto SaaS</h1>

      <form
        action={createProjectAction}
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        <label>
          <strong>Organizacion</strong>

          <select
            name="organizationId"
            required
            style={inputStyle}
          >
            {organizations.map(
              (organization) => (
                <option
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <strong>Nombre</strong>

          <input
            name="name"
            required
            style={inputStyle}
          />
        </label>

        <label>
          <strong>Descripcion</strong>

          <textarea
            name="description"
            rows={5}
            style={inputStyle}
          />
        </label>

        <label>
          <strong>Framework</strong>

          <select
            name="framework"
            style={inputStyle}
            defaultValue="nextjs"
          >
            <option value="nextjs">
              Next.js
            </option>

            <option value="react">
              React
            </option>

            <option value="vite">
              Vite
            </option>

            <option value="node">
              Node
            </option>
          </select>
        </label>

        <button
          type="submit"
          style={{
            padding: 14,
            border: 0,
            borderRadius: 14,
            background: "#D72638",
            color: "#FFFFFF",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Crear proyecto
        </button>
      </form>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 7,
  borderRadius: 12,
  border: "1px solid #CBD5E1",
};
'@

# =========================================================
# PROJECT DETAIL
# =========================================================

Write-ProjectFile "app\dashboard\projects\[id]\page.tsx" @'
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLiveProject } from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const project =
    await getLiveProject(id);

  if (!project) {
    notFound();
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg,#FFFFFF,#EEF2FF)",
          borderRadius: 30,
          padding: 28,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          PROJECT CONTROL PLANE
        </p>

        <h1
          style={{
            fontSize: 42,
            marginBottom: 5,
          }}
        >
          {project.name}
        </h1>

        <p style={{ color: "#64748B" }}>
          {project.description ||
            "Sin descripcion"}
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 14,
        }}
      >
        <Metric
          name="Project ID"
          value={project.id}
        />

        <Metric
          name="Status"
          value={project.status}
        />

        <Metric
          name="Framework"
          value={
            project.framework || "unknown"
          }
        />

        <Metric
          name="Branch"
          value={project.default_branch}
        />

        <Metric
          name="Repository"
          value={
            project.repository_url ||
            "Not connected"
          }
        />

        <Metric
          name="Runtime"
          value="Not attached"
        />
      </section>

      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 24,
          padding: 22,
        }}
      >
        <h2>Siguiente evolucion</h2>

        <p>
          En Bloque 2 este Project ID
          reemplazara progresivamente las rutas
          locales de Windows.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link href="/market">
            Market
          </Link>

          <Link href="/supreme">
            Supreme
          </Link>

          <Link href="/runtime">
            Runtime
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return (
    <article
      style={{
        background: "#FFFFFF",
        borderRadius: 20,
        padding: 18,
        wordBreak: "break-word",
      }}
    >
      <span style={{ color: "#64748B" }}>
        {name}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 8,
        }}
      >
        {value}
      </strong>
    </article>
  );
}
'@

# =========================================================
# TEAM / ORGANIZATIONS
# =========================================================

Write-ProjectFile "app\dashboard\team\page.tsx" @'
import {
  createOrganizationAction,
} from "@/app/dashboard/actions";
import {
  getLiveOrganizations,
} from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const organizations =
    await getLiveOrganizations();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(320px,.8fr) minmax(360px,1.2fr)",
        gap: 18,
      }}
    >
      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 24,
        }}
      >
        <p
          style={{
            color: "#D72638",
            fontWeight: 900,
          }}
        >
          ORGANIZATIONS
        </p>

        <h1>Crear workspace</h1>

        <form
          action={createOrganizationAction}
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <label>
            <strong>Nombre</strong>

            <input
              name="name"
              required
              placeholder="Mi empresa"
              style={{
                width: "100%",
                marginTop: 7,
                padding: 12,
                borderRadius: 12,
                border:
                  "1px solid #CBD5E1",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              border: 0,
              borderRadius: 14,
              padding: 13,
              background: "#D72638",
              color: "#FFFFFF",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Crear organizacion
          </button>
        </form>
      </section>

      <section
        style={{
          background: "#FFFFFF",
          borderRadius: 28,
          padding: 24,
        }}
      >
        <h2>Mis organizaciones</h2>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {organizations.map(
            (organization) => (
              <article
                key={organization.id}
                style={{
                  border:
                    "1px solid #E5E7EB",
                  padding: 14,
                  borderRadius: 16,
                }}
              >
                <strong>
                  {organization.name}
                </strong>

                <p>
                  Role: {organization.role}
                </p>

                <small>
                  Plan: {organization.plan}
                </small>
              </article>
            ),
          )}

          {!organizations.length ? (
            <p>
              Aun no perteneces a ninguna
              organizacion.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
'@

# =========================================================
# BILLING
# =========================================================

Write-ProjectFile "app\dashboard\billing\page.tsx" @'
import { getLiveOrganizations } from "@/lib/live1/data";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const organizations =
    await getLiveOrganizations();

  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 28,
        padding: 28,
      }}
    >
      <p
        style={{
          color: "#D72638",
          fontWeight: 900,
        }}
      >
        BILLING FOUNDATION
      </p>

      <h1>Planes y consumo</h1>

      <p>
        La estructura de subscriptions,
        credits y usage_events queda creada
        en LIVE 1.
      </p>

      <div
        style={{
          display: "grid",
          gap: 10,
          marginTop: 20,
        }}
      >
        {organizations.map(
          (organization) => (
            <article
              key={organization.id}
              style={{
                border:
                  "1px solid #E5E7EB",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <strong>
                {organization.name}
              </strong>

              <p>
                Plan actual:{" "}
                {organization.plan}
              </p>
            </article>
          ),
        )}
      </div>
    </section>
  );
}
'@

# =========================================================
# HEALTH API
# =========================================================

Write-ProjectFile "app\api\live1\health\route.ts" @'
import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = getSupabasePublicEnv();

  if (!env.configured) {
    return NextResponse.json({
      ok: true,
      version: "LIVE-1",
      configured: false,
      schemaReady: false,
      message:
        "Codigo LIVE 1 instalado. Faltan variables Supabase.",
    });
  }

  const supabase =
    await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      version: "LIVE-1",
      configured: false,
      schemaReady: false,
    });
  }

  const { error } =
    await supabase
      .from("organizations")
      .select("id")
      .limit(1);

  return NextResponse.json({
    ok: true,
    version: "LIVE-1",
    configured: true,
    schemaReady: !error,
    databaseError:
      error?.message || null,
  });
}
'@

# =========================================================
# CURRENT USER API
# =========================================================

Write-ProjectFile "app\api\live1\me\route.ts" @'
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase =
    await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase no configurado.",
      },
      {
        status: 503,
      },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
      },
      {
        status: 401,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
  });
}
'@

# =========================================================
# PROJECT API
# =========================================================

Write-ProjectFile "app\api\live1\projects\route.ts" @'
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function GET() {
  const supabase =
    await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase no configurado.",
      },
      {
        status: 503,
      },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const { data, error } =
    await supabase
      .from("projects")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    projects: data || [],
  });
}

export async function POST(
  request: Request,
) {
  const supabase =
    await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase no configurado.",
      },
      {
        status: 503,
      },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    await request.json().catch(() => ({}));

  const organizationId =
    String(
      body.organizationId || "",
    ).trim();

  const name =
    String(body.name || "").trim();

  if (!organizationId || !name) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "organizationId y name son obligatorios.",
      },
      {
        status: 400,
      },
    );
  }

  const slug =
    (slugify(name) || "project") +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 8);

  const {
    data,
    error,
  } =
    await supabase
      .from("projects")
      .insert({
        organization_id:
          organizationId,
        owner_id: user.id,
        name,
        slug,
        description:
          body.description || null,
        framework:
          body.framework || "nextjs",
        status: "draft",
        default_branch: "main",
      })
      .select("*")
      .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    project: data,
  });
}
'@

# =========================================================
# SQL MIGRATION
# =========================================================

Write-ProjectFile "supabase\migrations\20260817_live1_saas_core.sql" @'
begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free','pro','business','agency','enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner','admin','developer','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  owner_id uuid not null
    references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'planning',
        'active',
        'building',
        'testing',
        'deploying',
        'healthy',
        'failed',
        'archived'
      )
    ),
  framework text,
  repository_url text,
  default_branch text not null default 'main',
  runtime_provider text,
  preview_url text,
  production_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.project_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'developer'
    check (role in ('owner','admin','developer','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  status text not null default 'queued',
  prompt text,
  model text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  run_id uuid not null
    references public.agent_runs(id) on delete cascade,
  role text,
  title text not null,
  status text not null default 'queued',
  position integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  run_id uuid
    references public.agent_runs(id) on delete set null,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  status text not null default 'created',
  summary text,
  risk text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_set_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  change_set_id uuid not null
    references public.change_sets(id) on delete cascade,
  path text not null,
  action text not null,
  before_content text,
  after_content text,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  provider text not null default 'local',
  provider_runtime_id text,
  status text not null default 'queued',
  port integer,
  preview_url text,
  started_at timestamptz,
  stopped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_logs (
  id bigint generated by default as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  runtime_session_id uuid not null
    references public.runtime_sessions(id) on delete cascade,
  stream text not null default 'stdout',
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_memory (
  project_id uuid primary key
    references public.projects(id) on delete cascade,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  product_goal text,
  memory jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid
    references auth.users(id) on delete set null,
  decision text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_todos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid
    references auth.users(id) on delete set null,
  provider text not null,
  environment text not null default 'preview',
  status text not null default 'queued',
  deployment_url text,
  provider_deployment_id text,
  commit_sha text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.organizations(id) on delete cascade,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated by default as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid
    references public.projects(id) on delete set null,
  user_id uuid
    references auth.users(id) on delete set null,
  event_type text not null,
  quantity numeric(14,4) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.credits (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  balance numeric(14,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid
    references public.projects(id) on delete set null,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  result text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_org
  on public.projects(organization_id);

create index if not exists idx_agent_runs_project
  on public.agent_runs(project_id);

create index if not exists idx_agent_tasks_run
  on public.agent_tasks(run_id);

create index if not exists idx_runtime_project
  on public.runtime_sessions(project_id);

create index if not exists idx_runtime_logs_session
  on public.runtime_logs(runtime_session_id);

create index if not exists idx_deployments_project
  on public.deployments(project_id);

create index if not exists idx_usage_org
  on public.usage_events(organization_id);

create index if not exists idx_audit_org
  on public.audit_logs(organization_id);

-- ======================================================
-- UPDATED_AT
-- ======================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated
  on public.profiles;

create trigger trg_profiles_updated
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_organizations_updated
  on public.organizations;

create trigger trg_organizations_updated
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated
  on public.projects;

create trigger trg_projects_updated
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated
  on public.subscriptions;

create trigger trg_subscriptions_updated
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ======================================================
-- PROFILE CREATION
-- ======================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ======================================================
-- SECURITY HELPERS
-- ======================================================

create or replace function public.is_org_member(
  target_org uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(
  target_org uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.role in ('owner','admin')
  )
  or exists (
    select 1
    from public.organizations o
    where o.id = target_org
      and o.owner_id = auth.uid()
  );
$$;

grant execute
  on function public.is_org_member(uuid)
  to authenticated;

grant execute
  on function public.is_org_admin(uuid)
  to authenticated;

-- ======================================================
-- RLS
-- ======================================================

alter table public.profiles
  enable row level security;

alter table public.organizations
  enable row level security;

alter table public.organization_members
  enable row level security;

alter table public.projects
  enable row level security;

alter table public.project_members
  enable row level security;

alter table public.agent_runs
  enable row level security;

alter table public.agent_tasks
  enable row level security;

alter table public.change_sets
  enable row level security;

alter table public.change_set_files
  enable row level security;

alter table public.runtime_sessions
  enable row level security;

alter table public.runtime_logs
  enable row level security;

alter table public.project_memory
  enable row level security;

alter table public.project_decisions
  enable row level security;

alter table public.project_todos
  enable row level security;

alter table public.deployments
  enable row level security;

alter table public.subscriptions
  enable row level security;

alter table public.usage_events
  enable row level security;

alter table public.credits
  enable row level security;

alter table public.audit_logs
  enable row level security;

-- Profiles

drop policy if exists profiles_read_self
  on public.profiles;

create policy profiles_read_self
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_self
  on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Organizations

drop policy if exists organizations_select
  on public.organizations;

create policy organizations_select
on public.organizations
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_org_member(id)
);

drop policy if exists organizations_insert
  on public.organizations;

create policy organizations_insert
on public.organizations
for insert
to authenticated
with check (
  owner_id = auth.uid()
);

drop policy if exists organizations_update
  on public.organizations;

create policy organizations_update
on public.organizations
for update
to authenticated
using (
  public.is_org_admin(id)
)
with check (
  public.is_org_admin(id)
);

drop policy if exists organizations_delete
  on public.organizations;

create policy organizations_delete
on public.organizations
for delete
to authenticated
using (
  owner_id = auth.uid()
);

-- Organization Members

drop policy if exists organization_members_select
  on public.organization_members;

create policy organization_members_select
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

drop policy if exists organization_members_insert
  on public.organization_members;

create policy organization_members_insert
on public.organization_members
for insert
to authenticated
with check (
  public.is_org_admin(organization_id)
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_id
        and o.owner_id = auth.uid()
    )
  )
);

drop policy if exists organization_members_update
  on public.organization_members;

create policy organization_members_update
on public.organization_members
for update
to authenticated
using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

drop policy if exists organization_members_delete
  on public.organization_members;

create policy organization_members_delete
on public.organization_members
for delete
to authenticated
using (
  public.is_org_admin(organization_id)
  or user_id = auth.uid()
);

-- Projects

drop policy if exists projects_select
  on public.projects;

create policy projects_select
on public.projects
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists projects_insert
  on public.projects;

create policy projects_insert
on public.projects
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and owner_id = auth.uid()
);

drop policy if exists projects_update
  on public.projects;

create policy projects_update
on public.projects
for update
to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

drop policy if exists projects_delete
  on public.projects;

create policy projects_delete
on public.projects
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.is_org_admin(organization_id)
);

-- Project members

drop policy if exists project_members_all
  on public.project_members;

create policy project_members_all
on public.project_members
for all
to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

-- Organization-isolated operational tables

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agent_runs',
    'agent_tasks',
    'change_sets',
    'change_set_files',
    'runtime_sessions',
    'runtime_logs',
    'project_memory',
    'project_decisions',
    'project_todos',
    'deployments',
    'usage_events'
  ]
  loop
    execute format(
      'drop policy if exists org_isolation_all on public.%I',
      table_name
    );

    execute format(
      'create policy org_isolation_all
       on public.%I
       for all
       to authenticated
       using (public.is_org_member(organization_id))
       with check (public.is_org_member(organization_id))',
      table_name
    );
  end loop;
end;
$$;

-- Subscriptions

drop policy if exists subscriptions_select
  on public.subscriptions;

create policy subscriptions_select
on public.subscriptions
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists subscriptions_admin
  on public.subscriptions;

create policy subscriptions_admin
on public.subscriptions
for all
to authenticated
using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

-- Credits

drop policy if exists credits_select
  on public.credits;

create policy credits_select
on public.credits
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists credits_admin
  on public.credits;

create policy credits_admin
on public.credits
for all
to authenticated
using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

-- Audit logs

drop policy if exists audit_select
  on public.audit_logs;

create policy audit_select
on public.audit_logs
for select
to authenticated
using (
  public.is_org_admin(organization_id)
);

drop policy if exists audit_insert
  on public.audit_logs;

create policy audit_insert
on public.audit_logs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
);

commit;
'@

# =========================================================
# STRUCTURAL CHECKER
# =========================================================

Write-ProjectFile "scripts\check-live1-saas-core.ps1" @'
$ErrorActionPreference = "Stop"

$Root = "C:\Users\martin\Desktop\VSC\BestS\Coder"

Set-Location $Root

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " LIVE 1 SAAS CORE - STRUCTURAL CHECK" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$RequiredFiles = @(
    "middleware.ts",
    "lib\supabase\env.ts",
    "lib\supabase\server.ts",
    "lib\supabase\client.ts",
    "lib\supabase\middleware.ts",
    "lib\live1\auth.ts",
    "lib\live1\data.ts",
    "app\login\page.tsx",
    "app\signup\page.tsx",
    "app\setup\page.tsx",
    "app\dashboard\layout.tsx",
    "app\dashboard\page.tsx",
    "app\dashboard\projects\page.tsx",
    "app\dashboard\projects\new\page.tsx",
    "app\dashboard\projects\[id]\page.tsx",
    "app\dashboard\team\page.tsx",
    "app\dashboard\billing\page.tsx",
    "app\api\live1\health\route.ts",
    "app\api\live1\me\route.ts",
    "app\api\live1\projects\route.ts",
    "supabase\migrations\20260817_live1_saas_core.sql"
)

foreach ($File in $RequiredFiles) {
    if (!(Test-Path (Join-Path $Root $File))) {
        throw "Falta: $File"
    }

    Write-Host "[OK] $File" -ForegroundColor Green
}

Write-Host ""
Write-Host "TYPECHECK..." -ForegroundColor Cyan

npm run typecheck

if ($LASTEXITCODE -ne 0) {
    throw "TYPECHECK FAIL"
}

Write-Host "[PASS] TYPECHECK" -ForegroundColor Green

Write-Host ""
Write-Host "BUILD..." -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    throw "BUILD FAIL"
}

Write-Host "[PASS] BUILD" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " LIVE 1 ESTRUCTURA: PASS" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pendiente para certificacion:"
Write-Host "1. Configurar Supabase"
Write-Host "2. Ejecutar SQL"
Write-Host "3. Crear usuarios"
Write-Host "4. Probar RLS"
Write-Host ""
'@

# =========================================================
# CERTIFICATION
# =========================================================

Write-ProjectFile "scripts\certificar-live1.ps1" @'
param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$IsolationConfirmed
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " LIVE 1 - CERTIFICACION" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

try {
    $Health = Invoke-RestMethod `
        -Uri "$BaseUrl/api/live1/health" `
        -Method GET `
        -TimeoutSec 20
}
catch {
    throw "Coder no responde en $BaseUrl"
}

Write-Host ""
Write-Host "Version      : $($Health.version)"
Write-Host "Configured   : $($Health.configured)"
Write-Host "Schema Ready : $($Health.schemaReady)"

if (-not $Health.configured) {
    throw "Supabase todavia no esta configurado."
}

if (-not $Health.schemaReady) {
    Write-Host ""
    Write-Host "Database error:" -ForegroundColor Red
    Write-Host $Health.databaseError

    throw "Schema LIVE 1 no esta listo."
}

if (-not $IsolationConfirmed) {
    Write-Host ""
    Write-Host "FALTA PRUEBA RLS ENTRE DOS USUARIOS." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Haz la prueba:"
    Write-Host "1. Usuario A crea Organizacion A y Proyecto A."
    Write-Host "2. Cierra sesion."
    Write-Host "3. Usuario B crea su propia cuenta."
    Write-Host "4. Confirma que Usuario B NO ve Proyecto A."
    Write-Host "5. Ejecuta nuevamente:"
    Write-Host ""
    Write-Host 'powershell -ExecutionPolicy Bypass -File ".\scripts\certificar-live1.ps1" -IsolationConfirmed'
    Write-Host ""

    exit 2
}

Write-Host ""
Write-Host "[PASS] Supabase configurado" -ForegroundColor Green
Write-Host "[PASS] Schema disponible" -ForegroundColor Green
Write-Host "[PASS] Aislamiento RLS confirmado" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BLOQUE 1 - LIVE SAAS CORE CERTIFICADO" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
'@

Write-Host ""
Write-Host "Ejecutando validacion estructural..." -ForegroundColor Cyan

powershell `
    -ExecutionPolicy Bypass `
    -File ".\scripts\check-live1-saas-core.ps1"

if ($LASTEXITCODE -ne 0) {
    throw "LIVE 1 no paso validacion."
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " LIVE 1 CODIGO INSTALADO" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente:"
Write-Host "1. Crear/configurar proyecto Supabase"
Write-Host "2. Ejecutar migration SQL"
Write-Host "3. Configurar .env.local"
Write-Host "4. npm run dev"
Write-Host "5. Abrir http://localhost:3000/signup"
Write-Host ""