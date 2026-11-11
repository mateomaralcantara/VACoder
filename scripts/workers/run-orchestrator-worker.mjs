#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function readEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[t.slice(0, i).trim()] = value;
  }
  return env;
}

const root = process.cwd();
const fileEnv = readEnv(path.join(root, ".env.local"));
const env = { ...fileEnv, ...process.env };
const baseUrl = (env.VACODER_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const token = env.VACODER_WORKER_TOKEN || "";
const workerId = `${os.hostname()}-${process.pid}`;
if (!token) throw new Error("Falta VACODER_WORKER_TOKEN en .env.local");

let stopped = false;
process.on("SIGINT", () => { stopped = true; console.log("\nWorker detenido."); });
process.on("SIGTERM", () => { stopped = true; });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log("==========================================");
console.log(" VACODER LIVE 3 - JOB WORKER");
console.log("==========================================");
console.log("Worker:", workerId);
console.log("API   :", baseUrl);
console.log("Puedes cerrar el navegador; este proceso sigue trabajando.");

while (!stopped) {
  try {
    const response = await fetch(`${baseUrl}/api/orchestrator/worker/tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ workerId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    if (!data.idle) console.log(new Date().toLocaleTimeString(), JSON.stringify(data));
    await sleep(data.idle ? 3000 : 900);
  } catch (error) {
    console.error(new Date().toLocaleTimeString(), error instanceof Error ? error.message : String(error));
    await sleep(5000);
  }
}
