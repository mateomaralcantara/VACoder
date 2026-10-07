import { timingSafeEqual } from "node:crypto";
import { orchestratorServerEnv } from "@/lib/orchestrator/admin";

function equalSecret(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function assertWorkerRequest(request: Request) {
  const expected = orchestratorServerEnv().workerToken;
  if (!expected) throw new Error("VACODER_WORKER_TOKEN no configurado.");
  const auth = request.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!supplied || !equalSecret(supplied, expected)) {
    throw new Error("Worker no autorizado.");
  }
}
