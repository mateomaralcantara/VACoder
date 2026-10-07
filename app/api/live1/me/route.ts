import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase =
    await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase no configurado.",
      },
      {
        status: 503,
      },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
      },
      {
        status: 401,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
  });
}
