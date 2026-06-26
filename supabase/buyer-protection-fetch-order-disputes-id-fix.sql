-- Fix ambiguous `id` in fetch_order_disputes (RETURNS TABLE output column shadows orders.id)
-- Run if buyer-protection-phase4c-dispute-admin-resolution.sql was already applied.

create or replace function public.fetch_order_disputes(p_order_id uuid)
returns table (
  id uuid,
  order_id uuid,
  buyer_id uuid,
  seller_id uuid,
  listing_id uuid,
  reason text,
  description text,
  evidence_paths text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  seller_response text,
  seller_response_at timestamptz,
  seller_response_evidence_paths text[],
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if not v_is_admin
     and v_order.buyer_id <> v_uid
     and v_order.seller_id <> v_uid then
    raise exception 'You do not have access to this order';
  end if;

  return query
  select
    d.id,
    d.order_id,
    d.buyer_id,
    d.seller_id,
    d.listing_id,
    d.reason,
    d.description,
    d.evidence_paths,
    d.status,
    d.created_at,
    d.updated_at,
    d.seller_response,
    d.seller_response_at,
    d.seller_response_evidence_paths,
    case when v_is_admin then d.admin_note else null end as admin_note,
    d.resolved_at,
    d.resolved_by,
    case
      when v_is_admin then d.resolution
      when d.status in ('resolved_buyer', 'resolved_seller') then d.resolution
      else null
    end as resolution
  from public.order_disputes d
  where d.order_id = p_order_id
  order by d.created_at desc;
end;
$$;

revoke all on function public.fetch_order_disputes(uuid) from public;
grant execute on function public.fetch_order_disputes(uuid) to authenticated;

notify pgrst, 'reload schema';
