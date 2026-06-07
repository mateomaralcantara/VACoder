'use client';

import type { Provider, RunMode, TeachingStyle } from '@/lib/types';

interface ControlBarProps {
  prompt: string;
  provider: Provider;
  teachingStyle: TeachingStyle;
  runMode: RunMode;
  model: string;
  isRunning: boolean;
  onPromptChange: (value: string) => void;
  onProviderChange: (value: Provider) => void;
  onTeachingStyleChange: (value: TeachingStyle) => void;
  onRunModeChange: (value: RunMode) => void;
  onModelChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function ControlBar({
  prompt,
  provider,
  teachingStyle,
  runMode,
  model,
  isRunning,
  onPromptChange,
  onProviderChange,
  onTeachingStyleChange,
  onRunModeChange,
  onModelChange,
  onRun,
  onStop,
  onReset,
}: ControlBarProps) {
  return (
    <section className="control-bar">
      <div className="control-grid">
        <div className="control-field" style={{ gridColumn: 'span 3' }}>
          <label htmlFor="goal">Misión del agente</label>
          <textarea
            id="goal"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Ej: Moderniza el dashboard, crea componentes reutilizables, valida riesgos y explícame cada decisión."
          />
        </div>

        <div className="control-field">
          <label htmlFor="provider">Proveedor</label>
          <select id="provider" value={provider} onChange={(event) => onProviderChange(event.target.value as Provider)} disabled={isRunning}>
            <option value="demo">Demo</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>

        <div className="control-field">
          <label htmlFor="runMode">Modo</label>
          <select id="runMode" value={runMode} onChange={(event) => onRunModeChange(event.target.value as RunMode)} disabled={isRunning}>
            <option value="plan-only">Solo planificar</option>
            <option value="safe-patch">Cambios seguros</option>
            <option value="auto-patch">Aplicar automático</option>
          </select>
        </div>

        <div className="control-field">
          <label htmlFor="teachingStyle">Profesor</label>
          <select
            id="teachingStyle"
            value={teachingStyle}
            onChange={(event) => onTeachingStyleChange(event.target.value as TeachingStyle)}
            disabled={isRunning}
          >
            <option value="mentor">Mentor</option>
            <option value="strict">Revisor estricto</option>
            <option value="fast-track">Modo rápido</option>
            <option value="business">Empresarial</option>
            <option value="beginner">Principiante</option>
          </select>
        </div>

        <div className="control-field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="model">Modelo opcional</label>
          <input
            id="model"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="Ej: gpt-5.5, claude, gemini"
            disabled={isRunning}
          />
        </div>
      </div>

      <div className="status-row" style={{ marginTop: 14 }}>
        <span className="pill success">interfaz moderna</span>
        <span className={`pill ${provider === 'demo' ? 'warning' : 'success'}`}>
          {provider === 'demo' ? 'demo activo' : `proveedor: ${provider}`}
        </span>
        <span className="pill neutral">modo: {runMode}</span>
        <span className="pill neutral">profesor: {teachingStyle}</span>
      </div>

      <div className="actions" style={{ marginTop: 14 }}>
        <button className="ghost-btn" type="button" onClick={onReset} disabled={isRunning}>
          Reiniciar
        </button>
        {isRunning ? (
          <button className="danger-btn" type="button" onClick={onStop}>
            Detener ejecución
          </button>
        ) : (
          <button className="primary-btn" type="button" onClick={onRun} disabled={!prompt.trim()}>
            Ejecutar agente
          </button>
        )}
      </div>
    </section>
  );
}
