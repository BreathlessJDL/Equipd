-- Equipd listing taxonomy cleanup
-- Run after conversation-reads.sql (or any point after listings exist)
--
-- Adds controlled rating field and seeds the canonical category list.
-- Existing categories and listing rows are preserved.

-- ---------------------------------------------------------------------------
-- Rating (home / light commercial / full commercial)
-- ---------------------------------------------------------------------------

alter table public.listings
  add column if not exists rating text;

alter table public.listings
  drop constraint if exists listings_rating_valid;

alter table public.listings
  add constraint listings_rating_valid check (
    rating is null
    or rating in ('home_use', 'light_commercial', 'full_commercial')
  );

create index if not exists listings_rating_idx
  on public.listings (rating)
  where rating is not null;

-- ---------------------------------------------------------------------------
-- Canonical categories (controlled dropdown list)
-- Legacy categories from earlier seeds remain in the table untouched.
-- ---------------------------------------------------------------------------

insert into public.categories (name, slug, sort_order)
values
  ('Treadmills', 'treadmill', 10),
  ('Crosstrainers', 'crosstrainers', 20),
  ('Upright Bikes', 'upright-bikes', 30),
  ('Recumbent Bikes', 'recumbent-bikes', 40),
  ('Spin Bikes', 'spin-bikes', 50),
  ('Stairclimbers', 'stairclimbers', 60),
  ('Upper Body Bikes', 'upper-body-bikes', 70),
  ('Assault Bikes', 'assault-bike', 80),
  ('Plate Loaded Machines', 'plate-loaded-machine', 90),
  ('Pin Loaded Machines', 'pin-loaded-machine', 100),
  ('Multi-gyms', 'multi-gyms', 110),
  ('Dual Cable Pulley', 'dual-cable-pulley', 120),
  ('Squat Racks', 'squat-rack', 130),
  ('Skierg', 'skierg', 140),
  ('Rowers', 'rowers', 145),
  ('Functional', 'functional', 150),
  ('Benches', 'bench', 160),
  ('Dumbbells', 'dumbbells', 170),
  ('Weight Plates', 'weight-plates', 180),
  ('Barbells', 'barbells', 190),
  ('Other', 'other', 200)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;
