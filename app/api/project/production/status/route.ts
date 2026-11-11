import { NextResponse } from "next/server";
import { serializeProductionState } from "@/app/api/project/production/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado en vivo del pipeline que arranca /api/project/production/run: fase,
// eventos y proceso del runtime. El panel lo consulta mientras corre.
export async function GET() {
  return NextResponse.json(serializeProductionState());
}
