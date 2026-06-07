import type { StreamEvent, WorkspaceState } from '@/lib/types';
import { createFile, deleteFile, patchFile, renameFile } from '@/lib/project-state';

export function applyStreamEventToState(state: WorkspaceState, event: StreamEvent): WorkspaceState {
  switch (event.type) {
    case 'status':
      return { ...state, status: event.value };
    case 'plan':
      return { ...state, lastPlan: { title: event.title, steps: event.steps } };
    case 'teacher':
      return { ...state, teacherMessages: [...state.teacherMessages, event.message] };
    case 'activity':
      return { ...state, activityLogs: [...state.activityLogs, event.item] };
    case 'patch-file':
      return { ...state, files: patchFile(state.files, event.fileId, event.content) };
    case 'create-file':
      return { ...state, files: createFile(state.files, event.file) };
    case 'delete-file': {
      const nextFiles = deleteFile(state.files, event.fileId);
      return {
        ...state,
        files: nextFiles,
        selectedFileId: state.selectedFileId === event.fileId ? nextFiles[0]?.id ?? '' : state.selectedFileId,
      };
    }
    case 'rename-file':
      return { ...state, files: renameFile(state.files, event.fileId, event.nextPath) };
    case 'select-file':
      return { ...state, selectedFileId: event.fileId };
    case 'terminal':
      return { ...state, terminalOutputs: [...state.terminalOutputs, event.item] };
    case 'test-result':
      return { ...state, testResults: [...state.testResults, event.item] };
    case 'build-result':
      return { ...state, buildResults: [...state.buildResults, event.item] };
    case 'artifact':
      return { ...state, artifacts: [...state.artifacts.filter((item) => item.id !== 'seed'), event.artifact] };
    case 'done':
      return { ...state, status: event.summary };
    case 'error':
      return {
        ...state,
        status: 'Error',
        activityLogs: [
          ...state.activityLogs,
          {
            id: `err-${Date.now()}`,
            level: 'error',
            message: event.message,
            timestamp: event.timestamp,
          },
        ],
      };
    case 'diff':
    default:
      return state;
  }
}
