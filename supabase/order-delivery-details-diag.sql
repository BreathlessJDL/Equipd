-- Read-only diagnostics for order_delivery_details write failures.
-- Run in Supabase SQL editor. Replace order id if needed.

\set order_id '2bac67ec-398a-473e-82b8-3388b4f6e571'

-- 1) Order + payment state
select
  o.id,
  o.buyer_id,
  o.seller_id,
  o.order_type,
  o.fulfilment_status,
  o.collected_at,
  o.collection_confirmed_at,
  p.status as payment_status
from public.orders o
join public.payments p on p.id = o.payment_id
where o.id = :'order_id'::uuid;

-- 2) Helper results for buyer on this order
select
  public.is_seller_delivery_order_writable(:'order_id'::uuid) as is_writable,
  public.order_delivery_details_buyer_owns_order(
    :'order_id'::uuid,
    (select buyer_id from public.orders where id = :'order_id'::uuid)
  ) as buyer_owns_order;

-- 3) Trigger function security + definition
select
  p.proname,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'enforce_order_delivery_details_buyer_only',
    'set_order_delivery_details_submitted_at',
    'is_seller_delivery_order_writable',
    'order_delivery_details_buyer_owns_order'
  );

-- 4) Triggers on order_delivery_details
select
  tg.tgname,
  pg_get_triggerdef(tg.oid, true) as trigger_def
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'order_delivery_details'
  and not tg.tgisinternal;

-- 5) RLS policies
select
  pol.polname as policy_name,
  pol.polcmd as command,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expr
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'order_delivery_details';

-- 6) Table columns + constraints
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'order_delivery_details'
order by ordinal_position;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.order_delivery_details'::regclass;

-- 7) Existing row
select * from public.order_delivery_details where order_id = :'order_id'::uuid;
