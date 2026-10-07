begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free','pro','business','agency','enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner','admin','developer','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  owner_id uuid not null
    references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'planning',
        'active',
        'building',
        'testing',
        'deploying',
        'healthy',
        'failed',
        'archived'
      )
    ),
  framework text,
  repository_url text,
  default_branch text not null default 'main',
  runtime_provider text,
  preview_url text,
  production_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.project_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null default 'developer'
    check (role in ('owner','admin','developer','reviewer','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  status text not null default 'queued',
  prompt text,
  model text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  run_id uuid not null
    references public.agent_runs(id) on delete cascade,
  role text,
  title text not null,
  status text not null default 'queued',
  position integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  run_id uuid
    references public.agent_runs(id) on delete set null,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  status text not null default 'created',
  summary text,
  risk text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_set_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  change_set_id uuid not null
    references public.change_sets(id) on delete cascade,
  path text not null,
  action text not null,
  before_content text,
  after_content text,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete cascade,
  provider text not null default 'local',
  provider_runtime_id text,
  status text not null default 'queued',
  port integer,
  preview_url text,
  started_at timestamptz,
  stopped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.runtime_logs (
  id bigint generated by default as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  runtime_session_id uuid not null
    references public.runtime_sessions(id) on delete cascade,
  stream text not null default 'stdout',
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.project_memory (
  project_id uuid primary key
    references public.projects(id) on delete cascade,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  product_goal text,
  memory jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid
    references auth.users(id) on delete set null,
  decision text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_todos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid not null
    references public.projects(id) on delete cascade,
  created_by uuid
    references auth.users(id) on delete set null,
  provider text not null,
  environment text not null default 'preview',
  status text not null default 'queued',
  deployment_url text,
  provider_deployment_id text,
  commit_sha text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.organizations(id) on delete cascade,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated by default as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid
    references public.projects(id) on delete set null,
  user_id uuid
    references auth.users(id) on delete set null,
  event_type text not null,
  quantity numeric(14,4) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.credits (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  balance numeric(14,4) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  project_id uuid
    references public.projects(id) on delete set null,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  result text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_org
  on public.projects(organization_id);

create index if not exists idx_agent_runs_project
  on public.agent_runs(project_id);

create index if not exists idx_agent_tasks_run
  on public.agent_tasks(run_id);

create index if not exists idx_runtime_project
  on public.runtime_sessions(project_id);

create index if not exists idx_runtime_logs_session
  on public.runtime_logs(runtime_session_id);

create index if not exists idx_deployments_project
  on public.deployments(project_id);

create index if not exists idx_usage_org
  on public.usage_events(organization_id);

create index if not exists idx_audit_org
  on public.audit_logs(organization_id);

-- ======================================================
-- UPDATED_AT
-- ======================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated
  on public.profiles;

create trigger trg_profiles_updated
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_organizations_updated
  on public.organizations;

create trigger trg_organizations_updated
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated
  on public.projects;

create trigger trg_projects_updated
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated
  on public.subscriptions;

create trigger trg_subscriptions_updated
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ======================================================
-- PROFILE CREATION
-- ======================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      ''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- ======================================================
-- SECURITY HELPERS
-- ======================================================

create or replace function public.is_org_member(
  target_org uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(
  target_org uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
      and om.role in ('owner','admin')
  )
  or exists (
    select 1
    from public.organizations o
    where o.id = target_org
      and o.owner_id = auth.uid()
  );
$$;

grant execute
  on function public.is_org_member(uuid)
  to authenticated;

grant execute
  on function public.is_org_admin(uuid)
  to authenticated;

-- ======================================================
-- RLS
-- ======================================================

alter table public.profiles
  enable row level security;

alter table public.organizations
  enable row level security;

alter table public.organization_members
  enable row level security;

alter table public.projects
  enable row level security;

alter table public.project_members
  enable row level security;

alter table public.agent_runs
  enable row level security;

alter table public.agent_tasks
  enable row level security;

alter table public.change_sets
  enable row level security;

alter table public.change_set_files
  enable row level security;

alter table public.runtime_sessions
  enable row level security;

alter table public.runtime_logs
  enable row level security;

alter table public.project_memory
  enable row level security;

alter table public.project_decisions
  enable row level security;

alter table public.project_todos
  enable row level security;

alter table public.deployments
  enable row level security;

alter table public.subscriptions
  enable row level security;

alter table public.usage_events
  enable row level security;

alter table public.credits
  enable row level security;

alter table public.audit_logs
  enable row level security;

-- Profiles

drop policy if exists profiles_read_self
  on public.profiles;

create policy profiles_read_self
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_update_self
  on public.profiles;

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Organizations

drop policy if exists organizations_select
  on public.organizations;

create policy organizations_select
on public.organizations
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_org_member(id)
);

drop policy if exists organizations_insert
  on public.organizations;

create policy organizations_insert
on public.organizations
for insert
to authenticated
with check (
  owner_id = auth.uid()
);

drop policy if exists organizations_update
  on public.organizations;

create policy organizations_update
on public.organizations
for update
to authenticated
using (
  public.is_org_admin(id)
)
with check (
  public.is_org_admin(id)
);

drop policy if exists organizations_delete
  on public.organizations;

create policy organizations_delete
on public.organizations
for delete
to authenticated
using (
  owner_id = auth.uid()
);

-- Organization Members

drop policy if exists organization_members_select
  on public.organization_members;

create policy organization_members_select
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

drop policy if exists organization_members_insert
  on public.organization_members;

create policy organization_members_insert
on public.organization_members
for insert
to authenticated
with check (
  public.is_org_admin(organization_id)
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_id
        and o.owner_id = auth.uid()
    )
  )
);

drop policy if exists organization_members_update
  on public.organization_members;

create policy organization_members_update
on public.organization_members
for update
to authenticated
using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

drop policy if exists organization_members_delete
  on public.organization_members;

create policy organization_members_delete
on public.organization_members
for delete
to authenticated
using (
  public.is_org_admin(organization_id)
  or user_id = auth.uid()
);

-- Projects

drop policy if exists projects_select
  on public.projects;

create policy projects_select
on public.projects
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists projects_insert
  on public.projects;

create policy projects_insert
on public.projects
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
  and owner_id = auth.uid()
);

drop policy if exists projects_update
  on public.projects;

create policy projects_update
on public.projects
for update
to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

drop policy if exists projects_delete
  on public.projects;

create policy projects_delete
on public.projects
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.is_org_admin(organization_id)
);

-- Project members

drop policy if exists project_members_all
  on public.project_members;

create policy project_members_all
on public.project_members
for all
to authenticated
using (
  public.is_org_member(organization_id)
)
with check (
  public.is_org_member(organization_id)
);

-- Organization-isolated operational tables

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agent_runs',
    'agent_tasks',
    'change_sets',
    'change_set_files',
    'runtime_sessions',
    'runtime_logs',
    'project_memory',
    'project_decisions',
    'project_todos',
    'deployments',
    'usage_events'
  ]
  loop
    execute format(
      'drop policy if exists org_isolation_all on public.%I',
      table_name
    );

    execute format(
      'create policy org_isolation_all
       on public.%I
       for all
       to authenticated
       using (public.is_org_member(organization_id))
       with check (public.is_org_member(organization_id))',
      table_name
    );
  end loop;
end;
$$;

-- Subscriptions

drop policy if exists subscriptions_select
  on public.subscriptions;

create policy subscriptions_select
on public.subscriptions
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists subscriptions_admin
  on public.subscriptions;

create policy subscriptions_admin
on public.subscriptions
for all
to authenticated
using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

-- Credits

drop policy if exists credits_select
  on public.credits;

create policy credits_select
on public.credits
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

drop policy if exists credits_admin
  on public.credits;

create policy credits_admin
on public.credits
for all
to authenticated
using (
  public.is_org_admin(organization_id)
)
with check (
  public.is_org_admin(organization_id)
);

-- Audit logs

drop policy if exists audit_select
  on public.audit_logs;

create policy audit_select
on public.audit_logs
for select
to authenticated
using (
  public.is_org_admin(organization_id)
);

drop policy if exists audit_insert
  on public.audit_logs;

create policy audit_insert
on public.audit_logs
for insert
to authenticated
with check (
  public.is_org_member(organization_id)
);

commit;
