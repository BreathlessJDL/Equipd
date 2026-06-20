-- Equipd saved listings
-- Run after notifications.sql

-- ---------------------------------------------------------------------------
-- saved_listings
-- ---------------------------------------------------------------------------

create table public.saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_listings_user_listing_unique unique (user_id, listing_id)
);

create index saved_listings_user_created_idx
  on public.saved_listings (user_id, created_at desc);

create index saved_listings_listing_idx
  on public.saved_listings (listing_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.saved_listings enable row level security;

create policy "Users read own saved listings"
  on public.saved_listings for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users save listings for themselves"
  on public.saved_listings for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  );

create policy "Users remove own saved listings"
  on public.saved_listings for delete
  to authenticated
  using (user_id = auth.uid());
