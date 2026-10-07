begin;

create extension if not exists pgcrypto;

create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  provider text not null default 'supabase-storage',
  storage_bucket text not null default 'vacoder-workspaces',
  storage_path text not null,
  sha256 text,
  bytes bigint,
  status text not null default 'creating',
  excluded jsonb not null default '{}'::jsonb,
  error text,
  ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists workspace_snapshots_storage_unique
  on public.workspace_snapshots(storage_bucket, storage_path);

create index if not exists workspace_snapshots_project_created
  on public.workspace_snapshots(project_id, created_at desc);

create table if not exists public.cloud_runtime_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  snapshot_id uuid references public.workspace_snapshots(id) on delete set null,
  provider text not null,
  external_id text,
  status text not null default 'creating',
  timeout_seconds integer not null default 1200,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_runtime_project_created
  on public.cloud_runtime_sessions(project_id, created_at desc);

create index if not exists cloud_runtime_external
  on public.cloud_runtime_sessions(provider, external_id);

create table if not exists public.cloud_runtime_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  runtime_id uuid references public.cloud_runtime_sessions(id) on delete cascade,
  event_type text not null,
  message text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cloud_runtime_events_run_created
  on public.cloud_runtime_events(run_id, created_at);

create index if not exists cloud_runtime_events_runtime_created
  on public.cloud_runtime_events(runtime_id, created_at);

drop trigger if exists trg_workspace_snapshots_live4_updated on public.workspace_snapshots;
create trigger trg_workspace_snapshots_live4_updated
before update on public.workspace_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists trg_cloud_runtime_sessions_live4_updated on public.cloud_runtime_sessions;
create trigger trg_cloud_runtime_sessions_live4_updated
before update on public.cloud_runtime_sessions
for each row execute function public.set_updated_at();

alter table public.workspace_snapshots enable row level security;
alter table public.cloud_runtime_sessions enable row level security;
alter table public.cloud_runtime_events enable row level security;

drop policy if exists workspace_snapshots_org_live4 on public.workspace_snapshots;
create policy workspace_snapshots_org_live4
on public.workspace_snapshots
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists cloud_runtime_sessions_org_live4 on public.cloud_runtime_sessions;
create policy cloud_runtime_sessions_org_live4
on public.cloud_runtime_sessions
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists cloud_runtime_events_org_live4 on public.cloud_runtime_events;
create policy cloud_runtime_events_org_live4
on public.cloud_runtime_events
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

insert into storage.buckets (id, name, public)
values ('vacoder-workspaces', 'vacoder-workspaces', false)
on conflict (id) do update
set public = false;

-- LIVE 3 local no puede reclamar trabajos E2B.
create or replace function public.claim_next_agent_run(
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns setof public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select r.id into v_id
  from public.agent_runs r
  where r.cancel_requested = false
    and r.status in ('queued','planning','running','validating','repairing','testing','deploying')
    and coalesce(r.available_at, now()) <= now()
    and (r.lease_expires_at is null or r.lease_expires_at < now())
    and coalesce(r.payload->>'executionProvider', 'local') <> 'e2b'
  order by r.priority asc, r.created_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  update public.agent_runs
  set locked_by = left(p_worker_id, 160),
      locked_at = now(),
      lease_expires_at = now() + make_interval(secs => greatest(30, least(3600, p_lease_seconds))),
      updated_at = now()
  where id = v_id;

  return query
  select * from public.agent_runs where id = v_id;
end;
$$;

revoke all on function public.claim_next_agent_run(text, integer) from public;
revoke all on function public.claim_next_agent_run(text, integer) from anon;
revoke all on function public.claim_next_agent_run(text, integer) from authenticated;
grant execute on function public.claim_next_agent_run(text, integer) to service_role;

create or replace function public.claim_next_cloud_agent_run(
  p_worker_id text,
  p_lease_seconds integer default 1200
)
returns setof public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select r.id into v_id
  from public.agent_runs r
  where r.cancel_requested = false
    and r.status in ('queued','planning','running','validating','repairing','testing','deploying')
    and coalesce(r.available_at, now()) <= now()
    and (r.lease_expires_at is null or r.lease_expires_at < now())
    and r.payload->>'executionProvider' = 'e2b'
  order by r.priority asc, r.created_at asc
  for update skip locked
  limit 1;

  if v_id is null then
    return;
  end if;

  update public.agent_runs
  set locked_by = left(p_worker_id, 160),
      locked_at = now(),
      lease_expires_at = now() + make_interval(secs => greatest(60, least(3600, p_lease_seconds))),
      updated_at = now()
  where id = v_id;

  return query
  select * from public.agent_runs where id = v_id;
end;
$$;

revoke all on function public.claim_next_cloud_agent_run(text, integer) from public;
revoke all on function public.claim_next_cloud_agent_run(text, integer) from anon;
revoke all on function public.claim_next_cloud_agent_run(text, integer) from authenticated;
grant execute on function public.claim_next_cloud_agent_run(text, integer) to service_role;

commit;
