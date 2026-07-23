-- Authoritative admin upsert for researched canonical product CSV import.
-- Non-null parameters overwrite existing equipment_products fields.
-- Null parameters leave existing values unchanged.
-- Images are not required; new rows default to image_status = 'missing'.

create or replace function public.admin_upsert_canonical_product_csv(
  p_canonical_product_key text,
  p_brand text default null,
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
  p_baseline_source text default null,
  p_original_price_confidence integer default null,
  p_lifecycle_confidence integer default null,
  p_status text default null
)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.equipment_products;
  result public.equipment_products;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_canonical_product_key is null or length(trim(p_canonical_product_key)) = 0 then
    raise exception 'canonical_product_key is required';
  end if;

  select * into existing
  from public.equipment_products
  where canonical_product_key = trim(p_canonical_product_key);

  if existing.id is null then
    if p_brand is null or length(trim(p_brand)) = 0 then
      raise exception 'brand is required for new products';
    end if;
    if p_model is null or length(trim(p_model)) = 0 then
      raise exception 'model is required for new products';
    end if;
    if p_equipment_type is null or length(trim(p_equipment_type)) = 0 then
      raise exception 'equipment_type is required for new products';
    end if;
    if p_baseline_manufacture_year is null then
      raise exception 'baseline_manufacture_year is required for new products';
    end if;
    if p_original_base_price is null then
      raise exception 'original_base_price is required for new products';
    end if;

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
      original_price_source,
      baseline_source,
      original_price_confidence,
      lifecycle_confidence,
      source_intelligence_row_ids,
      status,
      image_status
    )
    values (
      trim(p_brand),
      nullif(trim(coalesce(p_product_family, '')), ''),
      trim(p_model),
      trim(p_equipment_type),
      coalesce(
        nullif(trim(coalesce(p_canonical_product_name, '')), ''),
        trim(concat_ws(' ', trim(p_brand), nullif(trim(coalesce(p_product_family, '')), ''), trim(p_model)))
      ),
      trim(p_canonical_product_key),
      p_baseline_manufacture_year,
      coalesce(p_production_start_year, p_baseline_manufacture_year),
      p_production_end_year,
      p_original_base_price,
      coalesce(nullif(trim(coalesce(p_original_base_price_currency, '')), ''), 'GBP'),
      nullif(trim(coalesce(p_original_price_source, '')), ''),
      nullif(trim(coalesce(p_baseline_source, '')), ''),
      p_original_price_confidence,
      p_lifecycle_confidence,
      '{}'::uuid[],
      coalesce(nullif(trim(coalesce(p_status, '')), ''), 'pending'),
      'missing'
    )
    returning * into result;

    return result;
  end if;

  update public.equipment_products
  set
    brand = coalesce(nullif(trim(coalesce(p_brand, '')), ''), brand),
    product_family = coalesce(nullif(trim(coalesce(p_product_family, '')), ''), product_family),
    model = coalesce(nullif(trim(coalesce(p_model, '')), ''), model),
    equipment_type = coalesce(nullif(trim(coalesce(p_equipment_type, '')), ''), equipment_type),
    canonical_product_name = coalesce(nullif(trim(coalesce(p_canonical_product_name, '')), ''), canonical_product_name),
    baseline_manufacture_year = coalesce(p_baseline_manufacture_year, baseline_manufacture_year),
    production_start_year = coalesce(
      p_production_start_year,
      case
        when p_baseline_manufacture_year is not null
          and (production_start_year is null or production_start_year = baseline_manufacture_year)
          then p_baseline_manufacture_year
        else production_start_year
      end
    ),
    production_end_year = coalesce(p_production_end_year, production_end_year),
    original_base_price = coalesce(p_original_base_price, original_base_price),
    original_base_price_currency = coalesce(
      nullif(trim(coalesce(p_original_base_price_currency, '')), ''),
      original_base_price_currency
    ),
    original_price_source = coalesce(
      nullif(trim(coalesce(p_original_price_source, '')), ''),
      original_price_source
    ),
    baseline_source = coalesce(
      nullif(trim(coalesce(p_baseline_source, '')), ''),
      baseline_source
    ),
    original_price_confidence = coalesce(p_original_price_confidence, original_price_confidence),
    lifecycle_confidence = coalesce(p_lifecycle_confidence, lifecycle_confidence),
    status = coalesce(nullif(trim(coalesce(p_status, '')), ''), status),
    updated_at = now()
  where id = existing.id
  returning * into result;

  return result;
end;
$$;

comment on function public.admin_upsert_canonical_product_csv is
  'Authoritative Equipment Intelligence CSV upsert by canonical_product_key. Non-null args overwrite; null args preserve existing values.';

grant execute on function public.admin_upsert_canonical_product_csv(
  text, text, text, text, text, text, integer, integer, integer, numeric, text, text, text, integer, integer, text
) to authenticated;
