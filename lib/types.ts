export type Provider = 'demo' | 'openai' | 'anthropic' | 'gemini';

export type TeachingStyle = 'mentor' | 'strict' | 'fast-track' | 'business' | 'beginner';

export type RunMode = 'plan-only' | 'safe-patch' | 'auto-patch';

export type LogLevel = 'info' | 'success' | 'warning' | 'error';

export interface AgentRunInput {
  prompt: string;
  provider: Provider;
  teachingStyle: TeachingStyle;
  runMode?: RunMode;
  model?: string;
  temperature?: number;
  maxSteps?: number;
  projectId?: string;
  files?: VirtualFile[];
}

export interface NormalizedAgentRunInput extends AgentRunInput {
  runMode: RunMode;
  maxSteps: number;
}

export interface VirtualFile {
  id: string;
  path: string;
  language: string;
  description: string;
  content: string;
  originalContent?: string;
  dirty?: boolean;
  lastTouchedAt?: string;
}

export interface TeacherMessage {
  id: string;
  title: string;
  body: string;
  concept?: string;
  timestamp?: string;
}

export interface ActivityLog {
  id: string;
  level: LogLevel;
  message: string;
  timestamp?: string;
}

export interface FinalArtifact {
  id: string;
  title: string;
  body: string;
  kind?: 'summary' | 'code' | 'report' | 'checklist' | 'deploy';
  timestamp?: string;
}

export interface DiffResult {
  fileId: string;
  path: string;
  additions: number;
  deletions: number;
  unified: string;
}

export interface TerminalOutput {
  id: string;
  command: string;
  output: string;
  exitCode?: number;
  timestamp?: string;
}

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  output: string;
  timestamp?: string;
}

export interface BuildResult {
  id: string;
  passed: boolean;
  command: string;
  output: string;
  timestamp?: string;
}

export type StreamEvent =
  | { type: 'status'; value: string; runId?: string; timestamp?: string }
  | { type: 'plan'; title: string; steps: string[]; runId?: string; timestamp?: string }
  | { type: 'teacher'; message: TeacherMessage; runId?: string; timestamp?: string }
  | { type: 'activity'; item: ActivityLog; runId?: string; timestamp?: string }
  | { type: 'patch-file'; fileId: string; content: string; reason?: string; runId?: string; timestamp?: string }
  | { type: 'create-file'; file: VirtualFile; reason?: string; runId?: string; timestamp?: string }
  | { type: 'delete-file'; fileId: string; reason?: string; runId?: string; timestamp?: string }
  | { type: 'rename-file'; fileId: string; nextPath: string; reason?: string; runId?: string; timestamp?: string }
  | { type: 'select-file'; fileId: string; runId?: string; timestamp?: string }
  | { type: 'terminal'; item: TerminalOutput; runId?: string; timestamp?: string }
  | { type: 'test-result'; item: TestResult; runId?: string; timestamp?: string }
  | { type: 'build-result'; item: BuildResult; runId?: string; timestamp?: string }
  | { type: 'diff'; item: DiffResult; runId?: string; timestamp?: string }
  | { type: 'artifact'; artifact: FinalArtifact; runId?: string; timestamp?: string }
  | { type: 'done'; summary: string; runId?: string; timestamp?: string }
  | { type: 'error'; message: string; runId?: string; timestamp?: string };

export interface WorkspaceState {
  files: VirtualFile[];
  selectedFileId: string;
  teacherMessages: TeacherMessage[];
  activityLogs: ActivityLog[];
  artifacts: FinalArtifact[];
  terminalOutputs: TerminalOutput[];
  testResults: TestResult[];
  buildResults: BuildResult[];
  status: string;
  lastPlan?: {
    title: string;
    steps: string[];
  };
}
