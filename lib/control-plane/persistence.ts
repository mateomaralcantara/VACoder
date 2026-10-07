import type { ResolvedProject } from "@/lib/control-plane/project";

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function cap(value: unknown, max = 500000): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

export async function audit(ctx: ResolvedProject, action: string, result: string, metadata: Record<string, unknown> = {}) {
  await ctx.supabase.from("audit_logs").insert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    actor_user_id: ctx.user.id,
    action,
    entity_type: "project",
    entity_id: ctx.project.id,
    result,
    metadata,
  });
}

export async function getMemory(ctx: ResolvedProject) {
  const { data, error } = await ctx.supabase.from("project_memory")
    .select("project_id, organization_id, product_goal, memory, updated_at")
    .eq("project_id", ctx.project.id).maybeSingle();
  if (error) throw new Error("project_memory: " + error.message);
  return data;
}

export async function mergeMemory(ctx: ResolvedProject, patch: Record<string, unknown>, productGoal?: string) {
  const current = await getMemory(ctx);
  const memory = { ...rec(current?.memory), ...patch, controlPlaneUpdatedAt: new Date().toISOString() };
  const { data, error } = await ctx.supabase.from("project_memory").upsert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    product_goal: productGoal?.trim() || current?.product_goal || "Convertir el proyecto en una aplicacion premium lista para vender.",
    memory,
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id" }).select("project_id, product_goal, memory, updated_at").single();
  if (error) throw new Error("project_memory save: " + error.message);
  await audit(ctx, "control_plane.memory.update", "success", { keys: Object.keys(patch) });
  return data;
}

export async function saveDecision(ctx: ResolvedProject, decision: string) {
  const value = decision.trim();
  if (!value) return null;
  const { data, error } = await ctx.supabase.from("project_decisions").insert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    created_by: ctx.user.id,
    decision: value,
    metadata: { source: "live2-control-plane" },
  }).select("id, decision, created_at").single();
  if (error) throw new Error("project_decisions: " + error.message);
  return data;
}

export async function persistRuntime(ctx: ResolvedProject, legacyData: Record<string, unknown>) {
  const session = rec(legacyData.session);
  const providerId = str(session.id);
  if (!providerId) return null;
  const previewUrl = str(session.previewUrl);
  const status = str(session.status) || "running";
  const port = typeof session.port === "number" ? session.port : null;
  const { data, error } = await ctx.supabase.from("runtime_sessions").insert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    created_by: ctx.user.id,
    provider: "local",
    provider_runtime_id: providerId,
    status,
    port,
    preview_url: previewUrl,
    started_at: str(session.startedAt) || new Date().toISOString(),
    metadata: { command: str(session.command), controlPlaneVersion: "live2" },
  }).select("*").single();
  if (error) throw new Error("runtime persistence: " + error.message);
  await ctx.supabase.from("projects").update({ runtime_provider: "local", preview_url: previewUrl, status: status === "failed" ? "failed" : "active" }).eq("id", ctx.project.id);
  await ctx.supabase.from("project_environments").update({ status, preview_url: previewUrl }).eq("project_id", ctx.project.id).eq("name", String(ctx.project.current_environment || "development"));
  await audit(ctx, "control_plane.runtime.start", status === "failed" ? "failed" : "success", { providerId, previewUrl, port });
  return data;
}

export async function latestRuntime(ctx: ResolvedProject) {
  const { data, error } = await ctx.supabase.from("runtime_sessions").select("*").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("runtime status persistence: " + error.message);
  return data;
}

export async function stopRuntimeRecord(ctx: ResolvedProject, id: string) {
  const { error } = await ctx.supabase.from("runtime_sessions").update({ status: "stopped", stopped_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("runtime stop persistence: " + error.message);
  await ctx.supabase.from("projects").update({ preview_url: null, status: "active" }).eq("id", ctx.project.id);
  await ctx.supabase.from("project_environments").update({ status: "idle", preview_url: null }).eq("project_id", ctx.project.id).eq("name", String(ctx.project.current_environment || "development"));
  await audit(ctx, "control_plane.runtime.stop", "success", { runtimeId: id });
}

export async function persistChangeSet(ctx: ResolvedProject, legacyData: Record<string, unknown>, prompt: string, model: string | null) {
  const result = rec(legacyData.result);
  const direct = rec(legacyData.changeSet);
  const nested = rec(result.changeSet);
  const raw = Object.keys(direct).length ? direct : Object.keys(nested).length ? nested : result;
  const legacyId = str(raw.id) || str(legacyData.id);
  if (!legacyId) return null;
  const summary = str(raw.summary) || str(legacyData.summary) || "Market change-set";
  const risk = str(raw.risk) || str(legacyData.risk) || "medium";
  const status = str(raw.status) || str(legacyData.status) || "created";
  const { data: row, error } = await ctx.supabase.from("change_sets").insert({
    organization_id: ctx.project.organization_id,
    project_id: ctx.project.id,
    created_by: ctx.user.id,
    status,
    summary,
    risk,
    metadata: { legacyId, prompt, model, controlPlaneVersion: "live2" },
  }).select("id").single();
  if (error || !row) throw new Error("change_set persistence: " + (error?.message || "missing row"));
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  if (entries.length) {
    const rows = entries.map(rec).map(item => ({
      organization_id: ctx.project.organization_id,
      project_id: ctx.project.id,
      change_set_id: row.id,
      path: str(item.path) || str(item.filePath) || "unknown",
      action: str(item.action) || "upsert",
      before_content: cap(item.before),
      after_content: cap(item.after),
      reason: str(item.reason) || "",
    }));
    const { error: fileError } = await ctx.supabase.from("change_set_files").insert(rows);
    if (fileError) throw new Error("change_set_files persistence: " + fileError.message);
  }
  await audit(ctx, "control_plane.market.create", "success", { persistentId: row.id, legacyId, entries: entries.length });
  return { persistentId: row.id as string, legacyId };
}

export async function getChangeSet(ctx: ResolvedProject, persistentId: string) {
  const { data, error } = await ctx.supabase.from("change_sets").select("id, status, summary, risk, metadata, created_at").eq("project_id", ctx.project.id).eq("id", persistentId).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Change-set persistente no encontrado.");
  return data;
}

export async function updateChangeSet(ctx: ResolvedProject, persistentId: string, status: string, result: Record<string, unknown>) {
  const current = await getChangeSet(ctx, persistentId);
  const metadata = { ...rec(current.metadata), lastOperationResult: result, lastOperationAt: new Date().toISOString() };
  const { error } = await ctx.supabase.from("change_sets").update({ status, metadata, updated_at: new Date().toISOString() }).eq("id", persistentId).eq("project_id", ctx.project.id);
  if (error) throw new Error("change_set update: " + error.message);
}

export async function listChangeSets(ctx: ResolvedProject) {
  const { data, error } = await ctx.supabase.from("change_sets").select("id, status, summary, risk, metadata, created_at, updated_at").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("change_set list: " + error.message);
  return data || [];
}
