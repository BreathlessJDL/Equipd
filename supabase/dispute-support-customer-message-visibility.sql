-- Expose customer-facing Equipd messages to order participants (not internal admin notes).
-- Run after dispute-support-simplified-02-schema-functions.sql

drop function if exists public.fetch_order_disputes(uuid);

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
  resolution text,
  refund_amount_pence integer,
  customer_message text
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
      when d.status in (
        'resolved_buyer', 'resolved_seller', 'resolved', 'rejected',
        'refund_pending', 'partial_refund_pending'
      ) then coalesce(d.customer_message, d.resolution)
      else d.customer_message
    end as resolution,
    case when v_is_admin then d.refund_amount_pence else null end as refund_amount_pence,
    coalesce(
      nullif(trim(d.customer_message), ''),
      case
        when nullif(trim(d.resolution), '') is not null
          and d.status <> 'open'
        then trim(d.resolution)
        else null
      end
    ) as customer_message
  from public.order_disputes d
  where d.order_id = p_order_id
  order by d.created_at desc;
end;
$$;

revoke all on function public.fetch_order_disputes(uuid) from public;
grant execute on function public.fetch_order_disputes(uuid) to authenticated;

drop function if exists public.fetch_order_support_requests(uuid);

create or replace function public.fetch_order_support_requests(p_order_id uuid)
returns table (
  id uuid,
  order_id uuid,
  listing_id uuid,
  buyer_id uuid,
  seller_id uuid,
  opened_by uuid,
  reason public.support_request_reason,
  message text,
  status public.support_request_status,
  evidence_paths text[],
  resolution_notes text,
  refund_amount_pence integer,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not v_is_admin and not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = v_uid or o.seller_id = v_uid)
  ) then
    raise exception 'You do not have access to this order';
  end if;

  return query
  select
    r.id,
    r.order_id,
    r.listing_id,
    r.buyer_id,
    r.seller_id,
    r.opened_by,
    r.reason,
    r.message,
    r.status,
    r.evidence_paths,
    case
      when v_is_admin then r.resolution_notes
      when nullif(trim(r.resolution_notes), '') is not null
        and r.status <> 'open'::public.support_request_status
      then trim(r.resolution_notes)
      else null
    end as resolution_notes,
    case when v_is_admin then r.refund_amount_pence else null end as refund_amount_pence,
    r.created_at,
    r.updated_at,
    r.resolved_at
  from public.transaction_support_requests r
  where r.order_id = p_order_id
  order by r.created_at desc;
end;
$$;

revoke all on function public.fetch_order_support_requests(uuid) from public;
grant execute on function public.fetch_order_support_requests(uuid) to authenticated;
