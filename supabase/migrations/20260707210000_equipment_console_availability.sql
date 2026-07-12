-- Date-aware console availability for valuation.

create table if not exists public.equipment_console_availability (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  console_name text not null,
  release_year integer not null check (release_year >= 1970 and release_year <= 2100),
  release_month integer check (release_month is null or (release_month >= 1 and release_month <= 12)),
  retired_year integer check (retired_year is null or retired_year >= 1970),
  console_tier text not null default 'base'
    check (console_tier in ('base', 'mid', 'premium')),
  modifier_percent numeric not null default 0
    check (modifier_percent >= 0 and modifier_percent <= 100),
  compatible_series text[],
  compatible_equipment_types text[],
  source text not null default 'seed_defaults',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_console_availability is
  'Console release/retirement windows used to filter valuation console options by manufacture year.';

create unique index if not exists equipment_console_availability_brand_console_uidx
  on public.equipment_console_availability (brand, lower(console_name));

create index if not exists equipment_console_availability_brand_idx
  on public.equipment_console_availability (brand);

drop trigger if exists equipment_console_availability_set_updated_at on public.equipment_console_availability;

create trigger equipment_console_availability_set_updated_at
  before update on public.equipment_console_availability
  for each row execute function public.set_updated_at();

alter table public.equipment_console_availability enable row level security;

drop policy if exists "Console availability is publicly readable" on public.equipment_console_availability;
create policy "Console availability is publicly readable"
  on public.equipment_console_availability for select
  using (true);

drop policy if exists "Admins can manage console availability" on public.equipment_console_availability;
create policy "Admins can manage console availability"
  on public.equipment_console_availability for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.equipment_console_availability to anon, authenticated;

insert into public.equipment_console_availability (
  brand, console_name, release_year, retired_year, console_tier, modifier_percent, notes
)
values
  -- Life Fitness Discover consoles
  ('Life Fitness', 'LED', 2010, null, 'base', 0, 'Base console'),
  ('Life Fitness', 'SL', 2010, null, 'base', 0, 'Base console'),
  ('Life Fitness', 'ST', 2010, null, 'base', 0, 'Base console'),
  ('Life Fitness', 'SE', 2012, null, 'mid', 17, 'Discover SE'),
  ('Life Fitness', 'SE3', 2015, null, 'mid', 17, 'Discover SE3'),
  ('Life Fitness', 'SE3HD', 2017, null, 'premium', 27, 'Discover SE3HD'),
  ('Life Fitness', 'SE3 HD', 2017, null, 'premium', 27, 'Discover SE3HD alias'),
  ('Life Fitness', 'SE4', 2022, null, 'premium', 27, 'Discover SE4'),
  -- Technogym
  ('Technogym', 'LED', 2010, null, 'base', 0, 'Base console'),
  ('Technogym', 'Visio', 2012, null, 'base', 0, 'Visio console'),
  ('Technogym', 'VisioWeb', 2014, null, 'mid', 10, 'VisioWeb console'),
  ('Technogym', 'Connect', 2015, null, 'base', 0, 'Connect console'),
  ('Technogym', 'Unity', 2016, null, 'mid', 15, 'Unity console'),
  ('Technogym', 'Live 10', 2019, null, 'mid', 15, 'Live console'),
  ('Technogym', 'Live 16', 2020, null, 'mid', 15, 'Live console'),
  ('Technogym', 'Live 19', 2021, null, 'premium', 25, 'Live console'),
  -- Matrix
  ('Matrix', 'LED', 2010, null, 'base', 0, 'Base console'),
  ('Matrix', 'Premium LED', 2010, null, 'base', 0, 'Base console'),
  ('Matrix', 'XR', 2012, null, 'base', 0, 'Base console'),
  ('Matrix', 'XER', 2014, null, 'mid', 15, 'Mid console'),
  ('Matrix', 'Touch', 2016, null, 'mid', 15, 'Mid console'),
  ('Matrix', 'XIR', 2018, null, 'premium', 25, 'Premium console'),
  ('Matrix', 'XUR', 2018, null, 'premium', 25, 'Premium console'),
  ('Matrix', 'Touch XL', 2019, null, 'premium', 25, 'Premium console'),
  -- Precor
  ('Precor', 'P31 LED', 2010, null, 'base', 0, 'Base console'),
  ('Precor', 'P62', 2016, null, 'mid', 15, '10 inch touchscreen'),
  ('Precor', 'P82', 2019, null, 'premium', 25, '15 inch touchscreen'),
  -- Cybex
  ('Cybex', '50L', 2010, null, 'base', 0, 'Base console'),
  ('Cybex', 'LED', 2010, null, 'base', 0, 'Base console'),
  ('Cybex', 'E3 View', 2014, 2018, 'mid', 12, 'Mid console'),
  ('Cybex', '70T', 2017, null, 'premium', 25, 'Touchscreen'),
  -- Star Trac
  ('Star Trac', 'LED', 2010, null, 'base', 0, 'Base console'),
  ('Star Trac', '10 inch touchscreen', 2014, null, 'mid', 12, 'Mid console'),
  ('Star Trac', '15 inch touchscreen', 2017, null, 'premium', 22, 'Premium console'),
  ('Star Trac', 'embedded touchscreen', 2017, null, 'premium', 22, 'Premium console')
on conflict do nothing;
