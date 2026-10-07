begin;

alter table public.projects
  add column if not exists current_environment text not null default 'development',
  add column if not exists workspace_status text not null default 'unlinked',
  add column if not exists control_plane_version text not null default 'live2';

create table if not exists public.workspace_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  provider text not null default 'local',
  workspace_path text,
  runtime_command text not null default 'npm run dev -- --port {{PORT}}',
  default_port integer not null default 3001,
  status text not null default 'unlinked',
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_registry_port_check check (default_port between 1024 and 65535)
);

create table if not exists public.project_environments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  provider text not null default 'local',
  status text not null default 'idle',
  preview_url text,
  production_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists idx_workspace_registry_org on public.workspace_registry(organization_id);
create index if not exists idx_workspace_registry_project on public.workspace_registry(project_id);
create index if not exists idx_project_environments_org on public.project_environments(organization_id);
create index if not exists idx_project_environments_project on public.project_environments(project_id);

drop trigger if exists trg_workspace_registry_updated on public.workspace_registry;
create trigger trg_workspace_registry_updated before update on public.workspace_registry for each row execute function public.set_updated_at();

drop trigger if exists trg_project_environments_updated on public.project_environments;
create trigger trg_project_environments_updated before update on public.project_environments for each row execute function public.set_updated_at();

alter table public.workspace_registry enable row level security;
alter table public.project_environments enable row level security;

drop policy if exists workspace_registry_select on public.workspace_registry;
create policy workspace_registry_select on public.workspace_registry for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists workspace_registry_insert on public.workspace_registry;
create policy workspace_registry_insert on public.workspace_registry for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists workspace_registry_update on public.workspace_registry;
create policy workspace_registry_update on public.workspace_registry for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists workspace_registry_delete on public.workspace_registry;
create policy workspace_registry_delete on public.workspace_registry for delete to authenticated using (public.is_org_admin(organization_id));

drop policy if exists project_environments_all on public.project_environments;
create policy project_environments_all on public.project_environments for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

insert into public.project_environments (organization_id, project_id, name, provider, status, metadata)
select p.organization_id, p.id, coalesce(p.current_environment, 'development'), coalesce(p.runtime_provider, 'local'), 'idle', jsonb_build_object('createdByMigration','LIVE-2')
from public.projects p
on conflict (project_id, name) do nothing;

commit;
