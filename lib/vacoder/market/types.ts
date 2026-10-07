export type MarketRiskLevel = "low" | "medium" | "high";

export type MarketFileOperation = {
  path: string;
  action: "upsert" | "delete";
  content?: string;
  reason?: string;
};

export type MarketPlanFile = {
  path: string;
  reason: string;
};

export type MarketAgentPlan = {
  summary: string;
  risk: MarketRiskLevel;
  steps: string[];
  filesToRead: MarketPlanFile[];
  operations: MarketFileOperation[];
  notes: string[];
};

export type MarketChangeEntry = {
  path: string;
  action: "upsert" | "delete";
  before: string | null;
  after: string | null;
  reason: string;
};

export type MarketChangeSet = {
  id: string;
  projectPath: string;
  prompt: string;
  model: string;
  status: "created" | "applied" | "rejected" | "failed";
  createdAt: string;
  updatedAt: string;
  summary: string;
  risk: MarketRiskLevel;
  steps: string[];
  entries: MarketChangeEntry[];
  notes: string[];
  backupId?: string;
  validation?: unknown;
};
