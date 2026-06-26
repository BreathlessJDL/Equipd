-- Equipd offers schema alignment (idempotent)
-- Run in Supabase SQL Editor when the API reports missing offers.direction (PGRST204 / schema cache).
-- Safe to re-run. Run before or instead of the first half of offer-messaging-flow.sql if that migration was not applied.
-- After running: PostgREST reloads via NOTIFY below; if errors persist, wait ~1 min or restart the API project.

-- ---------------------------------------------------------------------------
-- offers: ensure base columns exist
-- ---------------------------------------------------------------------------

alter table public.offers
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

alter table public.offers
  add column if not exists updated_at timestamptz not null default now();

alter table public.offers
  add column if not exists message text;

-- ---------------------------------------------------------------------------
-- offers.direction (text + check constraint)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offers'
      and column_name = 'direction'
  ) then
    alter table public.offers
      add column direction text not null default 'buyer_to_seller';
  end if;
end $$;

update public.offers
set direction = 'buyer_to_seller'
where direction is null;

alter table public.offers
  alter column direction set default 'buyer_to_seller';

alter table public.offers
  alter column direction set not null;

alter table public.offers
  drop constraint if exists offers_direction_valid;

alter table public.offers
  add constraint offers_direction_valid
  check (direction in ('buyer_to_seller', 'seller_to_buyer'));

-- ---------------------------------------------------------------------------
-- offers.parent_offer_id
-- ---------------------------------------------------------------------------

alter table public.offers
  add column if not exists parent_offer_id uuid references public.offers (id) on delete set null;

-- ---------------------------------------------------------------------------
-- offer_status enum extensions (status stays enum; rejected = declined in UI)
-- ---------------------------------------------------------------------------

alter type public.offer_status add value if not exists 'countered';

alter type public.offer_status add value if not exists 'cancelled';

-- ---------------------------------------------------------------------------
-- Partial unique indexes (buyer offer vs seller counter)
-- ---------------------------------------------------------------------------

drop index if exists public.offers_one_pending_per_buyer_listing_idx;

create unique index if not exists offers_one_pending_buyer_offer_per_listing_idx
  on public.offers (listing_id, buyer_id)
  where status = 'pending'::public.offer_status
    and direction = 'buyer_to_seller';

create unique index if not exists offers_one_pending_seller_counter_per_listing_idx
  on public.offers (listing_id, buyer_id)
  where status = 'pending'::public.offer_status
    and direction = 'seller_to_buyer';

-- ---------------------------------------------------------------------------
-- PostgREST schema cache reload
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
