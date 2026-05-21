# Supabase migrations

## Cómo aplicar la migración 0001

### Opción A — SQL Editor de Supabase (más rápido)
1. Abre tu proyecto en https://supabase.com/dashboard
2. Menú lateral → **SQL Editor** → **New query**
3. Pega el contenido de [`migrations/0001_projects_members_invitations.sql`](./migrations/0001_projects_members_invitations.sql)
4. **Run**. Si tu tabla `scenarios` no existía aún, créala antes con:
   ```sql
   create table public.scenarios (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     data jsonb not null,
     user_id uuid references auth.users(id) on delete cascade,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   ```

### Opción B — Supabase CLI
```bash
cd demo-app
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

## Configuración adicional en el Dashboard

1. **Authentication → Providers**
   - **Email**: habilitar; activar "Confirm email" si quieres confirmación obligatoria.
   - **Google**: habilitar y pegar Client ID / Secret de Google Cloud Console.
2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5173` (o tu URL prod)
   - Redirect URLs: agregar `http://localhost:5173/auth/callback` y la URL prod equivalente.
