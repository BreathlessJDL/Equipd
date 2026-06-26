-- Fix public browse cards showing "No photo" while listings are visible.
--
-- Root cause: listing_images SELECT RLS referenced listings (with RLS), while listings
-- visibility depends on listing_images — PostgREST embeds return empty image arrays.
-- listing_has_images() broke listings-side recursion; this migration breaks the
-- listing_images-side recursion for embeds and the distance browse RPC.

create or replace function public.listing_can_read_images(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and (
        public.listing_is_publicly_visible(l)
        or l.seller_id = auth.uid()
        or exists (
          select 1
          from public.offers o
          where o.listing_id = l.id
            and o.buyer_id = auth.uid()
            and o.status = 'accepted'::public.offer_status
        )
      )
  );
$$;

comment on function public.listing_can_read_images(uuid) is
  'SECURITY DEFINER: whether the current user may read listing_images for a listing.';

create or replace function public.listing_primary_image_storage_path(p_listing_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select li.storage_path
  from public.listing_images li
  where li.listing_id = p_listing_id
    and public.listing_can_read_images(p_listing_id)
  order by li.sort_order asc, li.created_at asc
  limit 1;
$$;

comment on function public.listing_primary_image_storage_path(uuid) is
  'Primary image path for browse cards; respects public visibility without RLS recursion.';

drop policy if exists "Listing images follow listing visibility" on public.listing_images;

create policy "Listing images follow listing visibility"
  on public.listing_images for select
  to anon, authenticated
  using (public.listing_can_read_images(listing_id));

-- Distance browse RPC: use definer helper for primary image (security invoker + RLS safe).
create or replace function public.search_listings_with_distance(
  p_buyer_lat double precision,
  p_buyer_lng double precision,
  p_radius_miles double precision default null,
  p_search text default null,
  p_category_id uuid default null,
  p_condition text default null,
  p_brand text default null,
  p_rating text default null,
  p_min_price_pence int default null,
  p_max_price_pence int default null,
  p_location_areas text[] default null,
  p_sort text default 'newest',
  p_limit int default 48
)
returns table (
  id uuid,
  slug text,
  title text,
  brand text,
  model text,
  price_pence int,
  condition text,
  location text,
  location_name text,
  city text,
  county text,
  postcode text,
  latitude double precision,
  longitude double precision,
  status text,
  seller_id uuid,
  rating text,
  collection_available boolean,
  courier_available boolean,
  created_at timestamptz,
  updated_at timestamptz,
  category_id uuid,
  category_name text,
  category_slug text,
  primary_image_storage_path text,
  distance_miles double precision
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_search text := nullif(trim(p_search), '');
  v_brand text := nullif(trim(p_brand), '');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'newest');
begin
  if p_buyer_lat is null or p_buyer_lng is null then
    raise exception 'Buyer latitude and longitude are required';
  end if;

  if p_radius_miles is not null and p_radius_miles <= 0 then
    raise exception 'Radius must be greater than zero';
  end if;

  return query
  with filtered as (
    select
      l.*,
      c.name as category_name,
      c.slug as category_slug,
      public.listing_primary_image_storage_path(l.id) as primary_image_storage_path,
      public.haversine_distance_miles(
        p_buyer_lat,
        p_buyer_lng,
        l.latitude,
        l.longitude
      ) as distance_miles
    from public.listings l
    left join public.categories c on c.id = l.category_id
    where public.listing_is_publicly_visible(l)
      and (
        p_radius_miles is null
        or (
          l.latitude is not null
          and l.longitude is not null
          and public.haversine_distance_miles(
            p_buyer_lat,
            p_buyer_lng,
            l.latitude,
            l.longitude
          ) <= p_radius_miles
        )
      )
      and (p_category_id is null or l.category_id = p_category_id)
      and (p_condition is null or l.condition = p_condition)
      and (p_rating is null or l.rating = p_rating)
      and (p_min_price_pence is null or l.price_pence >= p_min_price_pence)
      and (p_max_price_pence is null or l.price_pence <= p_max_price_pence)
      and (v_brand is null or l.brand = v_brand)
      and (
        v_search is null
        or l.title ilike '%' || v_search || '%'
        or l.brand ilike '%' || v_search || '%'
        or l.model ilike '%' || v_search || '%'
        or l.description ilike '%' || v_search || '%'
      )
      and (
        p_location_areas is null
        or cardinality(p_location_areas) = 0
        or exists (
          select 1
          from unnest(p_location_areas) area(value)
          where l.location ilike '%' || area.value || '%'
            or l.city ilike '%' || area.value || '%'
            or l.location_name ilike '%' || area.value || '%'
            or l.county ilike '%' || area.value || '%'
        )
      )
  )
  select
    f.id,
    f.slug,
    f.title,
    f.brand,
    f.model,
    f.price_pence,
    f.condition,
    f.location,
    f.location_name,
    f.city,
    f.county,
    f.postcode,
    f.latitude,
    f.longitude,
    f.status::text,
    f.seller_id,
    f.rating,
    f.collection_available,
    f.courier_available,
    f.created_at,
    f.updated_at,
    f.category_id,
    f.category_name,
    f.category_slug,
    f.primary_image_storage_path,
    f.distance_miles
  from filtered f
  order by
    case when v_sort = 'nearest' then f.distance_miles end asc nulls last,
    case when v_sort = 'price_asc' then f.price_pence end asc,
    case when v_sort = 'price_desc' then f.price_pence end desc,
    case when v_sort = 'updated' then f.updated_at end desc,
    f.created_at desc
  limit greatest(coalesce(p_limit, 48), 1);
end;
$$;

notify pgrst, 'reload schema';
