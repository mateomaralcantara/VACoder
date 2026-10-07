import { NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = getSupabasePublicEnv();

  if (!env.configured) {
    return NextResponse.json({
      ok: true,
      version: "LIVE-1",
      configured: false,
      schemaReady: false,
      message:
        "Codigo LIVE 1 instalado. Faltan variables Supabase.",
    });
  }

  const supabase =
    await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      version: "LIVE-1",
      configured: false,
      schemaReady: false,
    });
  }

  const { error } =
    await supabase
      .from("organizations")
      .select("id")
      .limit(1);

  return NextResponse.json({
    ok: true,
    version: "LIVE-1",
    configured: true,
    schemaReady: !error,
    databaseError:
      error?.message || null,
  });
}
