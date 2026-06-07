'use client';

import type { ProjectManifest } from '@/lib/project-manifest';

interface ProjectScanPanelProps {
  projectRoot: string;
  manifest: ProjectManifest | null;
  isScanning: boolean;
  scanError: string | null;
  onProjectRootChange: (value: string) => void;
  onScan: () => void;
  onLoadEvaluatePrompt: () => void;
}

export function ProjectScanPanel({
  projectRoot,
  manifest,
  isScanning,
  scanError,
  onProjectRootChange,
  onScan,
  onLoadEvaluatePrompt,
}: ProjectScanPanelProps) {
  const criticalFiles = manifest?.importantFiles.filter((file) => file.importance === 'critical') ?? [];
  const highFiles = manifest?.importantFiles.filter((file) => file.importance === 'high') ?? [];
  const stacks = manifest?.detectedStacks ?? [];

  return (
    <section className="panel project-scan-panel">
      <div className="panel-header">
        <div>
          <h2>Scanner de proyecto</h2>
          <p>Escanea una carpeta local, genera manifiesto y prepara evaluación sin mandar 5000 archivos al modelo.</p>
        </div>
        <span className={`pill ${manifest ? 'success' : 'warning'}`}>
          {manifest ? 'manifiesto listo' : 'sin manifiesto'}
        </span>
      </div>

      <div className="scan-controls">
        <div className="control-field scan-root-field">
          <label htmlFor="projectRoot">Ruta del proyecto local</label>
          <input
            id="projectRoot"
            value={projectRoot}
            onChange={(event) => onProjectRootChange(event.target.value)}
            placeholder='Ej: C:\Users\martin\Desktop\VSC\BestS\Coder'
          />
        </div>

        <div className="scan-actions">
          <button className="secondary-btn" type="button" onClick={onScan} disabled={isScanning}>
            {isScanning ? 'Escaneando…' : 'Escanear proyecto'}
          </button>
          <button className="ghost-btn" type="button" onClick={onLoadEvaluatePrompt} disabled={!manifest || isScanning}>
            Cargar prompt de evaluación
          </button>
        </div>
      </div>

      {scanError ? (
        <div className="scan-error">
          <strong>Error de escaneo</strong>
          <p>{scanError}</p>
        </div>
      ) : null}

      {manifest ? (
        <>
          <div className="scan-metric-grid">
            <article className="metric-card">
              <span>Proyecto</span>
              <strong>{manifest.projectName}</strong>
            </article>
            <article className="metric-card">
              <span>Archivos</span>
              <strong>{manifest.stats.totalFiles}</strong>
            </article>
            <article className="metric-card">
              <span>Incluidos</span>
              <strong>{manifest.stats.includedFiles}</strong>
            </article>
            <article className="metric-card">
              <span>Ignorados</span>
              <strong>{manifest.stats.ignoredFiles}</strong>
            </article>
          </div>

          <div className="scan-columns">
            <article className="scan-card">
              <h3>Stack detectado</h3>
              <div className="status-row">
                {stacks.map((stack) => (
                  <span key={stack.id} className="pill success">
                    {stack.label} {Math.round(stack.confidence * 100)}%
                  </span>
                ))}
              </div>
            </article>

            <article className="scan-card">
              <h3>Archivos críticos</h3>
              <div className="scan-file-list">
                {criticalFiles.slice(0, 12).map((file) => (
                  <span key={file.path} className="scan-file">
                    {file.path}
                  </span>
                ))}
                {criticalFiles.length === 0 ? <span className="muted">No se detectaron críticos.</span> : null}
              </div>
            </article>

            <article className="scan-card">
              <h3>Archivos importantes</h3>
              <div className="scan-file-list">
                {highFiles.slice(0, 16).map((file) => (
                  <span key={file.path} className="scan-file">
                    {file.path}
                  </span>
                ))}
                {highFiles.length === 0 ? <span className="muted">No se detectaron importantes.</span> : null}
              </div>
            </article>

            <article className="scan-card">
              <h3>Notas</h3>
              <div className="scan-file-list">
                {manifest.notes.map((note) => (
                  <span key={note} className="scan-file warning">
                    {note}
                  </span>
                ))}
                {manifest.notes.length === 0 ? <span className="muted">Sin notas adicionales.</span> : null}
              </div>
            </article>
          </div>
        </>
      ) : (
        <div className="scan-empty">
          <strong>Primer paso serio para evaluar proyectos grandes</strong>
          <p>
            Escanea el proyecto. El sistema creará un mapa inteligente con archivos clave, stack detectado y rutas
            importantes antes de pedirle al agente que opine.
          </p>
        </div>
      )}
    </section>
  );
}
