-- Equipd Phase 5A — structured Google Places listing locations
-- Run after trust-safety-phase2-reporting.sql (or any migration after base schema)
--
-- Adds structured location columns to listings. latitude/longitude already exist on listings.
-- Keeps legacy `location` text for browse filters and backwards compatibility.

alter table public.listings
  add column if not exists location_name text,
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists postcode text;

create index if not exists listings_city_idx
  on public.listings (city)
  where city is not null;

create index if not exists listings_postcode_idx
  on public.listings (postcode)
  where postcode is not null;

-- ---------------------------------------------------------------------------
-- Backfill from legacy free-text location where possible
-- ---------------------------------------------------------------------------

update public.listings
set
  location_name = nullif(trim(split_part(location, ',', 1)), ''),
  city = nullif(trim(split_part(location, ',', 1)), '')
where location is not null
  and trim(location) <> ''
  and location_name is null;

update public.listings
set postcode = nullif(trim(split_part(location, ',', 2)), '')
where location is not null
  and location like '%,%'
  and postcode is null
  and trim(split_part(location, ',', 2)) ~* '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$';

-- If the first segment looks like a UK postcode, treat it as postcode instead of city.
update public.listings
set
  postcode = city,
  city = null,
  location_name = null
where city ~* '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$'
  and postcode is null;

-- Normalise common "Town, County" legacy values into county when the second part is not a postcode.
update public.listings
set county = nullif(trim(split_part(location, ',', 2)), '')
where location is not null
  and location like '%,%'
  and county is null
  and trim(split_part(location, ',', 2)) !~* '^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$';

-- Keep legacy location text aligned with structured fields where we inferred them.
update public.listings
set location = case
  when city is not null and county is not null then city || ', ' || county
  when city is not null and postcode is not null then city || ', ' || postcode
  when city is not null then city
  when postcode is not null then postcode
  else location
end
where location is not null
  and (city is not null or postcode is not null);
