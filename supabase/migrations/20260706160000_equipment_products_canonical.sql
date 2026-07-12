-- Canonical equipment products: one row per physical machine/model.
-- Console variations are modifiers, not separate catalogue products.

-- ---------------------------------------------------------------------------
-- equipment_products
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  product_family text,
  model text not null,
  equipment_type text,
  canonical_product_name text not null,
  canonical_product_key text not null,
  baseline_manufacture_year integer,
  production_start_year integer,
  production_end_year integer,
  original_base_price numeric check (original_base_price is null or original_base_price > 0),
  original_base_price_currency text not null default 'GBP',
  original_price_source text,
  original_price_confidence integer check (
    original_price_confidence is null
    or (original_price_confidence >= 0 and original_price_confidence <= 100)
  ),
  lifecycle_confidence integer check (
    lifecycle_confidence is null
    or (lifecycle_confidence >= 0 and lifecycle_confidence <= 100)
  ),
  source_intelligence_row_ids uuid[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'excluded', 'needs_review')),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_products is
  'Canonical catalogue: one row per real physical machine/model. Console variants collapse here.';

comment on column public.equipment_products.source_intelligence_row_ids is
  'equipment_intelligence rows collapsed into this canonical product (never deleted).';

create unique index if not exists equipment_products_canonical_key_uidx
  on public.equipment_products (canonical_product_key);

create index if not exists equipment_products_brand_model_idx
  on public.equipment_products (brand, model);

create index if not exists equipment_products_status_idx
  on public.equipment_products (status);

drop trigger if exists equipment_products_set_updated_at on public.equipment_products;

create trigger equipment_products_set_updated_at
  before update on public.equipment_products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- equipment_console_modifiers
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_console_modifiers (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  console_name text not null,
  console_tier text not null default 'base'
    check (console_tier in ('base', 'mid', 'premium')),
  modifier_type text not null default 'percentage'
    check (modifier_type in ('percentage')),
  modifier_value numeric not null default 0
    check (modifier_value >= 0 and modifier_value <= 100),
  confidence integer not null default 85
    check (confidence >= 0 and confidence <= 100),
  source text not null default 'seed_defaults',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_console_modifiers is
  'Console modifier rules applied during valuation on top of original_base_price.';

create unique index if not exists equipment_console_modifiers_brand_console_uidx
  on public.equipment_console_modifiers (brand, lower(console_name));

create index if not exists equipment_console_modifiers_brand_idx
  on public.equipment_console_modifiers (brand);

drop trigger if exists equipment_console_modifiers_set_updated_at on public.equipment_console_modifiers;

create trigger equipment_console_modifiers_set_updated_at
  before update on public.equipment_console_modifiers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default console modifiers
-- ---------------------------------------------------------------------------

insert into public.equipment_console_modifiers (
  brand, console_name, console_tier, modifier_type, modifier_value, confidence, source, notes
)
values
  -- Life Fitness
  ('Life Fitness', 'LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Life Fitness', 'SL', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Life Fitness', 'ST', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Life Fitness', 'SE', 'mid', 'percentage', 17, 85, 'seed_defaults', 'Discover / mid console'),
  ('Life Fitness', 'SE3', 'mid', 'percentage', 17, 85, 'seed_defaults', 'Discover SE3'),
  ('Life Fitness', 'SE3HD', 'premium', 'percentage', 27, 85, 'seed_defaults', 'Discover SE3HD'),
  ('Life Fitness', 'SE3 HD', 'premium', 'percentage', 27, 85, 'seed_defaults', 'Discover SE3HD alias'),
  ('Life Fitness', 'SE4', 'premium', 'percentage', 27, 85, 'seed_defaults', 'Discover SE4'),
  -- Technogym
  ('Technogym', 'LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Technogym', 'Connect', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Technogym', 'Unity', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Unity console'),
  ('Technogym', 'Live 10', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 11', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 12', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 13', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 14', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 15', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 16', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 19', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 20', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 21', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Live console'),
  ('Technogym', 'Live 22', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Live console'),
  -- Matrix
  ('Matrix', 'LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Matrix', 'Premium LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Matrix', 'XR', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Matrix', 'XER', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Mid console'),
  ('Matrix', 'Touch', 'mid', 'percentage', 15, 85, 'seed_defaults', 'Mid console'),
  ('Matrix', 'XIR', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Premium console'),
  ('Matrix', 'XUR', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Premium console'),
  ('Matrix', 'Touch XL', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Premium console'),
  -- Precor
  ('Precor', 'P31 LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Precor', 'P62', 'mid', 'percentage', 15, 85, 'seed_defaults', '10 inch touchscreen'),
  ('Precor', 'P82', 'premium', 'percentage', 25, 85, 'seed_defaults', '15 inch touchscreen'),
  -- Cybex
  ('Cybex', '50L', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Cybex', 'LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Cybex', 'E3 View', 'mid', 'percentage', 12, 85, 'seed_defaults', 'Mid console'),
  ('Cybex', '70T', 'premium', 'percentage', 25, 85, 'seed_defaults', 'Touchscreen'),
  -- Star Trac
  ('Star Trac', 'LED', 'base', 'percentage', 0, 90, 'seed_defaults', 'Base console'),
  ('Star Trac', '10 inch touchscreen', 'mid', 'percentage', 12, 85, 'seed_defaults', 'Mid console'),
  ('Star Trac', '15 inch touchscreen', 'premium', 'percentage', 22, 85, 'seed_defaults', 'Premium console'),
  ('Star Trac', 'embedded touchscreen', 'premium', 'percentage', 22, 85, 'seed_defaults', 'Premium console')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.equipment_products enable row level security;
alter table public.equipment_console_modifiers enable row level security;

drop policy if exists "Equipment products are publicly readable" on public.equipment_products;
create policy "Equipment products are publicly readable"
  on public.equipment_products for select
  using (true);

drop policy if exists "Admins can manage equipment products" on public.equipment_products;
create policy "Admins can manage equipment products"
  on public.equipment_products for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Console modifiers are publicly readable" on public.equipment_console_modifiers;
create policy "Console modifiers are publicly readable"
  on public.equipment_console_modifiers for select
  using (true);

drop policy if exists "Admins can manage console modifiers" on public.equipment_console_modifiers;
create policy "Admins can manage console modifiers"
  on public.equipment_console_modifiers for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.equipment_products to anon, authenticated;
grant select on public.equipment_console_modifiers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

create or replace function public.admin_upsert_equipment_product_audit(
  p_canonical_product_key text,
  p_brand text,
  p_product_family text,
  p_model text,
  p_equipment_type text,
  p_canonical_product_name text,
  p_source_intelligence_row_ids uuid[],
  p_status text default 'pending',
  p_baseline_manufacture_year integer default null,
  p_production_start_year integer default null,
  p_production_end_year integer default null,
  p_original_base_price numeric default null,
  p_original_base_price_currency text default 'GBP',
  p_original_price_confidence integer default null,
  p_lifecycle_confidence integer default null,
  p_review_notes text default null
)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.equipment_products;
  merged_ids uuid[];
  result public.equipment_products;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into existing
  from public.equipment_products
  where canonical_product_key = p_canonical_product_key;

  if existing.id is not null and existing.status = 'approved' then
    merged_ids := (
      select array(
        select distinct unnest(existing.source_intelligence_row_ids || coalesce(p_source_intelligence_row_ids, '{}'))
      )
    );

    update public.equipment_products
    set
      source_intelligence_row_ids = merged_ids,
      updated_at = now()
    where id = existing.id
    returning * into result;

    return result;
  end if;

  merged_ids := coalesce(p_source_intelligence_row_ids, '{}');

  insert into public.equipment_products (
    brand,
    product_family,
    model,
    equipment_type,
    canonical_product_name,
    canonical_product_key,
    baseline_manufacture_year,
    production_start_year,
    production_end_year,
    original_base_price,
    original_base_price_currency,
    original_price_confidence,
    lifecycle_confidence,
    source_intelligence_row_ids,
    status,
    review_notes
  )
  values (
    p_brand,
    nullif(trim(p_product_family), ''),
    p_model,
    nullif(trim(p_equipment_type), ''),
    p_canonical_product_name,
    p_canonical_product_key,
    p_baseline_manufacture_year,
    p_production_start_year,
    p_production_end_year,
    p_original_base_price,
    coalesce(nullif(trim(p_original_base_price_currency), ''), 'GBP'),
    p_original_price_confidence,
    p_lifecycle_confidence,
    merged_ids,
    coalesce(nullif(trim(p_status), ''), 'pending'),
    nullif(trim(p_review_notes), '')
  )
  on conflict (canonical_product_key) do update
  set
    source_intelligence_row_ids = (
      select array(
        select distinct unnest(
          equipment_products.source_intelligence_row_ids
          || excluded.source_intelligence_row_ids
        )
      )
    ),
    status = case
      when equipment_products.status = 'approved' then equipment_products.status
      when equipment_products.status = 'excluded' then equipment_products.status
      else excluded.status
    end,
    review_notes = coalesce(excluded.review_notes, equipment_products.review_notes),
    baseline_manufacture_year = coalesce(equipment_products.baseline_manufacture_year, excluded.baseline_manufacture_year),
    production_start_year = coalesce(equipment_products.production_start_year, excluded.production_start_year),
    production_end_year = coalesce(equipment_products.production_end_year, excluded.production_end_year),
    original_base_price = coalesce(equipment_products.original_base_price, excluded.original_base_price),
    original_price_confidence = coalesce(equipment_products.original_price_confidence, excluded.original_price_confidence),
    lifecycle_confidence = coalesce(equipment_products.lifecycle_confidence, excluded.lifecycle_confidence),
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

create or replace function public.admin_update_equipment_product(
  p_product_id uuid,
  p_product_family text default null,
  p_model text default null,
  p_equipment_type text default null,
  p_canonical_product_name text default null,
  p_baseline_manufacture_year integer default null,
  p_production_start_year integer default null,
  p_production_end_year integer default null,
  p_original_base_price numeric default null,
  p_original_base_price_currency text default null,
  p_original_price_source text default null,
  p_original_price_confidence integer default null,
  p_lifecycle_confidence integer default null,
  p_status text default null,
  p_review_notes text default null
)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_products;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_products
  set
    product_family = coalesce(nullif(trim(p_product_family), ''), product_family),
    model = coalesce(nullif(trim(p_model), ''), model),
    equipment_type = coalesce(nullif(trim(p_equipment_type), ''), equipment_type),
    canonical_product_name = coalesce(nullif(trim(p_canonical_product_name), ''), canonical_product_name),
    baseline_manufacture_year = coalesce(p_baseline_manufacture_year, baseline_manufacture_year),
    production_start_year = coalesce(p_production_start_year, production_start_year),
    production_end_year = coalesce(p_production_end_year, production_end_year),
    original_base_price = coalesce(p_original_base_price, original_base_price),
    original_base_price_currency = coalesce(nullif(trim(p_original_base_price_currency), ''), original_base_price_currency),
    original_price_source = coalesce(nullif(trim(p_original_price_source), ''), original_price_source),
    original_price_confidence = coalesce(p_original_price_confidence, original_price_confidence),
    lifecycle_confidence = coalesce(p_lifecycle_confidence, lifecycle_confidence),
    status = coalesce(nullif(trim(p_status), ''), status),
    review_notes = coalesce(nullif(trim(p_review_notes), ''), review_notes),
    updated_at = now()
  where id = p_product_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_approve_equipment_product(p_product_id uuid)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_products;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_products
  set status = 'approved', updated_at = now()
  where id = p_product_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_exclude_equipment_product(p_product_id uuid)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_products;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_products
  set status = 'excluded', updated_at = now()
  where id = p_product_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_merge_equipment_products(
  p_target_product_id uuid,
  p_source_product_ids uuid[]
)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.equipment_products;
  merged_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into target from public.equipment_products where id = p_target_product_id;
  if target.id is null then
    raise exception 'Target equipment product not found';
  end if;

  select array(
    select distinct unnest(
      target.source_intelligence_row_ids
      || coalesce(array_agg(distinct row_id), '{}')
    )
  )
  into merged_ids
  from (
    select unnest(source_intelligence_row_ids) as row_id
    from public.equipment_products
    where id = any(p_source_product_ids)
  ) s;

  update public.equipment_products
  set
    source_intelligence_row_ids = merged_ids,
    status = case when target.status = 'approved' then 'approved' else 'needs_review' end,
    updated_at = now()
  where id = p_target_product_id
  returning * into target;

  update public.equipment_products
  set status = 'excluded', updated_at = now()
  where id = any(p_source_product_ids)
    and id <> p_target_product_id;

  return target;
end;
$$;

grant execute on function public.admin_upsert_equipment_product_audit(text, text, text, text, text, text, uuid[], text, integer, integer, integer, numeric, text, integer, integer, text) to authenticated;
grant execute on function public.admin_update_equipment_product(uuid, text, text, text, text, integer, integer, integer, numeric, text, text, integer, integer, text, text) to authenticated;
grant execute on function public.admin_approve_equipment_product(uuid) to authenticated;
grant execute on function public.admin_exclude_equipment_product(uuid) to authenticated;
grant execute on function public.admin_merge_equipment_products(uuid, uuid[]) to authenticated;
