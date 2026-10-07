export type ProjectControlContextPublic = {
  project: {
    id: string;
    organizationId: string;
    ownerId: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    framework: string | null;
    repositoryUrl: string | null;
    defaultBranch: string;
    runtimeProvider: string | null;
    previewUrl: string | null;
    productionUrl: string | null;
    currentEnvironment: string;
    workspaceStatus: string;
    controlPlaneVersion: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
  workspace: {
    linked: boolean;
    provider: string;
    status: string;
    defaultPort: number;
    runtimeCommand: string;
    updatedAt: string | null;
  };
  environment: {
    name: string;
    provider: string;
    status: string;
    previewUrl: string | null;
    productionUrl: string | null;
    updatedAt: string | null;
  };
};

export type ControlPlaneCertification = {
  projectId: string;
  score: number;
  certified: boolean;
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    details: string;
  }>;
};
