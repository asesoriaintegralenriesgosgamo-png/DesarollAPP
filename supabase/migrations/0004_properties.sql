-- ============================================================================
-- 0004: Ficha del Predio
--   properties (1:1 con projects), property_owners, property_boundaries,
--   property_documents (+ Storage bucket). Todo bajo RLS por proyecto.
-- ============================================================================

-- 1. Tablas -------------------------------------------------------------------

create table if not exists public.properties (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  uuid not null unique references public.projects(id) on delete cascade,

  -- Ubicación / dirección
  calle                       text,
  numero_exterior             text,
  numero_interior             text,
  colonia                     text,
  codigo_postal               text check (codigo_postal is null or codigo_postal ~ '^[0-9]{5}$'),
  municipio                   text,
  estado                      text,
  pais                        text default 'México',
  entre_calles                text,
  referencias                 text,
  ubicacion_url               text,
  latitud                     numeric(10, 7),
  longitud                    numeric(10, 7),
  plus_code                   text,

  -- Identificación catastral y oficial
  clave_catastral             text,
  cuenta_predial              text,
  numero_oficial              text,
  alineamiento_folio          text,
  alineamiento_fecha          date,
  folio_real                  text,
  numero_predio               text,

  -- Escritura / RPP
  escritura_numero            text,
  escritura_fecha             date,
  escritura_notario_nombre    text,
  escritura_notario_numero    text,
  escritura_libro             text,
  escritura_volumen           text,
  rpp_inscripcion             text,
  rpp_fecha                   date,

  -- Medidas y superficie
  superficie_terreno_m2       numeric(12, 2),
  superficie_construccion_m2  numeric(12, 2),
  frente_m                    numeric(8, 2),
  fondo_m                     numeric(8, 2),
  forma_terreno               text check (forma_terreno is null or forma_terreno in ('regular','irregular','triangular','trapezoidal','otro')),
  topografia                  text check (topografia is null or topografia in ('plano','pendiente_leve','pendiente_moderada','pendiente_pronunciada','irregular')),

  -- Zonificación / uso de suelo
  uso_suelo                   text,
  zonificacion                text,
  altura_maxima_m             numeric(6, 2),
  niveles_maximos             int check (niveles_maximos is null or niveles_maximos > 0),
  cos                         numeric(4, 3) check (cos is null or (cos >= 0 and cos <= 1)),
  cus                         numeric(5, 3) check (cus is null or cus >= 0),
  densidad                    text,
  restricciones               text,

  -- Servicios e infraestructura
  servicio_agua               boolean not null default false,
  servicio_drenaje            boolean not null default false,
  servicio_electricidad       boolean not null default false,
  servicio_gas_natural        boolean not null default false,
  servicio_alumbrado          boolean not null default false,
  pavimentacion               boolean not null default false,
  banquetas                   boolean not null default false,
  vigilancia                  boolean not null default false,

  cuenta_agua                 text,
  cuenta_cfe                  text,
  cuenta_gas                  text,

  -- Costo y situación legal
  precio_adquisicion          numeric(14, 2),
  moneda                      text default 'MXN' check (moneda in ('MXN','USD')),
  fecha_adquisicion           date,
  gravamenes                  text,
  adeudos_predial             numeric(12, 2),
  adeudos_agua                numeric(12, 2),
  litigios                    text,

  notas                       text,

  created_by                  uuid references auth.users(id) on delete set null,
  updated_by                  uuid references auth.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists properties_project_id_idx on public.properties(project_id);

create table if not exists public.property_owners (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references public.properties(id) on delete cascade,
  project_id            uuid not null references public.projects(id) on delete cascade,
  nombre                text not null check (char_length(nombre) between 1 and 200),
  tipo_persona          text not null default 'fisica' check (tipo_persona in ('fisica','moral')),
  rfc                   text,
  curp                  text,
  identificacion_tipo   text,
  identificacion_numero text,
  porcentaje            numeric(5, 2) check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100)),
  email                 text,
  telefono              text,
  domicilio_fiscal      text,
  notas                 text,
  position              int  not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists property_owners_property_id_idx on public.property_owners(property_id, position);
create index if not exists property_owners_project_id_idx on public.property_owners(project_id);

create table if not exists public.property_boundaries (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  direccion    text not null check (direccion in ('norte','sur','este','oeste','noreste','noroeste','sureste','suroeste','otro')),
  medida_m     numeric(8, 2),
  tipo_vecino  text check (tipo_vecino is null or tipo_vecino in ('calle','avenida','casa_habitacion','edificio','comercio','terreno_baldio','area_verde','rio_arroyo','barranca','otro')),
  descripcion  text,
  position     int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists property_boundaries_property_id_idx on public.property_boundaries(property_id, position);
create index if not exists property_boundaries_project_id_idx on public.property_boundaries(project_id);

create table if not exists public.property_documents (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  uploaded_by   uuid references auth.users(id) on delete set null,
  storage_path  text not null,
  file_name     text not null check (char_length(file_name) between 1 and 255),
  content_type  text,
  size_bytes    bigint,
  categoria     text not null default 'otro' check (categoria in ('escritura','alineamiento','plano','catastral','predial','foto','otro')),
  descripcion   text,
  created_at    timestamptz not null default now()
);
create index if not exists property_documents_property_id_idx on public.property_documents(property_id, created_at);
create index if not exists property_documents_project_id_idx on public.property_documents(project_id);

-- 2. Triggers updated_at ------------------------------------------------------
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

drop trigger if exists property_owners_set_updated_at on public.property_owners;
create trigger property_owners_set_updated_at
  before update on public.property_owners
  for each row execute function public.set_updated_at();

drop trigger if exists property_boundaries_set_updated_at on public.property_boundaries;
create trigger property_boundaries_set_updated_at
  before update on public.property_boundaries
  for each row execute function public.set_updated_at();

-- 3. RLS ----------------------------------------------------------------------
alter table public.properties          enable row level security;
alter table public.property_owners     enable row level security;
alter table public.property_boundaries enable row level security;
alter table public.property_documents  enable row level security;

-- properties
drop policy if exists properties_select_member on public.properties;
create policy properties_select_member on public.properties
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists properties_insert_editor on public.properties;
create policy properties_insert_editor on public.properties
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists properties_update_editor on public.properties;
create policy properties_update_editor on public.properties
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists properties_delete_editor on public.properties;
create policy properties_delete_editor on public.properties
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- property_owners
drop policy if exists property_owners_select_member on public.property_owners;
create policy property_owners_select_member on public.property_owners
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists property_owners_insert_editor on public.property_owners;
create policy property_owners_insert_editor on public.property_owners
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists property_owners_update_editor on public.property_owners;
create policy property_owners_update_editor on public.property_owners
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists property_owners_delete_editor on public.property_owners;
create policy property_owners_delete_editor on public.property_owners
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- property_boundaries
drop policy if exists property_boundaries_select_member on public.property_boundaries;
create policy property_boundaries_select_member on public.property_boundaries
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists property_boundaries_insert_editor on public.property_boundaries;
create policy property_boundaries_insert_editor on public.property_boundaries
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists property_boundaries_update_editor on public.property_boundaries;
create policy property_boundaries_update_editor on public.property_boundaries
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists property_boundaries_delete_editor on public.property_boundaries;
create policy property_boundaries_delete_editor on public.property_boundaries
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- property_documents
drop policy if exists property_documents_select_member on public.property_documents;
create policy property_documents_select_member on public.property_documents
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists property_documents_insert_editor on public.property_documents;
create policy property_documents_insert_editor on public.property_documents
  for insert with check (
    uploaded_by = auth.uid()
    and public.project_role(project_id, auth.uid()) in ('owner','editor')
  );

drop policy if exists property_documents_delete_editor on public.property_documents;
create policy property_documents_delete_editor on public.property_documents
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- 4. Storage bucket -----------------------------------------------------------
-- Bucket privado para documentos del predio.
-- Path convention: <project_id>/<property_id>/<filename>.
insert into storage.buckets (id, name, public)
values ('property-documents', 'property-documents', false)
on conflict (id) do nothing;

drop policy if exists property_storage_select on storage.objects;
create policy property_storage_select on storage.objects
  for select using (
    bucket_id = 'property-documents'
    and public.is_project_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

drop policy if exists property_storage_insert on storage.objects;
create policy property_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'property-documents'
    and public.project_role(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    ) in ('owner','editor')
  );

drop policy if exists property_storage_delete on storage.objects;
create policy property_storage_delete on storage.objects
  for delete using (
    bucket_id = 'property-documents'
    and public.project_role(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    ) in ('owner','editor')
  );

-- 5. GRANTs -------------------------------------------------------------------
grant select, insert, update, delete on public.properties          to authenticated;
grant select, insert, update, delete on public.property_owners     to authenticated;
grant select, insert, update, delete on public.property_boundaries to authenticated;
grant select, insert, update, delete on public.property_documents  to authenticated;
