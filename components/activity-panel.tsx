'use client';

import { useMemo, useState } from 'react';
import type { ActivityLog, FinalArtifact } from '@/lib/types';

interface ActivityPanelProps {
  logs: ActivityLog[];
  artifacts: FinalArtifact[];
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Formato estable para SSR/cliente.
 * No usar toLocaleTimeString aquí porque puede renderizar espacios invisibles distintos:
 * "p. m." vs "p. m." y eso rompe hydration.
 */
function formatTime(timestamp?: string): string {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

export function ActivityPanel({ logs, artifacts }: ActivityPanelProps) {
  const [tab, setTab] = useState<'activity' | 'final'>('activity');

  const metrics = useMemo(() => {
    const errors = logs.filter((log) => log.level === 'error').length;
    const warnings = logs.filter((log) => log.level === 'warning').length;
    const success = logs.filter((log) => log.level === 'success').length;

    return {
      events: logs.length,
      artifacts: artifacts.length,
      alerts: warnings + errors,
      success,
    };
  }, [artifacts.length, logs]);

  const hasArtifacts = artifacts.length > 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Actividad / Resultado final</h2>
          <p>Auditoría del agente, señales de riesgo y evidencia entregable.</p>
        </div>
        <span className={`pill ${metrics.alerts > 0 ? 'warning' : 'success'}`}>
          {metrics.alerts > 0 ? `${metrics.alerts} alerta(s)` : 'limpio'}
        </span>
      </div>

      <div className="panel-tabs">
        <button type="button" className={`tab-btn ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>
          Timeline
        </button>
        <button type="button" className={`tab-btn ${tab === 'final' ? 'active' : ''}`} onClick={() => setTab('final')}>
          Entregables
        </button>
      </div>

      {tab === 'activity' ? (
        <div className="console" aria-label="Registro de actividad">
          {logs.length === 0 ? <span className="console-line info">$ esperando eventos del agente…</span> : null}
          {logs.map((log) => {
            const time = formatTime(log.timestamp);

            return (
              <span key={log.id} className={`console-line ${log.level}`}>
                {time ? `[${time}] ` : ''}
                {log.message}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="artifact-list">
          {!hasArtifacts ? <div className="empty-state">Todavía no hay entregables finales.</div> : null}
          {artifacts.map((artifact) => (
            <article key={artifact.id} className="artifact-item">
              <div className="mini-row" style={{ justifyContent: 'space-between' }}>
                <strong>{artifact.title}</strong>
                {'kind' in artifact && artifact.kind ? <span className="pill neutral">{artifact.kind}</span> : null}
              </div>
              <p>{artifact.body}</p>
            </article>
          ))}
        </div>
      )}

      <div className="metric-grid">
        <article className="metric-card">
          <span>Eventos</span>
          <strong>{metrics.events}</strong>
        </article>
        <article className="metric-card">
          <span>Éxitos</span>
          <strong>{metrics.success}</strong>
        </article>
        <article className="metric-card">
          <span>Artefactos</span>
          <strong>{metrics.artifacts}</strong>
        </article>
      </div>
    </section>
  );
}