# Supabase migrations

## Aplicar migración 0001 (paso a paso)

### 1. Abrir SQL Editor

https://supabase.com/dashboard/project/dlctkyxmfcdpwdiekvyy/sql/new

(reemplaza el project ref si cambia)

### 2. Pegar y ejecutar

Copia **todo** el contenido de [`migrations/0001_projects_members_invitations.sql`](./migrations/0001_projects_members_invitations.sql) y dale **Run**.

La migración es **idempotente**: puedes correrla varias veces sin problema. Si ya tenías escenarios, los migra automáticamente a un proyecto "Mis escenarios" por usuario.

### 3. Verificar que quedó

Corre esta query en el SQL Editor — deberías ver las 5 tablas y la función RPC:

```sql
-- Tablas esperadas
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','projects','project_members','scenarios','invitations')
order by tablename;
-- Esperado: 5 filas

-- RLS activa en todas
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','projects','project_members','scenarios','invitations');
-- Esperado: rowsecurity = true en las 5

-- Función RPC
select proname from pg_proc
where pronamespace = (select oid from pg_namespace where nspname = 'public')
  and proname = 'accept_invitation';
-- Esperado: 1 fila

-- Trigger en auth.users
select tgname from pg_trigger where tgname = 'on_auth_user_created';
-- Esperado: 1 fila
```

## Configurar auth providers

1. **Authentication → Providers → Email**: habilitar. Si quieres confirmación obligatoria, activa "Confirm email".
2. **Authentication → Providers → Google**: habilitar y pegar Client ID / Secret de Google Cloud Console.
3. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (o tu URL prod)
   - **Redirect URLs**: agregar `http://localhost:5173/auth/callback` (y la URL prod equivalente)

## Troubleshooting

### "Could not find the table 'public.projects' in the schema cache"
La migración no se aplicó. Repite el paso 2.

### Error al crear proyecto: "new row violates row-level security policy"
La policy de `projects.insert` exige que `owner_id = auth.uid()`. Verifica que el cliente envíe `owner_id` (lo hace [src/lib/api/projects.js](../src/lib/api/projects.js)).

### "infinite recursion detected in policy"
Significa que los helpers `is_project_member` o `project_role` no se crearon como `SECURITY DEFINER`. Re-corre la migración completa.

### "permission denied for function accept_invitation"
Falta el grant. La migración hace `grant execute on function public.accept_invitation(text) to authenticated;` al final. Re-corre.
