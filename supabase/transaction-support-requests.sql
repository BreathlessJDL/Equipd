-- Equipd transaction support / dispute requests
-- Run after transaction-cancellation.sql
--
-- Adds transaction_support_requests table, create_transaction_support_request() RPC,
-- and in-app notification to the other party.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.support_request_reason as enum (
  'item_not_received',
  'item_not_as_described',
  'damaged_item',
  'collection_issue',
  'delivery_issue',
  'payment_or_payout_issue',
  'other'
);

create type public.support_request_status as enum (
  'open',
  'reviewing',
  'resolved',
  'closed'
);

-- ---------------------------------------------------------------------------
-- transaction_support_requests
-- ---------------------------------------------------------------------------

create table public.transaction_support_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  reason public.support_request_reason not null,
  message text not null,
  status public.support_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_support_requests_message_not_empty
    check (char_length(trim(message)) > 0),
  constraint transaction_support_requests_opened_by_participant
    check (opened_by = buyer_id or opened_by = seller_id)
);

create index transaction_support_requests_order_created_idx
  on public.transaction_support_requests (order_id, created_at desc);

create index transaction_support_requests_buyer_created_idx
  on public.transaction_support_requests (buyer_id, created_at desc);

create index transaction_support_requests_seller_created_idx
  on public.transaction_support_requests (seller_id, created_at desc);

create unique index transaction_support_requests_one_active_per_user_order_idx
  on public.transaction_support_requests (order_id, opened_by)
  where status in (
    'open'::public.support_request_status,
    'reviewing'::public.support_request_status
  );

create trigger transaction_support_requests_set_updated_at
  before update on public.transaction_support_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.transaction_support_requests enable row level security;

create policy "Order participants can read support requests"
  on public.transaction_support_requests for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Inserts go through create_transaction_support_request() only.

-- ---------------------------------------------------------------------------
-- Raise a support request on a paid order
-- ---------------------------------------------------------------------------

create or replace function public.create_transaction_support_request(
  p_order_id uuid,
  p_reason public.support_request_reason,
  p_message text
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_request public.transaction_support_requests;
  v_recipient_id uuid;
  v_listing_title text;
  v_message text := trim(p_message);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_message is null or char_length(v_message) = 0 then
    raise exception 'Please describe the issue';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_uid <> v_order.buyer_id and v_uid <> v_order.seller_id then
    raise exception 'You do not have access to this order';
  end if;

  if v_order.fulfilment_status = 'cancelled'::public.order_fulfilment_status then
    raise exception 'Support requests cannot be raised on cancelled orders';
  end if;

  if v_order.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status then
    raise exception 'Support requests can only be raised after payment';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Support requests can only be raised on paid orders';
  end if;

  if exists (
    select 1
    from public.transaction_support_requests r
    where r.order_id = p_order_id
      and r.opened_by = v_uid
      and r.status in (
        'open'::public.support_request_status,
        'reviewing'::public.support_request_status
      )
  ) then
    raise exception 'You already have an open support request on this order';
  end if;

  insert into public.transaction_support_requests (
    order_id,
    listing_id,
    buyer_id,
    seller_id,
    opened_by,
    reason,
    message,
    status
  )
  values (
    v_order.id,
    v_order.listing_id,
    v_order.buyer_id,
    v_order.seller_id,
    v_uid,
    p_reason,
    v_message,
    'open'::public.support_request_status
  )
  returning * into v_request;

  if v_uid = v_order.buyer_id then
    v_recipient_id := v_order.seller_id;
  else
    v_recipient_id := v_order.buyer_id;
  end if;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_recipient_id,
    'support_request_opened',
    'Support issue raised',
    'A support issue was raised on your order for '
      || coalesce(v_listing_title, 'a listing'),
    '/orders/' || v_order.id::text
  );

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_transaction_support_request(
  uuid,
  public.support_request_reason,
  text
) from public;

grant execute on function public.create_transaction_support_request(
  uuid,
  public.support_request_reason,
  text
) to authenticated;
