import { NextResponse } from "next/server";
import { retryProjectJob } from "@/lib/orchestrator/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; jobId: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const { id, jobId } = await context.params;
    return NextResponse.json({ ok: true, job: await retryProjectJob(id, jobId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
