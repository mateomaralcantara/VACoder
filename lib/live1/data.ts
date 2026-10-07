import { requireLiveUser } from "@/lib/live1/auth";

export type LiveOrganization = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  role: string;
};

export type LiveProject = {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  framework: string | null;
  repository_url: string | null;
  default_branch: string;
  created_at: string;
};

export async function getLiveOrganizations() {
  const { supabase, user } = await requireLiveUser();

  const { data: memberships, error: membershipError } =
    await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id);

  if (membershipError) {
    return [];
  }

  const ids = Array.from(
    new Set(
      (memberships || [])
        .map((row) => row.organization_id)
        .filter(Boolean),
    ),
  );

  if (!ids.length) {
    return [];
  }

  const { data: organizations, error } =
    await supabase
      .from("organizations")
      .select("id, name, slug, owner_id, plan")
      .in("id", ids)
      .order("created_at", {
        ascending: true,
      });

  if (error) {
    return [];
  }

  return (organizations || []).map((organization) => {
    const membership = (memberships || []).find(
      (row) => row.organization_id === organization.id,
    );

    return {
      ...organization,
      role: membership?.role || "viewer",
    } as LiveOrganization;
  });
}

export async function getLiveProjects() {
  const { supabase } = await requireLiveUser();

  const { data, error } =
    await supabase
      .from("projects")
      .select(
        "id, organization_id, owner_id, name, slug, description, status, framework, repository_url, default_branch, created_at",
      )
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    return [];
  }

  return (data || []) as LiveProject[];
}

export async function getLiveProject(projectId: string) {
  const { supabase } = await requireLiveUser();

  const { data, error } =
    await supabase
      .from("projects")
      .select(
        "id, organization_id, owner_id, name, slug, description, status, framework, repository_url, default_branch, created_at",
      )
      .eq("id", projectId)
      .maybeSingle();

  if (error) {
    return null;
  }

  return data as LiveProject | null;
}
