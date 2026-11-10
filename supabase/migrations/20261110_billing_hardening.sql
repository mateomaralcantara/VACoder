-- VACoder: endurecimiento de facturacion.
--
-- Antes de esta migracion, cualquier owner/admin podia cambiar el plan de su
-- organizacion, su fila de subscriptions y su saldo de credits directamente
-- desde el navegador, porque las politicas RLS permitian escribir esas tablas.
--
-- A partir de aqui el plan, la suscripcion y el saldo solo los cambia el
-- servidor (service role: webhook de Stripe, workers) o un administrador de
-- la base de datos. Los clientes pueden seguir creando sus filas iniciales,
-- pero siempre nacen en plan free y con saldo 0.
--
-- Es idempotente: se puede ejecutar mas de una vez.

-- Las peticiones del navegador llegan con el rol authenticated o anon. El
-- service role, el SQL editor y las funciones security definer no.
create or replace function public.is_billing_client()
returns boolean
language sql
stable
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- ------------------------------------------------------
-- organizations.plan
-- ------------------------------------------------------

create or replace function public.protect_organization_plan()
returns trigger
language plpgsql
as $$
begin
  if not public.is_billing_client() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plan := 'free';
  elsif new.plan is distinct from old.plan then
    raise exception 'El plan solo se cambia desde facturacion.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_organization_plan
  on public.organizations;

create trigger trg_protect_organization_plan
before insert or update on public.organizations
for each row execute function public.protect_organization_plan();

-- ------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------

create or replace function public.protect_subscription()
returns trigger
language plpgsql
as $$
begin
  if not public.is_billing_client() then
    -- En un DELETE no existe NEW; devolver NULL cancelaria el borrado.
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.plan := 'free';
    new.status := 'active';
    new.provider := null;
    new.provider_customer_id := null;
    new.provider_subscription_id := null;
    new.current_period_end := null;
    new.metadata := '{}'::jsonb;
    return new;
  end if;

  raise exception 'La suscripcion solo se cambia desde facturacion.'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_subscription
  on public.subscriptions;

create trigger trg_protect_subscription
before insert or update or delete on public.subscriptions
for each row execute function public.protect_subscription();

-- ------------------------------------------------------
-- credits
-- ------------------------------------------------------

create or replace function public.protect_credits()
returns trigger
language plpgsql
as $$
begin
  if not public.is_billing_client() then
    -- En un DELETE no existe NEW; devolver NULL cancelaria el borrado.
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.balance := 0;
    return new;
  end if;

  raise exception 'El saldo de creditos solo se cambia desde el servidor.'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_protect_credits
  on public.credits;

create trigger trg_protect_credits
before insert or update or delete on public.credits
for each row execute function public.protect_credits();

-- ------------------------------------------------------
-- Limite de proyectos por plan
-- Mantener igual que PLANS en lib/billing/plans.ts. null = sin limite.
-- ------------------------------------------------------

create or replace function public.plan_project_limit(target_plan text)
returns integer
language sql
immutable
as $$
  select case target_plan
    when 'free' then 2
    when 'pro' then 10
    when 'business' then 50
    when 'agency' then 200
    when 'enterprise' then null
    else 2
  end;
$$;

-- security definer: debe contar todos los proyectos de la organizacion, no
-- solo los que RLS deja ver al usuario que inserta.
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_plan text;
  max_projects integer;
  current_projects integer;
begin
  -- Bloquea la fila de la organizacion para que dos altas simultaneas no
  -- pasen las dos el limite.
  select o.plan into org_plan
  from public.organizations o
  where o.id = new.organization_id
  for update;

  max_projects := public.plan_project_limit(org_plan);

  if max_projects is null then
    return new;
  end if;

  select count(*) into current_projects
  from public.projects p
  where p.organization_id = new.organization_id;

  if current_projects >= max_projects then
    raise exception 'Limite de proyectos del plan % alcanzado (%).', org_plan, max_projects
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_limit
  on public.projects;

create trigger trg_enforce_project_limit
before insert on public.projects
for each row execute function public.enforce_project_limit();
