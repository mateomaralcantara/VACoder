'use client';

import { useMemo, useState } from 'react';
import { ActivityPanel } from '@/components/activity-panel';
import { CodePanel } from '@/components/code-panel';
import { ControlBar } from '@/components/control-bar';
import { DiffPanel } from '@/components/diff-panel';
import { RunStatusBar } from '@/components/run-status-bar';
import { TeacherPanel } from '@/components/teacher-panel';
import { TerminalPanel } from '@/components/terminal-panel';
import { applyStreamEventToState } from '@/lib/apply-stream-event';
import { cloneFiles, patchFile, revertFile } from '@/lib/project-state';
import { SAMPLE_FILES } from '@/lib/sample-project';
import { useAgentRun } from '@/hooks/use-agent-run';
import type { ActivityLog, FinalArtifact, Provider, RunMode, StreamEvent, TeacherMessage, TeachingStyle, WorkspaceState } from '@/lib/types';

const defaultMessages: TeacherMessage[] = [
  {
    id: 'intro',
    title: 'Listo para construir con control',
    concept: 'Base robusta',
    body: 'Ejecuta el agente. La interfaz separa misión, streaming, diff, terminal, auditoría y enseñanza antes de meter multi-agentes.',
  },
];

const defaultLogs: ActivityLog[] = [
  {
    id: 'boot',
    level: 'info',
    message: '$ espacio iniciado → interfaz moderna cargada',
    timestamp: new Date().toISOString(),
  },
];

const defaultArtifacts: FinalArtifact[] = [
  {
    id: 'seed',
    title: 'Estado del espacio',
    body: 'Todavía no hay artefacto final. Ejecuta una sesión para generar un resultado concreto.',
    kind: 'summary',
  },
];

function createInitialState(): WorkspaceState {
  const files = cloneFiles(SAMPLE_FILES);

  return {
    files,
    selectedFileId: files[0]?.id ?? '',
    teacherMessages: defaultMessages,
    activityLogs: defaultLogs,
    artifacts: defaultArtifacts,
    terminalOutputs: [],
    testResults: [],
    buildResults: [],
    status: 'En espera',
  };
}

export function Workspace() {
  const [state, setState] = useState<WorkspaceState>(() => createInitialState());
  const [prompt, setPrompt] = useState('Moderniza este sistema como un IDE-agente premium: UI limpia, flujo robusto, diff, terminal y profesor en vivo.');
  const [provider, setProvider] = useState<Provider>('demo');
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyle>('mentor');
  const [runMode, setRunMode] = useState<RunMode>('safe-patch');
  const [model, setModel] = useState('');

  const selectedFile = useMemo(
    () => state.files.find((file) => file.id === state.selectedFileId) ?? state.files[0],
    [state.files, state.selectedFileId],
  );

  const changedFiles = useMemo(() => state.files.filter((file) => file.dirty).length, [state.files]);

  const handleEvent = (event: StreamEvent) => {
    setState((previous) => applyStreamEventToState(previous, event));
  };

  const { isRunning, run, stop } = useAgentRun({ onEvent: handleEvent });

  const resetWorkspace = () => {
    setState(createInitialState());
  };

  const runAgent = () => {
    run({
      prompt,
      provider,
      teachingStyle,
      runMode,
      model: model.trim() || undefined,
      files: state.files,
      maxSteps: 12,
    });
  };

  const updateFileContent = (fileId: string, content: string) => {
    setState((previous) => ({
      ...previous,
      files: patchFile(previous.files, fileId, content),
    }));
  };

  const selectFile = (fileId: string) => {
    setState((previous) => ({ ...previous, selectedFileId: fileId }));
  };

  const handleRevertFile = (fileId: string) => {
    setState((previous) => ({ ...previous, files: revertFile(previous.files, fileId) }));
  };

  return (
    <main className="shell">
      <header className="header">
        <div className="hero">
          <h1>Agente Tutor IDE</h1>
          <p>
            Una base premium para construir software con IA: control de ejecución, evidencia visible, diff,
            validación, auditoría y profesor técnico en vivo.
          </p>
        </div>
        <div className="header-badge">modo maestro controlado</div>
      </header>

      <RunStatusBar status={state.status} isRunning={isRunning} changedFiles={changedFiles} logs={state.activityLogs.length} />

      <ControlBar
        prompt={prompt}
        provider={provider}
        teachingStyle={teachingStyle}
        runMode={runMode}
        model={model}
        isRunning={isRunning}
        onPromptChange={setPrompt}
        onProviderChange={setProvider}
        onTeachingStyleChange={setTeachingStyle}
        onRunModeChange={setRunMode}
        onModelChange={setModel}
        onRun={runAgent}
        onStop={stop}
        onReset={resetWorkspace}
      />

      <section className="workspace-grid">
        <CodePanel
          files={state.files}
          selectedFileId={state.selectedFileId}
          onSelectFile={selectFile}
          onChangeContent={updateFileContent}
          onRevertFile={handleRevertFile}
        />

        <div className="right-stack">
          <TeacherPanel status={state.status} messages={state.teacherMessages} plan={state.lastPlan} />
          <ActivityPanel logs={state.activityLogs} artifacts={state.artifacts} />
        </div>
      </section>

      <section className="workspace-grid lower-grid">
        <DiffPanel file={selectedFile} />
        <TerminalPanel terminals={state.terminalOutputs} tests={state.testResults} builds={state.buildResults} />
      </section>

      <p className="footer-note">
        Consejo: valida primero en <code>demo</code>. Después activa proveedor real, luego sandbox/terminal real, y solo entonces multi-agentes.
      </p>
    </main>
  );
}
