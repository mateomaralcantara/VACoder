'use client';

import type { RuntimeDevice, RuntimeStatus } from '@/lib/live-project/types';

type RuntimeTopbarProps = {
  projectName: string;
  url?: string;
  status: RuntimeStatus;
  device: RuntimeDevice;
  onDeviceChange: (device: RuntimeDevice) => void;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  loading?: boolean;
};

const statusLabels: Record<RuntimeStatus, string> = {
  idle: 'Inactivo',
  starting: 'Iniciando',
  running: 'Activo',
  error: 'Error',
  stopped: 'Detenido',
};

export function RuntimeTopbar({
  projectName,
  url,
  status,
  device,
  onDeviceChange,
  onStart,
  onStop,
  onRefresh,
  loading,
}: RuntimeTopbarProps) {
  return (
    <div className="runtime-topbar">
      <div>
        <p className="runtime-eyebrow">Visual Runtime</p>
        <h2>{projectName || 'Proyecto sin nombre'}</h2>
      </div>

      <div className="runtime-status-row">
        <span className={`runtime-badge runtime-${status}`}>{statusLabels[status]}</span>

        {url ? (
          <a className="runtime-url" href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        ) : (
          <span className="runtime-url muted">Sin URL</span>
        )}
      </div>

      <div className="runtime-devices">
        {(['desktop', 'tablet', 'mobile'] as RuntimeDevice[]).map((item) => (
          <button
            key={item}
            type="button"
            className={device === item ? 'active' : ''}
            onClick={() => onDeviceChange(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="runtime-actions">
        <button type="button" onClick={onStart} disabled={loading || status === 'starting'}>
          Iniciar
        </button>
        <button type="button" onClick={onRefresh} disabled={loading}>
          Refrescar
        </button>
        <button type="button" onClick={onStop} disabled={loading || status === 'idle'}>
          Detener
        </button>
      </div>
    </div>
  );
}