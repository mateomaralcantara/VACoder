import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";

import { requireWorkspace } from "@/lib/control-plane/project";
import { createOrchestratorAdminClient } from "@/lib/orchestrator/admin";
import { cloudRuntimeEnv } from "@/lib/cloud-runtime/env";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  ".vercel",
]);

function isSensitive(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.some((part) => EXCLUDED_DIRS.has(part))) {
    return true;
  }

  const name = parts.at(-1) || "";

  return (
    name === ".env" ||
    name.startsWith(".env.") ||
    name.endsWith(".pem") ||
    name.endsWith(".key") ||
    name.endsWith(".p12") ||
    name.endsWith(".pfx") ||
    name === "id_rsa" ||
    name === "id_ed25519"
  );
}

export async function createWorkspaceSnapshot(projectId: string) {
  const { ctx, projectPath } = await requireWorkspace(projectId);
  const env = cloudRuntimeEnv();
  const admin = createOrchestratorAdminClient();

  const snapshotId = crypto.randomUUID();
  const tempFile = path.join(os.tmpdir(), `vacoder-${snapshotId}.tar.gz`);
  const storagePath =
    `${ctx.project.organization_id}/${ctx.project.id}/${snapshotId}.tar.gz`;

  const { data: snapshotRow, error: insertError } = await admin
    .from("workspace_snapshots")
    .insert({
      id: snapshotId,
      organization_id: ctx.project.organization_id,
      project_id: ctx.project.id,
      created_by: ctx.user.id,
      provider: "supabase-storage",
      storage_bucket: env.snapshotBucket,
      storage_path: storagePath,
      status: "creating",
      excluded: {
        directories: Array.from(EXCLUDED_DIRS),
        secrets: [".env*", "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa", "id_ed25519"],
      },
    })
    .select("*")
    .single();

  if (insertError || !snapshotRow) {
    throw new Error(`SNAPSHOT_ROW_CREATE_FAIL | ${insertError?.message || "sin fila"}`);
  }

  try {
    await tar.c(
      {
        gzip: true,
        cwd: projectPath,
        file: tempFile,
        portable: true,
        noMtime: true,
        filter: (entryPath) => !isSensitive(entryPath),
      },
      ["."],
    );

    const stat = await fs.stat(tempFile);
    const maxBytes = env.maxSnapshotMb * 1024 * 1024;

    if (stat.size > maxBytes) {
      throw new Error(
        `Snapshot ${Math.round(stat.size / 1024 / 1024)}MB excede VACODER_MAX_SNAPSHOT_MB=${env.maxSnapshotMb}`,
      );
    }

    const buffer = await fs.readFile(tempFile);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    const { error: uploadError } = await admin.storage
      .from(env.snapshotBucket)
      .upload(storagePath, buffer, {
        contentType: "application/gzip",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`SNAPSHOT_UPLOAD_FAIL | ${uploadError.message}`);
    }

    const { data: readyRow, error: updateError } = await admin
      .from("workspace_snapshots")
      .update({
        status: "ready",
        bytes: stat.size,
        sha256,
        ready_at: new Date().toISOString(),
      })
      .eq("id", snapshotId)
      .select("*")
      .single();

    if (updateError || !readyRow) {
      throw new Error(`SNAPSHOT_READY_FAIL | ${updateError?.message || "sin fila"}`);
    }

    return readyRow;
  } catch (error) {
    await admin
      .from("workspace_snapshots")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", snapshotId);

    throw error;
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

