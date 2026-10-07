'use client';

import { useEffect, useMemo, useState } from 'react';
import { DevicePreviewFrame } from '@/components/device-preview-frame';
import { ProjectInspectorPanel } from '@/components/project-inspector-panel';
import { RuntimeTopbar } from '@/components/runtime-topbar';
import {
  getLiveRuntimeStatus,
  startLiveRuntime,
  stopLiveRuntime,
} from '@/lib/live-project-client';
import type { RuntimeDevice, RuntimeStatusResponse } from '@/lib/live-project/types';

const DEFAULT_PROJECT_PATH = 'C:\\Users\\martin\\Desktop\\VSC\\APPS\\migrahoy';

const EMPTY_RUNTIME: RuntimeStatusResponse = {
  status: 'idle',
  logs: [],
  routes: [],
  updatedAt: '',
};

export function LiveProjectView() {
  const [projectPath, setProjectPath] = useState(DEFAULT_PROJECT_PATH);
  const [port, setPort] = useState(3001);
  const [device, setDevice] = useState<RuntimeDevice>('desktop');
  const [runtime, setRuntime] = useState<RuntimeStatusResponse>(EMPTY_RUNTIME);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const projectName = useMemo(() => {
    const normalized = projectPath.replaceAll('\\', '/');
    return normalized.split('/').filter(Boolean).at(-1) ?? 'Proyecto';
  }, [projectPath]);

  async function refreshStatus() {
    try {
      const status = await getLiveRuntimeStatus();
      setRuntime(status);
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'No se pudo consultar el runtime.',
      }));
    }
  }

  async function handleStart() {
    setLoading(true);

    try {
      const status = await startLiveRuntime({
        cwd: projectPath,
        port,
      });

      setRuntime(status);
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'No se pudo iniciar el runtime.',
      }));
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);

    try {
      const status = await stopLiveRuntime();
      setRuntime(status);
    } catch (error) {
      setRuntime((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'No se pudo detener el runtime.',
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    void refreshStatus();

    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 2500);

    return () => window.clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <section className="live-runtime">
        <div className="runtime-card">
          <h3>Visual Runtime</h3>
          <p className="muted">Preparando vista visual del proyecto…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="live-runtime">
      <div className="runtime-config">
        <label>
          Ruta del proyecto
          <input
            value={projectPath}
            onChange={(event) => setProjectPath(event.target.value)}
            placeholder="C:\Users\martin\Desktop\VSC\APPS\migrahoy"
          />
        </label>

        <label>
          Puerto
          <input
            type="number"
            value={port}
            onChange={(event) => setPort(Number(event.target.value || 3000))}
            min={1024}
            max={65535}
          />
        </label>
      </div>

      <RuntimeTopbar
        projectName={projectName}
        url={runtime.url}
        status={runtime.status}
        device={device}
        onDeviceChange={setDevice}
        onStart={handleStart}
        onStop={handleStop}
        onRefresh={refreshStatus}
        loading={loading}
      />

      <div className="runtime-layout">
        <div className="runtime-left">
          <section className="runtime-card">
            <h3>Timeline</h3>
            <div className="runtime-timeline">
              {runtime.logs.slice(-12).map((line, index) => (
                <div key={`${line}-${index}`} className="timeline-item">
                  {line}
                </div>
              ))}

              {runtime.logs.length === 0 ? (
                <p className="muted">$ esperando ejecución…</p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="runtime-center">
          <DevicePreviewFrame
            url={runtime.url}
            device={device}
            status={runtime.status}
          />
        </div>

        <ProjectInspectorPanel
          cwd={runtime.cwd}
          port={runtime.port}
          pid={runtime.pid}
          status={runtime.status}
          error={runtime.error}
          routes={runtime.routes}
          logs={runtime.logs}
        />
      </div>

      <section className="runtime-terminal">
        <div className="runtime-terminal-header">
          <strong>Terminal / Logs</strong>
          <span>{runtime.updatedAt || 'sin actualización'}</span>
        </div>

        <pre>{runtime.logs.join('\n') || '$ esperando runtime…'}</pre>
      </section>
    </section>
  );
}