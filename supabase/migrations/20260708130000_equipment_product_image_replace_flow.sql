-- Fix admin image replace/approve so hosted storage is the source of truth.

create or replace function public.admin_update_equipment_product_image(
  p_product_id uuid,
  p_image_url text default null,
  p_image_storage_path text default null,
  p_image_source_url text default null,
  p_image_source_domain text default null,
  p_image_confidence integer default null,
  p_image_status text default null,
  p_image_failure_reason text default null
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
    image_url = case
      when p_image_url is not null then nullif(trim(p_image_url), '')
      else image_url
    end,
    image_storage_path = case
      when p_image_storage_path is not null then nullif(trim(p_image_storage_path), '')
      else image_storage_path
    end,
    image_source_url = case
      when p_image_source_url is not null then nullif(trim(p_image_source_url), '')
      else image_source_url
    end,
    image_source_domain = case
      when p_image_source_domain is not null then nullif(trim(p_image_source_domain), '')
      else image_source_domain
    end,
    image_confidence = coalesce(p_image_confidence, image_confidence),
    image_status = case
      when p_image_status is not null then nullif(trim(p_image_status), '')
      else image_status
    end,
    image_failure_reason = p_image_failure_reason,
    image_updated_at = now(),
    updated_at = now()
  where id = p_product_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_replace_equipment_product_image(
  p_product_id uuid,
  p_image_url text default null,
  p_image_storage_path text default null,
  p_image_source_url text default null,
  p_image_source_domain text default null,
  p_image_confidence integer default null,
  p_image_status text default null,
  p_image_failure_reason text default null
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
    image_url = nullif(trim(p_image_url), ''),
    image_storage_path = nullif(trim(p_image_storage_path), ''),
    image_source_url = nullif(trim(p_image_source_url), ''),
    image_source_domain = nullif(trim(p_image_source_domain), ''),
    image_confidence = p_image_confidence,
    image_status = coalesce(nullif(trim(p_image_status), ''), 'missing'),
    image_failure_reason = p_image_failure_reason,
    image_updated_at = now(),
    updated_at = now()
  where id = p_product_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_approve_equipment_product_image(p_product_id uuid)
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
    image_status = 'approved',
    image_failure_reason = null,
    image_updated_at = now(),
    updated_at = now()
  where id = p_product_id
    and (
      nullif(trim(image_url), '') is not null
      or nullif(trim(image_storage_path), '') is not null
    )
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product image not found or missing image_url/image_storage_path';
  end if;

  return result;
end;
$$;

grant execute on function public.admin_replace_equipment_product_image(
  uuid, text, text, text, text, integer, text, text
) to authenticated;
