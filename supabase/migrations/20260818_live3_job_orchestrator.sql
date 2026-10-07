begin;

create extension if not exists pgcrypto;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_runs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists run_type text not null default 'agent',
  add column if not exists status text not null default 'queued',
  add column if not exists priority integer not null default 5,
  add column if not exists progress integer not null default 0,
  add column if not exists current_stage text,
  add column if not exists prompt text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb,
  add column if not exists error text,
  add column if not exists attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists timeout_seconds integer not null default 900,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_tasks
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists run_id uuid references public.agent_runs(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists task_type text not null default 'task',
  add column if not exists stage text not null default 'running',
  add column if not exists position integer not null default 1,
  add column if not exists status text not null default 'queued',
  add column if not exists progress integer not null default 0,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb,
  add column if not exists error text,
  add column if not exists attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists timeout_seconds integer not null default 900,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

create table if not exists public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  event_type text not null,
  message text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_queue_live3
  on public.agent_runs(status, priority, available_at, created_at);
create index if not exists idx_agent_runs_project_live3
  on public.agent_runs(project_id, created_at desc);
create index if not exists idx_agent_tasks_run_live3
  on public.agent_tasks(run_id, position);
create index if not exists idx_agent_events_run_live3
  on public.agent_run_events(run_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_agent_runs_live3_updated on public.agent_runs;
create trigger trg_agent_runs_live3_updated before update on public.agent_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_agent_tasks_live3_updated on public.agent_tasks;
create trigger trg_agent_tasks_live3_updated before update on public.agent_tasks
for each row execute function public.set_updated_at();

alter table public.agent_runs enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_run_events enable row level security;

drop policy if exists agent_run_events_org_isolation_live3 on public.agent_run_events;
create policy agent_run_events_org_isolation_live3 on public.agent_run_events
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

-- Asegura politicas especificas sin eliminar las existentes de LIVE 1.
drop policy if exists agent_runs_org_live3 on public.agent_runs;
create policy agent_runs_org_live3 on public.agent_runs
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists agent_tasks_org_live3 on public.agent_tasks;
create policy agent_tasks_org_live3 on public.agent_tasks
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

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
  order by r.priority asc, r.created_at asc
  for update skip locked
  limit 1;

  if v_id is null then return; end if;

  update public.agent_runs
  set locked_by = left(p_worker_id, 160),
      locked_at = now(),
      lease_expires_at = now() + make_interval(secs => greatest(30, least(3600, p_lease_seconds))),
      updated_at = now()
  where id = v_id;

  return query select * from public.agent_runs where id = v_id;
end;
$$;

revoke all on function public.claim_next_agent_run(text, integer) from public;
revoke all on function public.claim_next_agent_run(text, integer) from anon;
revoke all on function public.claim_next_agent_run(text, integer) from authenticated;
grant execute on function public.claim_next_agent_run(text, integer) to service_role;

commit;
