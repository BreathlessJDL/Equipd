-- Equipd Intelligence data model (extends Price Guide).
-- Adds aliases, variants, valuation sources and source trade values.
-- Does not modify existing Price Guide tables or RLS.

-- ---------------------------------------------------------------------------
-- equipment_model_aliases
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_model_aliases (
  id uuid primary key default gen_random_uuid(),
  equipment_model_id uuid not null references public.equipment_models (id) on delete cascade,
  alias text not null,
  alias_type text not null default 'search',
  confidence_score numeric not null default 100,
  created_at timestamptz not null default now()
);

comment on table public.equipment_model_aliases is
  'Search and matching aliases for canonical equipment models.';

create index if not exists equipment_model_aliases_equipment_model_id_idx
  on public.equipment_model_aliases (equipment_model_id);

create index if not exists equipment_model_aliases_alias_idx
  on public.equipment_model_aliases (alias);

-- ---------------------------------------------------------------------------
-- equipment_model_variants
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_model_variants (
  id uuid primary key default gen_random_uuid(),
  equipment_model_id uuid not null references public.equipment_models (id) on delete cascade,
  variant_name text not null,
  variant_code text,
  variant_type text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.equipment_model_variants is
  'Known sub-model or configuration variants for an equipment model.';

create index if not exists equipment_model_variants_equipment_model_id_idx
  on public.equipment_model_variants (equipment_model_id);

-- ---------------------------------------------------------------------------
-- valuation_sources
-- ---------------------------------------------------------------------------

create table if not exists public.valuation_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  source_brand text,
  source_notes text,
  confidence_weight numeric not null default 1,
  created_at timestamptz not null default now()
);

comment on table public.valuation_sources is
  'Catalog of valuation data sources (trade-in sheets, dealer pricing, sales, etc.).';

comment on column public.valuation_sources.source_type is
  'e.g. official_manufacturer_trade_in, trade_partner_trade_in, dealer_price_sheet, market_observation, equipd_sale, user_reported_sale, auction_result';

create index if not exists valuation_sources_source_type_idx
  on public.valuation_sources (source_type);

-- ---------------------------------------------------------------------------
-- source_trade_values
-- ---------------------------------------------------------------------------

create table if not exists public.source_trade_values (
  id uuid primary key default gen_random_uuid(),
  equipment_model_id uuid not null references public.equipment_models (id) on delete cascade,
  valuation_source_id uuid references public.valuation_sources (id) on delete set null,
  manufacture_year int,
  equipment_age_years numeric,
  trade_value numeric not null,
  currency text not null default 'GBP',
  condition_basis text,
  value_type text not null default 'trade_in',
  confidence_score numeric not null default 100,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.source_trade_values is
  'Structured trade-in or dealer value points linked to models and sources.';

create index if not exists source_trade_values_equipment_model_id_idx
  on public.source_trade_values (equipment_model_id);

create index if not exists source_trade_values_valuation_source_id_idx
  on public.source_trade_values (valuation_source_id);

create index if not exists source_trade_values_manufacture_year_idx
  on public.source_trade_values (manufacture_year);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.equipment_model_aliases enable row level security;
alter table public.equipment_model_variants enable row level security;
alter table public.valuation_sources enable row level security;
alter table public.source_trade_values enable row level security;

-- equipment_model_aliases
drop policy if exists "Equipment model aliases are publicly readable" on public.equipment_model_aliases;
create policy "Equipment model aliases are publicly readable"
  on public.equipment_model_aliases for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert equipment model aliases" on public.equipment_model_aliases;
create policy "Admins can insert equipment model aliases"
  on public.equipment_model_aliases for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update equipment model aliases" on public.equipment_model_aliases;
create policy "Admins can update equipment model aliases"
  on public.equipment_model_aliases for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete equipment model aliases" on public.equipment_model_aliases;
create policy "Admins can delete equipment model aliases"
  on public.equipment_model_aliases for delete
  to authenticated
  using (public.is_admin());

-- equipment_model_variants
drop policy if exists "Equipment model variants are publicly readable" on public.equipment_model_variants;
create policy "Equipment model variants are publicly readable"
  on public.equipment_model_variants for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert equipment model variants" on public.equipment_model_variants;
create policy "Admins can insert equipment model variants"
  on public.equipment_model_variants for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update equipment model variants" on public.equipment_model_variants;
create policy "Admins can update equipment model variants"
  on public.equipment_model_variants for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete equipment model variants" on public.equipment_model_variants;
create policy "Admins can delete equipment model variants"
  on public.equipment_model_variants for delete
  to authenticated
  using (public.is_admin());

-- valuation_sources
drop policy if exists "Valuation sources are publicly readable" on public.valuation_sources;
create policy "Valuation sources are publicly readable"
  on public.valuation_sources for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert valuation sources" on public.valuation_sources;
create policy "Admins can insert valuation sources"
  on public.valuation_sources for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update valuation sources" on public.valuation_sources;
create policy "Admins can update valuation sources"
  on public.valuation_sources for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete valuation sources" on public.valuation_sources;
create policy "Admins can delete valuation sources"
  on public.valuation_sources for delete
  to authenticated
  using (public.is_admin());

-- source_trade_values
drop policy if exists "Source trade values are publicly readable" on public.source_trade_values;
create policy "Source trade values are publicly readable"
  on public.source_trade_values for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert source trade values" on public.source_trade_values;
create policy "Admins can insert source trade values"
  on public.source_trade_values for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update source trade values" on public.source_trade_values;
create policy "Admins can update source trade values"
  on public.source_trade_values for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete source trade values" on public.source_trade_values;
create policy "Admins can delete source trade values"
  on public.source_trade_values for delete
  to authenticated
  using (public.is_admin());

grant select on public.equipment_model_aliases to anon, authenticated;
grant select on public.equipment_model_variants to anon, authenticated;
grant select on public.valuation_sources to anon, authenticated;
grant select on public.source_trade_values to anon, authenticated;

notify pgrst, 'reload schema';
