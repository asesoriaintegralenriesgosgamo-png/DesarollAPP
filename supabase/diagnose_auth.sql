-- Diagnóstico v2: NO accede a auth.users (que está restringida).
-- Solo lee variables de sesión que PostgREST inyecta desde el JWT.

create or replace function public.debug_auth()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'auth_uid',      auth.uid(),
    'auth_role',     auth.role(),
    'jwt_claims',    nullif(current_setting('request.jwt.claims', true), ''),
    'jwt_sub_alt',   nullif(current_setting('request.jwt.claim.sub', true), ''),
    'pg_current_user', current_user,
    'pg_session_user', session_user
  );
$$;

grant execute on function public.debug_auth() to anon, authenticated;
