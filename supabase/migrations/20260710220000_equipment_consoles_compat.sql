-- Shared console catalogue + per-product compatibility (model/year aware).
-- Preserves product_console_options / availability / modifiers for rollback.

-- ---------------------------------------------------------------------------
-- equipment_consoles (master)
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_consoles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  console_key text not null,
  console_name text not null,
  alternative_names text[] not null default '{}',
  start_year integer
    check (start_year is null or (start_year >= 1970 and start_year <= 2100)),
  end_year integer
    check (end_year is null or (end_year >= 1970 and end_year <= 2100)),
  start_year_approximate boolean not null default false,
  end_year_approximate boolean not null default false,
  is_current boolean not null default false,
  image_url text,
  image_storage_path text,
  image_status text not null default 'none'
    check (image_status in ('none', 'pending', 'approved', 'rejected')),
  display_order integer not null default 0,
  active boolean not null default true,
  source_url text,
  notes text,
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_consoles_year_range_chk
    check (end_year is null or start_year is null or end_year >= start_year)
);

comment on table public.equipment_consoles is
  'Master catalogue of equipment consoles/monitors by brand.';

create unique index if not exists equipment_consoles_brand_key_uidx
  on public.equipment_consoles (brand, console_key);

create index if not exists equipment_consoles_brand_active_idx
  on public.equipment_consoles (brand, active, display_order);

drop trigger if exists equipment_consoles_set_updated_at on public.equipment_consoles;
create trigger equipment_consoles_set_updated_at
  before update on public.equipment_consoles
  for each row execute function public.set_updated_at();

alter table public.equipment_consoles enable row level security;

drop policy if exists "Equipment consoles are publicly readable" on public.equipment_consoles;
create policy "Equipment consoles are publicly readable"
  on public.equipment_consoles for select
  using (true);

drop policy if exists "Admins can manage equipment consoles" on public.equipment_consoles;
create policy "Admins can manage equipment consoles"
  on public.equipment_consoles for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.equipment_consoles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- product_console_compat
-- ---------------------------------------------------------------------------

create table if not exists public.product_console_compat (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.equipment_products(id) on delete cascade,
  console_id uuid not null references public.equipment_consoles(id) on delete restrict,
  available_from_year integer not null
    check (available_from_year >= 1970 and available_from_year <= 2100),
  available_to_year integer
    check (available_to_year is null or (available_to_year >= 1970 and available_to_year <= 2100)),
  from_year_approximate boolean not null default false,
  to_year_approximate boolean not null default false,
  compatibility_type text not null default 'factory'
    check (compatibility_type in ('factory', 'optional', 'retrofit', 'fixed')),
  is_default boolean not null default false,
  display_order integer not null default 0,
  tier text not null default 'base'
    check (tier in ('base', 'mid', 'premium')),
  modifier_percent numeric not null default 0
    check (modifier_percent >= 0 and modifier_percent <= 100),
  source_url text,
  notes text,
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_console_compat_year_range_chk
    check (available_to_year is null or available_to_year >= available_from_year)
);

comment on table public.product_console_compat is
  'Canonical product to console compatibility with year windows and factory/optional/retrofit/fixed types.';

create unique index if not exists product_console_compat_product_console_uidx
  on public.product_console_compat (product_id, console_id, compatibility_type, available_from_year);

create index if not exists product_console_compat_product_active_idx
  on public.product_console_compat (product_id, is_active, display_order);

create index if not exists product_console_compat_console_id_idx
  on public.product_console_compat (console_id);

create index if not exists product_console_compat_confidence_idx
  on public.product_console_compat (confidence)
  where is_active = true;

drop trigger if exists product_console_compat_set_updated_at on public.product_console_compat;
create trigger product_console_compat_set_updated_at
  before update on public.product_console_compat
  for each row execute function public.set_updated_at();

alter table public.product_console_compat enable row level security;

drop policy if exists "Product console compat is publicly readable" on public.product_console_compat;
create policy "Product console compat is publicly readable"
  on public.product_console_compat for select
  using (true);

drop policy if exists "Admins can manage product console compat" on public.product_console_compat;
create policy "Admins can manage product console compat"
  on public.product_console_compat for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.product_console_compat to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Concept2 master consoles
-- Sources: https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness
--          https://www.concept2.com/about/timeline
-- ---------------------------------------------------------------------------

insert into public.equipment_consoles (
  brand, console_key, console_name, alternative_names,
  start_year, end_year, start_year_approximate, end_year_approximate,
  is_current, display_order, active, source_url, notes, confidence
) values
  (
    'Concept2', 'pm1', 'PM1', array['Performance Monitor 1', 'PM 1'],
    1986, 1993, false, true,
    false, 10, true,
    'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    'Official Concept2 PM timeline lists PM1 as 1986–1993. Some secondary sources extend to ~1995.',
    'high'
  ),
  (
    'Concept2', 'pm2', 'PM2', array['Performance Monitor 2', 'PM 2'],
    1995, 2003, false, false,
    false, 20, true,
    'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    'Official Concept2 PM timeline: 1995–2003.',
    'high'
  ),
  (
    'Concept2', 'pm2_plus', 'PM2+', array['PM2 Plus', 'Performance Monitor 2+', 'PM 2+'],
    1998, 2003, false, false,
    false, 30, true,
    'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    'Official Concept2 PM timeline: 1998–2003.',
    'high'
  ),
  (
    'Concept2', 'pm3', 'PM3', array['Performance Monitor 3', 'PM 3'],
    2003, 2014, false, false,
    false, 40, true,
    'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    'Official Concept2 PM timeline: 2003–2014. Original monitor for Model D.',
    'high'
  ),
  (
    'Concept2', 'pm4', 'PM4', array['Performance Monitor 4', 'PM 4'],
    2006, 2014, false, false,
    false, 50, true,
    'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    'Official Concept2 PM timeline: 2006–2014. Original monitor for Model E (Aug 2006).',
    'high'
  ),
  (
    'Concept2', 'pm5', 'PM5', array['Performance Monitor 5', 'PM 5'],
    2014, null, false, false,
    true, 60, true,
    'https://www.concept2.com/blog/pm5-upgrade-or-retrofit-for-connected-fitness',
    'Official Concept2 PM timeline: 2014–present. Standard on current RowErg/SkiErg/BikeErg. Retrofit kits exist for older machines.',
    'high'
  )
on conflict (brand, console_key) do update set
  console_name = excluded.console_name,
  alternative_names = excluded.alternative_names,
  start_year = excluded.start_year,
  end_year = excluded.end_year,
  start_year_approximate = excluded.start_year_approximate,
  end_year_approximate = excluded.end_year_approximate,
  is_current = excluded.is_current,
  display_order = excluded.display_order,
  active = excluded.active,
  source_url = excluded.source_url,
  notes = excluded.notes,
  confidence = excluded.confidence,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Non-destructive backfill from product_console_options → master + compat
-- Treats legacy rows as factory (Life Fitness / Technogym / Matrix preserved).
-- ---------------------------------------------------------------------------

insert into public.equipment_consoles (
  brand, console_key, console_name, start_year, end_year,
  display_order, active, image_url, image_status, confidence, notes
)
select distinct on (ep.brand, pco.console_key)
  ep.brand,
  pco.console_key,
  pco.console_name,
  pco.release_year,
  pco.retired_year,
  pco.sort_order,
  true,
  pco.image_url,
  case when pco.image_url is not null and length(trim(pco.image_url)) > 0 then 'approved' else 'none' end,
  'medium',
  'Backfilled from product_console_options during equipment_consoles migration.'
from public.product_console_options pco
join public.equipment_products ep on ep.id = pco.product_id
where pco.is_active = true
  and ep.brand is not null
  and pco.console_key is not null
order by ep.brand, pco.console_key, pco.release_year
on conflict (brand, console_key) do nothing;

insert into public.product_console_compat (
  product_id,
  console_id,
  available_from_year,
  available_to_year,
  compatibility_type,
  is_default,
  display_order,
  tier,
  modifier_percent,
  notes,
  confidence,
  is_active
)
select
  pco.product_id,
  ec.id,
  pco.release_year,
  pco.retired_year,
  'factory',
  false,
  pco.sort_order,
  pco.tier,
  pco.modifier_percent,
  'Backfilled from product_console_options (legacy factory mapping).',
  'medium',
  pco.is_active
from public.product_console_options pco
join public.equipment_products ep on ep.id = pco.product_id
join public.equipment_consoles ec
  on ec.brand = ep.brand
 and ec.console_key = pco.console_key
where not exists (
  select 1
  from public.product_console_compat existing
  where existing.product_id = pco.product_id
    and existing.console_id = ec.id
    and existing.compatibility_type = 'factory'
    and existing.available_from_year = pco.release_year
);

-- Mark first sort_order row per product as default when none set
update public.product_console_compat pcc
set is_default = true
where pcc.id in (
  select distinct on (product_id) id
  from public.product_console_compat
  where is_active = true
    and compatibility_type in ('factory', 'optional', 'fixed')
  order by product_id, display_order asc, available_from_year asc
)
and not exists (
  select 1
  from public.product_console_compat other
  where other.product_id = pcc.product_id
    and other.is_default = true
    and other.is_active = true
);
