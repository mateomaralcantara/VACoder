export function cloudRuntimeEnv() {
  const e2bApiKey = process.env.E2B_API_KEY?.trim() || "";
  const provider = (process.env.VACODER_CLOUD_PROVIDER?.trim() || "e2b").toLowerCase();
  const snapshotBucket = process.env.VACODER_SNAPSHOT_BUCKET?.trim() || "vacoder-workspaces";
  const maxSnapshotMb = Math.max(
    10,
    Math.min(500, Number(process.env.VACODER_MAX_SNAPSHOT_MB || 100) || 100),
  );

  return {
    provider,
    e2bApiKey,
    snapshotBucket,
    maxSnapshotMb,
    e2bConfigured: Boolean(e2bApiKey),
  };
}
