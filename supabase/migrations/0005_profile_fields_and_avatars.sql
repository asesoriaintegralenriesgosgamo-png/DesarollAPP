-- 0004_profile_fields_and_avatars.sql
-- Amplía profiles con first_name/last_name/birth_date, sincroniza display_name
-- como "Nombre A." automáticamente, expone email de miembros via RPC seguro,
-- y crea el bucket público "avatars" con RLS por dueño.

-- a) Nuevas columnas en profiles -------------------------------------------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists birth_date date;

-- b) Trigger: display_name = "Nombre A." cuando se actualiza first/last name
create or replace function public.profiles_sync_display_name()
returns trigger
language plpgsql
as $$
begin
  if new.first_name is not null and length(trim(new.first_name)) > 0 then
    new.display_name :=
      trim(new.first_name) ||
      case
        when new.last_name is not null and length(trim(new.last_name)) > 0
          then ' ' || upper(left(trim(new.last_name), 1)) || '.'
        else ''
      end;
  end if;
  return new;
end $$;

drop trigger if exists profiles_sync_display_name_trg on public.profiles;
create trigger profiles_sync_display_name_trg
  before insert or update of first_name, last_name on public.profiles
  for each row execute function public.profiles_sync_display_name();

-- c) RPC seguro para obtener email de miembros del MISMO proyecto -----------
--    No expone auth.users directamente: valida que el caller pertenezca al
--    proyecto antes de regresar emails.
create or replace function public.get_member_emails(p_project_id uuid)
returns table(user_id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select pm.user_id, u.email::text
  from public.project_members pm
  join auth.users u on u.id = pm.user_id
  where pm.project_id = p_project_id
    and exists (
      select 1 from public.project_members me
      where me.project_id = p_project_id
        and me.user_id = auth.uid()
    );
$$;

revoke all on function public.get_member_emails(uuid) from public;
grant execute on function public.get_member_emails(uuid) to authenticated;

-- d) Bucket público "avatars" + políticas RLS de storage --------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_owner_write on storage.objects;
create policy avatars_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
