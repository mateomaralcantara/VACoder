export type RuntimeDevice = 'desktop' | 'tablet' | 'mobile';

export type RuntimeStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped';

export interface LiveProjectRoute {
  path: string;
  label: string;
  status?: 'ready' | 'pending' | 'error';
}

export interface RuntimeStartRequest {
  cwd: string;
  port?: number;
}

export interface RuntimeStatusResponse {
  status: RuntimeStatus;
  cwd?: string;
  port?: number;
  url?: string;
  pid?: number;
  logs: string[];
  error?: string;
  routes: LiveProjectRoute[];
  updatedAt: string;
}