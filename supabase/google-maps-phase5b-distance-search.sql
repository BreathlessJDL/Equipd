-- Equipd Phase 5B — distance search and radius filtering
-- Run after google-maps-phase5a-listing-location.sql
--
-- Adds haversine distance helper and search_listings_with_distance() RPC.
-- Does not require PostGIS.

-- ---------------------------------------------------------------------------
-- Haversine distance (miles)
-- ---------------------------------------------------------------------------

create or replace function public.haversine_distance_miles(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when p_lat1 is null
      or p_lon1 is null
      or p_lat2 is null
      or p_lon2 is null then null
    else 3958.7613 * 2 * asin(
      least(
        1.0,
        sqrt(
          power(sin(radians(p_lat2 - p_lat1) / 2.0), 2)
          + cos(radians(p_lat1))
            * cos(radians(p_lat2))
            * power(sin(radians(p_lon2 - p_lon1) / 2.0), 2)
        )
      )
    )
  end;
$$;

revoke all on function public.haversine_distance_miles(
  double precision,
  double precision,
  double precision,
  double precision
) from public;
grant execute on function public.haversine_distance_miles(
  double precision,
  double precision,
  double precision,
  double precision
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Search active listings with optional buyer distance filtering
-- ---------------------------------------------------------------------------

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
      img.storage_path as primary_image_storage_path,
      public.haversine_distance_miles(
        p_buyer_lat,
        p_buyer_lng,
        l.latitude,
        l.longitude
      ) as distance_miles
    from public.listings l
    left join public.categories c on c.id = l.category_id
    left join lateral (
      select li.storage_path
      from public.listing_images li
      where li.listing_id = l.id
      order by li.sort_order asc, li.created_at asc
      limit 1
    ) img on true
    where l.status = 'active'::public.listing_status
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

revoke all on function public.search_listings_with_distance(
  double precision,
  double precision,
  double precision,
  text,
  uuid,
  text,
  text,
  text,
  int,
  int,
  text[],
  text,
  int
) from public;

grant execute on function public.search_listings_with_distance(
  double precision,
  double precision,
  double precision,
  text,
  uuid,
  text,
  text,
  text,
  int,
  int,
  text[],
  text,
  int
) to anon, authenticated;
