import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSupabaseSession(request: NextRequest) {
  const env = getSupabasePublicEnv();

  let response = NextResponse.next({
    request,
  });

  if (!env.configured) {
    return {
      response,
      user: null,
      configured: false,
    };
  }

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        for (const item of cookiesToSet) {
          request.cookies.set(item.name, item.value);
        }

        response = NextResponse.next({
          request,
        });

        for (const item of cookiesToSet) {
          response.cookies.set(item.name, item.value, item.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user,
    configured: true,
  };
}
