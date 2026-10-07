import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

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
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const { data, error } =
    await supabase
      .from("projects")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    projects: data || [],
  });
}

export async function POST(
  request: Request,
) {
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
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    await request.json().catch(() => ({}));

  const organizationId =
    String(
      body.organizationId || "",
    ).trim();

  const name =
    String(body.name || "").trim();

  if (!organizationId || !name) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "organizationId y name son obligatorios.",
      },
      {
        status: 400,
      },
    );
  }

  const slug =
    (slugify(name) || "project") +
    "-" +
    Math.random()
      .toString(36)
      .slice(2, 8);

  const {
    data,
    error,
  } =
    await supabase
      .from("projects")
      .insert({
        organization_id:
          organizationId,
        owner_id: user.id,
        name,
        slug,
        description:
          body.description || null,
        framework:
          body.framework || "nextjs",
        status: "draft",
        default_branch: "main",
      })
      .select("*")
      .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    project: data,
  });
}
