-- Per-product commercial cardio console compatibility options.

create table if not exists public.product_console_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.equipment_products(id) on delete cascade,
  console_key text not null,
  console_name text not null,
  release_year integer not null
    check (release_year >= 1970 and release_year <= 2100),
  retired_year integer
    check (retired_year is null or retired_year >= 1970),
  tier text not null default 'base'
    check (tier in ('base', 'mid', 'premium')),
  modifier_percent numeric not null default 0
    check (modifier_percent >= 0 and modifier_percent <= 100),
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.product_console_options is
  'Console options valid for a specific commercial cardio equipment product.';

create unique index if not exists product_console_options_product_console_key_uidx
  on public.product_console_options (product_id, console_key);

create index if not exists product_console_options_product_id_idx
  on public.product_console_options (product_id);

create index if not exists product_console_options_product_active_idx
  on public.product_console_options (product_id, is_active, sort_order);

drop trigger if exists product_console_options_set_updated_at on public.product_console_options;

create trigger product_console_options_set_updated_at
  before update on public.product_console_options
  for each row execute function public.set_updated_at();

alter table public.product_console_options enable row level security;

drop policy if exists "Product console options are publicly readable" on public.product_console_options;
create policy "Product console options are publicly readable"
  on public.product_console_options for select
  using (true);

drop policy if exists "Admins can manage product console options" on public.product_console_options;
create policy "Admins can manage product console options"
  on public.product_console_options for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.product_console_options to anon, authenticated;
