export type ProjectBuilderStack =
  | 'next-css-supabase'
  | 'next-css'
  | 'vite-react';

export type ProjectBuilderDeployTarget = 'vercel' | 'node' | 'static';

export interface ProjectBuilderRequest {
  rootPath?: string;
  projectName: string;
  description: string;
  appType?: string;
  stack?: ProjectBuilderStack;
  auth?: boolean;
  database?: boolean;
  payments?: boolean;
  admin?: boolean;
  deploy?: ProjectBuilderDeployTarget;
  style?: string;
  overwrite?: boolean;
}

export interface ProjectBlueprint {
  name: string;
  description: string;
  appType: string;
  stack: string[];
  modules: string[];
  routes: string[];
  database: string[];
  commands: string[];
  warnings: string[];
}

export interface GeneratedProjectFile {
  path: string;
  language: string;
  content: string;
}

export interface ProjectBuilderPlan {
  blueprint: ProjectBlueprint;
  files: GeneratedProjectFile[];
  commands: string[];
}

export interface ProjectBuilderCreateResult {
  projectPath: string;
  created: string[];
  skipped: string[];
  errors: Array<{
    path: string;
    message: string;
  }>;
}