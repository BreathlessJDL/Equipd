-- Equipd offers table and RLS
-- Run after messaging.sql (optional conversation_id link)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  amount_pence int not null,
  status public.offer_status not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_buyer_seller_different check (buyer_id <> seller_id),
  constraint offers_amount_positive check (amount_pence > 0)
);

create index offers_listing_created_idx
  on public.offers (listing_id, created_at desc);

create index offers_buyer_created_idx
  on public.offers (buyer_id, created_at desc);

create index offers_seller_status_idx
  on public.offers (seller_id, status, created_at desc);

create unique index offers_one_pending_per_buyer_listing_idx
  on public.offers (listing_id, buyer_id)
  where status = 'pending';

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.offers enable row level security;

create policy "Buyers and sellers can read relevant offers"
  on public.offers for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyers can create offers on active listings"
  on public.offers for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = seller_id
        and l.status = 'active'
    )
  );

create policy "Sellers can respond to pending offers"
  on public.offers for update
  to authenticated
  using (
    seller_id = auth.uid()
    and status = 'pending'
  )
  with check (
    seller_id = auth.uid()
    and status in ('accepted', 'rejected')
  );

create policy "Buyers can withdraw pending offers"
  on public.offers for update
  to authenticated
  using (
    buyer_id = auth.uid()
    and status = 'pending'
  )
  with check (
    buyer_id = auth.uid()
    and status = 'withdrawn'
  );
