import { NextResponse } from "next/server";
import {
  getSupremeRuntime,
  listSupremeRuntimes,
} from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    return NextResponse.json({
      ok: true,
      session: getSupremeRuntime(id),
    });
  }

  return NextResponse.json({
    ok: true,
    sessions: listSupremeRuntimes(),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";

  if (id) {
    return NextResponse.json({
      ok: true,
      session: getSupremeRuntime(id),
    });
  }

  return NextResponse.json({
    ok: true,
    sessions: listSupremeRuntimes(),
  });
}
