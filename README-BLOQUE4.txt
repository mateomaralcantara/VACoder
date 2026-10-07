VACoder BLOQUE 4 — REAL CLOUD RUNTIME

Flujo:
Coder UI
 -> Workspace Snapshot privado en Supabase Storage
 -> Cloud Job (executionProvider=e2b)
 -> claim_next_cloud_agent_run()
 -> standalone cloud worker
 -> E2B isolated Linux sandbox
 -> npm install/ci
 -> typecheck
 -> build
 -> tests
 -> persisted runtime/events/logs
 -> sandbox kill

LIVE 3 local queda intacto. La migracion modifica claim_next_agent_run()
para excluir executionProvider=e2b.

Snapshot seguro:
- excluye .env*
- excluye *.pem/*.key/*.p12/*.pfx
- excluye id_rsa/id_ed25519
- excluye .git, .next, node_modules, dist, build, coverage, .turbo, .cache, .vercel

Para independencia completa de la PC:
despliega services/cloud-worker/Dockerfile en un host de contenedores persistente.
El cloud worker reclama Supabase directamente y no depende de Next.js.
