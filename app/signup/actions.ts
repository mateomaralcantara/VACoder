"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/setup");
  }

  const fullName =
    String(formData.get("fullName") || "").trim();

  const email =
    String(formData.get("email") || "").trim();

  const password =
    String(formData.get("password") || "");

  if (!email || !password) {
    redirect("/signup?error=missing");
  }

  const { data, error } =
    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

  if (error) {
    redirect(
      "/signup?error=" +
        encodeURIComponent(error.message),
    );
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/login?registered=1");
}
