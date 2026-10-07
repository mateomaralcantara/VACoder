import { NextResponse } from "next/server";
import { createWorkspaceSnapshot } from "@/lib/cloud-runtime/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const snapshot = await createWorkspaceSnapshot(id);
    return NextResponse.json({ ok: true, snapshot }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CLOUD_RUNTIME][SNAPSHOT]", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
