export type OrchestratorRunStatus =
  | "queued"
  | "planning"
  | "running"
  | "validating"
  | "repairing"
  | "testing"
  | "deploying"
  | "completed"
  | "failed"
  | "cancelled";

export type OrchestratorTaskType = "plan" | "typecheck" | "build" | "test";

export type CreateJobInput = {
  prompt?: string;
  priority?: number;
  maxAttempts?: number;
  timeoutSeconds?: number;
  includeTests?: boolean;
};

export type OrchestratorJobSummary = {
  id: string;
  project_id: string;
  status: OrchestratorRunStatus;
  priority: number;
  progress: number;
  current_stage: string | null;
  prompt: string | null;
  attempts: number;
  max_attempts: number;
  error: string | null;
  cancel_requested: boolean;
  created_at: string;
  updated_at: string;
};
