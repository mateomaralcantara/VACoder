'use client';

interface RunStatusBarProps {
  status: string;
  isRunning: boolean;
  changedFiles: number;
  logs: number;
}

export function RunStatusBar({ status, isRunning, changedFiles, logs }: RunStatusBarProps) {
  return (
    <section className="run-status-bar" aria-live="polite">
      <span className={`run-dot ${isRunning ? 'running' : ''}`} />
      <strong className="status-title">{status}</strong>
      <div className="status-metrics">
        <span className="pill neutral">Archivos: {changedFiles}</span>
        <span className="pill neutral">Eventos: {logs}</span>
        <span className={`pill ${isRunning ? 'warning' : 'success'}`}>{isRunning ? 'ejecutando' : 'estable'}</span>
      </div>
    </section>
  );
}
