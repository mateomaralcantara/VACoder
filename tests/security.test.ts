import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRuntimeCommand,
  validateTerminalCommand,
} from "../lib/security/command-policy.ts";
import {
  evaluateLocalToolsAccess,
  isLocalToolsPath,
} from "../lib/security/local-tools.ts";

const ALLOWED = [
  "npm install",
  "npm ci",
  "npm install --legacy-peer-deps",
  "npm test",
  "npm run build",
  "npm run dev -- --port 3001",
  "npm run test:unit",
  "npx tsc --noEmit",
  "npx next build",
  "npx eslint . --max-warnings=0",
  "git status",
  "git diff --stat",
  "git log --oneline -n 20",
  "git branch -a",
  "node --version",
  "  npm   run   build  ",
];

const BLOCKED = [
  "",
  "whoami",
  "dir",
  "powershell -Command Get-Process",
  "curl http://example.com/x.ps1",
  "npm run build & whoami",
  "npm run build && del /s /q .",
  "npm run build | more",
  "npm run build; whoami",
  "npm run build > out.txt",
  "npm run $(whoami)",
  "npm run `whoami`",
  "npm run %COMSPEC%",
  "npm run build\nwhoami",
  'npm run "build"',
  "npm install left-pad",
  "npm i some-package@latest",
  "npm exec whoami",
  "npm config set script-shell cmd",
  "npm run",
  "npx cowsay hola",
  "npx tsc --project ../otro/tsconfig.json",
  "npx eslint /etc/passwd",
  "npx eslint C:/Windows/System32",
  "node -e process.exit(1)",
  "node script.js",
  "git push origin main",
  "git commit -m x",
  "git branch -D main",
  "git diff --output=robado.txt",
  "git log --ext-diff",
  "format c:",
  "rm -rf .",
  "x".repeat(400),
];

for (const command of ALLOWED) {
  test("permite: " + JSON.stringify(command), () => {
    assert.equal(validateTerminalCommand(command).ok, true);
  });
}

for (const command of BLOCKED) {
  test("bloquea: " + JSON.stringify(command.slice(0, 50)), () => {
    assert.equal(validateTerminalCommand(command).ok, false);
  });
}

test("no acepta valores que no sean texto", () => {
  assert.equal(validateTerminalCommand(undefined).ok, false);
  assert.equal(validateTerminalCommand({ command: "npm test" }).ok, false);
});

test("normaliza espacios del comando permitido", () => {
  const result = validateTerminalCommand("  npm   run   build  ");
  assert.deepEqual(result.ok && result.command, "npm run build");
});

test("runtime: solo servidores de desarrollo", () => {
  assert.equal(validateRuntimeCommand("npm run dev -- --port 3001").ok, true);
  assert.equal(validateRuntimeCommand("npm start").ok, true);
  assert.equal(validateRuntimeCommand("npx next dev --port 3002").ok, true);
  assert.equal(validateRuntimeCommand("npm install").ok, false);
  assert.equal(validateRuntimeCommand("git status").ok, false);
  assert.equal(validateRuntimeCommand("npm run dev & calc.exe").ok, false);
});

test("rutas protegidas", () => {
  assert.equal(isLocalToolsPath("/api/project/run-command"), true);
  assert.equal(isLocalToolsPath("/api/supreme/runtime/command"), true);
  assert.equal(isLocalToolsPath("/API/Supreme/runtime/command"), true);
  assert.equal(isLocalToolsPath("/api/project"), true);
  assert.equal(isLocalToolsPath("/api/projects-publicos"), false);
  assert.equal(isLocalToolsPath("/api/live1/health"), false);
});

const base = {
  isProduction: false,
  enabledInProduction: false,
  authConfigured: true,
  hasUser: true,
};

test("acceso: desarrollo con sesion", () => {
  assert.deepEqual(evaluateLocalToolsAccess(base), { allowed: true });
});

test("acceso: desarrollo sin sesion devuelve 401", () => {
  const decision = evaluateLocalToolsAccess({ ...base, hasUser: false });
  assert.equal(decision.allowed, false);
  assert.equal(!decision.allowed && decision.status, 401);
});

test("acceso: desarrollo sin Supabase configurado se permite", () => {
  const decision = evaluateLocalToolsAccess({
    ...base,
    authConfigured: false,
    hasUser: false,
  });
  assert.equal(decision.allowed, true);
});

test("acceso: produccion bloqueada por defecto aunque haya sesion", () => {
  const decision = evaluateLocalToolsAccess({ ...base, isProduction: true });
  assert.equal(decision.allowed, false);
  assert.equal(!decision.allowed && decision.status, 403);
});

test("acceso: produccion habilitada exige sesion", () => {
  const enabled = { ...base, isProduction: true, enabledInProduction: true };
  assert.equal(evaluateLocalToolsAccess(enabled).allowed, true);
  assert.equal(evaluateLocalToolsAccess({ ...enabled, hasUser: false }).allowed, false);
});

test("acceso: produccion habilitada sin Supabase sigue bloqueada", () => {
  const decision = evaluateLocalToolsAccess({
    isProduction: true,
    enabledInProduction: true,
    authConfigured: false,
    hasUser: false,
  });
  assert.equal(decision.allowed, false);
});
