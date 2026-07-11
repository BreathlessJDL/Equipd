-- Equipd Intelligence Phase 1
-- Single-table intelligence catalog (application-layer calculations only).

-- ---------------------------------------------------------------------------
-- equipment_intelligence
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_intelligence (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  series text,
  model text not null,
  category text,
  equipment_type text,
  manufacture_year integer,
  original_rrp numeric,
  estimated_trade_in_value numeric,
  market_observations jsonb not null default '[]'::jsonb,
  confidence text not null default 'Low',
  currency text not null default 'GBP',
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_intelligence is
  'Equipd Intelligence catalog — valuations and product pages read from here.';

comment on column public.equipment_intelligence.market_observations is
  'JSON array of observation objects: price, source, url, condition, confidence, observed_at.';

drop trigger if exists equipment_intelligence_set_updated_at on public.equipment_intelligence;

create trigger equipment_intelligence_set_updated_at
  before update on public.equipment_intelligence
  for each row execute function public.set_updated_at();

create index if not exists equipment_intelligence_brand_idx
  on public.equipment_intelligence (brand);

create index if not exists equipment_intelligence_series_idx
  on public.equipment_intelligence (series);

create index if not exists equipment_intelligence_model_idx
  on public.equipment_intelligence (model);

create index if not exists equipment_intelligence_category_idx
  on public.equipment_intelligence (category);

create index if not exists equipment_intelligence_equipment_type_idx
  on public.equipment_intelligence (equipment_type);

-- slug uniqueness provides slug index (equipment_intelligence_slug_key)

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.equipment_intelligence enable row level security;

drop policy if exists "Equipment intelligence is publicly readable" on public.equipment_intelligence;
create policy "Equipment intelligence is publicly readable"
  on public.equipment_intelligence for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert equipment intelligence" on public.equipment_intelligence;
create policy "Admins can insert equipment intelligence"
  on public.equipment_intelligence for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update equipment intelligence" on public.equipment_intelligence;
create policy "Admins can update equipment intelligence"
  on public.equipment_intelligence for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete equipment intelligence" on public.equipment_intelligence;
create policy "Admins can delete equipment intelligence"
  on public.equipment_intelligence for delete
  to authenticated
  using (public.is_admin());

grant select on public.equipment_intelligence to anon, authenticated;

notify pgrst, 'reload schema';
