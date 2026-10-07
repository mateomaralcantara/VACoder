import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient() {
  const env = getSupabasePublicEnv();

  if (!env.configured) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          for (const item of cookiesToSet) {
            cookieStore.set(item.name, item.value, item.options);
          }
        } catch {
          // Un Server Component puede no permitir escritura de cookies.
          // El middleware se encarga de refrescarlas cuando sea necesario.
        }
      },
    },
  });
}
