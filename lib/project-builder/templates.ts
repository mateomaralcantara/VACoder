import type {
    GeneratedProjectFile,
    ProjectBlueprint,
    ProjectBuilderPlan,
    ProjectBuilderRequest,
  } from '@/lib/project-builder/types';
  import { assertValidBuilderRequest } from '@/lib/project-builder/validation';
  
  function titleCase(value: string): string {
    return value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  
  function asJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
  
  function createFile(path: string, language: string, content: string): GeneratedProjectFile {
    return {
      path,
      language,
      content: content.trimStart(),
    };
  }
  
  export function buildProjectBlueprint(input: ProjectBuilderRequest): ProjectBlueprint {
    const request = assertValidBuilderRequest(input);
  
    const hasSupabase =
      request.stack === 'next-css-supabase' ||
      Boolean(request.database) ||
      Boolean(request.auth);
  
    const modules = [
      'landing',
      'dashboard',
      hasSupabase ? 'supabase-ready' : null,
      request.auth ? 'auth-shell' : null,
      request.admin ? 'admin' : null,
      request.payments ? 'payments-placeholder' : null,
      'health-api',
    ].filter(Boolean) as string[];
  
    const routes = [
      '/',
      '/dashboard',
      request.auth ? '/login' : null,
      request.admin ? '/admin' : null,
      request.payments ? '/api/payments' : null,
      '/api/health',
    ].filter(Boolean) as string[];
  
    const database = hasSupabase
      ? ['profiles', 'app_events', request.payments ? 'payments' : null].filter(Boolean) as string[]
      : [];
  
    return {
      name: request.projectName,
      description: request.description,
      appType: request.appType || 'web app',
      stack:
        request.stack === 'vite-react'
          ? ['Vite', 'React', 'TypeScript']
          : ['Next.js App Router', 'React', 'TypeScript', hasSupabase ? 'Supabase-ready' : 'CSS'],
      modules,
      routes,
      database,
      commands: ['npm install', 'npm run build', 'npm run dev'],
      warnings: [
        'El proyecto generado es una base fuerte. Revisa credenciales, RLS, autenticación y permisos antes de producción.',
        'Nunca subas .env.local a GitHub.',
      ],
    };
  }
  
  export function buildProjectPlan(input: ProjectBuilderRequest): ProjectBuilderPlan {
    const request = assertValidBuilderRequest(input);
    const blueprint = buildProjectBlueprint(request);
    const displayName = titleCase(request.projectName);
  
    const hasSupabase =
      request.stack === 'next-css-supabase' ||
      Boolean(request.database) ||
      Boolean(request.auth);
  
    const files: GeneratedProjectFile[] = [
      createFile(
        'package.json',
        'json',
        asJson({
          name: request.projectName,
          version: '0.1.0',
          private: true,
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            typecheck: 'tsc --noEmit',
          },
          dependencies: {
            '@supabase/supabase-js': hasSupabase ? 'latest' : undefined,
            clsx: 'latest',
            next: 'latest',
            react: 'latest',
            'react-dom': 'latest',
          },
          devDependencies: {
            '@types/node': 'latest',
            '@types/react': 'latest',
            '@types/react-dom': 'latest',
            eslint: 'latest',
            'eslint-config-next': 'latest',
            typescript: 'latest',
          },
        }),
      ),
  
      createFile(
        'next.config.ts',
        'ts',
        `import type { NextConfig } from 'next';
  
  const nextConfig: NextConfig = {
    reactStrictMode: true,
  };
  
  export default nextConfig;
  `,
      ),
  
      createFile(
        'tsconfig.json',
        'json',
        asJson({
          compilerOptions: {
            target: 'ES2017',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: false,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: {
              '@/*': ['./*'],
            },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        }),
      ),
  
      createFile(
        '.env.example',
        'env',
        hasSupabase
          ? `NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  `
          : `NEXT_PUBLIC_APP_URL=http://localhost:3000
  `,
      ),
  
      createFile(
        'app/layout.tsx',
        'tsx',
        `import type { Metadata } from 'next';
  import './globals.css';
  
  export const metadata: Metadata = {
    title: '${displayName}',
    description: '${request.description.replaceAll("'", "\\'")}',
  };
  
  export default function RootLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <html lang="es">
        <body>{children}</body>
      </html>
    );
  }
  `,
      ),
  
      createFile(
        'app/globals.css',
        'css',
        `:root {
    --background: #07111f;
    --foreground: #f8fafc;
    --muted: #94a3b8;
    --card: rgba(15, 23, 42, 0.86);
    --border: rgba(148, 163, 184, 0.22);
    --accent: #38bdf8;
    --accent-2: #a78bfa;
  }
  
  * {
    box-sizing: border-box;
  }
  
  body {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 34rem),
      radial-gradient(circle at top right, rgba(167, 139, 250, 0.16), transparent 32rem),
      var(--background);
    color: var(--foreground);
    font-family: Arial, Helvetica, sans-serif;
  }
  
  a {
    color: inherit;
    text-decoration: none;
  }
  
  .page {
    min-height: 100vh;
  }
  
  .shell {
    width: min(1120px, calc(100% - 32px));
    margin: 0 auto;
  }
  
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 0;
  }
  
  .brand {
    font-weight: 800;
    letter-spacing: -0.04em;
  }
  
  .nav-links {
    display: flex;
    gap: 14px;
    color: var(--muted);
    font-size: 14px;
  }
  
  .hero {
    padding: 72px 0 48px;
    display: grid;
    gap: 28px;
  }
  
  .badge {
    width: fit-content;
    border: 1px solid var(--border);
    background: rgba(15, 23, 42, 0.6);
    color: var(--accent);
    padding: 8px 12px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 13px;
  }
  
  h1 {
    margin: 0;
    max-width: 860px;
    font-size: clamp(42px, 7vw, 78px);
    line-height: 0.92;
    letter-spacing: -0.07em;
  }
  
  .lead {
    max-width: 720px;
    color: var(--muted);
    font-size: 20px;
    line-height: 1.7;
  }
  
  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .button {
    border: 1px solid transparent;
    border-radius: 14px;
    padding: 13px 18px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    color: #020617;
  }
  
  .button.secondary {
    background: transparent;
    border-color: var(--border);
    color: var(--foreground);
  }
  
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    padding: 36px 0 72px;
  }
  
  .card {
    border: 1px solid var(--border);
    background: var(--card);
    backdrop-filter: blur(18px);
    border-radius: 24px;
    padding: 24px;
    min-height: 170px;
    box-shadow: 0 24px 80px rgba(2, 6, 23, 0.25);
  }
  
  .card h3 {
    margin: 0 0 10px;
    letter-spacing: -0.03em;
  }
  
  .card p {
    margin: 0;
    color: var(--muted);
    line-height: 1.6;
  }
  
  .form-card {
    max-width: 460px;
    margin: 48px auto;
  }
  
  .input {
    width: 100%;
    margin: 8px 0 14px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: rgba(15, 23, 42, 0.7);
    color: var(--foreground);
  }
  
  .table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .table th,
  .table td {
    border-bottom: 1px solid var(--border);
    padding: 12px;
    text-align: left;
  }
  
  @media (max-width: 800px) {
    .grid {
      grid-template-columns: 1fr;
    }
  
    .nav {
      align-items: flex-start;
      gap: 16px;
      flex-direction: column;
    }
  }
  `,
      ),
  
      createFile(
        'components/navbar.tsx',
        'tsx',
        `type NavbarProps = {
    name: string;
    showAdmin?: boolean;
    showAuth?: boolean;
  };
  
  export function Navbar({ name, showAdmin, showAuth }: NavbarProps) {
    return (
      <nav className="nav">
        <a href="/" className="brand">{name}</a>
        <div className="nav-links">
          <a href="/dashboard">Dashboard</a>
          {showAdmin ? <a href="/admin">Admin</a> : null}
          {showAuth ? <a href="/login">Login</a> : null}
        </div>
      </nav>
    );
  }
  `,
      ),
  
      createFile(
        'components/section-card.tsx',
        'tsx',
        `type SectionCardProps = {
    title: string;
    description: string;
  };
  
  export function SectionCard({ title, description }: SectionCardProps) {
    return (
      <article className="card">
        <h3>{title}</h3>
        <p>{description}</p>
      </article>
    );
  }
  `,
      ),
  
      createFile(
        'components/feature-grid.tsx',
        'tsx',
        `import { SectionCard } from '@/components/section-card';
  
  const features = [
    {
      title: 'Arquitectura limpia',
      description: 'Base lista para crecer con rutas, componentes y utilidades separadas.',
    },
    {
      title: 'Producción primero',
      description: 'Incluye health check, variables de entorno y estructura segura.',
    },
    {
      title: 'Lista para integrar',
      description: 'Preparada para Supabase, dashboard, admin y módulos de negocio.',
    },
  ];
  
  export function FeatureGrid() {
    return (
      <section className="grid">
        {features.map((feature) => (
          <SectionCard key={feature.title} {...feature} />
        ))}
      </section>
    );
  }
  `,
      ),
  
      createFile(
        'app/page.tsx',
        'tsx',
        `import { FeatureGrid } from '@/components/feature-grid';
  import { Navbar } from '@/components/navbar';
  
  export default function HomePage() {
    return (
      <main className="page">
        <div className="shell">
          <Navbar
            name="${displayName}"
            showAdmin={${String(Boolean(request.admin))}}
            showAuth={${String(Boolean(request.auth))}}
          />
  
          <section className="hero">
            <div className="badge">MVP fuerte generado por VACoder</div>
            <h1>${displayName}</h1>
            <p className="lead">${request.description.replaceAll('`', "'")}</p>
            <div className="actions">
              <a className="button" href="/dashboard">Entrar al dashboard</a>
              ${
                request.auth
                  ? '<a className="button secondary" href="/login">Iniciar sesión</a>'
                  : '<a className="button secondary" href="/api/health">Ver health check</a>'
              }
            </div>
          </section>
  
          <FeatureGrid />
        </div>
      </main>
    );
  }
  `,
      ),
  
      createFile(
        'app/dashboard/page.tsx',
        'tsx',
        `import { Navbar } from '@/components/navbar';
  import { SectionCard } from '@/components/section-card';
  
  export default function DashboardPage() {
    return (
      <main className="page">
        <div className="shell">
          <Navbar
            name="${displayName}"
            showAdmin={${String(Boolean(request.admin))}}
            showAuth={${String(Boolean(request.auth))}}
          />
  
          <section className="hero">
            <div className="badge">Dashboard</div>
            <h1>Panel principal</h1>
            <p className="lead">Centro operativo para controlar módulos, métricas y próximas acciones.</p>
          </section>
  
          <section className="grid">
            <SectionCard title="Estado" description="Base del proyecto lista para conectar datos reales." />
            <SectionCard title="Módulos" description="${blueprint.modules.join(', ')}" />
            <SectionCard title="Siguiente paso" description="Conecta autenticación, base de datos y reglas de negocio." />
          </section>
        </div>
      </main>
    );
  }
  `,
      ),
  
      createFile(
        'app/api/health/route.ts',
        'ts',
        `import { NextResponse } from 'next/server';
  
  export function GET() {
    return NextResponse.json({
      ok: true,
      service: '${request.projectName}',
      timestamp: new Date().toISOString(),
    });
  }
  `,
      ),
  
      createFile(
        'types/app.ts',
        'ts',
        `export type AppModule = '${blueprint.modules.join("' | '")}';
  
  export interface AppHealth {
    ok: boolean;
    service: string;
    timestamp: string;
  }
  `,
      ),
  
      createFile(
        'lib/env.ts',
        'ts',
        `export const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
  
  export function assertPublicEnv() {
    const missing: string[] = [];
  
    if (!env.supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!env.supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
    return {
      ok: missing.length === 0,
      missing,
    };
  }
  `,
      ),
  
      createFile(
        'lib/validators.ts',
        'ts',
        `export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }
  
  export function isEmail(value: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
  }
  `,
      ),
  
      createFile(
        'README.md',
        'md',
        `# ${displayName}
  
  ${request.description}
  
  ## Stack
  
  ${blueprint.stack.map((item) => `- ${item}`).join('\n')}
  
  ## Rutas
  
  ${blueprint.routes.map((item) => `- ${item}`).join('\n')}
  
  ## Comandos
  
  \`\`\`bash
  npm install
  npm run build
  npm run dev
  \`\`\`
  
  ## Variables de entorno
  
  Copia \`.env.example\` a \`.env.local\` y completa los valores reales.
  
  ## Nota de producción
  
  Antes de producción revisa seguridad, autenticación, políticas RLS, permisos de admin y manejo de errores.
  `,
      ),
    ];
  
    if (hasSupabase) {
      files.push(
        createFile(
          'lib/supabase.ts',
          'ts',
          `import { createClient } from '@supabase/supabase-js';
  import { env } from '@/lib/env';
  
  export function createBrowserSupabaseClient() {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error('Faltan variables públicas de Supabase.');
    }
  
    return createClient(env.supabaseUrl, env.supabaseAnonKey);
  }
  `,
        ),
  
        createFile(
          'supabase/schema.sql',
          'sql',
          `create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    full_name text,
    role text not null default 'user',
    created_at timestamptz not null default now()
  );
  
  create table if not exists public.app_events (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  
  alter table public.profiles enable row level security;
  alter table public.app_events enable row level security;
  
  create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);
  
  create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id);
  `,
        ),
      );
    }
  
    if (request.auth) {
      files.push(
        createFile(
          'app/login/page.tsx',
          'tsx',
          `import { Navbar } from '@/components/navbar';
  
  export default function LoginPage() {
    return (
      <main className="page">
        <div className="shell">
          <Navbar name="${displayName}" showAdmin={${String(Boolean(request.admin))}} showAuth />
  
          <section className="card form-card">
            <h1 style={{ fontSize: 36 }}>Iniciar sesión</h1>
            <p className="lead" style={{ fontSize: 16 }}>Pantalla base lista para conectar Supabase Auth.</p>
  
            <label>
              Email
              <input className="input" type="email" placeholder="tu@email.com" />
            </label>
  
            <label>
              Contraseña
              <input className="input" type="password" placeholder="********" />
            </label>
  
            <button className="button" type="button">Entrar</button>
          </section>
        </div>
      </main>
    );
  }
  `,
        ),
  
        createFile(
          'middleware.ts',
          'ts',
          `import { NextResponse, type NextRequest } from 'next/server';
  
  export function middleware(request: NextRequest) {
    const response = NextResponse.next();
    response.headers.set('x-vacoder-app', '${request.projectName}');
    return response;
  }
  
  export const config = {
    matcher: ['/dashboard/:path*', '/admin/:path*'],
  };
  `,
        ),
      );
    }
  
    if (request.admin) {
      files.push(
        createFile(
          'app/admin/page.tsx',
          'tsx',
          `import { Navbar } from '@/components/navbar';
  
  const rows = [
    { label: 'Usuarios', value: 'Pendiente' },
    { label: 'Eventos', value: 'Pendiente' },
    { label: 'Seguridad', value: 'Revisar RLS' },
  ];
  
  export default function AdminPage() {
    return (
      <main className="page">
        <div className="shell">
          <Navbar name="${displayName}" showAdmin showAuth={${String(Boolean(request.auth))}} />
  
          <section className="hero">
            <div className="badge">Admin</div>
            <h1>Panel de administración</h1>
            <p className="lead">Vista base para gestión interna. Protege esta ruta antes de producción.</p>
          </section>
  
          <section className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    );
  }
  `,
        ),
      );
    }
  
    if (request.payments) {
      files.push(
        createFile(
          'app/api/payments/route.ts',
          'ts',
          `import { NextResponse } from 'next/server';
  
  export async function POST() {
    return NextResponse.json(
      {
        ok: false,
        message: 'Conecta Stripe, PayPal o Azul antes de activar pagos reales.',
      },
      { status: 501 },
    );
  }
  `,
        ),
      );
    }
  
    return {
      blueprint,
      files,
      commands: blueprint.commands,
    };
  }