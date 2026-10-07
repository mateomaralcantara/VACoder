'use client';

import type { LiveProjectRoute, RuntimeStatus } from '@/lib/live-project/types';

type ProjectInspectorPanelProps = {
  cwd?: string;
  port?: number;
  pid?: number;
  status: RuntimeStatus;
  error?: string;
  routes: LiveProjectRoute[];
  logs: string[];
};

export function ProjectInspectorPanel({
  cwd,
  port,
  pid,
  status,
  error,
  routes,
  logs,
}: ProjectInspectorPanelProps) {
  return (
    <aside className="project-inspector">
      <section className="inspector-card">
        <h3>Runtime</h3>
        <dl>
          <div>
            <dt>Estado</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Puerto</dt>
            <dd>{port ?? '—'}</dd>
          </div>
          <div>
            <dt>PID</dt>
            <dd>{pid ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="inspector-card">
        <h3>Proyecto</h3>
        <p className="runtime-path">{cwd || 'Sin carpeta activa'}</p>
      </section>

      <section className="inspector-card">
        <h3>Rutas</h3>
        <div className="runtime-route-list">
          {routes.length > 0 ? (
            routes.map((route) => (
              <div key={route.path} className="runtime-route">
                <span>{route.label}</span>
                <code>{route.path}</code>
              </div>
            ))
          ) : (
            <p className="muted">Sin rutas detectadas.</p>
          )}
        </div>
      </section>

      {error ? (
        <section className="inspector-card error-card">
          <h3>Error</h3>
          <pre>{error}</pre>
        </section>
      ) : null}

      <section className="inspector-card">
        <h3>Logs recientes</h3>
        <pre className="mini-log">{logs.slice(-16).join('\n') || '$ sin logs todavía'}</pre>
      </section>
    </aside>
  );
}