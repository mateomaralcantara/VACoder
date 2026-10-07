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
