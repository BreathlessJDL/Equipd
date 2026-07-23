-- Stage 5: sold listing public readability (additive, reversible).
--
-- Introduces:
--   listings.sold_at — reliable sold/completed timestamp (NOT updated_at)
--   listing_is_publicly_readable — detail/image readability (active OR eligible sold)
--
-- Does NOT change listing_is_publicly_visible or listings_public_browse (active-only marketplace).

-- ---------------------------------------------------------------------------
-- 1. sold_at column
-- ---------------------------------------------------------------------------

alter table public.listings
  add column if not exists sold_at timestamptz;

comment on column public.listings.sold_at is
  'Set once when status first becomes sold. Source of truth for sold archive indexing (12 months). Never use updated_at for this policy.';

create index if not exists listings_sold_at_idx
  on public.listings (sold_at)
  where status = 'sold'::public.listing_status and sold_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Set sold_at when status first becomes sold
-- ---------------------------------------------------------------------------

create or replace function public.set_listing_sold_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'sold'::public.listing_status
     and old.status is distinct from 'sold'::public.listing_status
     and new.sold_at is null then
    new.sold_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists listings_set_sold_at on public.listings;

create trigger listings_set_sold_at
  before update of status on public.listings
  for each row
  execute function public.set_listing_sold_at();

-- ---------------------------------------------------------------------------
-- 3. published_at: also set on INSERT when created already active
-- ---------------------------------------------------------------------------

create or replace function public.set_listing_published_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active'::public.listing_status and new.published_at is null then
      new.published_at := now();
    end if;
    return new;
  end if;

  if new.status = 'active'::public.listing_status
     and old.status is distinct from 'active'::public.listing_status
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists listings_set_published_at on public.listings;

create trigger listings_set_published_at
  before insert or update on public.listings
  for each row
  execute function public.set_listing_published_at();

-- ---------------------------------------------------------------------------
-- 4. Deterministic backfills (no updated_at guesses)
-- ---------------------------------------------------------------------------

-- sold_at from earliest order inventory_sold_at (all current sold rows have this)
update public.listings l
set sold_at = src.sold_at
from (
  select o.listing_id, min(o.inventory_sold_at) as sold_at
  from public.orders o
  where o.inventory_sold_at is not null
  group by o.listing_id
) src
where l.id = src.listing_id
  and l.status = 'sold'::public.listing_status
  and l.sold_at is null;

-- Fallback: buyer_confirmed_at when inventory_sold_at absent
update public.listings l
set sold_at = src.sold_at
from (
  select o.listing_id, min(o.buyer_confirmed_at) as sold_at
  from public.orders o
  where o.buyer_confirmed_at is not null
  group by o.listing_id
) src
where l.id = src.listing_id
  and l.status = 'sold'::public.listing_status
  and l.sold_at is null;

-- published_at for currently publicly visible actives missing it
update public.listings l
set published_at = coalesce(l.created_at, now())
where l.published_at is null
  and public.listing_is_publicly_visible(l);

-- published_at for sold listings that completed a marketplace order (proof of prior public sale)
update public.listings l
set published_at = coalesce(l.created_at, l.sold_at, now())
where l.published_at is null
  and l.status = 'sold'::public.listing_status
  and l.sold_at is not null
  and not l.is_test_data
  and exists (
    select 1
    from public.orders o
    where o.listing_id = l.id
      and (o.inventory_sold_at is not null or o.buyer_confirmed_at is not null)
  );

-- ---------------------------------------------------------------------------
-- 5. Public readability predicate (detail + images). Browse stays active-only.
-- ---------------------------------------------------------------------------

create or replace function public.listing_is_publicly_readable(
  p_listing public.listings
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    not coalesce(p_listing.is_test_data, false)
    and (
      public.listing_is_publicly_visible(p_listing)
      or (
        p_listing.status = 'sold'::public.listing_status
        and p_listing.published_at is not null
        and p_listing.sold_at is not null
        and (
          p_listing.source is distinct from 'import'::public.listing_source
          or public.listing_has_images(p_listing.id)
        )
      )
    );
$$;

comment on function public.listing_is_publicly_readable(public.listings) is
  'Anonymous detail/image readability: currently publicly visible actives, or legitimate sold listings with published_at + sold_at. Never widens browse/search.';

revoke all on function public.listing_is_publicly_readable(public.listings)
  from public;
grant execute on function public.listing_is_publicly_readable(public.listings)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. RLS: listing detail uses readability; browse view unchanged
-- ---------------------------------------------------------------------------

drop policy if exists "Active listings are publicly readable" on public.listings;

create policy "Publicly readable listings are selectable"
  on public.listings for select
  to anon, authenticated
  using (
    public.listing_is_publicly_readable(listings)
    or seller_id = auth.uid()
    or exists (
      select 1
      from public.offers o
      where o.listing_id = listings.id
        and o.buyer_id = auth.uid()
        and o.status = 'accepted'::public.offer_status
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Images: eligible sold listings readable anonymously
-- ---------------------------------------------------------------------------

create or replace function public.listing_can_read_images(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and (
        public.listing_is_publicly_readable(l)
        or l.seller_id = auth.uid()
        or exists (
          select 1
          from public.offers o
          where o.listing_id = l.id
            and o.buyer_id = auth.uid()
            and o.status = 'accepted'::public.offer_status
        )
      )
  );
$$;

comment on function public.listing_can_read_images(uuid) is
  'SECURITY DEFINER: whether the current user may read listing_images (active public, eligible sold, seller, or accepted-offer buyer).';

-- ---------------------------------------------------------------------------
-- 8. Save/favourite: active marketplace only (sold cannot be newly saved)
-- ---------------------------------------------------------------------------

drop policy if exists "Users save listings for themselves" on public.saved_listings;

create policy "Users save listings for themselves"
  on public.saved_listings for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and public.listing_is_publicly_visible(l)
        and l.seller_id is distinct from auth.uid()
    )
  );

notify pgrst, 'reload schema';
