import { createClient } from "@supabase/supabase-js";

export function orchestratorServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const workerToken = process.env.VACODER_WORKER_TOKEN?.trim() || "";
  return {
    url,
    serviceKey,
    workerToken,
    configured: Boolean(url && serviceKey && workerToken),
  };
}

export function createOrchestratorAdminClient() {
  const env = orchestratorServerEnv();
  if (!env.url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL.");
  if (!env.serviceKey) throw new Error("Falta SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY (solo servidor).");

  return createClient(env.url, env.serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
