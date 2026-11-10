import { assertSafeProjectPath, runCommand } from "@/lib/vacoder/core";
import type { SupremeDeployStatus } from "@/lib/vacoder/supreme/types";

export async function getSupremeDeployStatus(projectPathInput: string): Promise<SupremeDeployStatus> {
  const projectPath = assertSafeProjectPath(projectPathInput);

  const gitStatus = await runCommand(projectPath, "git status --short", 60000).catch((error) => ({
    exitCode: 1,
    stdout: "",
    stderr: error instanceof Error ? error.message : "Git fallo.",
  }));

  const branch = await runCommand(projectPath, "git branch --show-current", 60000).catch(() => ({
    exitCode: 1,
    stdout: "",
    stderr: "",
  }));

  const vercel = await runCommand(projectPath, "npx vercel --version", 60000).catch(() => ({
    exitCode: 1,
    stdout: "",
    stderr: "",
  }));

  const hasChanges = Boolean(gitStatus.stdout.trim());

  const recommendations: string[] = [];

  if (gitStatus.exitCode !== 0) {
    recommendations.push("Inicializar Git o corregir repositorio.");
  }

  if (hasChanges) {
    recommendations.push("Crear commit antes de deploy.");
  }

  if (vercel.exitCode !== 0) {
    recommendations.push("Instalar/configurar Vercel CLI si se quiere deploy automatico.");
  }

  return {
    gitOk: gitStatus.exitCode === 0,
    branch: branch.stdout.trim(),
    hasChanges,
    statusText: gitStatus.stdout || gitStatus.stderr || "Sin cambios.",
    vercelAvailable: vercel.exitCode === 0,
    recommendations,
  };
}

export async function runSupremeVercelDeploy(projectPathInput: string, production: boolean) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const command = production ? "npx vercel --prod --yes" : "npx vercel --yes";
  const result = await runCommand(projectPath, command, 180000);

  return {
    ok: result.exitCode === 0,
    command,
    result,
  };
}
