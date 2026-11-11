"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveUser } from "@/lib/live1/auth";
import { canCreateProject } from "@/lib/billing/plans";
import { stripeEnv } from "@/lib/billing/stripe";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniqueSlug(name: string) {
  const base = slugify(name) || "workspace";

  const suffix =
    Math.random()
      .toString(36)
      .slice(2, 8);

  return base + "-" + suffix;
}

export async function signOutAction() {
  const { supabase } = await requireLiveUser();

  await supabase.auth.signOut();

  redirect("/login");
}

export async function createOrganizationAction(
  formData: FormData,
) {
  const { supabase, user } = await requireLiveUser();

  const name =
    String(formData.get("name") || "").trim();

  if (!name) {
    throw new Error(
      "El nombre de la organizacion es obligatorio.",
    );
  }

  const slug = uniqueSlug(name);

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from("organizations")
      .insert({
        name,
        slug,
        owner_id: user.id,
        plan: "free",
      })
      .select("id")
      .single();

  if (organizationError || !organization) {
    throw new Error(
      organizationError?.message ||
        "No se pudo crear la organizacion.",
    );
  }

  const { error: memberError } =
    await supabase
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: "owner",
      });

  if (memberError) {
    throw new Error(memberError.message);
  }

  await supabase
    .from("subscriptions")
    .insert({
      organization_id: organization.id,
      plan: "free",
      status: "active",
    });

  await supabase
    .from("credits")
    .insert({
      organization_id: organization.id,
      balance: 0,
    });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team");

  redirect("/dashboard/projects/new");
}

export async function createProjectAction(
  formData: FormData,
) {
  const { supabase, user } = await requireLiveUser();

  const organizationId =
    String(
      formData.get("organizationId") || "",
    ).trim();

  const name =
    String(formData.get("name") || "").trim();

  const description =
    String(
      formData.get("description") || "",
    ).trim();

  const framework =
    String(
      formData.get("framework") || "nextjs",
    ).trim();

  if (!organizationId || !name) {
    throw new Error(
      "Organizacion y nombre son obligatorios.",
    );
  }

  // Limite de proyectos del plan. La base de datos lo vuelve a comprobar
  // (trigger enforce_project_limit); esto solo da un mensaje claro.
  const [{ data: organization }, { count }] = await Promise.all([
    supabase
      .from("organizations")
      .select("plan")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);

  if (!organization) {
    throw new Error("Organizacion no encontrada.");
  }

  // Sin Stripe configurado no hay forma de cambiar de plan, asi que los
  // limites no se aplican (entorno de pruebas).
  if (stripeEnv().configured && !canCreateProject(organization.plan, count ?? 0)) {
    redirect("/dashboard/billing?error=limite");
  }

  const slug = uniqueSlug(name);

  const {
    data: project,
    error,
  } =
    await supabase
      .from("projects")
      .insert({
        organization_id: organizationId,
        owner_id: user.id,
        name,
        slug,
        description:
          description || null,
        status: "draft",
        framework:
          framework || "nextjs",
        default_branch: "main",
      })
      .select("id")
      .single();

  if (error || !project) {
    throw new Error(
      error?.message ||
        "No se pudo crear el proyecto.",
    );
  }

  await supabase
    .from("project_members")
    .insert({
      organization_id: organizationId,
      project_id: project.id,
      user_id: user.id,
      role: "owner",
    });

  await supabase
    .from("project_memory")
    .insert({
      organization_id: organizationId,
      project_id: project.id,
      product_goal:
        "Convertir el proyecto en una aplicacion premium lista para vender.",
      memory: {},
    });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");

  redirect(
    "/dashboard/projects/" + project.id,
  );
}
