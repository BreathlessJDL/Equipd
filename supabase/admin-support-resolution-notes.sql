-- Equipd admin support resolution notes
-- Run after admin-order-management.sql
--
-- Adds admin/resolution note fields, participant-safe fetch RPC,
-- and admin_update_support_request() with review timestamps.

-- ---------------------------------------------------------------------------
-- Extend transaction_support_requests
-- ---------------------------------------------------------------------------

alter table public.transaction_support_requests
  add column if not exists admin_notes text,
  add column if not exists resolution_notes text,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz;

-- ---------------------------------------------------------------------------
-- Participants must use fetch_order_support_requests(); hide admin_notes
-- ---------------------------------------------------------------------------

drop policy if exists "Order participants can read support requests"
  on public.transaction_support_requests;

-- ---------------------------------------------------------------------------
-- Participant-safe support request list for an order
-- ---------------------------------------------------------------------------

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
  resolution_notes text,
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
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
    case
      when r.status in (
        'resolved'::public.support_request_status,
        'closed'::public.support_request_status
      ) then r.resolution_notes
      else null
    end as resolution_notes,
    r.created_at,
    r.updated_at,
    r.resolved_at
  from public.transaction_support_requests r
  where r.order_id = p_order_id
  order by r.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin list support requests (extended)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_support_requests(
  p_status public.support_request_status default null
)
returns table (
  id uuid,
  order_id uuid,
  listing_id uuid,
  listing_title text,
  buyer_id uuid,
  buyer_display_name text,
  seller_id uuid,
  seller_display_name text,
  opened_by uuid,
  opened_by_display_name text,
  reason public.support_request_reason,
  message text,
  status public.support_request_status,
  admin_notes text,
  resolution_notes text,
  reviewed_by uuid,
  reviewed_by_display_name text,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  select
    r.id,
    r.order_id,
    r.listing_id,
    l.title as listing_title,
    r.buyer_id,
    buyer.display_name as buyer_display_name,
    r.seller_id,
    seller.display_name as seller_display_name,
    r.opened_by,
    opener.display_name as opened_by_display_name,
    r.reason,
    r.message,
    r.status,
    r.admin_notes,
    r.resolution_notes,
    r.reviewed_by,
    reviewer.display_name as reviewed_by_display_name,
    r.reviewed_at,
    r.resolved_at,
    r.created_at,
    r.updated_at
  from public.transaction_support_requests r
  join public.listings l on l.id = r.listing_id
  join public.profiles buyer on buyer.id = r.buyer_id
  join public.profiles seller on seller.id = r.seller_id
  join public.profiles opener on opener.id = r.opened_by
  left join public.profiles reviewer on reviewer.id = r.reviewed_by
  where p_status is null or r.status = p_status
  order by r.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin update support request
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_support_request(
  p_request_id uuid,
  p_status public.support_request_status,
  p_admin_notes text default null,
  p_resolution_notes text default null
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_reviewed_by uuid;
  v_reviewed_at timestamptz;
  v_resolved_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  v_reviewed_by := v_request.reviewed_by;
  v_reviewed_at := v_request.reviewed_at;
  v_resolved_at := v_request.resolved_at;

  if p_status = 'reviewing'::public.support_request_status
    and v_request.status is distinct from 'reviewing'::public.support_request_status then
    v_reviewed_by := v_uid;
    v_reviewed_at := now();
  end if;

  if p_status in (
    'resolved'::public.support_request_status,
    'closed'::public.support_request_status
  )
  and v_request.status not in (
    'resolved'::public.support_request_status,
    'closed'::public.support_request_status
  ) then
    v_resolved_at := now();
  end if;

  update public.transaction_support_requests
  set
    status = p_status,
    admin_notes = nullif(trim(coalesce(p_admin_notes, '')), ''),
    resolution_notes = nullif(trim(coalesce(p_resolution_notes, '')), ''),
    reviewed_by = v_reviewed_by,
    reviewed_at = v_reviewed_at,
    resolved_at = v_resolved_at
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.fetch_order_support_requests(uuid) from public;
grant execute on function public.fetch_order_support_requests(uuid) to authenticated;

revoke all on function public.admin_update_support_request(
  uuid,
  public.support_request_status,
  text,
  text
) from public;
grant execute on function public.admin_update_support_request(
  uuid,
  public.support_request_status,
  text,
  text
) to authenticated;

drop function if exists public.admin_update_support_request_status(
  uuid,
  public.support_request_status
);
