-- Suspended/deleted sellers' listings were still visible to callers who cannot
-- read public.profiles (anon, and ordinary authenticated users). The visibility
-- predicate used EXISTS on profiles under RLS, so "not exists" was true when
-- the seller row was invisible. Admins could read profiles, so they saw the
-- listings disappear. Fix: evaluate seller hiding in SECURITY DEFINER helpers.

create or replace function public.seller_is_hidden_from_public_marketplace(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.is_suspended = true
        or p.deleted_at is not null
      from public.profiles p
      where p.id = p_user_id
    ),
    false
  );
$$;

comment on function public.seller_is_hidden_from_public_marketplace(uuid) is
  'SECURITY DEFINER helper: true when the seller is suspended or deleted. Not granted to anon/authenticated; listing visibility functions call it as the definer.';

revoke all on function public.seller_is_hidden_from_public_marketplace(uuid)
  from public, anon, authenticated;
grant execute on function public.seller_is_hidden_from_public_marketplace(uuid)
  to service_role;

create or replace function public.listing_is_publicly_visible(
  p_listing public.listings
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not coalesce(p_listing.is_test_data, false)
    and p_listing.status = 'active'::public.listing_status
    and p_listing.quantity_available > 0
    and (
      p_listing.source is distinct from 'import'::public.listing_source
      or public.listing_has_images(p_listing.id)
    )
    and not public.seller_is_hidden_from_public_marketplace(p_listing.seller_id);
$$;

comment on function public.listing_is_publicly_visible(public.listings) is
  'Canonical marketplace visibility. Excludes test fixtures, non-active/out-of-stock, image-less imports, and suspended or deleted sellers. SECURITY DEFINER so anon and authenticated get the same result.';

revoke all on function public.listing_is_publicly_visible(public.listings)
  from public;
grant execute on function public.listing_is_publicly_visible(public.listings)
  to anon, authenticated, service_role;

create or replace function public.listing_is_publicly_readable(
  p_listing public.listings
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.seller_is_hidden_from_public_marketplace(p_listing.seller_id)
    and not coalesce(p_listing.is_test_data, false)
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
  'Anonymous detail/image readability for currently visible actives, or legitimate sold listings. Suspended/deleted sellers are excluded. Counterparties still use seller/accepted-offer RLS.';

revoke all on function public.listing_is_publicly_readable(public.listings)
  from public;
grant execute on function public.listing_is_publicly_readable(public.listings)
  to anon, authenticated, service_role;

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
        or public.is_admin()
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

drop policy if exists "Admins can read all listings" on public.listings;
create policy "Admins can read all listings"
  on public.listings for select
  to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
