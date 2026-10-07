import fs from "node:fs/promises";
import { assertSafeProjectPath } from "@/lib/vacoder/core";
import { requireLiveUser } from "@/lib/live1/auth";
import type { ProjectControlContextPublic } from "@/lib/control-plane/types";

export type ResolvedProject = {
  supabase: Awaited<ReturnType<typeof requireLiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireLiveUser>>["user"];
  project: Record<string, unknown> & {
    id: string;
    organization_id: string;
    owner_id: string;
    name: string;
    slug: string;
  };
  organization: Record<string, unknown> & {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  workspace: (Record<string, unknown> & {
    id: string;
    workspace_path: string | null;
    provider: string;
    status: string;
    runtime_command: string;
    default_port: number;
    updated_at: string | null;
  }) | null;
  environment: (Record<string, unknown> & {
    id: string;
    name: string;
    provider: string;
    status: string;
    preview_url: string | null;
    production_url: string | null;
    updated_at: string | null;
  }) | null;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export async function resolveProject(projectId: string): Promise<ResolvedProject> {
  const id = projectId.trim();
  if (!id) throw new Error("projectId es obligatorio.");

  const { supabase, user } = await requireLiveUser();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id, owner_id, name, slug, description, status, framework, repository_url, default_branch, runtime_provider, preview_url, production_url, current_environment, workspace_status, control_plane_version")
    .eq("id", id)
    .maybeSingle();

  if (projectError) throw new Error("Project Resolver: " + projectError.message);
  if (!project) throw new Error("Proyecto no encontrado o no autorizado.");

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, plan")
    .eq("id", project.organization_id)
    .maybeSingle();

  if (orgError || !organization) {
    throw new Error(orgError?.message || "Organizacion no disponible.");
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspace_registry")
    .select("id, workspace_path, provider, status, runtime_command, default_port, updated_at")
    .eq("project_id", project.id)
    .maybeSingle();

  if (workspaceError) {
    throw new Error("Workspace Registry no disponible. Ejecuta LIVE 2 SQL. " + workspaceError.message);
  }

  const environmentName = text(project.current_environment, "development") || "development";
  const { data: environment, error: environmentError } = await supabase
    .from("project_environments")
    .select("id, name, provider, status, preview_url, production_url, updated_at")
    .eq("project_id", project.id)
    .eq("name", environmentName)
    .maybeSingle();

  if (environmentError) {
    throw new Error("Project Environment no disponible. Ejecuta LIVE 2 SQL. " + environmentError.message);
  }

  return {
    supabase,
    user,
    project: project as ResolvedProject["project"],
    organization: organization as ResolvedProject["organization"],
    workspace: (workspace || null) as ResolvedProject["workspace"],
    environment: (environment || null) as ResolvedProject["environment"],
  };
}

export function publicContext(ctx: ResolvedProject): ProjectControlContextPublic {
  const p = ctx.project;
  return {
    project: {
      id: p.id,
      organizationId: p.organization_id,
      ownerId: p.owner_id,
      name: p.name,
      slug: p.slug,
      description: typeof p.description === "string" ? p.description : null,
      status: text(p.status, "draft"),
      framework: typeof p.framework === "string" ? p.framework : null,
      repositoryUrl: typeof p.repository_url === "string" ? p.repository_url : null,
      defaultBranch: text(p.default_branch, "main"),
      runtimeProvider: typeof p.runtime_provider === "string" ? p.runtime_provider : null,
      previewUrl: typeof p.preview_url === "string" ? p.preview_url : null,
      productionUrl: typeof p.production_url === "string" ? p.production_url : null,
      currentEnvironment: text(p.current_environment, "development") || "development",
      workspaceStatus: text(p.workspace_status, "unlinked") || "unlinked",
      controlPlaneVersion: text(p.control_plane_version, "live2") || "live2",
    },
    organization: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      slug: ctx.organization.slug,
      plan: ctx.organization.plan,
    },
    workspace: {
      linked: Boolean(ctx.workspace?.workspace_path),
      provider: ctx.workspace?.provider || "unlinked",
      status: ctx.workspace?.status || "unlinked",
      defaultPort: ctx.workspace?.default_port || 3001,
      runtimeCommand: ctx.workspace?.runtime_command || "npm run dev -- --port {{PORT}}",
      updatedAt: ctx.workspace?.updated_at || null,
    },
    environment: {
      name: ctx.environment?.name || text(p.current_environment, "development") || "development",
      provider: ctx.environment?.provider || text(p.runtime_provider, "local") || "local",
      status: ctx.environment?.status || "idle",
      previewUrl: ctx.environment?.preview_url || (typeof p.preview_url === "string" ? p.preview_url : null),
      productionUrl: ctx.environment?.production_url || (typeof p.production_url === "string" ? p.production_url : null),
      updatedAt: ctx.environment?.updated_at || null,
    },
  };
}

export async function getPublicProjectContext(projectId: string) {
  return publicContext(await resolveProject(projectId));
}

export async function requireWorkspace(projectId: string) {
  const ctx = await resolveProject(projectId);
  const raw = ctx.workspace?.workspace_path?.trim() || "";
  if (!raw) throw new Error("Workspace no vinculado. Abre Project Control Plane y registra la ruta local.");
  const projectPath = assertSafeProjectPath(raw);
  const stat = await fs.stat(projectPath).catch(() => null);
  if (!stat?.isDirectory()) throw new Error("El workspace registrado no existe o no es una carpeta.");
  return { ctx, projectPath };
}

export async function registerWorkspace(args: {
  projectId: string;
  workspacePath: string;
  runtimeCommand?: string;
  defaultPort?: number;
}) {
  const ctx = await resolveProject(args.projectId);
  const projectPath = assertSafeProjectPath(args.workspacePath.trim());
  const stat = await fs.stat(projectPath).catch(() => null);
  if (!stat?.isDirectory()) throw new Error("La ruta del workspace no existe.");

  const defaultPort = Math.max(1024, Math.min(65535, Number(args.defaultPort || 3001)));
  const runtimeCommand = args.runtimeCommand?.trim() || "npm run dev -- --port {{PORT}}";
  const envName = text(ctx.project.current_environment, "development") || "development";

  const { error: wError } = await ctx.supabase.from("workspace_registry").upsert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    provider: "local",
    workspace_path: projectPath,
    runtime_command: runtimeCommand,
    default_port: defaultPort,
    status: "linked",
    created_by: ctx.user.id,
    metadata: { controlPlaneVersion: "live2" },
  }, { onConflict: "project_id" });
  if (wError) throw new Error("Workspace Registry: " + wError.message);

  const { error: eError } = await ctx.supabase.from("project_environments").upsert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    name: envName,
    provider: "local",
    status: "idle",
    metadata: { controlPlaneVersion: "live2" },
  }, { onConflict: "project_id,name" });
  if (eError) throw new Error("Project Environment: " + eError.message);

  const { error: pError } = await ctx.supabase.from("projects").update({
    runtime_provider: "local",
    workspace_status: "linked",
    control_plane_version: "live2",
    current_environment: envName,
  }).eq("id", ctx.project.id);
  if (pError) throw new Error("Project update: " + pError.message);

  await ctx.supabase.from("audit_logs").insert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    actor_user_id: ctx.user.id,
    action: "control_plane.workspace.link",
    entity_type: "project",
    entity_id: ctx.project.id,
    result: "success",
    metadata: { provider: "local", defaultPort },
  });

  return getPublicProjectContext(ctx.project.id);
}
