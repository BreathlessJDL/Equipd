-- Equipd Buyer Protection / Order Lifecycle — Phase 1a (enums only)
-- Run after stripe-payments-phase3a.sql and offer-messaging-flow.sql
--
-- IMPORTANT: Run this script alone in Supabase SQL Editor, then run phase1b in a
-- separate execution. PostgreSQL cannot use newly added enum values in the same
-- transaction/script before commit (error 55P04).
--
-- Safe to re-run (idempotent).

-- ---------------------------------------------------------------------------
-- order_fulfilment_status — new lifecycle values
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'awaiting_collection'
  ) then
    alter type public.order_fulfilment_status add value 'awaiting_collection';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'awaiting_courier_collection'
  ) then
    alter type public.order_fulfilment_status add value 'awaiting_courier_collection';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'collected'
  ) then
    alter type public.order_fulfilment_status add value 'collected';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'in_transit'
  ) then
    alter type public.order_fulfilment_status add value 'in_transit';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'delivered'
  ) then
    alter type public.order_fulfilment_status add value 'delivered';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'awaiting_payout'
  ) then
    alter type public.order_fulfilment_status add value 'awaiting_payout';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'refunded'
  ) then
    alter type public.order_fulfilment_status add value 'refunded';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- order_type enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_type'
  ) then
    create type public.order_type as enum (
      'collection',
      'seller_delivery',
      'buyer_courier'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Verification (read-only; no casts to new values in function bodies)
-- ---------------------------------------------------------------------------

select
  t.typname as enum_type,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
from pg_enum e
join pg_type t on e.enumtypid = t.oid
join pg_namespace n on t.typnamespace = n.oid
where n.nspname = 'public'
  and t.typname in ('order_fulfilment_status', 'order_type')
order by t.typname, e.enumsortorder;
