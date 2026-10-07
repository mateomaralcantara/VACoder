export type CloudRuntimeProviderName = "e2b";

export type CloudRuntimeSessionStatus =
  | "creating"
  | "provisioning"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "terminated";

export type CloudJobInput = {
  prompt?: string;
  priority?: number;
  maxAttempts?: number;
  timeoutSeconds?: number;
  includeTests?: boolean;
  snapshotId?: string;
};
