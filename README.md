# VACoder

IDE con agente de IA para crear, revisar y reparar aplicaciones web. Incluye
un estudio local (escaner de proyecto, parches, diff, terminal y preview), una
capa SaaS con organizaciones y proyectos, una cola de jobs y un runtime en la
nube que ejecuta cada build dentro de un sandbox aislado.

Next.js 15 · React 19 · Supabase (auth, Postgres, storage) · E2B · Stripe

## Empezar

Requiere Node 22.9 o superior.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Con `DEMO_MODE=true` y sin mas variables, `/studio` funciona con respuestas
simuladas. Para login, organizaciones y proyectos hace falta Supabase.

## Comandos

| Comando | Que hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | TypeScript sin emitir |
| `npm test` | Pruebas unitarias (`tests/`) |
| `npm run build` | Build de produccion |
| `npm run test:e2e` | Prueba de humo contra el build y flujos del Studio contra `next dev` (builder, escaner, comandos, runtime, pipeline) |
| `npm run validate` | Todo lo anterior en orden; es lo que corre CI |
| `npm run worker:orchestrator` | Worker de la cola de jobs (necesita la app levantada) |
| `npm run worker:cloud` | Worker del cloud runtime (sandbox E2B) |

## Configuracion

Todas las variables estan documentadas en `.env.example`.

### Supabase

1. Crea un proyecto y copia la URL y la llave publica a `.env.local`.
2. Ejecuta las migraciones de `supabase/migrations/` en orden de nombre.
3. Copia la secret key a `SUPABASE_SECRET_KEY` (solo servidor).

### Proveedores de IA

Pon `DEMO_MODE=false` y al menos una de `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY` o `GEMINI_API_KEY`.

### Facturacion (Stripe) — opcional

Sin las variables `STRIPE_*` los pagos quedan desactivados: no se muestra
ninguna opcion de compra y los limites de proyectos no se aplican. Para probar
el software no hace falta configurar nada de esto ni ejecutar la migracion
`20261110_billing_hardening.sql`.

Para activarlos:

1. Crea en Stripe un producto con precio mensual por cada plan de pago y copia
   sus ids a `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` y `STRIPE_PRICE_AGENCY`.
2. Copia la secret key a `STRIPE_SECRET_KEY`.
3. Crea un webhook que apunte a `https://TU-DOMINIO/api/billing/webhook` con
   los eventos `customer.subscription.created`, `customer.subscription.updated`
   y `customer.subscription.deleted`; copia su secreto a `STRIPE_WEBHOOK_SECRET`.
4. Activa el portal de clientes en Stripe (facturas, tarjeta, cancelacion).

El plan de una organizacion solo cambia cuando llega un evento firmado de
Stripe. La migracion `20261110_billing_hardening.sql` impide que un cliente
modifique su plan, su suscripcion o su saldo desde el navegador, y hace cumplir
el limite de proyectos de cada plan. Los limites se definen en
`lib/billing/plans.ts` y en la funcion SQL `plan_project_limit`; deben coincidir.

### Cloud runtime

`services/cloud-worker` es un worker independiente que reclama jobs de
Supabase y los ejecuta en un sandbox E2B (install, typecheck, build, tests).
Necesita `E2B_API_KEY`, `SUPABASE_SECRET_KEY` y `VACODER_WORKER_TOKEN`.
`deploy/railway-cloud-worker` es el mismo worker empaquetado para Railway; una
prueba impide que las dos copias diverjan, asi que cambia siempre ambas.

## Seguridad

Las rutas `/api/project/*` y `/api/supreme/*` leen y escriben el disco del
servidor y ejecutan procesos. Estan pensadas para la maquina del desarrollador:

- En produccion responden `403` salvo `VACODER_LOCAL_TOOLS_ENABLED=true`, y aun
  asi exigen sesion. No lo actives en un despliegue publico: usa el cloud runtime.
- Solo operan dentro de la raiz de proyectos (`VACODER_APPS_ROOT`).
- La terminal acepta una lista blanca de comandos (`lib/security/command-policy.ts`)
  y los procesos se lanzan sin shell (`lib/security/process.ts`).

`/api/agent/stream` es publico solo en modo demo. Con `DEMO_MODE=false` cada
peticion gasta creditos del proveedor de IA, asi que exige sesion.

Los endpoints de workers (`/api/orchestrator/worker/*`, `/api/cloud-runtime/worker/*`)
se autentican con `VACODER_WORKER_TOKEN`; el webhook de Stripe, con su firma.

## Estructura

```
app/                  Paginas y rutas API (Next.js App Router)
  api/project         Herramientas locales: scan, patch, diff, git, runtime
  api/supreme         Terminal, runtime, deploy y score locales
  api/orchestrator    Cola de jobs
  api/cloud-runtime   Jobs en sandbox
  api/billing         Webhook de Stripe
  dashboard           SaaS: organizaciones, proyectos, equipo, billing
components/           UI
lib/
  providers           OpenAI, Anthropic y Gemini
  security            Acceso, lista blanca de comandos, procesos, raiz de proyectos
  billing             Planes y Stripe
  orchestrator        Motor y ejecutores de jobs
  cloud-runtime       Snapshots y jobs en la nube
services/cloud-worker Worker E2B
supabase/migrations   Esquema y politicas RLS
scripts/workers       Arranque de los workers
scripts/legacy        Comprobaciones historicas de PowerShell (sin mantener)
tests/                Pruebas unitarias y prueba de humo (tests/e2e)
docs/                 Material de referencia
```
