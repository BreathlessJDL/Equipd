-- Optional structured location fields on profiles (safe for existing databases).
-- latitude/longitude already exist on public.profiles in schema.sql.

alter table public.profiles
  add column if not exists city text;

alter table public.profiles
  add column if not exists county text;

alter table public.profiles
  add column if not exists postcode text;
