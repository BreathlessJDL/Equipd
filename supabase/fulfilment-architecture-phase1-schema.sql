-- Equipd Fulfilment architecture — Phase 1 (schema + RLS only)
-- Run after order-handover-details-phase4b-rpc.sql
-- Safe to re-run (idempotent where possible).
--
-- Phase 1 scope:
--   - listing_fulfilment_private (seller collection address/phone; not public)
--   - listings.seller_delivery_radius_miles (public nullable integer)
--   - order_delivery_details (buyer delivery address for seller_delivery orders)
--
-- Does NOT remove order_handover_details (legacy Phase 4).
-- No UI, messaging, or order lifecycle changes in this migration.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_listing_seller(p_listing_id uuid, p_user_id uuid default auth.uid())
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
      and l.seller_id = p_user_id
  );
$$;

revoke all on function public.is_listing_seller(uuid, uuid) from public;
grant execute on function public.is_listing_seller(uuid, uuid) to authenticated;

create or replace function public.buyer_has_paid_order_for_listing(
  p_listing_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.payments p on p.id = o.payment_id
    where o.listing_id = p_listing_id
      and o.buyer_id = p_user_id
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status <> 'cancelled'::public.order_fulfilment_status
  );
$$;

revoke all on function public.buyer_has_paid_order_for_listing(uuid, uuid) from public;
grant execute on function public.buyer_has_paid_order_for_listing(uuid, uuid) to authenticated;

create or replace function public.is_seller_delivery_order_writable(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.payments p on p.id = o.payment_id
    where o.id = p_order_id
      and coalesce(o.order_type, 'collection'::public.order_type)
        = 'seller_delivery'::public.order_type
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status <> 'cancelled'::public.order_fulfilment_status
  );
$$;

revoke all on function public.is_seller_delivery_order_writable(uuid) from public;
grant execute on function public.is_seller_delivery_order_writable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- listings.seller_delivery_radius_miles (public metadata)
-- ---------------------------------------------------------------------------

alter table public.listings
  add column if not exists seller_delivery_radius_miles integer;

alter table public.listings
  drop constraint if exists listings_seller_delivery_radius_miles_positive;

alter table public.listings
  add constraint listings_seller_delivery_radius_miles_positive
  check (seller_delivery_radius_miles is null or seller_delivery_radius_miles > 0);

comment on column public.listings.seller_delivery_radius_miles is
  'Public seller-delivery radius in miles. Nullable until seller delivery is enabled.';

-- ---------------------------------------------------------------------------
-- listing_fulfilment_private
-- ---------------------------------------------------------------------------

create table if not exists public.listing_fulfilment_private (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  collection_address text,
  collection_phone text,
  collection_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.listing_fulfilment_private is
  'Private seller collection/contact details for a listing. Never exposed via public listing browse.';

comment on column public.listing_fulfilment_private.collection_address is
  'Seller collection / courier pickup address. Shared with buyer only after paid order.';

comment on column public.listing_fulfilment_private.collection_phone is
  'Seller contact number for fulfilment coordination. Shared with buyer only after paid order.';

comment on column public.listing_fulfilment_private.collection_instructions is
  'Optional access, parking, or loading instructions for collection/courier pickup.';

drop trigger if exists listing_fulfilment_private_set_updated_at on public.listing_fulfilment_private;

create trigger listing_fulfilment_private_set_updated_at
  before update on public.listing_fulfilment_private
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- listing_fulfilment_private — buyer write guard (seller-only fields)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_fulfilment_private_seller_only()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_listing_seller(coalesce(NEW.listing_id, OLD.listing_id), v_uid) then
    raise exception 'Only the listing seller may change private fulfilment details';
  end if;

  if TG_OP = 'UPDATE' and NEW.listing_id is distinct from OLD.listing_id then
    raise exception 'Cannot reassign private fulfilment details to another listing';
  end if;

  return NEW;
end;
$$;

drop trigger if exists listing_fulfilment_private_enforce_seller_only_insert
  on public.listing_fulfilment_private;

create trigger listing_fulfilment_private_enforce_seller_only_insert
  before insert on public.listing_fulfilment_private
  for each row execute function public.enforce_listing_fulfilment_private_seller_only();

drop trigger if exists listing_fulfilment_private_enforce_seller_only_update
  on public.listing_fulfilment_private;

create trigger listing_fulfilment_private_enforce_seller_only_update
  before update on public.listing_fulfilment_private
  for each row execute function public.enforce_listing_fulfilment_private_seller_only();

drop trigger if exists listing_fulfilment_private_enforce_seller_only_delete
  on public.listing_fulfilment_private;

create trigger listing_fulfilment_private_enforce_seller_only_delete
  before delete on public.listing_fulfilment_private
  for each row execute function public.enforce_listing_fulfilment_private_seller_only();

-- ---------------------------------------------------------------------------
-- listing_fulfilment_private — RLS
-- ---------------------------------------------------------------------------

alter table public.listing_fulfilment_private enable row level security;

drop policy if exists "Sellers can read own listing fulfilment private"
  on public.listing_fulfilment_private;

create policy "Sellers can read own listing fulfilment private"
  on public.listing_fulfilment_private for select
  to authenticated
  using (public.is_listing_seller(listing_id));

drop policy if exists "Buyers can read listing fulfilment private after paid order"
  on public.listing_fulfilment_private;

create policy "Buyers can read listing fulfilment private after paid order"
  on public.listing_fulfilment_private for select
  to authenticated
  using (public.buyer_has_paid_order_for_listing(listing_id));

drop policy if exists "Admins can read all listing fulfilment private"
  on public.listing_fulfilment_private;

create policy "Admins can read all listing fulfilment private"
  on public.listing_fulfilment_private for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Sellers can insert own listing fulfilment private"
  on public.listing_fulfilment_private;

create policy "Sellers can insert own listing fulfilment private"
  on public.listing_fulfilment_private for insert
  to authenticated
  with check (public.is_listing_seller(listing_id));

drop policy if exists "Sellers can update own listing fulfilment private"
  on public.listing_fulfilment_private;

create policy "Sellers can update own listing fulfilment private"
  on public.listing_fulfilment_private for update
  to authenticated
  using (public.is_listing_seller(listing_id))
  with check (public.is_listing_seller(listing_id));

drop policy if exists "Sellers can delete own listing fulfilment private"
  on public.listing_fulfilment_private;

create policy "Sellers can delete own listing fulfilment private"
  on public.listing_fulfilment_private for delete
  to authenticated
  using (public.is_listing_seller(listing_id));

revoke all on table public.listing_fulfilment_private from public;
grant select, insert, update, delete on table public.listing_fulfilment_private to authenticated;

-- ---------------------------------------------------------------------------
-- order_delivery_details
-- ---------------------------------------------------------------------------

create table if not exists public.order_delivery_details (
  order_id uuid primary key references public.orders (id) on delete cascade,
  buyer_delivery_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.order_delivery_details is
  'Buyer delivery address for seller_delivery orders. Captured after payment.';

comment on column public.order_delivery_details.buyer_delivery_address is
  'Buyer-provided delivery address for seller_delivery fulfilment.';

drop trigger if exists order_delivery_details_set_updated_at on public.order_delivery_details;

create trigger order_delivery_details_set_updated_at
  before update on public.order_delivery_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_delivery_details — buyer-only writes
-- ---------------------------------------------------------------------------

create or replace function public.enforce_order_delivery_details_buyer_only()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.buyer_id
  into v_buyer_id
  from public.orders o
  where o.id = coalesce(NEW.order_id, OLD.order_id);

  if not found then
    raise exception 'Order not found';
  end if;

  if v_uid <> v_buyer_id then
    raise exception 'Only the buyer may change delivery details for this order';
  end if;

  if TG_OP = 'INSERT' then
    if not public.is_seller_delivery_order_writable(NEW.order_id) then
      raise exception 'Delivery details cannot be added for this order';
    end if;
  elsif TG_OP = 'UPDATE' then
    if not public.is_seller_delivery_order_writable(OLD.order_id) then
      raise exception 'Delivery details cannot be changed for this order';
    end if;

    if NEW.order_id is distinct from OLD.order_id then
      raise exception 'Cannot reassign delivery details to another order';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists order_delivery_details_enforce_buyer_only_insert
  on public.order_delivery_details;

create trigger order_delivery_details_enforce_buyer_only_insert
  before insert on public.order_delivery_details
  for each row execute function public.enforce_order_delivery_details_buyer_only();

drop trigger if exists order_delivery_details_enforce_buyer_only_update
  on public.order_delivery_details;

create trigger order_delivery_details_enforce_buyer_only_update
  before update on public.order_delivery_details
  for each row execute function public.enforce_order_delivery_details_buyer_only();

-- ---------------------------------------------------------------------------
-- order_delivery_details — RLS
-- ---------------------------------------------------------------------------

alter table public.order_delivery_details enable row level security;

drop policy if exists "Buyers can read own order delivery details"
  on public.order_delivery_details;

create policy "Buyers can read own order delivery details"
  on public.order_delivery_details for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
    )
  );

drop policy if exists "Sellers can read order delivery details for their seller delivery orders"
  on public.order_delivery_details;

create policy "Sellers can read order delivery details for their seller delivery orders"
  on public.order_delivery_details for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.payments p on p.id = o.payment_id
      where o.id = order_id
        and o.seller_id = auth.uid()
        and coalesce(o.order_type, 'collection'::public.order_type)
          = 'seller_delivery'::public.order_type
        and p.status = 'paid'::public.payment_status
        and o.fulfilment_status <> 'cancelled'::public.order_fulfilment_status
    )
  );

drop policy if exists "Admins can read all order delivery details"
  on public.order_delivery_details;

create policy "Admins can read all order delivery details"
  on public.order_delivery_details for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Buyers can insert order delivery details"
  on public.order_delivery_details;

create policy "Buyers can insert order delivery details"
  on public.order_delivery_details for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
    )
    and public.is_seller_delivery_order_writable(order_id)
  );

drop policy if exists "Buyers can update order delivery details"
  on public.order_delivery_details;

create policy "Buyers can update order delivery details"
  on public.order_delivery_details for update
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
    )
    and public.is_seller_delivery_order_writable(order_id)
  )
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.buyer_id = auth.uid()
    )
    and public.is_seller_delivery_order_writable(order_id)
  );

-- No delete policy: participants cannot remove delivery detail rows.

revoke all on table public.order_delivery_details from public;
grant select, insert, update on table public.order_delivery_details to authenticated;
