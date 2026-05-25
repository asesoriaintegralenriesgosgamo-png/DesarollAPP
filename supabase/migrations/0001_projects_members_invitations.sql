-- ============================================================================
-- Migración: proyectos, miembros, invitaciones y refactor de scenarios
-- ============================================================================
-- Estructura:
--   1. Extensiones
--   2. Tablas nuevas (profiles, projects, project_members, invitations)
--   3. Helpers SECURITY DEFINER (evitan recursión en RLS)
--   4. Refactor de scenarios (project_id, drop user_id)
--   5. RLS policies
--   6. Triggers
--   7. RPC accept_invitation
-- ============================================================================

-- 1. Extensiones --------------------------------------------------------------
create extension if not exists pgcrypto with schema public;

-- 1b. scenarios (base, si no existe) ------------------------------------------
-- Idempotente: si ya tenías scenarios desde antes, no toca nada aquí.
create table if not exists public.scenarios (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  data       jsonb not null,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tablas nuevas ------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on public.projects(owner_id);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx on public.project_members(user_id);

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  email       text,                                       -- NULL = invitación tipo link
  token       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  role        text not null check (role in ('editor','viewer')),
  invited_by  uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists invitations_project_id_idx on public.invitations(project_id);
create index if not exists invitations_token_idx on public.invitations(token);

-- 3. Helpers SECURITY DEFINER --------------------------------------------------
-- Estas funciones se usan dentro de policies para evitar recursión
-- (policies sobre projects/project_members que se referencien entre sí).

create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

create or replace function public.project_role(p_project_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.project_members
  where project_id = p_project_id and user_id = p_user_id;
$$;

revoke all on function public.is_project_member(uuid, uuid) from public;
grant execute on function public.is_project_member(uuid, uuid) to anon, authenticated;
revoke all on function public.project_role(uuid, uuid) from public;
grant execute on function public.project_role(uuid, uuid) to anon, authenticated;

-- 4. Refactor de scenarios ----------------------------------------------------
-- 4a. Agregar columnas
alter table public.scenarios
  add column if not exists project_id uuid references public.projects(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- 4b. Backfill: crear un proyecto "Mis escenarios" por cada user_id existente
-- y migrar los escenarios a ese project_id + insertar como owners en members.
do $$
declare
  rec record;
  new_project_id uuid;
begin
  for rec in
    select distinct user_id
    from public.scenarios
    where user_id is not null
      and project_id is null
  loop
    insert into public.projects (owner_id, name, description)
    values (rec.user_id, 'Mis escenarios', 'Proyecto migrado automáticamente')
    returning id into new_project_id;

    insert into public.project_members (project_id, user_id, role)
    values (new_project_id, rec.user_id, 'owner')
    on conflict do nothing;

    update public.scenarios
       set project_id = new_project_id,
           created_by = user_id
     where user_id = rec.user_id and project_id is null;
  end loop;
end $$;

-- 4c. Hacer project_id obligatorio y descartar user_id
alter table public.scenarios
  alter column project_id set not null;

alter table public.scenarios
  drop column if exists user_id;

create index if not exists scenarios_project_id_idx on public.scenarios(project_id);

-- 5. RLS ----------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.scenarios       enable row level security;
alter table public.invitations     enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists profiles_select_own_or_shared on public.profiles;
create policy profiles_select_own_or_shared on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.project_members me
      join public.project_members other
        on other.project_id = me.project_id
      where me.user_id = auth.uid()
        and other.user_id = profiles.id
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- projects ---------------------------------------------------------------
drop policy if exists projects_select_member on public.projects;
create policy projects_select_member on public.projects
  for select using (public.is_project_member(id, auth.uid()));

drop policy if exists projects_insert_self on public.projects;
create policy projects_insert_self on public.projects
  for insert with check (owner_id = auth.uid());

drop policy if exists projects_update_editor_or_owner on public.projects;
create policy projects_update_editor_or_owner on public.projects
  for update using (
    public.project_role(id, auth.uid()) in ('owner','editor')
  ) with check (
    public.project_role(id, auth.uid()) in ('owner','editor')
  );

drop policy if exists projects_delete_owner on public.projects;
create policy projects_delete_owner on public.projects
  for delete using (public.project_role(id, auth.uid()) = 'owner');

-- project_members --------------------------------------------------------
drop policy if exists members_select_same_project on public.project_members;
create policy members_select_same_project on public.project_members
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists members_insert_self_as_owner on public.project_members;
-- Permite que el trigger handle_new_project inserte (corre como dueño autenticado)
create policy members_insert_self_as_owner on public.project_members
  for insert with check (
    -- el nuevo registro debe pertenecer a un proyecto del que el actor es owner,
    -- O bien el actor se está insertando a sí mismo como owner de su propio proyecto
    (
      user_id = auth.uid()
      and role = 'owner'
      and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    )
    or public.project_role(project_id, auth.uid()) = 'owner'
  );

drop policy if exists members_update_by_owner on public.project_members;
create policy members_update_by_owner on public.project_members
  for update using (public.project_role(project_id, auth.uid()) = 'owner')
  with check (public.project_role(project_id, auth.uid()) = 'owner');

drop policy if exists members_delete_by_owner_or_self on public.project_members;
create policy members_delete_by_owner_or_self on public.project_members
  for delete using (
    public.project_role(project_id, auth.uid()) = 'owner'
    or user_id = auth.uid()
  );

-- scenarios --------------------------------------------------------------
drop policy if exists scenarios_select_member on public.scenarios;
create policy scenarios_select_member on public.scenarios
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists scenarios_modify_editor on public.scenarios;
create policy scenarios_modify_editor on public.scenarios
  for insert with check (
    public.project_role(project_id, auth.uid()) in ('owner','editor')
  );

drop policy if exists scenarios_update_editor on public.scenarios;
create policy scenarios_update_editor on public.scenarios
  for update using (
    public.project_role(project_id, auth.uid()) in ('owner','editor')
  ) with check (
    public.project_role(project_id, auth.uid()) in ('owner','editor')
  );

drop policy if exists scenarios_delete_editor on public.scenarios;
create policy scenarios_delete_editor on public.scenarios
  for delete using (
    public.project_role(project_id, auth.uid()) in ('owner','editor')
  );

-- invitations ------------------------------------------------------------
drop policy if exists invitations_select_member on public.invitations;
create policy invitations_select_member on public.invitations
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists invitations_insert_owner on public.invitations;
create policy invitations_insert_owner on public.invitations
  for insert with check (
    public.project_role(project_id, auth.uid()) = 'owner'
    and invited_by = auth.uid()
  );

drop policy if exists invitations_delete_owner on public.invitations;
create policy invitations_delete_owner on public.invitations
  for delete using (public.project_role(project_id, auth.uid()) = 'owner');

-- 6. Triggers -----------------------------------------------------------------

-- 6a. set updated_at on update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists scenarios_set_updated_at on public.scenarios;
create trigger scenarios_set_updated_at
  before update on public.scenarios
  for each row execute function public.set_updated_at();

-- 6b. Crear profile cuando un usuario se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6c. Insertar owner en project_members cuando se crea un proyecto
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists projects_handle_new on public.projects;
create trigger projects_handle_new
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- 7. RPC accept_invitation ----------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns table (project_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select * into inv
    from public.invitations
    where token = p_token
    limit 1;

  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;

  if inv.accepted_at is not null then
    raise exception 'invitation_already_accepted' using errcode = 'P0001';
  end if;

  if inv.expires_at < now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  -- Si la invitación era por email, exigir que coincida con el email del JWT
  if inv.email is not null then
    select email into current_email from auth.users where id = auth.uid();
    if lower(current_email) <> lower(inv.email) then
      raise exception 'invitation_email_mismatch' using errcode = 'P0001';
    end if;
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (inv.project_id, auth.uid(), inv.role)
  on conflict (project_id, user_id) do update
    set role = excluded.role;

  -- Solo marcar accepted_at en invitaciones por email (las de link pueden reutilizarse)
  if inv.email is not null then
    update public.invitations
       set accepted_at = now()
     where id = inv.id;
  end if;

  return query select inv.project_id, inv.role;
end $$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;
