-- Track provenance for canonical product research imports.

alter table public.equipment_products
  add column if not exists baseline_source text,
  add column if not exists original_price_source_url text;

comment on column public.equipment_products.baseline_source is
  'Provenance for baseline_manufacture_year (manual_import, series_default, product_research_verified, etc.).';

comment on column public.equipment_products.original_price_source_url is
  'Source URL for the canonical product original_base_price when imported or verified manually.';

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
  p_baseline_source text default null,
  p_original_price_source_url text default null,
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
    baseline_source = coalesce(nullif(trim(p_baseline_source), ''), baseline_source),
    original_price_source_url = coalesce(nullif(trim(p_original_price_source_url), ''), original_price_source_url),
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
