-- Fix: "column reference \"project_id\" is ambiguous" al aceptar invitación.
--
-- Causa: la función accept_invitation se declara como
--   returns table (project_id uuid, role text)
-- Esas columnas de salida quedan como variables implícitas dentro del cuerpo
-- PL/pgSQL. Cuando el INSERT ... ON CONFLICT usa `project_id` / `role` sin
-- calificar, Postgres no sabe si referirte a la variable de salida o a la
-- columna de la tabla y aborta con:
--   column reference "project_id" is ambiguous
--
-- Solución: recrear la función con #variable_conflict use_column para que
-- Postgres prefiera la columna en caso de colisión. Se mantiene la firma y la
-- forma de retorno ({ project_id, role }) para no romper a los consumidores.

create or replace function public.accept_invitation(p_token text)
returns table (project_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
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
