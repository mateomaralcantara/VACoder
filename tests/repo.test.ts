import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PLANS } from "../lib/billing/plans.ts";

// Railway despliega deploy/railway-cloud-worker como unidad independiente,
// asi que el worker existe dos veces. Esta prueba impide que diverjan.
test("el worker de Railway es identico al de services/cloud-worker", () => {
  assert.equal(
    fs.readFileSync("deploy/railway-cloud-worker/worker.mjs", "utf8"),
    fs.readFileSync("services/cloud-worker/worker.mjs", "utf8"),
  );
});

test("los limites de proyectos de TypeScript y SQL coinciden", () => {
  const sql = fs.readFileSync("supabase/migrations/20261110_billing_hardening.sql", "utf8");

  for (const plan of Object.values(PLANS)) {
    const match = sql.match(new RegExp("when '" + plan.id + "' then (\\w+)"));
    assert.ok(match, "falta el plan " + plan.id + " en plan_project_limit");
    assert.equal(match[1], plan.maxProjects === null ? "null" : String(plan.maxProjects), plan.id);
  }
});

test(".env.example documenta todas las variables que lee el codigo", () => {
  const documented = fs.readFileSync(".env.example", "utf8");
  const ignored = new Set(["NODE_ENV", "ComSpec", "comspec", "SystemRoot", "WINDIR"]);
  const missing = new Set<string>();

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = dir + "/" + entry.name;

      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx|mjs)$/.test(entry.name)) {
        for (const [, name] of fs.readFileSync(full, "utf8").matchAll(/process\.env\.([A-Za-z0-9_]+)/g)) {
          if (!ignored.has(name) && !documented.includes(name)) {
            missing.add(name);
          }
        }
      }
    }
  };

  for (const dir of ["app", "lib", "services", "scripts/workers"]) {
    walk(dir);
  }

  assert.deepEqual([...missing], []);
});
