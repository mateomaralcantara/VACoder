import { NextResponse } from "next/server";
import {
  createCloudProjectJob,
  listCloudProjectData,
} from "@/lib/cloud-runtime/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    return NextResponse.json({
      ok: true,
      ...(await listCloudProjectData(id)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const job = await createCloudProjectJob(id, body);
    return NextResponse.json({ ok: true, job }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CLOUD_RUNTIME][CREATE_JOB]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
