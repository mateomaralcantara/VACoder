import { NextResponse } from "next/server";
import { Sandbox } from "e2b";

import { assertWorkerRequest } from "@/lib/orchestrator/worker-auth";
import { cloudRuntimeEnv } from "@/lib/cloud-runtime/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let sandbox: Sandbox | null = null;

  try {
    assertWorkerRequest(request);

    const env = cloudRuntimeEnv();

    const template =
      process.env.VACODER_E2B_TEMPLATE?.trim() ||
      "vacoder-node22";

    if (!env.e2bApiKey) {
      throw new Error("Falta E2B_API_KEY.");
    }

    sandbox = await Sandbox.create(
      template,
      {
        apiKey: env.e2bApiKey,
        timeoutMs: 60_000,
        metadata: {
          vacoder: "live4-probe",
        },
      },
    );

    const result = await sandbox.commands.run(
      "printf 'VACODER_E2B_OK\\n' && uname -s && node --version",
      { timeoutMs: 30_000 },
    );

    return NextResponse.json({
      ok: true,
      provider: "e2b",
      sandboxId: sandbox.sandboxId,
      stdout: result.stdout,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  } finally {
    if (sandbox) {
      await sandbox.kill().catch(() => {});
    }
  }
}

