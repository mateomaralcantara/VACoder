import { NextResponse } from "next/server";
import { POST as legacyScanPost } from "@/app/api/project/scan/route";
import { POST as legacyValidatePost } from "@/app/api/project/validate/route";
import { POST as legacySupremeScorePost } from "@/app/api/supreme/score/route";
import { POST as legacyDeployStatusPost } from "@/app/api/supreme/deploy/status/route";
import { POST as legacyRuntimeStartPost } from "@/app/api/supreme/runtime/start/route";
import { GET as legacyRuntimeStatusGet } from "@/app/api/supreme/runtime/status/route";
import { POST as legacyRuntimeStopPost } from "@/app/api/supreme/runtime/stop/route";
import { POST as legacyPreviewPost } from "@/app/api/supreme/runtime/preview/route";
import { POST as legacyMarketCreatePost } from "@/app/api/project/change-set/create/route";
import { POST as legacyMarketApplyPost } from "@/app/api/project/change-set/apply/route";
import { POST as legacyMarketRejectPost } from "@/app/api/project/change-set/reject/route";
import { POST as legacyMarketListPost } from "@/app/api/project/change-set/list/route";
import { dispatchInternalGet, dispatchInternalPost } from "@/lib/control-plane/bridge";
import { getPublicProjectContext, publicContext, registerWorkspace, requireWorkspace, resolveProject } from "@/lib/control-plane/project";
import { getChangeSet, getMemory, latestRuntime, listChangeSets, mergeMemory, persistChangeSet, persistRuntime, saveDecision, stopRuntimeRecord, updateChangeSet } from "@/lib/control-plane/persistence";
import type { ControlPlaneCertification } from "@/lib/control-plane/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string; action: string[] }> };

function key(parts: string[]) { return parts.join("/").toLowerCase(); }
function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function jsonError(error: unknown, status = 500) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Control Plane error." }, { status });
}

async function certification(projectId: string): Promise<ControlPlaneCertification> {
  const ctx = await resolveProject(projectId);
  const [memory, runtimeCount, changeCount, environment] = await Promise.all([
    getMemory(ctx),
    ctx.supabase.from("runtime_sessions").select("id", { count: "exact", head: true }).eq("project_id", ctx.project.id),
    ctx.supabase.from("change_sets").select("id", { count: "exact", head: true }).eq("project_id", ctx.project.id),
    ctx.supabase.from("project_environments").select("id, status").eq("project_id", ctx.project.id).eq("name", String(ctx.project.current_environment || "development")).maybeSingle(),
  ]);
  const checks = [
    { key: "projectResolver", label: "Project ID Resolver", ok: Boolean(ctx.project.id), details: ctx.project.name },
    { key: "organizationIsolation", label: "Organization isolation / RLS", ok: Boolean(ctx.organization.id), details: "Resolved under authenticated RLS session" },
    { key: "workspaceRegistry", label: "Workspace Registry", ok: Boolean(ctx.workspace?.workspace_path && ctx.workspace.status === "linked"), details: ctx.workspace?.status || "unlinked" },
    { key: "projectEnvironment", label: "Project Environment", ok: Boolean(environment.data?.id), details: environment.data?.status || "missing" },
    { key: "memoryPersistence", label: "Persistent project memory", ok: Boolean(memory?.project_id), details: memory?.updated_at || "missing" },
    { key: "runtimePersistence", label: "Runtime session persistence", ok: (runtimeCount.count || 0) > 0, details: String(runtimeCount.count || 0) + " runtime sessions" },
    { key: "changeSetPersistence", label: "Market change-set persistence", ok: (changeCount.count || 0) > 0, details: String(changeCount.count || 0) + " change-sets" },
  ];
  const passed = checks.filter(item => item.ok).length;
  return { projectId, score: Math.round((passed / checks.length) * 100), certified: passed === checks.length, checks };
}

export async function GET(_request: Request, context: ParamsContext) {
  try {
    const { id, action } = await context.params;
    const op = key(action);

    if (op === "context") return NextResponse.json({ ok: true, context: await getPublicProjectContext(id) });
    if (op === "workspace") return NextResponse.json({ ok: true, workspace: (await getPublicProjectContext(id)).workspace });
    if (op === "memory") {
      const ctx = await resolveProject(id);
      const [memory, decisions, todos] = await Promise.all([
        getMemory(ctx),
        ctx.supabase.from("project_decisions").select("id, decision, created_at").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(30),
        ctx.supabase.from("project_todos").select("id, title, status, priority, created_at").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(30),
      ]);
      return NextResponse.json({ ok: true, memory, decisions: decisions.data || [], todos: todos.data || [] });
    }
    if (op === "runtime/status") {
      const ctx = await resolveProject(id);
      const persistent = await latestRuntime(ctx);
      const bridge = await dispatchInternalGet(legacyRuntimeStatusGet);
      const sessions = Array.isArray(bridge.data.sessions) ? bridge.data.sessions.map(asRecord) : [];
      const live = sessions.find(item => typeof item.id === "string" && item.id === persistent?.provider_runtime_id) || null;
      return NextResponse.json({ ok: true, projectId: id, persistent, live, engineAvailable: bridge.ok });
    }
    if (op === "market/list") {
      const { ctx, projectPath } = await requireWorkspace(id);
      const [persistent, legacy] = await Promise.all([
        listChangeSets(ctx),
        dispatchInternalPost(legacyMarketListPost, { projectPath }).catch(() => ({ ok: false, status: 500, data: {} })),
      ]);
      return NextResponse.json({ ok: true, projectId: id, persistent, legacy: legacy.data });
    }
    if (op === "certification") return NextResponse.json({ ok: true, certification: await certification(id) });

    return NextResponse.json({ ok: false, error: "GET operation no soportada: " + op }, { status: 404 });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, context: ParamsContext) {
  try {
    const { id, action } = await context.params;
    const op = key(action);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    if (op === "workspace") {
      const projectContext = await registerWorkspace({
        projectId: id,
        workspacePath: String(body.workspacePath || ""),
        runtimeCommand: typeof body.runtimeCommand === "string" ? body.runtimeCommand : undefined,
        defaultPort: Number(body.defaultPort || 3001),
      });
      return NextResponse.json({ ok: true, context: projectContext });
    }

    if (op === "memory") {
      const ctx = await resolveProject(id);
      const patch = body.patch && typeof body.patch === "object" ? body.patch as Record<string, unknown> : {};
      const memory = await mergeMemory(ctx, patch, typeof body.productGoal === "string" ? body.productGoal : undefined);
      const decision = typeof body.decision === "string" ? await saveDecision(ctx, body.decision) : null;
      return NextResponse.json({ ok: true, memory, decision });
    }

    if (op === "scan" || op === "validate" || op === "supreme/score" || op === "supreme/deploy-status") {
      const { ctx, projectPath } = await requireWorkspace(id);
      const handler = op === "scan" ? legacyScanPost : op === "validate" ? legacyValidatePost : op === "supreme/score" ? legacySupremeScorePost : legacyDeployStatusPost;
      const bridge = await dispatchInternalPost(handler, { ...body, projectPath });
      if (op === "supreme/score" && bridge.ok) {
        await mergeMemory(ctx, { supremeScore: bridge.data, supremeScoreUpdatedAt: new Date().toISOString() });
      }
      return NextResponse.json({ ...bridge.data, controlPlane: { projectId: id, persisted: op === "supreme/score" && bridge.ok } }, { status: bridge.status });
    }

    if (op === "runtime/start") {
      const { ctx, projectPath } = await requireWorkspace(id);
      const port = Math.max(1024, Math.min(65535, Number(body.port || ctx.workspace?.default_port || 3001)));
      const template = typeof body.command === "string" && body.command.trim() ? body.command.trim() : ctx.workspace?.runtime_command || "npm run dev -- --port {{PORT}}";
      const command = template.replaceAll("{{PORT}}", String(port));
      const bridge = await dispatchInternalPost(legacyRuntimeStartPost, { projectPath, port, command });
      const persistent = bridge.ok ? await persistRuntime(ctx, bridge.data) : null;
      return NextResponse.json({ ...bridge.data, controlPlane: { projectId: id, persistentRuntimeId: persistent?.id || null } }, { status: bridge.status });
    }

    if (op === "runtime/stop") {
      const ctx = await resolveProject(id);
      const persistent = await latestRuntime(ctx);
      if (!persistent?.provider_runtime_id) return NextResponse.json({ ok: false, error: "No existe runtime persistente activo." }, { status: 404 });
      const bridge = await dispatchInternalPost(legacyRuntimeStopPost, { id: persistent.provider_runtime_id });
      if (bridge.ok) await stopRuntimeRecord(ctx, persistent.id);
      return NextResponse.json({ ...bridge.data, controlPlane: { projectId: id, persistentRuntimeId: persistent.id } }, { status: bridge.status });
    }

    if (op === "runtime/preview") {
      const ctx = await resolveProject(id);
      const persistent = await latestRuntime(ctx);
      if (!persistent?.preview_url) return NextResponse.json({ ok: false, error: "No existe preview runtime activa." }, { status: 404 });
      const bridge = await dispatchInternalPost(legacyPreviewPost, { url: persistent.preview_url });
      return NextResponse.json(bridge.data, { status: bridge.status });
    }

    if (op === "market/create") {
      const { ctx, projectPath } = await requireWorkspace(id);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return NextResponse.json({ ok: false, error: "prompt es obligatorio." }, { status: 400 });
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : null;
      const bridge = await dispatchInternalPost(legacyMarketCreatePost, { ...body, projectPath, prompt, ...(model ? { model } : {}) });
      const persisted = bridge.ok ? await persistChangeSet(ctx, bridge.data, prompt, model) : null;
      return NextResponse.json({ ...bridge.data, controlPlane: { projectId: id, persistentId: persisted?.persistentId || null, legacyId: persisted?.legacyId || null } }, { status: bridge.status });
    }

    if (op === "market/apply" || op === "market/reject") {
      const { ctx, projectPath } = await requireWorkspace(id);
      const persistentId = String(body.persistentId || "").trim();
      if (!persistentId) return NextResponse.json({ ok: false, error: "persistentId es obligatorio." }, { status: 400 });
      const persistent = await getChangeSet(ctx, persistentId);
      const metadata = asRecord(persistent.metadata);
      const legacyId = typeof body.legacyId === "string" && body.legacyId.trim() ? body.legacyId.trim() : typeof metadata.legacyId === "string" ? metadata.legacyId : "";
      if (!legacyId) throw new Error("El change-set no contiene legacyId.");
      const handler = op === "market/apply" ? legacyMarketApplyPost : legacyMarketRejectPost;
      const bridge = await dispatchInternalPost(handler, { ...body, projectPath, id: legacyId, changeSetId: legacyId });
      await updateChangeSet(ctx, persistentId, bridge.ok ? (op === "market/apply" ? "applied" : "rejected") : "failed", bridge.data);
      return NextResponse.json({ ...bridge.data, controlPlane: { projectId: id, persistentId, legacyId } }, { status: bridge.status });
    }

    return NextResponse.json({ ok: false, error: "POST operation no soportada: " + op }, { status: 404 });
  } catch (error) { return jsonError(error); }
}
