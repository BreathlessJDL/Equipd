-- Allow image approval when only storage path is present (hosted copy without external URL).

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
    and (image_url is not null or nullif(trim(image_storage_path), '') is not null)
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product image not found or missing image_url/image_storage_path';
  end if;

  return result;
end;
$$;
