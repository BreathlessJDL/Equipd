-- Stage 1: additive multi-quantity inventory architecture.
-- Database/backend only. Frontend and Stripe Checkout remain unchanged.
--
-- Preconditions:
--   * Stage 0 production dry run returned SAFE_TO_PROCEED.
--   * A production backup is taken immediately before applying this migration.
--
-- The entire migration is transactional. Any failed precondition, backfill
-- invariant, constraint validation, or function creation aborts all changes.

select pg_advisory_xact_lock(hashtext('equipd_multi_quantity_inventory_stage1'));

-- ---------------------------------------------------------------------------
-- 1. Preflight: repeat the blocking Stage 0 checks inside the transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.payments p
  left join public.offers f on f.id = p.offer_id
  left join public.listings l on l.id = p.listing_id
  where f.id is null or l.id is null;
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % payment rows have missing offer/listing relationships', v_count;
  end if;

  select count(*) into v_count
  from public.orders o
  left join public.offers f on f.id = o.offer_id
  left join public.payments p on p.id = o.payment_id
  left join public.listings l on l.id = o.listing_id
  where f.id is null or p.id is null or l.id is null
     or p.offer_id <> o.offer_id
     or p.listing_id <> o.listing_id;
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % order rows have missing or contradictory relationships', v_count;
  end if;

  select count(*) into v_count
  from (
    select listing_id
    from public.offers
    where status = 'accepted'::public.offer_status
    group by listing_id
    having count(*) > 1
  ) s;
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % listings have multiple accepted offers', v_count;
  end if;

  select count(*) into v_count
  from (
    select listing_id
    from public.payments
    where status in (
      'awaiting_seller_setup'::public.payment_status,
      'pending'::public.payment_status
    )
    group by listing_id
    having count(*) > 1
  ) s;
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % listings have multiple open payments', v_count;
  end if;

  select count(*) into v_count
  from public.listings l
  where l.status = 'reserved'::public.listing_status
    and not exists (
      select 1
      from public.orders o
      join public.payments p on p.id = o.payment_id
      where o.listing_id = l.id
        and o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
        and p.status in (
          'awaiting_seller_setup'::public.payment_status,
          'pending'::public.payment_status
        )
    );
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % reserved listings have no live reservation', v_count;
  end if;

  select count(*) into v_count
  from public.listings l
  where l.status = 'in_progress'::public.listing_status
    and not exists (
      select 1
      from public.orders o
      join public.payments p on p.id = o.payment_id
      where o.listing_id = l.id
        and p.status in ('paid'::public.payment_status, 'refunded'::public.payment_status)
        and o.fulfilment_status not in (
          'awaiting_payment'::public.order_fulfilment_status,
          'cancelled'::public.order_fulfilment_status
        )
    );
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % in-progress listings have no paid order', v_count;
  end if;

  select count(*) into v_count
  from public.orders o
  join public.payments p on p.id = o.payment_id
  where (
    o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
    and p.status = 'paid'::public.payment_status
  ) or (
    o.fulfilment_status in (
      'paid'::public.order_fulfilment_status,
      'in_progress'::public.order_fulfilment_status,
      'awaiting_collection'::public.order_fulfilment_status,
      'awaiting_courier_collection'::public.order_fulfilment_status,
      'awaiting_seller_delivery'::public.order_fulfilment_status,
      'collected'::public.order_fulfilment_status,
      'in_transit'::public.order_fulfilment_status,
      'delivered'::public.order_fulfilment_status,
      'awaiting_payout'::public.order_fulfilment_status,
      'buyer_confirmed'::public.order_fulfilment_status,
      'completed'::public.order_fulfilment_status,
      'disputed'::public.order_fulfilment_status,
      'refund_pending'::public.order_fulfilment_status
    )
    and p.status not in ('paid'::public.payment_status, 'refunded'::public.payment_status)
  ) or (
    o.fulfilment_status = 'cancelled'::public.order_fulfilment_status
    and p.status = 'paid'::public.payment_status
  );
  if v_count <> 0 then
    raise exception 'Stage 1 blocked: % payment/order status combinations are contradictory', v_count;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Additive schema objects. No existing column is removed or repurposed.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'order_inventory_state'
  ) then
    create type public.order_inventory_state as enum (
      'reserved',
      'sold',
      'released',
      'restocked',
      'no_restock'
    );
  end if;
end;
$$;

alter table public.listings
  add column if not exists quantity_total integer,
  add column if not exists quantity_available integer,
  add column if not exists quantity_reserved integer,
  add column if not exists quantity_sold integer,
  add column if not exists inventory_version bigint;

alter table public.offers
  add column if not exists quantity integer;

alter table public.payments
  add column if not exists quantity integer,
  add column if not exists listing_unit_price_pence integer,
  add column if not exists agreed_unit_price_pence integer,
  add column if not exists item_subtotal_pence integer;

alter table public.orders
  add column if not exists quantity integer,
  add column if not exists listing_unit_price_pence integer,
  add column if not exists agreed_unit_price_pence integer,
  add column if not exists item_subtotal_pence integer,
  add column if not exists inventory_state public.order_inventory_state,
  add column if not exists inventory_reserved_at timestamptz,
  add column if not exists inventory_sold_at timestamptz,
  add column if not exists inventory_released_at timestamptz,
  add column if not exists inventory_restocked_at timestamptz,
  add column if not exists inventory_no_restock_at timestamptz;

alter table public.listings
  add constraint listings_quantity_total_valid
    check (quantity_total between 1 and 999) not valid,
  add constraint listings_quantity_available_non_negative
    check (quantity_available >= 0) not valid,
  add constraint listings_quantity_reserved_non_negative
    check (quantity_reserved >= 0) not valid,
  add constraint listings_quantity_sold_non_negative
    check (quantity_sold >= 0) not valid,
  add constraint listings_quantity_inventory_invariant
    check (
      quantity_available + quantity_reserved + quantity_sold = quantity_total
    ) not valid,
  add constraint listings_inventory_version_non_negative
    check (inventory_version >= 0) not valid;

alter table public.offers
  add constraint offers_quantity_valid
    check (quantity between 1 and 999) not valid,
  add constraint offers_amount_divisible_by_quantity
    check (amount_pence % quantity = 0) not valid;

alter table public.payments
  add constraint payments_quantity_valid
    check (quantity between 1 and 999) not valid,
  add constraint payments_listing_unit_price_positive
    check (listing_unit_price_pence > 0) not valid,
  add constraint payments_agreed_unit_price_positive
    check (agreed_unit_price_pence > 0) not valid,
  add constraint payments_item_subtotal_positive
    check (item_subtotal_pence > 0) not valid,
  add constraint payments_item_subtotal_valid
    check (item_subtotal_pence = agreed_unit_price_pence * quantity) not valid,
  add constraint payments_amount_matches_item_subtotal
    check (amount_pence = item_subtotal_pence) not valid;

alter table public.orders
  add constraint orders_quantity_valid
    check (quantity between 1 and 999) not valid,
  add constraint orders_listing_unit_price_positive
    check (listing_unit_price_pence > 0) not valid,
  add constraint orders_agreed_unit_price_positive
    check (agreed_unit_price_pence > 0) not valid,
  add constraint orders_item_subtotal_positive
    check (item_subtotal_pence > 0) not valid,
  add constraint orders_item_subtotal_valid
    check (item_subtotal_pence = agreed_unit_price_pence * quantity) not valid,
  add constraint orders_amount_matches_item_subtotal
    check (amount_pence = item_subtotal_pence) not valid;

create index if not exists listings_available_inventory_idx
  on public.listings (status, quantity_available)
  where quantity_available > 0;

create index if not exists orders_inventory_state_idx
  on public.orders (inventory_state, listing_id);

create index if not exists payments_open_expiry_idx
  on public.payments (expires_at)
  where status in (
    'awaiting_seller_setup'::public.payment_status,
    'pending'::public.payment_status
  );

-- ---------------------------------------------------------------------------
-- 3. Guarded quantity=1 backfill. Runs only after all additive columns,
--    enum, constraints and indexes exist.
-- ---------------------------------------------------------------------------

update public.offers
set quantity = 1
where quantity is null;

update public.payments p
set
  quantity = 1,
  listing_unit_price_pence = l.price_pence,
  agreed_unit_price_pence = p.amount_pence,
  item_subtotal_pence = p.amount_pence
from public.listings l
where l.id = p.listing_id
  and (
    p.quantity is null
    or p.listing_unit_price_pence is null
    or p.agreed_unit_price_pence is null
    or p.item_subtotal_pence is null
  );

update public.orders o
set
  quantity = 1,
  listing_unit_price_pence = l.price_pence,
  agreed_unit_price_pence = o.amount_pence,
  item_subtotal_pence = o.amount_pence,
  inventory_state = case
    when o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
      and p.status in (
        'awaiting_seller_setup'::public.payment_status,
        'pending'::public.payment_status
      )
      then 'reserved'::public.order_inventory_state
    when o.fulfilment_status = 'cancelled'::public.order_fulfilment_status
      or (
        o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
        and p.status in (
          'expired'::public.payment_status,
          'cancelled'::public.payment_status
        )
      )
      then 'released'::public.order_inventory_state
    when o.fulfilment_status = 'refunded'::public.order_fulfilment_status
      and coalesce(
        o.collected_at,
        o.delivered_at,
        o.courier_collected_at,
        o.courier_delivered_at,
        o.collection_confirmed_at,
        o.buyer_confirmed_at,
        o.payout_released_at
      ) is not null
      then 'no_restock'::public.order_inventory_state
    when o.fulfilment_status = 'refunded'::public.order_fulfilment_status
      then 'restocked'::public.order_inventory_state
    else 'sold'::public.order_inventory_state
  end,
  inventory_reserved_at = case
    when o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
      and p.status in (
        'awaiting_seller_setup'::public.payment_status,
        'pending'::public.payment_status
      )
      then o.created_at
    else o.inventory_reserved_at
  end,
  inventory_sold_at = case
    when o.fulfilment_status not in (
      'awaiting_payment'::public.order_fulfilment_status,
      'cancelled'::public.order_fulfilment_status,
      'refunded'::public.order_fulfilment_status
    )
      then coalesce(p.paid_at, o.created_at)
    else o.inventory_sold_at
  end,
  inventory_released_at = case
    when o.fulfilment_status = 'cancelled'::public.order_fulfilment_status
      or (
        o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
        and p.status in (
          'expired'::public.payment_status,
          'cancelled'::public.payment_status
        )
      )
      then o.updated_at
    else o.inventory_released_at
  end,
  inventory_restocked_at = case
    when o.fulfilment_status = 'refunded'::public.order_fulfilment_status
      and coalesce(
        o.collected_at,
        o.delivered_at,
        o.courier_collected_at,
        o.courier_delivered_at,
        o.collection_confirmed_at,
        o.buyer_confirmed_at,
        o.payout_released_at
      ) is null
      then o.updated_at
    else o.inventory_restocked_at
  end,
  inventory_no_restock_at = case
    when o.fulfilment_status = 'refunded'::public.order_fulfilment_status
      and coalesce(
        o.collected_at,
        o.delivered_at,
        o.courier_collected_at,
        o.courier_delivered_at,
        o.collection_confirmed_at,
        o.buyer_confirmed_at,
        o.payout_released_at
      ) is not null
      then o.updated_at
    else o.inventory_no_restock_at
  end
from public.payments p, public.listings l
where p.id = o.payment_id
  and l.id = o.listing_id
  and (
    o.quantity is null
    or o.listing_unit_price_pence is null
    or o.agreed_unit_price_pence is null
    or o.item_subtotal_pence is null
    or o.inventory_state is null
  );

update public.listings l
set
  quantity_total = 1,
  quantity_reserved = case
    when exists (
      select 1
      from public.orders o
      where o.listing_id = l.id
        and o.inventory_state = 'reserved'::public.order_inventory_state
    ) then 1 else 0
  end,
  quantity_sold = case
    when exists (
      select 1
      from public.orders o
      where o.listing_id = l.id
        and o.inventory_state in (
          'sold'::public.order_inventory_state,
          'no_restock'::public.order_inventory_state
        )
    ) or (
      l.status = 'sold'::public.listing_status
      and not exists (
        select 1 from public.orders o where o.listing_id = l.id
      )
    ) then 1 else 0
  end,
  quantity_available = 1
    - case
        when exists (
          select 1
          from public.orders o
          where o.listing_id = l.id
            and o.inventory_state = 'reserved'::public.order_inventory_state
        ) then 1 else 0
      end
    - case
        when exists (
          select 1
          from public.orders o
          where o.listing_id = l.id
            and o.inventory_state in (
              'sold'::public.order_inventory_state,
              'no_restock'::public.order_inventory_state
            )
        ) or (
          l.status = 'sold'::public.listing_status
          and not exists (
            select 1 from public.orders o where o.listing_id = l.id
          )
        ) then 1 else 0
      end,
  inventory_version = 0
where l.quantity_total is null
   or l.quantity_available is null
   or l.quantity_reserved is null
   or l.quantity_sold is null
   or l.inventory_version is null;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.listings
  where quantity_total is null
     or quantity_available is null
     or quantity_reserved is null
     or quantity_sold is null
     or inventory_version is null
     or quantity_total < 1
     or quantity_available < 0
     or quantity_reserved < 0
     or quantity_sold < 0
     or quantity_available + quantity_reserved + quantity_sold <> quantity_total;
  if v_count <> 0 then
    raise exception 'Stage 1 backfill invariant failed for % listings', v_count;
  end if;

  select count(*) into v_count
  from public.orders
  where quantity is null
     or listing_unit_price_pence is null
     or agreed_unit_price_pence is null
     or item_subtotal_pence is null
     or inventory_state is null
     or item_subtotal_pence <> agreed_unit_price_pence * quantity
     or amount_pence <> item_subtotal_pence;
  if v_count <> 0 then
    raise exception 'Stage 1 order snapshot backfill failed for % orders', v_count;
  end if;

  select count(*) into v_count
  from public.payments
  where quantity is null
     or listing_unit_price_pence is null
     or agreed_unit_price_pence is null
     or item_subtotal_pence is null
     or item_subtotal_pence <> agreed_unit_price_pence * quantity
     or amount_pence <> item_subtotal_pence;
  if v_count <> 0 then
    raise exception 'Stage 1 payment snapshot backfill failed for % payments', v_count;
  end if;
end;
$$;

alter table public.listings
  alter column quantity_total set default 1,
  alter column quantity_total set not null,
  alter column quantity_available set default 1,
  alter column quantity_available set not null,
  alter column quantity_reserved set default 0,
  alter column quantity_reserved set not null,
  alter column quantity_sold set default 0,
  alter column quantity_sold set not null,
  alter column inventory_version set default 0,
  alter column inventory_version set not null;

alter table public.offers
  alter column quantity set default 1,
  alter column quantity set not null;

alter table public.payments
  alter column quantity set default 1,
  alter column quantity set not null,
  alter column listing_unit_price_pence set not null,
  alter column agreed_unit_price_pence set not null,
  alter column item_subtotal_pence set not null;

alter table public.orders
  alter column quantity set default 1,
  alter column quantity set not null,
  alter column listing_unit_price_pence set not null,
  alter column agreed_unit_price_pence set not null,
  alter column item_subtotal_pence set not null,
  alter column inventory_state set not null;

alter table public.listings
  validate constraint listings_quantity_total_valid,
  validate constraint listings_quantity_available_non_negative,
  validate constraint listings_quantity_reserved_non_negative,
  validate constraint listings_quantity_sold_non_negative,
  validate constraint listings_quantity_inventory_invariant,
  validate constraint listings_inventory_version_non_negative;

alter table public.offers
  validate constraint offers_quantity_valid,
  validate constraint offers_amount_divisible_by_quantity;

alter table public.payments
  validate constraint payments_quantity_valid,
  validate constraint payments_listing_unit_price_positive,
  validate constraint payments_agreed_unit_price_positive,
  validate constraint payments_item_subtotal_positive,
  validate constraint payments_item_subtotal_valid,
  validate constraint payments_amount_matches_item_subtotal;

alter table public.orders
  validate constraint orders_quantity_valid,
  validate constraint orders_listing_unit_price_positive,
  validate constraint orders_agreed_unit_price_positive,
  validate constraint orders_item_subtotal_positive,
  validate constraint orders_item_subtotal_valid,
  validate constraint orders_amount_matches_item_subtotal;

-- ---------------------------------------------------------------------------
-- 4. Inventory status/transition primitives.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_listing_inventory_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('draft'::public.listing_status, 'archived'::public.listing_status)
     and old.status is distinct from new.status
     and new.quantity_reserved > 0 then
    raise exception 'A listing with reserved inventory cannot be hidden or archived';
  end if;

  if new.status in (
    'active'::public.listing_status,
    'reserved'::public.listing_status,
    'in_progress'::public.listing_status,
    'sold'::public.listing_status
  ) then
    if new.quantity_available > 0 then
      new.status := 'active'::public.listing_status;
    elsif new.quantity_reserved > 0 then
      new.status := 'reserved'::public.listing_status;
    elsif new.quantity_sold > 0 then
      if new.status = 'sold'::public.listing_status
         or old.status = 'sold'::public.listing_status then
        new.status := 'sold'::public.listing_status;
      else
        new.status := 'in_progress'::public.listing_status;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_listing_inventory_status_trigger on public.listings;
create trigger normalize_listing_inventory_status_trigger
before update of status, quantity_total, quantity_available, quantity_reserved, quantity_sold
on public.listings
for each row
execute function public.normalize_listing_inventory_status();

create or replace function public.guard_listing_inventory_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role')
     and (
       new.quantity_total is distinct from old.quantity_total
       or new.quantity_available is distinct from old.quantity_available
       or new.quantity_reserved is distinct from old.quantity_reserved
       or new.quantity_sold is distinct from old.quantity_sold
       or new.inventory_version is distinct from old.inventory_version
     ) then
    raise exception 'Inventory fields must be changed through an inventory RPC'
      using errcode = '42501';
  end if;

  if (
    new.quantity_total is distinct from old.quantity_total
    or new.quantity_available is distinct from old.quantity_available
    or new.quantity_reserved is distinct from old.quantity_reserved
    or new.quantity_sold is distinct from old.quantity_sold
  ) and new.inventory_version <> old.inventory_version + 1 then
    raise exception 'Inventory version must increment exactly once per mutation'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_listing_inventory_write_trigger on public.listings;
create trigger guard_listing_inventory_write_trigger
before update of quantity_total, quantity_available, quantity_reserved, quantity_sold, inventory_version
on public.listings
for each row
execute function public.guard_listing_inventory_write();

create or replace function public.guard_listing_inventory_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Stage 1 keeps listing creation backwards-compatible at quantity=1.
  -- Stage 2 will replace this with the validated quantity-aware create path.
  if current_user not in ('postgres', 'service_role') then
    new.quantity_total := 1;
    new.quantity_available := 1;
    new.quantity_reserved := 0;
    new.quantity_sold := 0;
    new.inventory_version := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_listing_inventory_insert_trigger on public.listings;
create trigger guard_listing_inventory_insert_trigger
before insert on public.listings
for each row
execute function public.guard_listing_inventory_insert();

create or replace function public.transition_order_inventory_state(
  p_order_id uuid,
  p_target_state public.order_inventory_state
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_listing public.listings;
  v_available_delta integer := 0;
  v_reserved_delta integer := 0;
  v_sold_delta integer := 0;
  v_status public.listing_status;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.inventory_state = p_target_state then
    return v_order;
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_order.listing_id
  for update;

  if not found then
    raise exception 'Listing not found for order';
  end if;

  if v_order.inventory_state = 'reserved'::public.order_inventory_state
     and p_target_state = 'sold'::public.order_inventory_state then
    v_reserved_delta := -v_order.quantity;
    v_sold_delta := v_order.quantity;
  elsif v_order.inventory_state = 'reserved'::public.order_inventory_state
     and p_target_state = 'released'::public.order_inventory_state then
    v_available_delta := v_order.quantity;
    v_reserved_delta := -v_order.quantity;
  elsif v_order.inventory_state = 'sold'::public.order_inventory_state
     and p_target_state = 'restocked'::public.order_inventory_state then
    v_available_delta := v_order.quantity;
    v_sold_delta := -v_order.quantity;
  elsif v_order.inventory_state = 'sold'::public.order_inventory_state
     and p_target_state = 'no_restock'::public.order_inventory_state then
    null;
  else
    raise exception 'Invalid inventory transition: % -> %',
      v_order.inventory_state, p_target_state
      using errcode = 'P0001';
  end if;

  if v_listing.quantity_available + v_available_delta < 0
     or v_listing.quantity_reserved + v_reserved_delta < 0
     or v_listing.quantity_sold + v_sold_delta < 0 then
    raise exception 'Inventory transition would make a counter negative'
      using errcode = '23514';
  end if;

  if v_listing.status in ('draft'::public.listing_status, 'archived'::public.listing_status) then
    v_status := v_listing.status;
  elsif v_listing.quantity_available + v_available_delta > 0 then
    v_status := 'active'::public.listing_status;
  elsif v_listing.quantity_reserved + v_reserved_delta > 0 then
    v_status := 'reserved'::public.listing_status;
  elsif v_listing.quantity_sold + v_sold_delta > 0 then
    if v_listing.status = 'sold'::public.listing_status then
      v_status := 'sold'::public.listing_status;
    else
      v_status := 'in_progress'::public.listing_status;
    end if;
  else
    v_status := 'active'::public.listing_status;
  end if;

  update public.listings
  set
    quantity_available = quantity_available + v_available_delta,
    quantity_reserved = quantity_reserved + v_reserved_delta,
    quantity_sold = quantity_sold + v_sold_delta,
    inventory_version = inventory_version + 1,
    status = v_status
  where id = v_listing.id;

  update public.orders
  set
    inventory_state = p_target_state,
    inventory_sold_at = case
      when p_target_state = 'sold'::public.order_inventory_state
        then coalesce(inventory_sold_at, now())
      else inventory_sold_at
    end,
    inventory_released_at = case
      when p_target_state = 'released'::public.order_inventory_state
        then coalesce(inventory_released_at, now())
      else inventory_released_at
    end,
    inventory_restocked_at = case
      when p_target_state = 'restocked'::public.order_inventory_state
        then coalesce(inventory_restocked_at, now())
      else inventory_restocked_at
    end,
    inventory_no_restock_at = case
      when p_target_state = 'no_restock'::public.order_inventory_state
        then coalesce(inventory_no_restock_at, now())
      else inventory_no_restock_at
    end
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.transition_order_inventory_state(uuid, public.order_inventory_state) from public;
revoke all on function public.transition_order_inventory_state(uuid, public.order_inventory_state)
  from anon, authenticated, service_role;

create or replace function public.apply_refund_inventory_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.fulfilment_status is distinct from new.fulfilment_status
     and new.fulfilment_status = 'refunded'::public.order_fulfilment_status
     and new.inventory_state = 'sold'::public.order_inventory_state then
    if coalesce(
      new.collected_at,
      new.delivered_at,
      new.courier_collected_at,
      new.courier_delivered_at,
      new.collection_confirmed_at,
      new.buyer_confirmed_at,
      new.payout_released_at
    ) is null then
      perform public.transition_order_inventory_state(
        new.id,
        'restocked'::public.order_inventory_state
      );
    else
      perform public.transition_order_inventory_state(
        new.id,
        'no_restock'::public.order_inventory_state
      );
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists apply_refund_inventory_transition_trigger on public.orders;
create trigger apply_refund_inventory_transition_trigger
after update of fulfilment_status on public.orders
for each row
execute function public.apply_refund_inventory_transition();

-- ---------------------------------------------------------------------------
-- 5. Offer quantity integrity and atomic acceptance.
-- ---------------------------------------------------------------------------

create or replace function public.set_offer_thread_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.offers;
begin
  if new.parent_offer_id is not null then
    select *
    into v_parent
    from public.offers
    where id = new.parent_offer_id;

    if not found then
      raise exception 'Parent offer not found';
    end if;

    if v_parent.listing_id <> new.listing_id
       or v_parent.buyer_id <> new.buyer_id
       or v_parent.seller_id <> new.seller_id then
      raise exception 'Counter-offer must remain in the same negotiation thread';
    end if;

    new.quantity := v_parent.quantity;
  end if;

  if new.quantity is null or new.quantity < 1 or new.quantity > 999 then
    raise exception 'Offer quantity must be between 1 and 999';
  end if;

  if new.amount_pence % new.quantity <> 0 then
    raise exception 'Offer total must divide evenly by quantity';
  end if;

  return new;
end;
$$;

drop trigger if exists set_offer_thread_quantity_trigger on public.offers;
create trigger set_offer_thread_quantity_trigger
before insert or update of parent_offer_id, quantity, amount_pence
on public.offers
for each row
execute function public.set_offer_thread_quantity();

create or replace function public.validate_buyer_offer_amount()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_listing_price integer;
  v_direction text;
begin
  v_direction := coalesce(new.direction, 'buyer_to_seller');

  if v_direction <> 'buyer_to_seller' then
    return new;
  end if;

  select l.price_pence
  into v_listing_price
  from public.listings l
  where l.id = new.listing_id;

  if v_listing_price is null then
    raise exception 'Listing not found';
  end if;

  if new.amount_pence > v_listing_price * new.quantity then
    raise exception 'Offers cannot be higher than the asking price.';
  end if;

  return new;
end;
$$;

create or replace function public.create_payment_and_order_for_accepted_offer(
  p_offer public.offers
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.listings;
  v_item_subtotal_pence integer;
  v_agreed_unit_price_pence integer;
  v_protection_fee_pence integer;
  v_seller_service_fee_pence integer;
  v_seller_net_pence integer;
  v_buyer_total_pence integer;
  v_order_type public.order_type;
  v_payment_id uuid;
begin
  if p_offer.status <> 'accepted'::public.offer_status then
    raise exception 'Accepted offer required';
  end if;

  if p_offer.quantity < 1
     or p_offer.amount_pence <= 0
     or p_offer.amount_pence % p_offer.quantity <> 0 then
    raise exception 'Invalid offer quantity or indivisible total';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_offer.listing_id;

  if not found then
    raise exception 'Listing not found';
  end if;

  v_item_subtotal_pence := p_offer.amount_pence;
  v_agreed_unit_price_pence := p_offer.amount_pence / p_offer.quantity;
  v_protection_fee_pence := public.calculate_buyer_protection_fee(v_item_subtotal_pence);
  v_seller_service_fee_pence := public.calculate_seller_service_fee(v_item_subtotal_pence);
  v_seller_net_pence := public.calculate_seller_net_payout(v_item_subtotal_pence);
  v_buyer_total_pence := v_item_subtotal_pence + v_protection_fee_pence;
  v_order_type := public.auto_order_type_for_listing(p_offer.listing_id);

  insert into public.payments (
    offer_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    quantity,
    listing_unit_price_pence,
    agreed_unit_price_pence,
    item_subtotal_pence,
    buyer_protection_fee_pence,
    buyer_total_pence,
    platform_fee_pence,
    seller_service_fee_pence,
    seller_net_pence,
    status,
    expires_at
  )
  values (
    p_offer.id,
    p_offer.listing_id,
    p_offer.buyer_id,
    p_offer.seller_id,
    v_item_subtotal_pence,
    p_offer.quantity,
    v_listing.price_pence,
    v_agreed_unit_price_pence,
    v_item_subtotal_pence,
    v_protection_fee_pence,
    v_buyer_total_pence,
    v_protection_fee_pence,
    v_seller_service_fee_pence,
    v_seller_net_pence,
    'pending'::public.payment_status,
    now() + interval '72 hours'
  )
  returning id into v_payment_id;

  insert into public.orders (
    offer_id,
    payment_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    quantity,
    listing_unit_price_pence,
    agreed_unit_price_pence,
    item_subtotal_pence,
    item_price_pence,
    buyer_protection_fee_pence,
    buyer_total_pence,
    platform_fee_pence,
    seller_service_fee_pence,
    seller_net_pence,
    order_type,
    fulfilment_status,
    payout_status,
    dispute_window_hours,
    protection_status,
    inventory_state,
    inventory_reserved_at
  )
  values (
    p_offer.id,
    v_payment_id,
    p_offer.listing_id,
    p_offer.buyer_id,
    p_offer.seller_id,
    v_item_subtotal_pence,
    p_offer.quantity,
    v_listing.price_pence,
    v_agreed_unit_price_pence,
    v_item_subtotal_pence,
    v_item_subtotal_pence,
    v_protection_fee_pence,
    v_buyer_total_pence,
    v_protection_fee_pence,
    v_seller_service_fee_pence,
    v_seller_net_pence,
    v_order_type,
    'awaiting_payment'::public.order_fulfilment_status,
    'not_due'::public.payout_status,
    24,
    'active',
    'reserved'::public.order_inventory_state,
    now()
  );

  return v_payment_id;
end;
$$;

revoke all on function public.create_payment_and_order_for_accepted_offer(public.offers) from public;
revoke all on function public.create_payment_and_order_for_accepted_offer(public.offers)
  from anon, authenticated, service_role;

create or replace function public.accept_offer_with_inventory(
  p_offer_id uuid,
  p_expected_direction text
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_listing public.listings;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_expected_direction not in ('buyer_to_seller', 'seller_to_buyer') then
    raise exception 'Invalid offer direction';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.direction <> p_expected_direction then
    raise exception 'Offer direction does not match acceptance flow';
  end if;

  if p_expected_direction = 'buyer_to_seller' and v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can accept this offer';
  end if;

  if p_expected_direction = 'seller_to_buyer' and v_offer.buyer_id <> v_uid then
    raise exception 'Only the buyer can accept this counter-offer';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be accepted';
  end if;

  if v_offer.quantity < 1
     or v_offer.amount_pence <= 0
     or v_offer.amount_pence % v_offer.quantity <> 0 then
    raise exception 'Invalid offer quantity or indivisible total';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_offer.listing_id
  for update;

  if not found or v_listing.seller_id <> v_offer.seller_id then
    raise exception 'Listing not found or seller mismatch';
  end if;

  if v_listing.status <> 'active'::public.listing_status
     or v_listing.quantity_available < v_offer.quantity then
    raise exception 'Insufficient inventory: requested %, available %',
      v_offer.quantity, coalesce(v_listing.quantity_available, 0)
      using errcode = 'P0001';
  end if;

  update public.listings
  set
    quantity_available = quantity_available - v_offer.quantity,
    quantity_reserved = quantity_reserved + v_offer.quantity,
    inventory_version = inventory_version + 1,
    status = case
      when quantity_available - v_offer.quantity > 0
        then 'active'::public.listing_status
      else 'reserved'::public.listing_status
    end
  where id = v_listing.id;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = v_offer.id;

  perform public.create_payment_and_order_for_accepted_offer(
    (select o from public.offers o where o.id = v_offer.id)
  );

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      case
        when p_expected_direction = 'seller_to_buyer'
          then 'Counter-offer accepted.'
        else 'Offer accepted.'
      end
    );
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

revoke all on function public.accept_offer_with_inventory(uuid, text) from public;
revoke all on function public.accept_offer_with_inventory(uuid, text)
  from anon, authenticated, service_role;

create or replace function public.accept_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.accept_offer_with_inventory(p_offer_id, 'buyer_to_seller');
end;
$$;

create or replace function public.accept_counter_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.accept_offer_with_inventory(p_offer_id, 'seller_to_buyer');
end;
$$;

revoke all on function public.accept_offer(uuid) from public, anon;
grant execute on function public.accept_offer(uuid) to authenticated, service_role;
revoke all on function public.accept_counter_offer(uuid) from public, anon;
grant execute on function public.accept_counter_offer(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Seller quantity edit RPC (row lock + optimistic version check).
-- ---------------------------------------------------------------------------

create or replace function public.update_listing_quantity(
  p_listing_id uuid,
  p_new_total integer,
  p_expected_inventory_version bigint
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_min_total integer;
  v_status public.listing_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_total is null or p_new_total < 1 or p_new_total > 999 then
    raise exception 'Quantity total must be between 1 and 999';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_listing.seller_id <> v_uid then
    raise exception 'Only the seller can update listing quantity';
  end if;

  if v_listing.inventory_version <> p_expected_inventory_version then
    raise exception 'Inventory was changed by another transaction; refresh and retry'
      using errcode = '40001';
  end if;

  v_min_total := v_listing.quantity_reserved + v_listing.quantity_sold;
  if p_new_total < v_min_total then
    raise exception 'Quantity total cannot be below reserved + sold (%)', v_min_total;
  end if;

  if v_listing.status in ('draft'::public.listing_status, 'archived'::public.listing_status) then
    v_status := v_listing.status;
  elsif p_new_total - v_min_total > 0 then
    v_status := 'active'::public.listing_status;
  elsif v_listing.quantity_reserved > 0 then
    v_status := 'reserved'::public.listing_status;
  elsif v_listing.quantity_sold > 0 then
    v_status := case
      when v_listing.status = 'sold'::public.listing_status
        then 'sold'::public.listing_status
      else 'in_progress'::public.listing_status
    end;
  else
    v_status := 'active'::public.listing_status;
  end if;

  update public.listings
  set
    quantity_total = p_new_total,
    quantity_available = p_new_total - quantity_reserved - quantity_sold,
    inventory_version = inventory_version + 1,
    status = v_status
  where id = p_listing_id
  returning * into v_listing;

  return v_listing;
end;
$$;

revoke all on function public.update_listing_quantity(uuid, integer, bigint) from public, anon;
revoke all on function public.update_listing_quantity(uuid, integer, bigint)
  from authenticated;
grant execute on function public.update_listing_quantity(uuid, integer, bigint)
  to service_role;

-- ---------------------------------------------------------------------------
-- 7. Payment capture, cancellation and expiry become inventory-state guarded.
-- ---------------------------------------------------------------------------

create or replace function public.mark_payment_captured(
  p_payment_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_next_fulfilment public.order_fulfilment_status;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status = 'paid'::public.payment_status then
    return v_payment;
  end if;

  if v_payment.status <> 'pending'::public.payment_status then
    raise exception 'Payment cannot be captured from status %', v_payment.status;
  end if;

  if v_payment.expires_at <= now() then
    raise exception 'Payment reservation has expired; manual reconciliation required';
  end if;

  if not exists (
    select 1
    from public.offers o
    where o.id = v_payment.offer_id
      and o.status = 'accepted'::public.offer_status
  ) then
    raise exception 'Accepted offer required before payment can be captured';
  end if;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Order not found for payment';
  end if;

  if v_order.inventory_state <> 'reserved'::public.order_inventory_state then
    raise exception 'Order reservation is not active; manual reconciliation required';
  end if;

  if v_order.order_type is null then
    raise exception 'Order fulfilment method must be selected before payment capture';
  end if;

  if not public.listing_allows_order_type(
    v_payment.listing_id,
    v_order.order_type,
    v_payment.buyer_id
  ) then
    raise exception 'Order fulfilment method is not allowed for this listing';
  end if;

  perform public.transition_order_inventory_state(
    v_order.id,
    'sold'::public.order_inventory_state
  );

  update public.payments
  set
    status = 'paid'::public.payment_status,
    stripe_checkout_session_id = coalesce(
      p_stripe_checkout_session_id,
      stripe_checkout_session_id
    ),
    stripe_payment_intent_id = coalesce(
      p_stripe_payment_intent_id,
      stripe_payment_intent_id
    ),
    stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
    paid_at = coalesce(paid_at, now())
  where id = p_payment_id;

  v_next_fulfilment := public.initial_fulfilment_status_for_order_type(v_order.order_type);

  update public.orders
  set
    fulfilment_status = v_next_fulfilment,
    payout_status = 'not_due'::public.payout_status,
    payout_release_at = null,
    protection_status = coalesce(protection_status, 'active')
  where id = v_order.id
    and fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

revoke all on function public.mark_payment_captured(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_payment_captured(uuid, text, text, text)
  to service_role;

revoke all on function public.mark_payment_paid(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_payment_paid(uuid, text, text)
  to service_role;

create or replace function public.expire_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status not in (
    'awaiting_seller_setup'::public.payment_status,
    'pending'::public.payment_status
  ) then
    return v_payment;
  end if;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Order not found for payment';
  end if;

  if v_order.inventory_state = 'reserved'::public.order_inventory_state then
    perform public.transition_order_inventory_state(
      v_order.id,
      'released'::public.order_inventory_state
    );
  elsif v_order.inventory_state <> 'released'::public.order_inventory_state then
    raise exception 'Payment cannot expire from inventory state %', v_order.inventory_state;
  end if;

  update public.payments
  set status = 'expired'::public.payment_status
  where id = p_payment_id;

  update public.orders
  set
    fulfilment_status = 'cancelled'::public.order_fulfilment_status,
    payout_status = 'cancelled'::public.payout_status
  where id = v_order.id;

  select * into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

create or replace function public.cancel_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.status = 'paid'::public.payment_status then
    raise exception 'Paid payments cannot be cancelled';
  end if;

  if v_payment.status in (
    'cancelled'::public.payment_status,
    'expired'::public.payment_status
  ) then
    return v_payment;
  end if;

  select *
  into v_order
  from public.orders
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Order not found for payment';
  end if;

  if v_order.inventory_state = 'reserved'::public.order_inventory_state then
    perform public.transition_order_inventory_state(
      v_order.id,
      'released'::public.order_inventory_state
    );
  elsif v_order.inventory_state <> 'released'::public.order_inventory_state then
    raise exception 'Payment cannot cancel from inventory state %', v_order.inventory_state;
  end if;

  update public.payments
  set status = 'cancelled'::public.payment_status
  where id = p_payment_id;

  update public.orders
  set
    fulfilment_status = 'cancelled'::public.order_fulfilment_status,
    payout_status = 'cancelled'::public.payout_status
  where id = v_order.id;

  select * into v_payment
  from public.payments
  where id = p_payment_id;

  return v_payment;
end;
$$;

create or replace function public.cancel_accepted_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_payment public.payments;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can cancel this accepted offer';
  end if;

  if v_offer.status = 'cancelled'::public.offer_status then
    return v_offer;
  end if;

  if v_offer.status <> 'accepted'::public.offer_status then
    raise exception 'Only accepted offers can be cancelled';
  end if;

  select *
  into v_payment
  from public.payments
  where offer_id = p_offer_id
  for update;

  if not found then
    raise exception 'Payment not found for this offer';
  end if;

  if v_payment.status = 'paid'::public.payment_status then
    raise exception 'This transaction has been paid. Contact support to request cancellation or open a dispute.';
  end if;

  perform public.cancel_payment(v_payment.id);

  update public.offers
  set status = 'cancelled'::public.offer_status
  where id = p_offer_id;

  select * into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

revoke all on function public.expire_payment(uuid) from public, anon, authenticated;
grant execute on function public.expire_payment(uuid) to service_role;
revoke all on function public.cancel_payment(uuid) from public, anon, authenticated;
grant execute on function public.cancel_payment(uuid) to service_role;
revoke all on function public.cancel_accepted_offer(uuid) from public, anon;
grant execute on function public.cancel_accepted_offer(uuid) to authenticated, service_role;

create or replace function public.release_expired_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_count integer := 0;
begin
  for v_payment_id in
    select id
    from public.payments
    where status in (
      'awaiting_seller_setup'::public.payment_status,
      'pending'::public.payment_status
    )
      and expires_at <= now()
    order by expires_at
    for update skip locked
  loop
    perform public.expire_payment(v_payment_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.release_expired_payments()
  from public, anon, authenticated;
grant execute on function public.release_expired_payments() to service_role;

-- ---------------------------------------------------------------------------
-- 8. Visibility/RLS: stock is authoritative and inventory writes use RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.listing_is_publicly_visible(
  p_listing public.listings
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_listing.status = 'active'::public.listing_status
    and p_listing.quantity_available > 0
    and (
      p_listing.source is distinct from 'import'::public.listing_source
      or public.listing_has_images(p_listing.id)
    );
$$;

comment on function public.listing_is_publicly_visible(public.listings) is
  'True when an active listing has available inventory and is browsable. Import listings also need an image.';

drop policy if exists "Buyers can create buyer offers on active listings"
  on public.offers;

create policy "Buyers can create buyer offers on active listings"
  on public.offers for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and direction = 'buyer_to_seller'
    and quantity between 1 and 999
    and amount_pence > 0
    and amount_pence % quantity = 0
    and exists (
      select 1
      from public.listings l
      where l.id = offers.listing_id
        and l.seller_id = offers.seller_id
        and public.listing_is_publicly_visible(l)
        and l.quantity_available >= offers.quantity
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Mandatory five-minute expiry schedule.
-- ---------------------------------------------------------------------------

do $$
declare
  v_job_id bigint;
  v_cron_database text := coalesce(
    nullif(current_setting('cron.database_name', true), ''),
    'postgres'
  );
begin
  if current_database() <> v_cron_database then
    raise notice
      'Skipping pg_cron schedule in isolated validation database % (cron database is %)',
      current_database(),
      v_cron_database;
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'equipd-release-expired-payments'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'equipd-release-expired-payments',
    '*/5 * * * *',
    'select public.release_expired_payments();'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Final transactional proof. Any failure rolls back the whole migration.
-- ---------------------------------------------------------------------------

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.listings
  where quantity_total < 1
     or quantity_available < 0
     or quantity_reserved < 0
     or quantity_sold < 0
     or quantity_available + quantity_reserved + quantity_sold <> quantity_total;
  if v_count <> 0 then
    raise exception 'Final inventory invariant failed for % listings', v_count;
  end if;

  select count(*) into v_count
  from public.offers
  where quantity < 1
     or amount_pence <= 0
     or amount_pence % quantity <> 0;
  if v_count <> 0 then
    raise exception 'Final offer quantity invariant failed for % offers', v_count;
  end if;

  select count(*) into v_count
  from public.orders
  where quantity < 1
     or agreed_unit_price_pence <= 0
     or item_subtotal_pence <> agreed_unit_price_pence * quantity
     or amount_pence <> item_subtotal_pence
     or inventory_state is null;
  if v_count <> 0 then
    raise exception 'Final order snapshot invariant failed for % orders', v_count;
  end if;

  select count(*) into v_count
  from public.payments
  where quantity < 1
     or agreed_unit_price_pence <= 0
     or item_subtotal_pence <> agreed_unit_price_pence * quantity
     or amount_pence <> item_subtotal_pence;
  if v_count <> 0 then
    raise exception 'Final payment snapshot invariant failed for % payments', v_count;
  end if;

  if current_database() = coalesce(
    nullif(current_setting('cron.database_name', true), ''),
    'postgres'
  ) then
    if not exists (
      select 1
      from cron.job
      where jobname = 'equipd-release-expired-payments'
        and schedule = '*/5 * * * *'
        and active
    ) then
      raise exception 'Expiry schedule was not created or is inactive';
    end if;
  end if;
end;
$$;

