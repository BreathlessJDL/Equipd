-- Fix order_delivery_details RLS after orders SELECT revoked from clients
-- Run after fulfilment-architecture-phase1-schema.sql
-- (and seller-delivery-buyer-details-extension.sql if using extended columns)
--
-- Problem: policies that query public.orders directly fail with
-- "permission denied for table orders" because authenticated users read orders
-- via orders_client / RPCs only (prelaunch-security-fixes.sql).
--
-- Fix: SECURITY DEFINER helpers + policies that call them.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.order_delivery_details_buyer_owns_order(
  p_order_id uuid,
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
    where o.id = p_order_id
      and o.buyer_id = p_user_id
  );
$$;

revoke all on function public.order_delivery_details_buyer_owns_order(uuid, uuid) from public;
grant execute on function public.order_delivery_details_buyer_owns_order(uuid, uuid) to authenticated;

create or replace function public.order_delivery_details_seller_can_read(
  p_order_id uuid,
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
    where o.id = p_order_id
      and o.seller_id = p_user_id
      and coalesce(o.order_type, 'collection'::public.order_type)
        = 'seller_delivery'::public.order_type
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status <> 'cancelled'::public.order_fulfilment_status
  );
$$;

revoke all on function public.order_delivery_details_seller_can_read(uuid, uuid) from public;
grant execute on function public.order_delivery_details_seller_can_read(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- order_delivery_details — RLS (replace direct orders subqueries)
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
