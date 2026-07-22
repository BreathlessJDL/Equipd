-- Durable production test-fixture visibility safeguard.
--
-- Test data is marked at insert time, remains immutable, can never have a
-- public listing status/published timestamp, and is excluded by the canonical
-- public visibility predicate regardless of any future status regression.

alter table public.listings
  add column if not exists is_test_data boolean not null default false;

comment on column public.listings.is_test_data is
  'Immutable internal marker. Test fixtures are always excluded from every public marketplace surface.';

alter table public.listings
  drop constraint if exists listings_test_data_non_public_check;

alter table public.listings
  add constraint listings_test_data_non_public_check
  check (
    not is_test_data
    or (
      status in (
        'draft'::public.listing_status,
        'archived'::public.listing_status
      )
      and published_at is null
    )
  ) not valid;

alter table public.listings
  validate constraint listings_test_data_non_public_check;

create index if not exists listings_test_data_idx
  on public.listings (id)
  where is_test_data;

create or replace function public.guard_listing_test_data()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_test_data is distinct from old.is_test_data then
    raise exception 'The test-data marker is immutable'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT'
     and new.is_test_data
     and auth.role() is distinct from 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Only service-role tooling may create test listings'
      using errcode = '42501';
  end if;

  if new.is_test_data
     and (
       new.status not in (
         'draft'::public.listing_status,
         'archived'::public.listing_status
       )
       or new.published_at is not null
     ) then
    raise exception 'Test listings must remain draft/archived and unpublished'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_listing_test_data_trigger on public.listings;
create trigger guard_listing_test_data_trigger
before insert or update of is_test_data, status, published_at
on public.listings
for each row
execute function public.guard_listing_test_data();

-- Canonical predicate used by direct anonymous RLS, listings_public_browse,
-- browse/search RPCs, brand/location reads and image visibility.
create or replace function public.listing_is_publicly_visible(
  p_listing public.listings
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    not p_listing.is_test_data
    and p_listing.status = 'active'::public.listing_status
    and p_listing.quantity_available > 0
    and (
      p_listing.source is distinct from 'import'::public.listing_source
      or public.listing_has_images(p_listing.id)
    );
$$;

comment on function public.listing_is_publicly_visible(public.listings) is
  'Canonical marketplace visibility predicate. Excludes immutable test data, non-active/out-of-stock listings, and image-less imports.';

-- Service-role-only commerce setup for production smoke fixtures. This
-- deliberately bypasses normal active-listing acceptance while preserving
-- inventory, offer, payment and order constraints/snapshots.
create or replace function public.create_test_fixture_payment_and_order(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_quantity integer,
  p_total_offer_amount_pence integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings;
  v_offer public.offers;
  v_payment_id uuid;
  v_order_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Quantity must be between 1 and 999';
  end if;

  if p_total_offer_amount_pence is null
     or p_total_offer_amount_pence <= 0
     or p_total_offer_amount_pence % p_quantity <> 0 then
    raise exception 'Offer total must be positive and divide evenly by quantity';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Test listing not found';
  end if;

  if not v_listing.is_test_data then
    raise exception 'Listing is not marked as test data'
      using errcode = '42501';
  end if;

  if v_listing.status not in (
       'draft'::public.listing_status,
       'archived'::public.listing_status
     )
     or v_listing.published_at is not null then
    raise exception 'Test listing is not permanently non-public'
      using errcode = '23514';
  end if;

  if p_buyer_id is null or p_buyer_id = v_listing.seller_id then
    raise exception 'A distinct test buyer is required';
  end if;

  if not exists (select 1 from public.profiles where id = p_buyer_id) then
    raise exception 'Test buyer profile not found';
  end if;

  if v_listing.quantity_available < p_quantity then
    raise exception 'Insufficient test inventory: requested %, available %',
      p_quantity, v_listing.quantity_available;
  end if;

  if p_total_offer_amount_pence > v_listing.price_pence * p_quantity then
    raise exception 'Test offer cannot exceed asking-price total';
  end if;

  update public.listings
  set
    quantity_available = quantity_available - p_quantity,
    quantity_reserved = quantity_reserved + p_quantity,
    inventory_version = inventory_version + 1
  where id = v_listing.id;

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    quantity,
    status,
    direction
  )
  values (
    v_listing.id,
    p_buyer_id,
    v_listing.seller_id,
    p_total_offer_amount_pence,
    p_quantity,
    'accepted'::public.offer_status,
    'buyer_to_seller'
  )
  returning * into v_offer;

  v_payment_id := public.create_payment_and_order_for_accepted_offer(v_offer);

  select id
  into v_order_id
  from public.orders
  where payment_id = v_payment_id;

  if v_order_id is null then
    raise exception 'Test order creation failed';
  end if;

  -- Defense-in-depth proof inside the same transaction.
  select *
  into v_listing
  from public.listings
  where id = p_listing_id;

  if public.listing_is_publicly_visible(v_listing) then
    raise exception 'Test fixture became publicly visible; transaction aborted'
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'listing_id', v_listing.id,
    'offer_id', v_offer.id,
    'payment_id', v_payment_id,
    'order_id', v_order_id,
    'quantity', p_quantity,
    'inventory_version', v_listing.inventory_version
  );
end;
$$;

revoke all on function public.create_test_fixture_payment_and_order(
  uuid, uuid, integer, integer
) from public, anon, authenticated;
grant execute on function public.create_test_fixture_payment_and_order(
  uuid, uuid, integer, integer
) to service_role;

notify pgrst, 'reload schema';
