// Prueba de humo: levanta el build de produccion y comprueba, por HTTP, que
// las paginas responden y que las protecciones estan activas.
//
// Requiere `npm run build` previo. Se ejecuta con `npm run test:e2e`.

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import net from "node:net";

const require = createRequire(import.meta.url);
const WEBHOOK_SECRET = "whsec_smoke_test";

let server;
let base;
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

async function waitUntilReady(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // El servidor aun no escucha.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error("El servidor no arranco a tiempo.\n" + serverLog);
}

function post(path, body, headers = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  });
}

before(async () => {
  const port = await freePort();
  base = "http://127.0.0.1:" + port;

  // Entorno limpio: sin Supabase, sin proveedores y sin herramientas locales,
  // igual que un despliegue recien creado.
  const env = { ...process.env, NODE_ENV: "production", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, DEMO_MODE: "true" };

  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "VACODER_LOCAL_TOOLS_ENABLED",
    "VACODER_WORKER_TOKEN",
  ]) {
    delete env[key];
  }

  server = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );

  server.stdout.on("data", (chunk) => (serverLog += chunk));
  server.stderr.on("data", (chunk) => (serverLog += chunk));

  await waitUntilReady(base + "/api/live1/health");
});

after(() => {
  server?.kill("SIGTERM");
});

test("paginas publicas responden", async () => {
  for (const path of ["/", "/login", "/signup", "/studio", "/setup"]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.equal(response.status, 200, path);
  }
});

test("cabeceras de seguridad", async () => {
  const response = await fetch(base + "/");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(response.headers.get("x-powered-by"), null);
});

test("el dashboard no se sirve sin sesion", async () => {
  for (const path of ["/dashboard", "/dashboard/billing", "/dashboard/projects/new"]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.ok([302, 307].includes(response.status), path + " -> " + response.status);
    assert.match(response.headers.get("location") || "", /\/(setup|login)$/);
  }
});

test("las herramientas locales estan cerradas en produccion", async () => {
  const attempts = [
    ["/api/supreme/runtime/command", { projectPath: "/tmp", command: "whoami" }],
    ["/api/supreme/runtime/start", { projectPath: "/tmp", command: "npm run dev" }],
    ["/api/supreme/deploy/vercel", { projectPath: "/tmp" }],
    ["/api/project/run-command", { cwd: "/tmp", command: "npm test" }],
    ["/api/project/patch/apply", { projectPath: "/tmp" }],
    ["/api/project/git/commit", { projectPath: "/tmp", message: "x" }],
    ["/api/project/scan", { projectPath: "/tmp" }],
    ["/api/project/builder/create", { projectName: "x" }],
  ];

  for (const [path, body] of attempts) {
    const response = await post(path, body);
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).code, "LOCAL_TOOLS_DISABLED");
  }

  const status = await fetch(base + "/api/supreme/runtime/status");
  assert.equal(status.status, 403);
});

test("los endpoints de workers rechazan peticiones sin token", async () => {
  const response = await post("/api/orchestrator/worker/tick", {});
  assert.ok(response.status >= 400, "status " + response.status);
});

test("webhook de Stripe: exige firma valida", async () => {
  const body = JSON.stringify({ type: "invoice.paid", data: { object: {} } });

  const unsigned = await post("/api/billing/webhook", body);
  assert.equal(unsigned.status, 400);

  const forged = await post("/api/billing/webhook", body, {
    "stripe-signature": "t=" + Math.floor(Date.now() / 1000) + ",v1=" + "0".repeat(64),
  });
  assert.equal(forged.status, 400);

  const timestamp = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(timestamp + "." + body).digest("hex");
  const signed = await post("/api/billing/webhook", body, {
    "stripe-signature": "t=" + timestamp + ",v1=" + v1,
  });
  assert.equal(signed.status, 200);
  assert.deepEqual(await signed.json(), { ok: true, ignored: true });
});

test("agente: el modo demo emite eventos NDJSON validos y termina", async () => {
  const response = await post("/api/agent/stream", {
    prompt: "Crea una pagina de inicio sencilla",
    provider: "demo",
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/x-ndjson/);

  const lines = (await response.text()).split("\n").filter(Boolean);
  assert.ok(lines.length >= 3, "solo " + lines.length + " eventos");

  const events = lines.map((line) => JSON.parse(line));

  for (const event of events) {
    assert.equal(typeof event.type, "string");
    assert.equal(typeof event.runId, "string");
  }

  assert.equal(events.some((event) => event.type === "error"), false);
});

test("agente: rechaza solicitudes invalidas", async () => {
  assert.equal((await post("/api/agent/stream", "no es json")).status, 400);
  assert.equal((await post("/api/agent/stream", { prompt: "" })).status, 400);
  assert.equal(
    (await post("/api/agent/stream", { prompt: "hola mundo", provider: "otro" })).status,
    400,
  );
});
