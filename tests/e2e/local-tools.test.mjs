// Flujos del Studio contra el servidor de desarrollo, tal como los usa la
// interfaz: builder, escaner, comandos, runtime y pipeline de produccion.
//
// Cada comprobacion fija el contrato entre un panel y su ruta API. No usa la
// red: los proyectos de prueba no tienen dependencias.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

let server;
let base;
let appsRoot;
let serverLog = "";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function api(method, route, body) {
  const response = await fetch(base + route, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: response.status, data: await response.json() };
}

async function isUp(url) {
  try {
    return (await fetch(url)).status;
  } catch {
    return 0;
  }
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error("Tiempo agotado: " + label + "\n" + serverLog.slice(-2000));
}

// Proyecto minimo sin dependencias: `dev` levanta un servidor HTTP y `build`
// imprime el NODE_ENV con el que fue ejecutado.
function createTinyProject(name) {
  const dir = path.join(appsRoot, name);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({
      name,
      private: true,
      scripts: {
        dev: "node server.js",
        build: "node build.js",
        typecheck: "node -e \"process.exit(0)\"",
      },
    }),
  );
  fs.writeFileSync(path.join(dir, "build.js"), "console.log('NODE_ENV=' + process.env.NODE_ENV);\n");
  fs.writeFileSync(
    path.join(dir, "server.js"),
    "const i = process.argv.indexOf('--port');\n" +
      "const port = Number(i > -1 ? process.argv[i + 1] : process.env.PORT);\n" +
      "require('http').createServer((q, r) => r.end('<title>tiny</title>ok')).listen(port, () => console.log('ready on localhost:' + port));\n",
  );
  fs.mkdirSync(path.join(dir, "node_modules"));

  return dir;
}

before(async () => {
  appsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vacoder-apps-"));

  const port = await freePort();
  base = "http://127.0.0.1:" + port;

  const env = { ...process.env, VACODER_APPS_ROOT: appsRoot, DEMO_MODE: "true" };

  for (const key of [
    "NODE_ENV",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]) {
    delete env[key];
  }

  server = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "dev", "-p", String(port), "-H", "127.0.0.1"],
    { env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
  );

  server.stdout.on("data", (chunk) => (serverLog += chunk));
  server.stderr.on("data", (chunk) => (serverLog += chunk));

  await waitFor(() => isUp(base + "/api/live1/health"), 120_000, "servidor de desarrollo");
});

after(() => {
  if (server?.pid) {
    try {
      process.kill(process.platform === "win32" ? server.pid : -server.pid, "SIGTERM");
    } catch {
      // ya termino
    }
  }

  fs.rmSync(appsRoot, { recursive: true, force: true });
});

test("builder: el preview devuelve el plan que el panel dibuja", async () => {
  const { status, data } = await api("POST", "/api/project/builder/preview", {
    projectName: "Mi Tienda",
    description: "Una tienda online moderna y segura.",
  });

  assert.equal(status, 200);
  assert.equal(data.blueprint.name, "mi-tienda");
  assert.ok(Array.isArray(data.blueprint.routes));
  assert.ok(data.files.length > 5);

  for (const file of data.files) {
    assert.equal(typeof file.path, "string");
    assert.equal(typeof file.content, "string");
  }

  const paths = data.files.map((file) => file.path);
  assert.ok(paths.includes("package.json"));
  assert.ok(paths.includes(".gitignore"), "la app generada debe traer .gitignore");
});

test("builder: valida la solicitud", async () => {
  const { status, data } = await api("POST", "/api/project/builder/preview", {
    projectName: "x",
    description: "corta",
  });

  assert.equal(status, 400);
  assert.equal(typeof data.error, "string");
});

test("builder: crea los archivos en disco y no pisa los existentes", async () => {
  const request = {
    projectName: "mi-tienda",
    description: "Una tienda online moderna y segura.",
  };

  const first = await api("POST", "/api/project/builder/create", request);
  assert.equal(first.status, 200);
  assert.equal(first.data.projectPath, path.join(appsRoot, "mi-tienda"));
  assert.ok(first.data.created.length > 5);
  assert.deepEqual(first.data.skipped, []);
  assert.deepEqual(first.data.errors, []);

  const pkg = JSON.parse(fs.readFileSync(path.join(appsRoot, "mi-tienda", "package.json"), "utf8"));
  assert.equal(pkg.name, "mi-tienda");
  assert.match(fs.readFileSync(path.join(appsRoot, "mi-tienda", ".gitignore"), "utf8"), /node_modules/);

  const second = await api("POST", "/api/project/builder/create", request);
  assert.deepEqual(second.data.created, []);
  assert.equal(second.data.skipped.length, first.data.created.length);
});

test("builder: no escribe fuera de la raiz de proyectos", async () => {
  const { status, data } = await api("POST", "/api/project/builder/create", {
    rootPath: os.tmpdir(),
    projectName: "fuera",
    description: "Una app que intenta salir de la raiz.",
  });

  assert.equal(status, 400);
  assert.match(data.error, /Ruta insegura/);
  assert.equal(fs.existsSync(path.join(os.tmpdir(), "fuera")), false);
});

test("escaner: el Studio recibe un manifiesto", async () => {
  const { status, data } = await api("POST", "/api/project/scan", {
    projectRoot: path.join(appsRoot, "mi-tienda"),
  });

  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.manifest.projectName, "mi-tienda");
  assert.ok(data.manifest.stats.totalFiles > 5);
  assert.ok(data.manifest.stats.includedFiles > 0);
});

test("escaner: el control plane recibe el listado plano", async () => {
  const { status, data } = await api("POST", "/api/project/scan", {
    projectPath: path.join(appsRoot, "mi-tienda"),
  });

  assert.equal(status, 200);
  assert.ok(data.totalFiles > 5);
  assert.ok(Array.isArray(data.files));
});

test("comandos: el build corre con NODE_ENV=production aunque el servidor este en desarrollo", async () => {
  const cwd = createTinyProject("tiny-build");
  const { status, data } = await api("POST", "/api/project/run-command", {
    cwd,
    command: "npm run build",
  });

  assert.equal(status, 200);
  assert.equal(data.exitCode, 0, data.stderr);
  assert.match(data.stdout, /NODE_ENV=production/);
});

test("comandos: una carpeta inexistente da un error claro", async () => {
  const { data } = await api("POST", "/api/supreme/runtime/command", {
    projectPath: path.join(appsRoot, "no-existe"),
    command: "npm run build",
  });

  assert.equal(data.ok, false);
  assert.match(data.result.stderr, /no existe/);
});

test("runtime de Supreme: arranca, responde y al detener libera el puerto", async () => {
  const projectPath = createTinyProject("tiny-supreme");
  const port = await freePort();

  const started = await api("POST", "/api/supreme/runtime/start", { projectPath, port });
  assert.equal(started.data.ok, true);

  const url = "http://127.0.0.1:" + port;
  await waitFor(() => isUp(url), 20_000, "runtime de Supreme");

  const listed = await api("GET", "/api/supreme/runtime/status");
  assert.equal(listed.data.sessions[0].id, started.data.session.id, "la sesion mas reciente va primero");

  await api("POST", "/api/supreme/runtime/stop", { id: started.data.session.id });
  await waitFor(async () => (await isUp(url)) === 0, 10_000, "cierre del puerto");
});

test("runtime del proyecto: arranca, responde y al detener libera el puerto", async () => {
  const cwd = createTinyProject("tiny-live");
  const port = await freePort();

  const started = await api("POST", "/api/project/runtime/start", { cwd, port });
  assert.equal(started.status, 200);

  const url = "http://127.0.0.1:" + port;
  await waitFor(() => isUp(url), 20_000, "runtime del proyecto");
  await waitFor(
    async () => (await api("GET", "/api/project/runtime/status")).data.status === "running",
    10_000,
    "estado running",
  );

  const stopped = await api("POST", "/api/project/runtime/stop");
  assert.equal(stopped.data.status, "stopped");
  await waitFor(async () => (await isUp(url)) === 0, 10_000, "cierre del puerto");
});

test("pipeline de produccion: valida, compila, arranca y el estado lo refleja", async () => {
  const cwd = createTinyProject("tiny-pipeline");
  const port = await freePort();

  const run = await api("POST", "/api/project/production/run", { cwd, port, maxAttempts: 1 });
  assert.equal(run.status, 200, JSON.stringify(run.data).slice(0, 600));
  assert.equal(run.data.success, true);
  assert.equal(run.data.phase, "ready");

  const url = "http://127.0.0.1:" + port;
  assert.equal(await isUp(url), 200);

  // El panel lee este estado mientras el pipeline corre.
  const status = await api("GET", "/api/project/production/status");
  assert.equal(status.data.phase, "ready");
  assert.equal(status.data.running, true);
  assert.equal(status.data.cwd, cwd);
  assert.ok(status.data.events.length > 0);

  // Los logs tardios del runtime no deben devolverlo a una fase anterior.
  await fetch(url);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal((await api("GET", "/api/project/production/status")).data.phase, "ready");

  const stopped = await api("POST", "/api/project/production/stop");
  assert.equal(stopped.data.phase, "stopped");
  assert.equal(stopped.data.running, false);
  await waitFor(async () => (await isUp(url)) === 0, 10_000, "cierre del puerto");
});

test("market: sin proveedor de IA crea un change-set local aplicable", async () => {
  const projectPath = createTinyProject("tiny-market");
  const { status, data } = await api("POST", "/api/project/change-set/create", {
    projectPath,
    prompt: "Mejora la pagina de inicio",
  });

  assert.equal(status, 200, JSON.stringify(data).slice(0, 400));
  assert.equal(data.ok, true);
  assert.equal(typeof data.changeSet.id, "string");
});
