-- ============================================================================
-- 0006: Cuentas — control financiero del proyecto
--   project_partners        (socios financieros)
--   project_bank_accounts   (cuentas bancarias)
--   payees                  (beneficiarios / proveedores)
--   expense_categories      (partidas presupuestales, jerárquicas)
--   partner_contributions   (aportaciones de socios)
--   project_expenses        (egresos / gastos)
--   partner_transfers       (cesiones entre socios)
--   partner_contracts       (contratos PDF)
--   Storage bucket: accounts-documents
-- Todo bajo RLS por proyecto siguiendo el patrón de 0002/0004.
-- ============================================================================

-- 1. Tablas -------------------------------------------------------------------

-- 1.1 project_partners ------------------------------------------------------
create table if not exists public.project_partners (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  linked_user_id          uuid references auth.users(id) on delete set null,

  nombre                  text not null check (char_length(nombre) between 1 and 200),
  tipo_persona            text not null default 'fisica' check (tipo_persona in ('fisica','moral')),
  rfc                     text,
  curp                    text,
  identificacion_tipo     text,
  identificacion_numero   text,

  email                   text,
  telefono                text,
  domicilio_fiscal        text,

  rol_en_proyecto         text,
  porcentaje_contractual  numeric(5, 2) check (porcentaje_contractual is null or (porcentaje_contractual >= 0 and porcentaje_contractual <= 100)),
  monto_comprometido      numeric(14, 2) check (monto_comprometido is null or monto_comprometido >= 0),
  moneda                  text not null default 'MXN' check (moneda in ('MXN','USD')),

  color                   text not null default '#78716c' check (color ~* '^#[0-9a-f]{6}$'),
  activo                  boolean not null default true,
  notas                   text,
  position                int not null default 0,

  created_by              uuid references auth.users(id) on delete set null,
  updated_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists project_partners_project_id_idx on public.project_partners(project_id, position);

-- 1.2 project_bank_accounts ------------------------------------------------
create table if not exists public.project_bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,

  nombre          text not null check (char_length(nombre) between 1 and 120),
  banco           text,
  numero_cuenta   text,
  clabe           text check (clabe is null or clabe ~ '^[0-9]{18}$'),
  moneda          text not null default 'MXN' check (moneda in ('MXN','USD')),
  saldo_inicial   numeric(14, 2) not null default 0,
  fecha_apertura  date,
  tipo            text not null default 'operativa' check (tipo in ('operativa','escrow','inversion','credito','otra')),
  activa          boolean not null default true,
  notas           text,
  position        int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists project_bank_accounts_project_id_idx on public.project_bank_accounts(project_id, position);

-- 1.3 payees ---------------------------------------------------------------
create table if not exists public.payees (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,

  nombre          text not null check (char_length(nombre) between 1 and 200),
  tipo            text not null default 'proveedor' check (tipo in ('proveedor','contratista','profesional','gobierno','empleado','servicio','otro')),
  rfc             text,
  email           text,
  telefono        text,
  contacto_nombre text,
  notas           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists payees_project_id_idx on public.payees(project_id, nombre);

-- 1.4 expense_categories ---------------------------------------------------
create table if not exists public.expense_categories (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  parent_id            uuid references public.expense_categories(id) on delete cascade,

  nombre               text not null check (char_length(nombre) between 1 and 80),
  color                text not null default '#78716c' check (color ~* '^#[0-9a-f]{6}$'),
  presupuesto_inicial  numeric(14, 2),
  moneda               text not null default 'MXN' check (moneda in ('MXN','USD')),
  position             int not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists expense_categories_project_id_idx on public.expense_categories(project_id, position);
create index if not exists expense_categories_parent_id_idx on public.expense_categories(parent_id, position);

-- Evita anidamiento > 1 nivel (categoría → subcategoría, sin más). Mismo patrón
-- que construction_tasks_validate_parent.
create or replace function public.expense_categories_validate_parent()
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
    raise exception 'category_parent_self_reference';
  end if;
  select parent_id into grandparent
    from public.expense_categories
    where id = new.parent_id;
  if grandparent is not null then
    raise exception 'category_parent_must_be_top_level';
  end if;
  return new;
end $$;

drop trigger if exists expense_categories_validate_parent on public.expense_categories;
create trigger expense_categories_validate_parent
  before insert or update on public.expense_categories
  for each row execute function public.expense_categories_validate_parent();

-- 1.5 partner_contributions ------------------------------------------------
create table if not exists public.partner_contributions (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  partner_id                uuid not null references public.project_partners(id) on delete cascade,
  account_id                uuid references public.project_bank_accounts(id) on delete set null,

  fecha                     date not null,
  monto                     numeric(14, 2) not null check (monto > 0),
  moneda                    text not null default 'MXN' check (moneda in ('MXN','USD')),
  tipo                      text not null default 'capital' check (tipo in ('capital','prestamo','especie','reembolso')),
  concepto                  text,
  metodo                    text check (metodo is null or metodo in ('transferencia','cheque','efectivo','especie','tarjeta','otro')),
  referencia                text,
  comprobante_storage_path  text,
  estado                    text not null default 'registrada' check (estado in ('registrada','conciliada')),

  created_by                uuid references auth.users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists partner_contributions_project_id_idx on public.partner_contributions(project_id, fecha desc);
create index if not exists partner_contributions_partner_id_idx on public.partner_contributions(partner_id, fecha desc);
create index if not exists partner_contributions_account_id_idx on public.partner_contributions(account_id);

-- 1.6 project_expenses -----------------------------------------------------
create table if not exists public.project_expenses (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  payee_id                  uuid references public.payees(id) on delete set null,
  category_id               uuid references public.expense_categories(id) on delete set null,
  account_id                uuid references public.project_bank_accounts(id) on delete set null,
  construction_task_id      uuid references public.construction_tasks(id) on delete set null,

  fecha                     date not null,
  monto                     numeric(14, 2) not null check (monto > 0),
  moneda                    text not null default 'MXN' check (moneda in ('MXN','USD')),
  concepto                  text not null check (char_length(concepto) between 1 and 300),
  metodo                    text check (metodo is null or metodo in ('transferencia','cheque','efectivo','tarjeta','otro')),
  referencia                text,
  estado                    text not null default 'pagado' check (estado in ('programado','pagado','conciliado','cancelado')),

  factura_uuid              text,
  factura_folio             text,
  factura_storage_path      text,
  comprobante_storage_path  text,

  created_by                uuid references auth.users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists project_expenses_project_id_idx on public.project_expenses(project_id, fecha desc);
create index if not exists project_expenses_category_id_idx on public.project_expenses(category_id);
create index if not exists project_expenses_payee_id_idx on public.project_expenses(payee_id);
create index if not exists project_expenses_account_id_idx on public.project_expenses(account_id);
create index if not exists project_expenses_construction_task_id_idx on public.project_expenses(construction_task_id);

-- 1.7 partner_transfers ----------------------------------------------------
create table if not exists public.partner_transfers (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  from_partner_id         uuid not null references public.project_partners(id) on delete cascade,
  to_partner_id           uuid not null references public.project_partners(id) on delete cascade,

  fecha                   date not null,
  tipo                    text not null default 'cesion_porcentaje' check (tipo in ('cesion_porcentaje','ajuste','distribucion')),
  monto                   numeric(14, 2) check (monto is null or monto >= 0),
  moneda                  text not null default 'MXN' check (moneda in ('MXN','USD')),
  porcentaje_transferido  numeric(5, 2) check (porcentaje_transferido is null or (porcentaje_transferido >= 0 and porcentaje_transferido <= 100)),
  concepto                text,
  referencia              text,

  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),

  constraint partner_transfers_distinct check (from_partner_id <> to_partner_id)
);
create index if not exists partner_transfers_project_id_idx on public.partner_transfers(project_id, fecha desc);
create index if not exists partner_transfers_from_idx on public.partner_transfers(from_partner_id);
create index if not exists partner_transfers_to_idx on public.partner_transfers(to_partner_id);

-- 1.8 partner_contracts ----------------------------------------------------
create table if not exists public.partner_contracts (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  partner_id          uuid references public.project_partners(id) on delete cascade,  -- NULL = contrato general del proyecto

  tipo                text not null default 'asociacion' check (tipo in ('asociacion','fideicomiso','prestamo','cesion','servicios','otro')),
  nombre              text not null check (char_length(nombre) between 1 and 200),
  descripcion         text,
  fecha_firma         date,
  fecha_vencimiento   date,
  storage_path        text not null,
  file_name           text not null,
  content_type        text,
  size_bytes          bigint,

  uploaded_by         uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists partner_contracts_project_id_idx on public.partner_contracts(project_id, created_at desc);
create index if not exists partner_contracts_partner_id_idx on public.partner_contracts(partner_id);

-- 2. Triggers updated_at ------------------------------------------------------
drop trigger if exists project_partners_set_updated_at on public.project_partners;
create trigger project_partners_set_updated_at
  before update on public.project_partners
  for each row execute function public.set_updated_at();

drop trigger if exists project_bank_accounts_set_updated_at on public.project_bank_accounts;
create trigger project_bank_accounts_set_updated_at
  before update on public.project_bank_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists payees_set_updated_at on public.payees;
create trigger payees_set_updated_at
  before update on public.payees
  for each row execute function public.set_updated_at();

drop trigger if exists expense_categories_set_updated_at on public.expense_categories;
create trigger expense_categories_set_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

drop trigger if exists partner_contributions_set_updated_at on public.partner_contributions;
create trigger partner_contributions_set_updated_at
  before update on public.partner_contributions
  for each row execute function public.set_updated_at();

drop trigger if exists project_expenses_set_updated_at on public.project_expenses;
create trigger project_expenses_set_updated_at
  before update on public.project_expenses
  for each row execute function public.set_updated_at();

-- 3. RLS ----------------------------------------------------------------------
alter table public.project_partners       enable row level security;
alter table public.project_bank_accounts  enable row level security;
alter table public.payees                 enable row level security;
alter table public.expense_categories     enable row level security;
alter table public.partner_contributions  enable row level security;
alter table public.project_expenses       enable row level security;
alter table public.partner_transfers      enable row level security;
alter table public.partner_contracts      enable row level security;

-- project_partners
drop policy if exists pp_select_member on public.project_partners;
create policy pp_select_member on public.project_partners
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists pp_insert_editor on public.project_partners;
create policy pp_insert_editor on public.project_partners
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pp_update_editor on public.project_partners;
create policy pp_update_editor on public.project_partners
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pp_delete_editor on public.project_partners;
create policy pp_delete_editor on public.project_partners
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- project_bank_accounts
drop policy if exists pba_select_member on public.project_bank_accounts;
create policy pba_select_member on public.project_bank_accounts
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists pba_insert_editor on public.project_bank_accounts;
create policy pba_insert_editor on public.project_bank_accounts
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pba_update_editor on public.project_bank_accounts;
create policy pba_update_editor on public.project_bank_accounts
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pba_delete_editor on public.project_bank_accounts;
create policy pba_delete_editor on public.project_bank_accounts
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- payees
drop policy if exists payees_select_member on public.payees;
create policy payees_select_member on public.payees
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists payees_insert_editor on public.payees;
create policy payees_insert_editor on public.payees
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists payees_update_editor on public.payees;
create policy payees_update_editor on public.payees
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists payees_delete_editor on public.payees;
create policy payees_delete_editor on public.payees
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- expense_categories
drop policy if exists ec_select_member on public.expense_categories;
create policy ec_select_member on public.expense_categories
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists ec_insert_editor on public.expense_categories;
create policy ec_insert_editor on public.expense_categories
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists ec_update_editor on public.expense_categories;
create policy ec_update_editor on public.expense_categories
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists ec_delete_editor on public.expense_categories;
create policy ec_delete_editor on public.expense_categories
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- partner_contributions
drop policy if exists pc_select_member on public.partner_contributions;
create policy pc_select_member on public.partner_contributions
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists pc_insert_editor on public.partner_contributions;
create policy pc_insert_editor on public.partner_contributions
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pc_update_editor on public.partner_contributions;
create policy pc_update_editor on public.partner_contributions
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pc_delete_editor on public.partner_contributions;
create policy pc_delete_editor on public.partner_contributions
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- project_expenses
drop policy if exists pe_select_member on public.project_expenses;
create policy pe_select_member on public.project_expenses
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists pe_insert_editor on public.project_expenses;
create policy pe_insert_editor on public.project_expenses
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pe_update_editor on public.project_expenses;
create policy pe_update_editor on public.project_expenses
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pe_delete_editor on public.project_expenses;
create policy pe_delete_editor on public.project_expenses
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- partner_transfers
drop policy if exists pt_select_member on public.partner_transfers;
create policy pt_select_member on public.partner_transfers
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists pt_insert_editor on public.partner_transfers;
create policy pt_insert_editor on public.partner_transfers
  for insert with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pt_update_editor on public.partner_transfers;
create policy pt_update_editor on public.partner_transfers
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pt_delete_editor on public.partner_transfers;
create policy pt_delete_editor on public.partner_transfers
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- partner_contracts
drop policy if exists pcon_select_member on public.partner_contracts;
create policy pcon_select_member on public.partner_contracts
  for select using (public.is_project_member(project_id, auth.uid()));

drop policy if exists pcon_insert_editor on public.partner_contracts;
create policy pcon_insert_editor on public.partner_contracts
  for insert with check (
    uploaded_by = auth.uid()
    and public.project_role(project_id, auth.uid()) in ('owner','editor')
  );

drop policy if exists pcon_update_editor on public.partner_contracts;
create policy pcon_update_editor on public.partner_contracts
  for update using (public.project_role(project_id, auth.uid()) in ('owner','editor'))
            with check (public.project_role(project_id, auth.uid()) in ('owner','editor'));

drop policy if exists pcon_delete_editor on public.partner_contracts;
create policy pcon_delete_editor on public.partner_contracts
  for delete using (public.project_role(project_id, auth.uid()) in ('owner','editor'));

-- 4. Storage bucket -----------------------------------------------------------
-- Bucket privado para comprobantes, facturas y contratos.
-- Path convention: <project_id>/<entity_type>/<entity_id>/<filename>
-- Donde entity_type ∈ {contributions, expenses, contracts, invoices}.
insert into storage.buckets (id, name, public)
values ('accounts-documents', 'accounts-documents', false)
on conflict (id) do nothing;

drop policy if exists accounts_storage_select on storage.objects;
create policy accounts_storage_select on storage.objects
  for select using (
    bucket_id = 'accounts-documents'
    and public.is_project_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

drop policy if exists accounts_storage_insert on storage.objects;
create policy accounts_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'accounts-documents'
    and public.project_role(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    ) in ('owner','editor')
  );

drop policy if exists accounts_storage_delete on storage.objects;
create policy accounts_storage_delete on storage.objects
  for delete using (
    bucket_id = 'accounts-documents'
    and public.project_role(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    ) in ('owner','editor')
  );

-- 5. GRANTs -------------------------------------------------------------------
grant select, insert, update, delete on public.project_partners       to authenticated;
grant select, insert, update, delete on public.project_bank_accounts  to authenticated;
grant select, insert, update, delete on public.payees                 to authenticated;
grant select, insert, update, delete on public.expense_categories     to authenticated;
grant select, insert, update, delete on public.partner_contributions  to authenticated;
grant select, insert, update, delete on public.project_expenses       to authenticated;
grant select, insert, update, delete on public.partner_transfers      to authenticated;
grant select, insert, update, delete on public.partner_contracts      to authenticated;
