-- Equipment product hero images (sourced independently from price/lifecycle data).

alter table public.equipment_products
  add column if not exists image_url text,
  add column if not exists image_storage_path text,
  add column if not exists image_source_url text,
  add column if not exists image_source_domain text,
  add column if not exists image_confidence integer,
  add column if not exists image_status text not null default 'missing',
  add column if not exists image_failure_reason text,
  add column if not exists image_updated_at timestamptz;

alter table public.equipment_products
  drop constraint if exists equipment_products_image_status_check;

alter table public.equipment_products
  add constraint equipment_products_image_status_check
  check (image_status in ('missing', 'suggested', 'approved', 'rejected', 'failed'));

alter table public.equipment_products
  drop constraint if exists equipment_products_image_confidence_range_check;

alter table public.equipment_products
  add constraint equipment_products_image_confidence_range_check
  check (image_confidence is null or (image_confidence >= 0 and image_confidence <= 100));

create index if not exists equipment_products_image_status_idx
  on public.equipment_products (image_status);

comment on column public.equipment_products.image_url is
  'Public URL for the equipment product hero image (Supabase Storage or approved external URL).';
comment on column public.equipment_products.image_status is
  'missing | suggested | approved | rejected | failed';

-- ---------------------------------------------------------------------------
-- Storage bucket: equipment-product-images (public read)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipment-product-images',
  'equipment-product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipment product images are publicly readable" on storage.objects;
create policy "Equipment product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'equipment-product-images');

drop policy if exists "Admins can manage equipment product images" on storage.objects;
create policy "Admins can manage equipment product images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'equipment-product-images'
    and public.is_admin()
  )
  with check (
    bucket_id = 'equipment-product-images'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Admin image RPCs (do not modify price / lifecycle fields)
-- ---------------------------------------------------------------------------

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
    image_url = coalesce(nullif(trim(p_image_url), ''), image_url),
    image_storage_path = coalesce(nullif(trim(p_image_storage_path), ''), image_storage_path),
    image_source_url = coalesce(nullif(trim(p_image_source_url), ''), image_source_url),
    image_source_domain = coalesce(nullif(trim(p_image_source_domain), ''), image_source_domain),
    image_confidence = coalesce(p_image_confidence, image_confidence),
    image_status = coalesce(nullif(trim(p_image_status), ''), image_status),
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
    and image_url is not null
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product image not found or missing image_url';
  end if;

  return result;
end;
$$;

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

grant execute on function public.admin_update_equipment_product_image(
  uuid, text, text, text, text, integer, text, text
) to authenticated;
grant execute on function public.admin_approve_equipment_product_image(uuid) to authenticated;
grant execute on function public.admin_reject_equipment_product_image(uuid, text) to authenticated;
