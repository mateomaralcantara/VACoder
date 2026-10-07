'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '@/components/production-run-panel.module.css';
import {
  getProductionStatus,
  startProductionRun,
  stopProductionRun,
} from '@/lib/production-client';
import type {
  ProductionEvent,
  ProductionPhase,
  ProductionStatus,
} from '@/lib/production/types';

interface ProductionRunPanelProps {
  defaultCwd?: string;
  defaultPort?: number;
}

const phaseLabels: Record<ProductionPhase, string> = {
  idle: 'En espera',
  installing: 'Instalando',
  typechecking: 'Typecheck',
  building: 'Compilando',
  repairing: 'Reparando',
  starting: 'Iniciando',
  verifying: 'Verificando',
  ready: 'Lista',
  failed: 'Falló',
  stopped: 'Detenida',
};

const defaultStatus: ProductionStatus = {
  phase: 'idle',
  running: false,
  events: [],
  updatedAt: new Date().toISOString(),
};

function isProductionPhase(value: unknown): value is ProductionPhase {
  return (
    value === 'idle' ||
    value === 'installing' ||
    value === 'typechecking' ||
    value === 'building' ||
    value === 'repairing' ||
    value === 'starting' ||
    value === 'verifying' ||
    value === 'ready' ||
    value === 'failed' ||
    value === 'stopped'
  );
}

function normalizeStatus(value: unknown): ProductionStatus {
  if (!value || typeof value !== 'object') {
    return {
      ...defaultStatus,
      updatedAt: new Date().toISOString(),
    };
  }

  const raw = value as Partial<ProductionStatus> & {
    status?: string;
    message?: string;
  };

  const phase = isProductionPhase(raw.phase)
    ? raw.phase
    : raw.status === 'running'
      ? 'starting'
      : raw.status === 'error'
        ? 'failed'
        : 'idle';

  return {
    ...defaultStatus,
    ...raw,
    phase,
    running: Boolean(raw.running),
    events: Array.isArray(raw.events) ? raw.events : [],
    updatedAt:
      typeof raw.updatedAt === 'string'
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

function isBusy(phase: ProductionPhase): boolean {
  return [
    'installing',
    'typechecking',
    'building',
    'repairing',
    'starting',
    'verifying',
  ].includes(phase);
}

function formatEventTime(event: ProductionEvent): string {
  if (!event.at) {
    return '—';
  }

  return new Date(event.at).toLocaleTimeString();
}

function getPhaseLabel(phase: ProductionPhase): string {
  return phaseLabels[phase] || 'Estado desconocido';
}

export function ProductionRunPanel({
  defaultCwd = 'C:/Users/martin/Desktop/VSC/APPS/migrahoy',
  defaultPort = 3001,
}: ProductionRunPanelProps) {
  const [cwd, setCwd] = useState(defaultCwd);
  const [port, setPort] = useState(String(defaultPort));
  const [maxAttempts, setMaxAttempts] = useState('5');
  const [error, setError] = useState('');

  const [status, setStatus] = useState<ProductionStatus>(defaultStatus);

  const safeStatus = normalizeStatus(status);
  const busy = isBusy(safeStatus.phase);

  const visibleEvents = useMemo(() => {
    return [...safeStatus.events].reverse().slice(0, 150);
  }, [safeStatus.events]);

  async function refreshStatus() {
    const nextStatus = await getProductionStatus();
    setStatus(normalizeStatus(nextStatus));
  }

  async function handleRun() {
    setError('');

    try {
      const result = await startProductionRun({
        cwd,
        port: Number(port),
        maxAttempts: Number(maxAttempts),
      });

      await refreshStatus();

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (currentError) {
      const message =
        currentError instanceof Error ? currentError.message : 'Error desconocido.';

      setError(message);

      try {
        await refreshStatus();
      } catch {
        // No hacemos nada. El error principal ya está visible.
      }
    }
  }

  async function handleStop() {
    setError('');

    try {
      const nextStatus = await stopProductionRun();
      setStatus(normalizeStatus(nextStatus));
    } catch (currentError) {
      const message =
        currentError instanceof Error ? currentError.message : 'No se pudo detener.';

      setError(message);
    }
  }

  useEffect(() => {
    refreshStatus().catch(() => undefined);

    const interval = window.setInterval(() => {
      refreshStatus().catch(() => undefined);
    }, busy ? 1500 : 5000);

    return () => window.clearInterval(interval);
  }, [busy]);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Production Gate</p>
          <h2>Crear, compilar, reparar y validar</h2>
          <p className={styles.description}>
            Este módulo no declara una app como lista hasta que el build pase y el
            localhost responda sin error crítico.
          </p>
        </div>

        <span className={`${styles.badge} ${styles[safeStatus.phase] || ''}`}>
          {getPhaseLabel(safeStatus.phase)}
        </span>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Ruta del proyecto</span>
          <input
            value={cwd}
            onChange={(event) => setCwd(event.target.value)}
            placeholder="C:/Users/martin/Desktop/VSC/APPS/migrahoy"
          />
        </label>

        <label className={styles.field}>
          <span>Puerto</span>
          <input
            value={port}
            onChange={(event) => setPort(event.target.value)}
            inputMode="numeric"
          />
        </label>

        <label className={styles.field}>
          <span>Intentos</span>
          <input
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(event.target.value)}
            inputMode="numeric"
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={handleRun} disabled={busy}>
          {busy ? 'Trabajando...' : 'Compilar + reparar + ejecutar'}
        </button>

        <button type="button" onClick={refreshStatus}>
          Refrescar
        </button>

        <button type="button" onClick={handleStop}>
          Detener
        </button>

        {safeStatus.url ? (
          <a href={safeStatus.url} target="_blank" rel="noreferrer">
            Abrir localhost
          </a>
        ) : null}
      </div>

      {(error || safeStatus.error) && (
        <div className={styles.errorBox}>
          <strong>Error:</strong> {error || safeStatus.error}
        </div>
      )}

      <div className={styles.cards}>
        <div>
          <span>Runtime</span>
          <strong>{safeStatus.running ? 'Activo' : 'Inactivo'}</strong>
        </div>

        <div>
          <span>URL</span>
          <strong>{safeStatus.url || '—'}</strong>
        </div>

        <div>
          <span>PID</span>
          <strong>{safeStatus.pid || '—'}</strong>
        </div>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelineHeader}>
          <h3>Timeline</h3>
          <span>{safeStatus.events.length} evento(s)</span>
        </div>

        {visibleEvents.length > 0 ? (
          visibleEvents.map((event) => (
            <article
              key={event.id}
              className={`${styles.event} ${styles[event.level] || ''}`}
            >
              <div className={styles.eventTop}>
                <strong>{getPhaseLabel(event.phase)}</strong>
                <span>{formatEventTime(event)}</span>
              </div>

              <p>{event.message}</p>

              {event.details ? <pre>{event.details.slice(0, 2500)}</pre> : null}
            </article>
          ))
        ) : (
          <p className={styles.empty}>
            Todavía no hay eventos. Dale al botón y que empiece la batalla.
          </p>
        )}
      </div>
    </section>
  );
}