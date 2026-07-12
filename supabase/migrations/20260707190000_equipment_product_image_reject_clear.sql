-- Rejecting a product image clears public URLs so dealer/watermarked assets are not served.

create or replace function public.admin_reject_equipment_product_image(
  p_product_id uuid,
  p_reason text default null
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
    image_status = 'rejected',
    image_url = null,
    image_storage_path = null,
    image_failure_reason = coalesce(nullif(trim(p_reason), ''), image_failure_reason),
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
