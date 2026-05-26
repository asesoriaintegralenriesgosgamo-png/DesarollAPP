-- ============================================================================
-- 0002: Calendario de Obra
--   Categorías, tareas (con subtareas), asignados, dependencias,
--   comentarios, adjuntos (Storage), hitos. Todo bajo RLS por proyecto.
-- ============================================================================

-- 1. Tablas -------------------------------------------------------------------

create table if not exists public.construction_categories (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null default '#78716c' check (color ~* '^#[0-9a-f]{6}$'),
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists construction_categories_project_id_idx
  on public.construction_categories(project_id, position);

create table if not exists public.construction_tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  category_id    uuid references public.construction_categories(id) on delete set null,
  parent_id      uuid references public.construction_tasks(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 160),
  description    text,
  planned_start  date,
  planned_end    date,
  actual_start   date,
  actual_end     date,
  progress       int  not null default 0 check (progress between 0 and 100),
  position       int  not null default 0,
  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint planned_dates_order check (
    planned_start is null or planned_end is null or planned_start <= planned_end
  ),
  constraint actual_dates_order check (
    actual_start is null or actual_end is null or actual_start <= actual_end
  )
);
create index if not exists construction_tasks_project_id_idx
  on public.construction_tasks(project_id);
create index if not exists construction_tasks_category_id_idx
  on public.construction_tasks(category_id, position);
create index if not exists construction_tasks_parent_id_idx
  on public.construction_tasks(parent_id, position);
create index if not exists construction_tasks_planned_idx
  on public.construction_tasks(project_id, planned_start, planned_end);

-- Evita anidamiento de más de 1 nivel (categoría → tarea → subtarea, no más).
create or replace function public.construction_tasks_validate_parent()
returns trigger
language plpgsql
as $$
declare
  grandparent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'task_parent_self_reference';
  end if;
  select parent_id into grandparent
    from public.construction_tasks
    where id = new.parent_id;
  if grandparent is not null then
    raise exception 'task_parent_must_be_top_level';
  end if;
  return new;
end $$;

drop trigger if exists construction_tasks_validate_parent on public.construction_tasks;
create trigger construction_tasks_validate_parent
  before insert or update on public.construction_tasks
  for each row execute function public.construction_tasks_validate_parent();

create table if not exists public.construction_task_assignees (
  task_id    uuid not null references public.construction_tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index if not exists construction_task_assignees_user_id_idx
  on public.construction_task_assignees(user_id);

create table if not exists public.construction_task_dependencies (
  task_id            uuid not null references public.construction_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.construction_tasks(id) on delete cascade,
  created_at         timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint dependency_no_self check (task_id <> depends_on_task_id)
);
create index if not exists construction_task_deps_depends_on_idx
  on public.construction_task_dependencies(depends_on_task_id);

create table if not exists public.construction_task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.construction_tasks(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists construction_task_comments_task_id_idx
  on public.construction_task_comments(task_id, created_at);

create table if not exists public.construction_task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.construction_tasks(id) on delete cascade,
  uploaded_by   uuid not null references auth.users(id) on delete set null,
  storage_path  text not null,
  file_name     text not null check (char_length(file_name) between 1 and 255),
  content_type  text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);
create index if not exists construction_task_attachments_task_id_idx
  on public.construction_task_attachments(task_id, created_at);

create table if not exists public.construction_milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  date        date not null,
  color       text not null default '#dc2626' check (color ~* '^#[0-9a-f]{6}$'),
  created_at  timestamptz not null default now()
);
create index if not exists construction_milestones_project_id_idx
  on public.construction_milestones(project_id, date);

-- 2. Triggers updated_at ------------------------------------------------------
drop trigger if exists construction_categories_set_updated_at on public.construction_categories;
create trigger construction_categories_set_updated_at
  before update on public.construction_categories
  for each row execute function public.set_updated_at();

drop trigger if exists construction_tasks_set_updated_at on public.construction_tasks;
create trigger construction_tasks_set_updated_at
  before update on public.construction_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists construction_task_comments_set_updated_at on public.construction_task_comments;
create trigger construction_task_comments_set_updated_at
  before update on public.construction_task_comments
  for each row execute function public.set_updated_at();

-- 3. RLS ----------------------------------------------------------------------
alter table public.construction_categories       enable row level security;
alter table public.construction_tasks            enable row level security;
alter table public.construction_task_assignees   enable row level security;
alter table public.construction_task_dependencies enable row level security;
alter table public.construction_task_comments    enable row level security;
alter table public.construction_task_attachments enable row level security;
alter table public.construction_milestones       enable row level security;

-- categories
drop policy if exists cat_select_member  on public.construction_categories;
create policy cat_select_member on public.construction_categories
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists cat_insert_editor on public.construction_categories;
create policy cat_insert_editor on public.construction_categories
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists cat_update_editor on public.construction_categories;
create policy cat_update_editor on public.construction_categories
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists cat_delete_editor on public.construction_categories;
create policy cat_delete_editor on public.construction_categories
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- tasks
drop policy if exists task_select_member  on public.construction_tasks;
create policy task_select_member on public.construction_tasks
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists task_insert_editor on public.construction_tasks;
create policy task_insert_editor on public.construction_tasks
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists task_update_editor on public.construction_tasks;
create policy task_update_editor on public.construction_tasks
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists task_delete_editor on public.construction_tasks;
create policy task_delete_editor on public.construction_tasks
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- assignees (membresía vía project_id de la tarea padre)
drop policy if exists assign_select_member on public.construction_task_assignees;
create policy assign_select_member on public.construction_task_assignees
  for select using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.is_project_member(t.project_id, auth.uid())
    )
  );

drop policy if exists assign_insert_editor on public.construction_task_assignees;
create policy assign_insert_editor on public.construction_task_assignees
  for insert with check (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
        and public.is_project_member(t.project_id, user_id)
    )
  );

drop policy if exists assign_delete_editor on public.construction_task_assignees;
create policy assign_delete_editor on public.construction_task_assignees
  for delete using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
    )
  );

-- dependencies (mismo proyecto + editor)
drop policy if exists dep_select_member on public.construction_task_dependencies;
create policy dep_select_member on public.construction_task_dependencies
  for select using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.is_project_member(t.project_id, auth.uid())
    )
  );

drop policy if exists dep_insert_editor on public.construction_task_dependencies;
create policy dep_insert_editor on public.construction_task_dependencies
  for insert with check (
    exists (
      select 1 from public.construction_tasks t
      join public.construction_tasks d on d.id = depends_on_task_id
      where t.id = task_id
        and t.project_id = d.project_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
    )
  );

drop policy if exists dep_delete_editor on public.construction_task_dependencies;
create policy dep_delete_editor on public.construction_task_dependencies
  for delete using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
    )
  );

-- comments (lectura miembro; el autor puede editar/borrar el suyo;
-- los owners/editors pueden borrar cualquiera para moderación)
drop policy if exists comm_select_member on public.construction_task_comments;
create policy comm_select_member on public.construction_task_comments
  for select using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.is_project_member(t.project_id, auth.uid())
    )
  );

drop policy if exists comm_insert_member on public.construction_task_comments;
create policy comm_insert_member on public.construction_task_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.is_project_member(t.project_id, auth.uid())
    )
  );

drop policy if exists comm_update_own on public.construction_task_comments;
create policy comm_update_own on public.construction_task_comments
  for update using (user_id = auth.uid())
            with check (user_id = auth.uid());

drop policy if exists comm_delete_own_or_editor on public.construction_task_comments;
create policy comm_delete_own_or_editor on public.construction_task_comments
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
    )
  );

-- attachments
drop policy if exists att_select_member on public.construction_task_attachments;
create policy att_select_member on public.construction_task_attachments
  for select using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.is_project_member(t.project_id, auth.uid())
    )
  );

drop policy if exists att_insert_editor on public.construction_task_attachments;
create policy att_insert_editor on public.construction_task_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
    )
  );

drop policy if exists att_delete_editor on public.construction_task_attachments;
create policy att_delete_editor on public.construction_task_attachments
  for delete using (
    exists (
      select 1 from public.construction_tasks t
      where t.id = task_id
        and public.project_role(t.project_id, auth.uid()) in ('owner','editor')
    )
  );

-- milestones
drop policy if exists ms_select_member  on public.construction_milestones;
create policy ms_select_member on public.construction_milestones
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists ms_insert_editor on public.construction_milestones;
create policy ms_insert_editor on public.construction_milestones
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists ms_update_editor on public.construction_milestones;
create policy ms_update_editor on public.construction_milestones
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists ms_delete_editor on public.construction_milestones;
create policy ms_delete_editor on public.construction_milestones
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- 4. Storage bucket -----------------------------------------------------------
-- Bucket privado para adjuntos. Path convention: <project_id>/<task_id>/<filename>.
insert into storage.buckets (id, name, public)
values ('construction-attachments', 'construction-attachments', false)
on conflict (id) do nothing;

-- RLS de storage.objects: project_id se extrae del primer segmento del path.
-- Las policies usan los helpers existentes is_project_member / project_role.

drop policy if exists construction_storage_select on storage.objects;
create policy construction_storage_select on storage.objects
  for select using (
    bucket_id = 'construction-attachments'
    and public.is_project_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

drop policy if exists construction_storage_insert on storage.objects;
create policy construction_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'construction-attachments'
    and public.project_role(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    ) in ('owner','editor')
  );

drop policy if exists construction_storage_delete on storage.objects;
create policy construction_storage_delete on storage.objects
  for delete using (
    bucket_id = 'construction-attachments'
    and public.project_role(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    ) in ('owner','editor')
  );

-- 5. GRANTs -------------------------------------------------------------------
grant select, insert, update, delete on public.construction_categories        to authenticated;
grant select, insert, update, delete on public.construction_tasks             to authenticated;
grant select, insert, update, delete on public.construction_task_assignees    to authenticated;
grant select, insert, update, delete on public.construction_task_dependencies to authenticated;
grant select, insert, update, delete on public.construction_task_comments     to authenticated;
grant select, insert, update, delete on public.construction_task_attachments  to authenticated;
grant select, insert, update, delete on public.construction_milestones        to authenticated;
