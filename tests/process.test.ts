import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveSpawnTarget,
  runArgv,
  tokenizeCommand,
} from "../lib/security/process.ts";
import {
  assertInsideAppsRoot,
  isInsideRoot,
  resolveAppsRoot,
} from "../lib/security/project-root.ts";

test("tokenizeCommand", () => {
  assert.deepEqual(tokenizeCommand("  npm   run build "), ["npm", "run", "build"]);
  assert.deepEqual(tokenizeCommand(""), []);
});

test("resolveSpawnTarget: en POSIX ejecuta el binario directo", () => {
  assert.deepEqual(resolveSpawnTarget("npm", ["run", "build"], "linux"), {
    file: "npm",
    args: ["run", "build"],
  });
});

test("resolveSpawnTarget: en Windows npm pasa por cmd.exe y git no", () => {
  const npm = resolveSpawnTarget("npm", ["run", "dev", "--", "--port", "3001"], "win32");
  assert.deepEqual(npm.args, ["/d", "/s", "/c", "npm.cmd", "run", "dev", "--", "--port", "3001"]);
  assert.deepEqual(resolveSpawnTarget("git", ["commit", "-m", "a & b"], "win32"), {
    file: "git",
    args: ["commit", "-m", "a & b"],
  });
});

test("resolveSpawnTarget: en Windows rechaza metacaracteres hacia cmd.exe", () => {
  for (const arg of ["a&b", "a|b", "%PATH%", "a b", 'a"b', "a>b", "a^b", "(x)"]) {
    assert.throws(() => resolveSpawnTarget("npm", ["run", arg], "win32"));
  }
});

test("runArgv: ejecuta y captura la salida", async () => {
  const result = await runArgv(os.tmpdir(), process.execPath, ["-e", "console.log('hola')"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.trim(), "hola");
  assert.equal(result.timedOut, false);
});

test("runArgv: los argumentos no se interpretan como shell", async () => {
  const marker = path.join(os.tmpdir(), "vacoder-inyeccion-" + process.pid);
  const payload = "x; touch " + marker + " && $(touch " + marker + ") `touch " + marker + "`";
  const result = await runArgv(os.tmpdir(), process.execPath, [
    "-e",
    "console.log(process.argv[1])",
    payload,
  ]);
  assert.equal(result.stdout.trim(), payload);
  assert.equal(fs.existsSync(marker), false);
});

test("runArgv: codigo de salida, binario inexistente y timeout", async () => {
  const failed = await runArgv(os.tmpdir(), process.execPath, ["-e", "process.exit(3)"]);
  assert.equal(failed.exitCode, 3);

  const missing = await runArgv(os.tmpdir(), "vacoder-no-existe-xyz", []);
  assert.notEqual(missing.exitCode, 0);

  const slow = await runArgv(os.tmpdir(), process.execPath, ["-e", "setTimeout(()=>{}, 30000)"], 300);
  assert.equal(slow.timedOut, true);
  assert.equal(slow.exitCode, 124);
});

test("isInsideRoot: no acepta carpetas hermanas ni salidas con ..", () => {
  const posix = path.posix;
  assert.equal(isInsideRoot("/srv/apps", "/srv/apps", posix, false), true);
  assert.equal(isInsideRoot("/srv/apps", "/srv/apps/demo/src", posix, false), true);
  assert.equal(isInsideRoot("/srv/apps", "/srv/apps-otra", posix, false), false);
  assert.equal(isInsideRoot("/srv/apps", "/srv/apps/../secreto", posix, false), false);
  assert.equal(isInsideRoot("/srv/apps", "/etc", posix, false), false);
  assert.equal(isInsideRoot("/srv/Apps", "/srv/apps/demo", posix, false), false);

  const win = path.win32;
  assert.equal(isInsideRoot("C:\\APPS", "c:\\apps\\Demo", win, true), true);
  assert.equal(isInsideRoot("C:\\APPS", "C:\\APPS-otra", win, true), false);
  assert.equal(isInsideRoot("C:\\APPS", "C:\\APPS\\..\\Windows", win, true), false);
  assert.equal(isInsideRoot("C:\\APPS", "D:\\APPS\\demo", win, true), false);
});

test("resolveAppsRoot: variable de entorno y valores por defecto", () => {
  assert.equal(resolveAppsRoot({ VACODER_APPS_ROOT: " /srv/apps " }, "linux"), "/srv/apps");
  assert.match(resolveAppsRoot({}, "win32"), /APPS$/);
  assert.equal(resolveAppsRoot({}, "linux"), path.join(os.homedir(), "vacoder-apps"));
});

test("assertInsideAppsRoot", () => {
  const previous = process.env.VACODER_APPS_ROOT;
  process.env.VACODER_APPS_ROOT = path.join(os.tmpdir(), "vacoder-root");

  try {
    assert.equal(
      assertInsideAppsRoot(path.join(os.tmpdir(), "vacoder-root", "demo")),
      path.join(os.tmpdir(), "vacoder-root", "demo"),
    );
    assert.throws(() => assertInsideAppsRoot(os.tmpdir()));
    assert.throws(() => assertInsideAppsRoot(path.join(os.tmpdir(), "vacoder-root-2")));
    assert.throws(() => assertInsideAppsRoot(""));
    assert.throws(() => assertInsideAppsRoot(undefined));
    assert.throws(() => assertInsideAppsRoot("demo\0"));
  } finally {
    if (previous === undefined) delete process.env.VACODER_APPS_ROOT;
    else process.env.VACODER_APPS_ROOT = previous;
  }
});

test("nodeEnvForCommand: los builds son de produccion y el resto no hereda", async () => {
  const { nodeEnvForCommand } = await import("../lib/security/process.ts");
  assert.equal(nodeEnvForCommand("npm", ["run", "build"]), "production");
  assert.equal(nodeEnvForCommand("npx", ["next", "build"]), "production");
  assert.equal(nodeEnvForCommand("npm", ["install"]), undefined);
  assert.equal(nodeEnvForCommand("npm", ["run", "dev", "--", "--port", "3001"]), undefined);
  assert.equal(nodeEnvForCommand("git", ["status"]), undefined);
});

test("runArgv: carpeta inexistente", async () => {
  const result = await runArgv(path.join(os.tmpdir(), "vacoder-no-existe-" + process.pid), process.execPath, ["-v"]);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /no existe/);
});
