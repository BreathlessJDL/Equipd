-- Equipd admin order management
-- Run after admin-support-tools.sql
--
-- Adds admin read access on orders and admin_list_orders() RPC.

-- ---------------------------------------------------------------------------
-- Admin read access on orders
-- ---------------------------------------------------------------------------

create policy "Admins can read all orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin list orders
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_orders(
  p_filter text default 'all'
)
returns table (
  id uuid,
  listing_id uuid,
  listing_title text,
  buyer_id uuid,
  buyer_display_name text,
  seller_id uuid,
  seller_display_name text,
  amount_pence int,
  payment_status public.payment_status,
  fulfilment_status public.order_fulfilment_status,
  payout_status public.payout_status,
  buyer_confirmed_at timestamptz,
  seller_onboarding_complete boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_filter is not null
    and p_filter not in (
      'all',
      'awaiting_payment',
      'paid_in_progress',
      'buyer_confirmed',
      'completed',
      'payout_failed',
      'cancelled'
    ) then
    raise exception 'Invalid order filter: %', p_filter;
  end if;

  return query
  select
    o.id,
    o.listing_id,
    l.title as listing_title,
    o.buyer_id,
    buyer.display_name as buyer_display_name,
    o.seller_id,
    seller.display_name as seller_display_name,
    o.amount_pence,
    p.status as payment_status,
    o.fulfilment_status,
    o.payout_status,
    o.buyer_confirmed_at,
    coalesce(seller.stripe_onboarding_complete, false) as seller_onboarding_complete,
    o.created_at
  from public.orders o
  join public.listings l on l.id = o.listing_id
  join public.payments p on p.id = o.payment_id
  join public.profiles buyer on buyer.id = o.buyer_id
  join public.profiles seller on seller.id = o.seller_id
  where
    p_filter is null
    or p_filter = 'all'
    or (
      p_filter = 'awaiting_payment'
      and o.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
    )
    or (
      p_filter = 'paid_in_progress'
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status in (
        'paid'::public.order_fulfilment_status,
        'in_progress'::public.order_fulfilment_status
      )
    )
    or (
      p_filter = 'buyer_confirmed'
      and o.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status
    )
    or (
      p_filter = 'completed'
      and o.fulfilment_status = 'completed'::public.order_fulfilment_status
    )
    or (
      p_filter = 'payout_failed'
      and o.payout_status = 'failed'::public.payout_status
    )
    or (
      p_filter = 'cancelled'
      and (
        o.fulfilment_status = 'cancelled'::public.order_fulfilment_status
        or p.status in (
          'cancelled'::public.payment_status,
          'expired'::public.payment_status,
          'refunded'::public.payment_status
        )
      )
    )
  order by o.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.admin_list_orders(text) from public;
grant execute on function public.admin_list_orders(text) to authenticated;
