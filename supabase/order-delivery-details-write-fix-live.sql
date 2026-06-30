-- Definitive fix: order_delivery_details buyer writes on live Supabase
-- Run after order-delivery-details-rls-fix.sql
--
-- Verified live failure (buyer INSERT on order 2bac67ec-…):
--   code: 42501
--   message: permission denied for table orders
--
-- Cause: enforce_order_delivery_details_buyer_only() still runs as INVOKER and
-- SELECTs public.orders. Clients cannot SELECT orders (prelaunch-security-fixes).
--
-- RLS insert/update policies already enforce buyer ownership + writable status
-- via SECURITY DEFINER helpers. The enforce_* triggers are redundant — remove them.

-- ---------------------------------------------------------------------------
-- Remove broken redundant write guard triggers
-- ---------------------------------------------------------------------------

drop trigger if exists order_delivery_details_enforce_buyer_only_insert
  on public.order_delivery_details;

drop trigger if exists order_delivery_details_enforce_buyer_only_update
  on public.order_delivery_details;

drop function if exists public.enforce_order_delivery_details_buyer_only();

-- ---------------------------------------------------------------------------
-- Writable guard (SECURITY DEFINER — used by RLS policies)
-- ---------------------------------------------------------------------------

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
      and o.fulfilment_status in (
        'awaiting_seller_delivery'::public.order_fulfilment_status,
        'paid'::public.order_fulfilment_status
      )
      and o.collected_at is null
      and o.collection_confirmed_at is null
  );
$$;

revoke all on function public.is_seller_delivery_order_writable(uuid) from public;
grant execute on function public.is_seller_delivery_order_writable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Re-assert RLS policies (idempotent)
-- ---------------------------------------------------------------------------

alter table public.order_delivery_details enable row level security;

drop policy if exists "Buyers can read own order delivery details"
  on public.order_delivery_details;

create policy "Buyers can read own order delivery details"
  on public.order_delivery_details for select
  to authenticated
  using (public.order_delivery_details_buyer_owns_order(order_id));

drop policy if exists "Sellers can read order delivery details for their seller delivery orders"
  on public.order_delivery_details;

create policy "Sellers can read order delivery details for their seller delivery orders"
  on public.order_delivery_details for select
  to authenticated
  using (public.order_delivery_details_seller_can_read(order_id));

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
    public.order_delivery_details_buyer_owns_order(order_id)
    and public.is_seller_delivery_order_writable(order_id)
  );

drop policy if exists "Buyers can update order delivery details"
  on public.order_delivery_details;

create policy "Buyers can update order delivery details"
  on public.order_delivery_details for update
  to authenticated
  using (
    public.order_delivery_details_buyer_owns_order(order_id)
    and public.is_seller_delivery_order_writable(order_id)
  )
  with check (
    public.order_delivery_details_buyer_owns_order(order_id)
    and public.is_seller_delivery_order_writable(order_id)
  );

revoke all on table public.order_delivery_details from public;
grant select, insert, update on table public.order_delivery_details to authenticated;

-- ---------------------------------------------------------------------------
-- Verification (should show security_definer = true for helpers, no enforce trigger)
-- ---------------------------------------------------------------------------

select
  p.proname,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'order_delivery_details_buyer_owns_order',
    'is_seller_delivery_order_writable'
  );

select tg.tgname
from pg_trigger tg
join pg_class c on c.oid = tg.tgrelid
where c.relname = 'order_delivery_details'
  and not tg.tgisinternal
order by tg.tgname;
