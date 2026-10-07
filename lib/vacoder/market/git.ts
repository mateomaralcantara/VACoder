import {
  assertSafeProjectPath,
  runCommand,
} from "@/lib/vacoder/core";

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
  const safeMessage = (messageInput || "vacoder market leader changes")
    .replaceAll('"', "'")
    .replaceAll("`", "'")
    .trim();

  const add = await runCommand(projectPath, "git add .", 60000);

  if (add.exitCode !== 0) {
    return {
      ok: false,
      step: "git add",
      add,
    };
  }

  const commit = await runCommand(
    projectPath,
    'git commit -m "' + safeMessage + '"',
    60000,
  );

  return {
    ok: commit.exitCode === 0,
    step: "git commit",
    add,
    commit,
  };
}
