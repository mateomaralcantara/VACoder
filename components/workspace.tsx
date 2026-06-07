'use client';

import { useMemo, useState } from 'react';
import { ActivityPanel } from '@/components/activity-panel';
import { CodePanel } from '@/components/code-panel';
import { ControlBar } from '@/components/control-bar';
import { DiffPanel } from '@/components/diff-panel';
import { ProjectScanPanel } from '@/components/project-scan-panel';
import { RunStatusBar } from '@/components/run-status-bar';
import { TeacherPanel } from '@/components/teacher-panel';
import { TerminalPanel } from '@/components/terminal-panel';
import { applyStreamEventToState } from '@/lib/apply-stream-event';
import { createEvaluateProjectPrompt } from '@/lib/prompts/evaluate-project';
import { cloneFiles, patchFile, revertFile } from '@/lib/project-state';
import { scanProjectFromClient } from '@/lib/project-scan-client';
import { SAMPLE_FILES } from '@/lib/sample-project';
import { useAgentRun } from '@/hooks/use-agent-run';
import type {
  ActivityLog,
  FinalArtifact,
  Provider,
  RunMode,
  StreamEvent,
  TeacherMessage,
  TeachingStyle,
  WorkspaceState,
} from '@/lib/types';
import type { ProjectManifest } from '@/lib/project-manifest';

const defaultMessages: TeacherMessage[] = [
  {
    id: 'intro',
    title: 'Listo para construir con control',
    concept: 'Flujo robusto',
    body: 'Ejecuta el agente. El sistema separa streaming, eventos, diff, terminal, scanner y enseñanza para evitar desorden antes de meter multi-agentes.',
  },
];

const defaultLogs: ActivityLog[] = [
  {
    id: 'boot',
    level: 'info',
    message: '$ espacio iniciado → contrato de eventos cargado',
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

function createLog(level: ActivityLog['level'], message: string): ActivityLog {
  return {
    id: `log-${crypto.randomUUID()}`,
    level,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function Workspace() {
  const [state, setState] = useState<WorkspaceState>(() => createInitialState());
  const [prompt, setPrompt] = useState('Construye un dashboard CRM moderno y explícame cada cambio en vivo.');
  const [provider, setProvider] = useState<Provider>('demo');
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyle>('mentor');
  const [runMode, setRunMode] = useState<RunMode>('safe-patch');
  const [model, setModel] = useState('');
  const [projectRoot, setProjectRoot] = useState('C:\\Users\\martin\\Desktop\\VSC\\BestS\\Coder');
  const [projectManifest, setProjectManifest] = useState<ProjectManifest | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

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
    setProjectManifest(null);
    setScanError(null);
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

  const scanCurrentProject = async () => {
    setIsScanning(true);
    setScanError(null);
    setState((previous) => ({
      ...previous,
      status: 'Escaneando proyecto…',
      activityLogs: [...previous.activityLogs, createLog('info', `$ scanner --root "${projectRoot || '.'}"`)],
    }));

    try {
      const result = await scanProjectFromClient({
        projectRoot: projectRoot.trim() || undefined,
        maxDepth: 12,
        maxFiles: 15000,
        maxImportantFiles: 180,
        maxFileSizeBytes: 180000,
        includeContentPreview: true,
        contentPreviewMaxChars: 8000,
        includeLockFiles: false,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setProjectManifest(result.manifest);
      setState((previous) => ({
        ...previous,
        status: 'Proyecto escaneado',
        activityLogs: [
          ...previous.activityLogs,
          createLog(
            'success',
            `$ manifest listo → ${result.manifest.stats.totalFiles} archivos, ${result.manifest.stats.includedFiles} incluidos`,
          ),
        ],
        artifacts: [
          ...previous.artifacts.filter((artifact) => artifact.id !== 'seed'),
          {
            id: `manifest-${crypto.randomUUID()}`,
            title: 'Manifiesto de proyecto generado',
            body: `${result.manifest.projectName}: ${result.manifest.stats.totalFiles} archivos totales, ${result.manifest.stats.includedFiles} incluidos, ${result.manifest.stats.ignoredFiles} ignorados.`,
            kind: 'summary',
          },
        ],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fallo inesperado escaneando proyecto.';
      setScanError(message);
      setState((previous) => ({
        ...previous,
        status: 'Error escaneando proyecto',
        activityLogs: [...previous.activityLogs, createLog('error', message)],
      }));
    } finally {
      setIsScanning(false);
    }
  };

  const loadEvaluatePrompt = () => {
    if (!projectManifest) {
      return;
    }

    setPrompt(createEvaluateProjectPrompt(projectManifest));
    setRunMode('plan-only');
    setState((previous) => ({
      ...previous,
      status: 'Prompt de evaluación cargado',
      activityLogs: [...previous.activityLogs, createLog('info', '$ prompt cargado → evaluación por manifiesto')],
      teacherMessages: [
        ...previous.teacherMessages,
        {
          id: `teacher-${crypto.randomUUID()}`,
          title: 'Evaluación por manifiesto',
          concept: 'Project Scanner',
          body: 'El agente recibirá un mapa del proyecto en vez de todos los archivos. Esto evita reventar contexto y permite auditar proyectos grandes con más control.',
        },
      ],
    }));
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
          <h1>VACoder Agent OS</h1>
          <p>
            Evalúa proyectos grandes con scanner, manifiesto, streaming seguro, diff, terminal,
            validación y profesor en vivo antes de pasar a multi-agentes.
          </p>
        </div>
        <div className="header-badge">project scanner conectado</div>
      </header>

      <RunStatusBar status={state.status} isRunning={isRunning || isScanning} changedFiles={changedFiles} logs={state.activityLogs.length} />

      <ProjectScanPanel
        projectRoot={projectRoot}
        manifest={projectManifest}
        isScanning={isScanning}
        scanError={scanError}
        onProjectRootChange={setProjectRoot}
        onScan={scanCurrentProject}
        onLoadEvaluatePrompt={loadEvaluatePrompt}
      />

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
        Consejo: escanea primero, carga prompt de evaluación, ejecuta en modo solo planificar y luego pasa a cambios seguros.
      </p>
    </main>
  );
}
