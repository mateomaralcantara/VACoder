import {
  assertSafeProjectPath,
  runCommand,
} from "@/lib/vacoder/core";
import { runArgv } from "@/lib/security/process";

export async function getGitStatus(projectPathInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  const status = await runCommand(projectPath, "git status --short", 60000);
  const branch = await runCommand(projectPath, "git branch --show-current", 60000);

  return {
    ok: status.exitCode === 0,
    branch: branch.stdout.trim(),
    status,
  };
}

export async function commitGitChanges(projectPathInput: string, messageInput: string) {
  const projectPath = assertSafeProjectPath(projectPathInput);
  // El mensaje viaja como un unico argumento (sin shell), asi que no puede
  // inyectar comandos. Se limpia solo para que el commit sea legible.
  const message =
    String(messageInput || "")
      .replace(/[\u0000-\u001f]+/g, " ")
      .trim()
      .slice(0, 200) || "vacoder market leader changes";

  const add = await runCommand(projectPath, "git add .", 60000);

  if (add.exitCode !== 0) {
    return {
      ok: false,
      step: "git add",
      add,
    };
  }

  const commit = await runArgv(
    projectPath,
    "git",
    ["commit", "-m", message],
    60000,
  );

  return {
    ok: commit.exitCode === 0,
    step: "git commit",
    add,
    commit,
  };
}
