export type SupremeRisk = "low" | "medium" | "high";

export type SupremeScoreItem = {
  area: string;
  item: string;
  status: "ok" | "warn" | "fail";
  points: number;
  max: number;
  details: string;
};

export type SupremeProductScore = {
  score: number;
  maxScore: number;
  percent: number;
  grade: string;
  readyToSell: boolean;
  items: SupremeScoreItem[];
  missing: string[];
  recommendations: string[];
};

export type SupremeMemory = {
  projectPath: string;
  updatedAt: string;
  productGoal: string;
  decisions: string[];
  modules: string[];
  todos: string[];
  risks: string[];
  lastScore?: SupremeProductScore;
};

export type SupremeModule = {
  id: string;
  name: string;
  category: string;
  description: string;
  businessValue: string;
  files: string[];
};

export type SupremeAgentRole =
  | "CEO"
  | "CTO"
  | "Builder"
  | "Designer"
  | "QA"
  | "Security"
  | "DevOps";

export type SupremeAgentFinding = {
  role: SupremeAgentRole;
  title: string;
  priority: "low" | "medium" | "high";
  recommendation: string;
};

export type SupremeVisualResult = {
  ok: boolean;
  url: string;
  statusCode?: number;
  title?: string;
  bodyLength?: number;
  looksBlank: boolean;
  findings: string[];
};

export type SupremeDeployStatus = {
  gitOk: boolean;
  branch: string;
  hasChanges: boolean;
  statusText: string;
  vercelAvailable: boolean;
  recommendations: string[];
};
