import { NextResponse } from "next/server";
import { findFreePorts } from "@/lib/vacoder/supreme/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = Number(url.searchParams.get("start") || 3000);
  const end = Number(url.searchParams.get("end") || 3025);

  const ports = await findFreePorts(start, end);

  return NextResponse.json({
    ok: true,
    ports,
  });
}
