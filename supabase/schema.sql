-- Equipd core schema
-- Run first. Requires a fresh Supabase project (or empty public equipd tables).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.listing_status as enum ('draft', 'active', 'sold', 'archived');

create type public.listing_source as enum ('manual', 'import', 'api');

create type public.wanted_request_status as enum ('active', 'paused', 'fulfilled', 'archived');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  display_name text,
  location text,
  latitude double precision,
  longitude double precision,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_latitude_range check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  constraint profiles_longitude_range check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  ),
  constraint profiles_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ),
  constraint profiles_username_format check (
    username is null
    or (
      char_length(username) >= 3
      and char_length(username) <= 24
      and username ~ '^[a-zA-Z0-9_-]+$'
    )
  )
);

create unique index profiles_username_lower_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
begin
  raw_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    raw_username
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint brands_name_unique unique (name),
  constraint brands_slug_unique unique (slug)
);

create index brands_slug_idx on public.brands (slug);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_name_unique unique (name),
  constraint categories_slug_unique unique (slug)
);

create index categories_sort_order_idx on public.categories (sort_order);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  brand_id uuid references public.brands (id) on delete set null,
  slug text not null,
  brand text,
  model text,
  title text not null,
  description text,
  price_pence int not null,
  condition text not null,
  location text,
  latitude double precision,
  longitude double precision,
  status public.listing_status not null default 'draft',
  source public.listing_source not null default 'manual',
  views_count int not null default 0,
  saved_count int not null default 0,
  ai_brand text,
  ai_model text,
  ai_confidence numeric(4, 3),
  ai_price_low int,
  ai_price_high int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint listings_slug_unique unique (slug),
  constraint listings_title_length check (char_length(title) between 3 and 120),
  constraint listings_price_positive check (price_pence > 0),
  constraint listings_condition_valid check (
    condition in ('new', 'like_new', 'good', 'fair', 'poor')
  ),
  constraint listings_views_count_non_negative check (views_count >= 0),
  constraint listings_saved_count_non_negative check (saved_count >= 0),
  constraint listings_latitude_range check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  constraint listings_longitude_range check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  ),
  constraint listings_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ),
  constraint listings_ai_confidence_range check (
    ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)
  ),
  constraint listings_ai_price_low_non_negative check (
    ai_price_low is null or ai_price_low >= 0
  ),
  constraint listings_ai_price_high_non_negative check (
    ai_price_high is null or ai_price_high >= 0
  ),
  constraint listings_ai_price_range check (
    ai_price_low is null
    or ai_price_high is null
    or ai_price_low <= ai_price_high
  )
);

create index listings_status_created_at_idx
  on public.listings (status, created_at desc);

create index listings_seller_status_idx
  on public.listings (seller_id, status);

create index listings_brand_id_idx
  on public.listings (brand_id);

create index listings_slug_idx
  on public.listings (slug);

create index listings_views_count_idx
  on public.listings (views_count desc)
  where status = 'active';

create index listings_search_idx
  on public.listings
  using gin (
    to_tsvector(
      'english',
      title
        || ' '
        || coalesce(description, '')
        || ' '
        || coalesce(brand, '')
        || ' '
        || coalesce(model, '')
    )
  );

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Set published_at when a listing first goes active
create or replace function public.set_listing_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger listings_set_published_at
  before update on public.listings
  for each row execute function public.set_listing_published_at();

-- ---------------------------------------------------------------------------
-- listing_images
-- ---------------------------------------------------------------------------

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint listing_images_storage_path_unique unique (storage_path)
);

create index listing_images_listing_sort_idx
  on public.listing_images (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- wanted_requests (schema only in Phase 1 — no UI yet)
-- ---------------------------------------------------------------------------

create table public.wanted_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  brand text,
  model text,
  max_price_pence int,
  location text,
  latitude double precision,
  longitude double precision,
  radius_km int,
  criteria jsonb not null default '{}'::jsonb,
  status public.wanted_request_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wanted_requests_title_length check (char_length(title) between 3 and 120),
  constraint wanted_requests_max_price_non_negative check (
    max_price_pence is null or max_price_pence >= 0
  ),
  constraint wanted_requests_radius_positive check (
    radius_km is null or radius_km > 0
  ),
  constraint wanted_requests_latitude_range check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  constraint wanted_requests_longitude_range check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  ),
  constraint wanted_requests_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create index wanted_requests_user_status_idx
  on public.wanted_requests (user_id, status, created_at desc);

create index wanted_requests_status_created_at_idx
  on public.wanted_requests (status, created_at desc);

create trigger wanted_requests_set_updated_at
  before update on public.wanted_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- View counter RPC (public detail page; bypasses owner-only update RLS)
-- ---------------------------------------------------------------------------

create or replace function public.increment_listing_views(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set views_count = views_count + 1
  where slug = p_slug
    and status = 'active';
end;
$$;

grant execute on function public.increment_listing_views(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saved count RPC (public listing detail; bypasses saved_listings RLS)
-- ---------------------------------------------------------------------------

create or replace function public.get_listing_saved_count(p_listing_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select l.saved_count
      from public.listings l
      where l.id = p_listing_id
    ),
    0
  );
$$;

grant execute on function public.get_listing_saved_count(uuid) to anon, authenticated;
