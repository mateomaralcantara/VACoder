'use client';

import { useMemo, useState } from 'react';
import {
  createProjectOnDisk,
  previewProjectBuild,
  runProjectCommand,
} from '@/lib/project-builder-client';
import type { ProjectBuilderPlan, ProjectBuilderRequest } from '@/lib/project-builder/types';

const DEFAULT_ROOT = 'C:\\Users\\martin\\Desktop\\VSC\\APPS';

export function ProjectBuilderPanel() {
  const [form, setForm] = useState<ProjectBuilderRequest>({
    rootPath: DEFAULT_ROOT,
    projectName: 'mi-app-fuerte',
    description: 'Una app web moderna, segura y lista para crecer.',
    appType: 'SaaS / Web App',
    stack: 'next-css-supabase',
    auth: true,
    database: true,
    payments: false,
    admin: true,
    deploy: 'vercel',
    style: 'moderna, profesional, oscura y premium',
  });

  const [plan, setPlan] = useState<ProjectBuilderPlan | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(() => {
    return plan?.files.find((file) => file.path === selectedFile) ?? plan?.files[0] ?? null;
  }, [plan, selectedFile]);

  function update<K extends keyof ProjectBuilderRequest>(key: K, value: ProjectBuilderRequest[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handlePreview() {
    setLoading(true);
    setLog([]);

    try {
      const nextPlan = await previewProjectBuild(form);
      setPlan(nextPlan);
      setSelectedFile(nextPlan.files[0]?.path ?? '');
      setLog((items) => [...items, `Preview generado: ${nextPlan.files.length} archivos.`]);
    } catch (error) {
      setLog((items) => [...items, error instanceof Error ? error.message : 'Error generando preview.']);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setLoading(true);

    try {
      const result = await createProjectOnDisk({ ...form, overwrite: false });
      setLog((items) => [
        ...items,
        `Proyecto creado en: ${result.projectPath}`,
        `Archivos creados: ${result.created.length}`,
        `Archivos omitidos: ${result.skipped.length}`,
        `Errores: ${result.errors.length}`,
      ]);
    } catch (error) {
      setLog((items) => [...items, error instanceof Error ? error.message : 'Error creando proyecto.']);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuild() {
    if (!form.rootPath || !form.projectName) {
      setLog((items) => [...items, 'Falta rootPath o projectName.']);
      return;
    }

    const cwd = `${form.rootPath}\\${form.projectName}`;

    setLoading(true);

    try {
      const result = await runProjectCommand({
        cwd,
        command: 'npm run build',
      });

      setLog((items) => [
        ...items,
        `$ ${result.command}`,
        result.stdout || '(sin stdout)',
        result.stderr || '(sin stderr)',
        `exitCode: ${result.exitCode}`,
      ]);
    } catch (error) {
      setLog((items) => [...items, error instanceof Error ? error.message : 'Error ejecutando build.']);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="builder-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project Builder</p>
          <h2>Crear app/web fuerte desde cero</h2>
          <p>Genera blueprint, archivos base, escritura en disco y build controlado.</p>
        </div>
        <span className="status-pill">{loading ? 'trabajando' : 'listo'}</span>
      </div>

      <div className="builder-grid">
        <div className="builder-form">
          <label>
            Carpeta destino
            <input
              value={form.rootPath ?? ''}
              onChange={(event) => update('rootPath', event.target.value)}
              placeholder={DEFAULT_ROOT}
            />
          </label>

          <label>
            Nombre del proyecto
            <input
              value={form.projectName}
              onChange={(event) => update('projectName', event.target.value)}
              placeholder="migrapro-web"
            />
          </label>

          <label>
            Tipo de app
            <input
              value={form.appType ?? ''}
              onChange={(event) => update('appType', event.target.value)}
              placeholder="SaaS, landing, dashboard..."
            />
          </label>

          <label>
            Descripción
            <textarea
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Describe la app que quieres crear"
              rows={5}
            />
          </label>

          <label>
            Stack
            <select
              value={form.stack}
              onChange={(event) => update('stack', event.target.value as ProjectBuilderRequest['stack'])}
            >
              <option value="next-css-supabase">Next.js + CSS + Supabase-ready</option>
              <option value="next-css">Next.js + CSS</option>
              <option value="vite-react">Vite + React</option>
            </select>
          </label>

          <div className="checkbox-grid">
            <label>
              <input
                type="checkbox"
                checked={Boolean(form.auth)}
                onChange={(event) => update('auth', event.target.checked)}
              />
              Auth
            </label>

            <label>
              <input
                type="checkbox"
                checked={Boolean(form.database)}
                onChange={(event) => update('database', event.target.checked)}
              />
              Base de datos
            </label>

            <label>
              <input
                type="checkbox"
                checked={Boolean(form.admin)}
                onChange={(event) => update('admin', event.target.checked)}
              />
              Admin
            </label>

            <label>
              <input
                type="checkbox"
                checked={Boolean(form.payments)}
                onChange={(event) => update('payments', event.target.checked)}
              />
              Pagos
            </label>
          </div>

          <div className="builder-actions">
            <button type="button" onClick={handlePreview} disabled={loading}>
              Generar preview
            </button>
            <button type="button" onClick={handleCreate} disabled={loading || !plan}>
              Crear en disco
            </button>
            <button type="button" onClick={handleBuild} disabled={loading}>
              Ejecutar build
            </button>
          </div>
        </div>

        <div className="builder-preview">
          <h3>Blueprint</h3>
          {plan ? (
            <pre>{JSON.stringify(plan.blueprint, null, 2)}</pre>
          ) : (
            <p>Genera un preview para ver el plan técnico.</p>
          )}

          <h3>Archivos</h3>
          <div className="file-list">
            {plan?.files.map((file) => (
              <button
                key={file.path}
                type="button"
                className={selectedFile === file.path ? 'active' : ''}
                onClick={() => setSelectedFile(file.path)}
              >
                {file.path}
              </button>
            ))}
          </div>

          {selected ? (
            <>
              <h3>{selected.path}</h3>
              <pre>{selected.content}</pre>
            </>
          ) : null}
        </div>
      </div>

      <div className="builder-log">
        <h3>Log</h3>
        <pre>{log.join('\n') || '$ esperando acción…'}</pre>
      </div>
    </section>
  );
}