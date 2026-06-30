-- Fix order_delivery_details write path after orders SELECT revoked from clients
-- Run after order-delivery-details-rls-fix.sql
--
-- Problem: enforce_order_delivery_details_buyer_only() queries public.orders as the
-- invoking buyer (no table SELECT permission), so INSERT/UPDATE fail with
-- "permission denied for table orders" even when RLS policies pass.
--
-- Fix: SECURITY DEFINER trigger using the same helpers as RLS policies.

create or replace function public.enforce_order_delivery_details_buyer_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.order_delivery_details_buyer_owns_order(coalesce(NEW.order_id, OLD.order_id)) then
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

revoke all on function public.enforce_order_delivery_details_buyer_only() from public;

-- Allow writable while awaiting seller delivery, and legacy paid seller-delivery rows.
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
