'use client';

import { useMemo, useState } from 'react';
import type { RuntimeDevice, RuntimeStatus } from '@/lib/live-project/types';

type DevicePreviewFrameProps = {
  url?: string;
  device: RuntimeDevice;
  status: RuntimeStatus;
};

const deviceWidths: Record<RuntimeDevice, number | string> = {
  desktop: '100%',
  tablet: 820,
  mobile: 390,
};

const deviceHeights: Record<RuntimeDevice, number> = {
  desktop: 720,
  tablet: 720,
  mobile: 720,
};

export function DevicePreviewFrame({ url, device, status }: DevicePreviewFrameProps) {
  const [version, setVersion] = useState(0);

  const frameUrl = useMemo(() => {
    if (!url) {
      return '';
    }

    return `${url}?vacoderPreview=${version}`;
  }, [url, version]);

  return (
    <div className="device-preview-shell">
      <div className="device-preview-header">
        <div className="browser-dots">
          <span />
          <span />
          <span />
        </div>

        <div className="browser-address">
          {url || 'Esperando localhost...'}
        </div>

        <button type="button" onClick={() => setVersion((current) => current + 1)}>
          Recargar iframe
        </button>
      </div>

      <div className="device-preview-stage">
        <div
          className={`device-frame device-${device}`}
          style={{
            width: deviceWidths[device],
            height: deviceHeights[device],
          }}
        >
          {status === 'running' && frameUrl ? (
            <iframe title="Live project preview" src={frameUrl} />
          ) : (
            <div className="preview-empty">
              <h3>Preview no disponible</h3>
              <p>Inicia el runtime para ver el proyecto vivo dentro de VACoder.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}