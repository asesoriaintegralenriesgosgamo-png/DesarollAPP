-- Diagnóstico: ¿qué ve el servidor cuando un usuario hace una petición?
-- Crea una función pública que devuelve lo que vería RLS.

create or replace function public.debug_auth()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'auth_uid',     auth.uid(),
    'auth_role',    auth.role(),
    'auth_email',   (select email from auth.users where id = auth.uid()),
    'jwt_claims',   current_setting('request.jwt.claims', true),
    'jwt_sub',      current_setting('request.jwt.claim.sub', true),
    'pg_user',      current_user
  );
$$;

grant execute on function public.debug_auth() to anon, authenticated;
