import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assertSafeProjectPath,
  assertSafeRelativePath,
  createBackup,
  deleteProjectFile,
  ensureVacoderDir,
  validateProject,
  writeProjectFile,
} from "@/lib/vacoder/core";
import {
  generateMarketAgentPlan,
  readBeforeForOperation,
} from "@/lib/vacoder/market/agent";
import type {
  MarketChangeEntry,
  MarketChangeSet,
} from "@/lib/vacoder/market/types";

async function getChangeSetDir(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const vacoderDir = await ensureVacoderDir(projectPath);
  const dir = path.join(vacoderDir, "change-sets");

  await fs.mkdir(dir, { recursive: true });

  return dir;
}

function assertSafeId(id: string) {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) {
    throw new Error("changeSetId inseguro.");
  }

  return id;
}

export async function createMarketChangeSet(args: {
  projectPath: string;
  prompt: string;
  model?: string;
}) {
  const generated = await generateMarketAgentPlan({
    projectPath: args.projectPath,
    prompt: args.prompt,
    model: args.model,
  });

  const now = new Date().toISOString();
  const id = now.replace(/[:.]/g, "-") + "-" + crypto.randomUUID();

  const entries: MarketChangeEntry[] = [];

  for (const operation of generated.plan.operations) {
    const safePath = assertSafeRelativePath(operation.path);
    const before = await readBeforeForOperation(generated.projectPath, operation);

    entries.push({
      path: safePath,
      action: operation.action,
      before,
      after: operation.action === "delete" ? null : operation.content || "",
      reason: operation.reason || "Cambio generado por VACoder.",
    });
  }

  const changeSet: MarketChangeSet = {
    id,
    projectPath: generated.projectPath,
    prompt: args.prompt,
    model: generated.model,
    status: "created",
    createdAt: now,
    updatedAt: now,
    summary: generated.plan.summary,
    risk: generated.plan.risk,
    steps: generated.plan.steps,
    entries,
    notes: [
      ...generated.plan.notes,
      "Archivos usados como contexto: " + generated.contextFiles.join(", "),
      "Total de archivos detectados: " + generated.totalFiles,
    ],
  };

  const dir = await getChangeSetDir(generated.projectPath);

  await fs.writeFile(
    path.join(dir, id + ".json"),
    JSON.stringify(changeSet, null, 2),
    "utf8",
  );

  return changeSet;
}

export async function readMarketChangeSet(projectPathInput: string, changeSetId: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const id = assertSafeId(changeSetId);
  const dir = await getChangeSetDir(projectPath);
  const raw = await fs.readFile(path.join(dir, id + ".json"), "utf8");

  return JSON.parse(raw) as MarketChangeSet;
}

export async function saveMarketChangeSet(changeSet: MarketChangeSet) {
  const dir = await getChangeSetDir(changeSet.projectPath);

  changeSet.updatedAt = new Date().toISOString();

  await fs.writeFile(
    path.join(dir, changeSet.id + ".json"),
    JSON.stringify(changeSet, null, 2),
    "utf8",
  );

  return changeSet;
}

export async function listMarketChangeSets(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const dir = await getChangeSetDir(projectPath);
  const files = await fs.readdir(dir).catch(() => []);

  const results: MarketChangeSet[] = [];

  for (const file of files.filter((item) => item.endsWith(".json")).slice(-50)) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      results.push(JSON.parse(raw) as MarketChangeSet);
    } catch {
      // ignorar corruptos
    }
  }

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function applyMarketChangeSet(args: {
  projectPath: string;
  changeSetId: string;
  validate?: boolean;
  autoRollback?: boolean;
}) {
  const changeSet = await readMarketChangeSet(args.projectPath, args.changeSetId);

  if (changeSet.status !== "created") {
    throw new Error("Este change-set ya no esta en estado created.");
  }

  const backup = await createBackup(
    changeSet.projectPath,
    changeSet.entries.map((entry) => entry.path),
  );

  for (const entry of changeSet.entries) {
    if (entry.action === "delete") {
      await deleteProjectFile(changeSet.projectPath, entry.path);
    } else {
      await writeProjectFile(changeSet.projectPath, entry.path, entry.after || "");
    }
  }

  const validation = args.validate === false ? null : await validateProject(changeSet.projectPath);

  if (validation && !validation.ok && args.autoRollback !== false) {
    for (const entry of changeSet.entries) {
      if (entry.before === null) {
        await deleteProjectFile(changeSet.projectPath, entry.path);
      } else {
        await writeProjectFile(changeSet.projectPath, entry.path, entry.before);
      }
    }

    changeSet.status = "failed";
    changeSet.backupId = backup.id;
    changeSet.validation = validation;

    await saveMarketChangeSet(changeSet);

    return {
      ok: false,
      status: "failed-rolled-back",
      changeSet,
      validation,
    };
  }

  changeSet.status = validation && !validation.ok ? "failed" : "applied";
  changeSet.backupId = backup.id;
  changeSet.validation = validation;

  await saveMarketChangeSet(changeSet);

  return {
    ok: validation ? validation.ok : true,
    status: changeSet.status,
    changeSet,
    validation,
  };
}

export async function rejectMarketChangeSet(args: {
  projectPath: string;
  changeSetId: string;
}) {
  const changeSet = await readMarketChangeSet(args.projectPath, args.changeSetId);

  changeSet.status = "rejected";

  await saveMarketChangeSet(changeSet);

  return changeSet;
}
