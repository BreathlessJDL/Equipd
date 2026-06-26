-- Equipd Buyer Protection / Order Lifecycle — Phase 4A (Buyer disputes)
-- Run after buyer-protection-phase3b-courier-delivery-confirmation.sql
-- Safe to re-run (idempotent where possible).
--
-- Allows buyers to open a dispute during the 24-hour Buyer Protection window.
-- Freezes payout and moves the order to disputed. No payout release or refunds.

-- ---------------------------------------------------------------------------
-- payout_status: on_hold (payout frozen while dispute is active)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'payout_status'
      and e.enumlabel = 'on_hold'
  ) then
    alter type public.payout_status add value 'on_hold';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- protection_status: disputed
-- ---------------------------------------------------------------------------

alter table public.orders
  drop constraint if exists orders_protection_status_valid;

alter table public.orders
  add constraint orders_protection_status_valid
  check (
    protection_status is null
    or protection_status in (
      'active',
      'dispute_open',
      'disputed',
      'released',
      'refunded',
      'cancelled'
    )
  );

-- ---------------------------------------------------------------------------
-- order_disputes
-- ---------------------------------------------------------------------------

create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  reason text not null,
  description text not null,
  evidence_paths text[] not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seller_response text,
  seller_response_at timestamptz,
  seller_response_evidence_paths text[] not null default '{}',
  constraint order_disputes_description_not_empty
    check (char_length(trim(description)) > 0),
  constraint order_disputes_status_valid
    check (
      status in (
        'open',
        'under_review',
        'resolved_buyer',
        'resolved_seller',
        'cancelled'
      )
    ),
  constraint order_disputes_reason_valid
    check (
      reason in (
        'significant_undisclosed_fault',
        'item_not_received',
        'wrong_item_delivered',
        'significant_seller_misrepresentation'
      )
    ),
  constraint order_disputes_evidence_required
    check (cardinality(evidence_paths) >= 1)
);

create index if not exists order_disputes_order_created_idx
  on public.order_disputes (order_id, created_at desc);

create unique index if not exists order_disputes_one_active_per_order_idx
  on public.order_disputes (order_id)
  where status in ('open', 'under_review');

drop trigger if exists order_disputes_set_updated_at on public.order_disputes;

create trigger order_disputes_set_updated_at
  before update on public.order_disputes
  for each row execute function public.set_updated_at();

alter table public.order_disputes enable row level security;

drop policy if exists "Order participants can read order disputes" on public.order_disputes;

create policy "Order participants can read order disputes"
  on public.order_disputes for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Dispute evidence storage (order-evidence bucket)
-- Path: {order_id}/disputes/{dispute_id}/{filename}
-- ---------------------------------------------------------------------------

drop policy if exists "Buyer can upload dispute evidence" on storage.objects;

create policy "Buyer can upload dispute evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'disputes'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.buyer_id = auth.uid()
        and o.fulfilment_status in (
          'collected'::public.order_fulfilment_status,
          'delivered'::public.order_fulfilment_status
        )
        and o.payout_release_at is not null
        and o.payout_release_at > now()
        and o.payout_released_at is null
        and o.fulfilment_status not in (
          'disputed'::public.order_fulfilment_status,
          'refunded'::public.order_fulfilment_status,
          'cancelled'::public.order_fulfilment_status,
          'completed'::public.order_fulfilment_status
        )
        and not exists (
          select 1
          from public.order_disputes d
          where d.order_id = o.id
            and d.status in ('open', 'under_review')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Reason validation by order type
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_dispute_reason_for_order_type(
  p_order_type public.order_type,
  p_reason text
)
returns boolean
language sql
immutable
as $$
  select case coalesce(p_order_type, 'collection'::public.order_type)
    when 'collection'::public.order_type then
      p_reason = 'significant_undisclosed_fault'
    when 'seller_delivery'::public.order_type then
      p_reason in (
        'item_not_received',
        'wrong_item_delivered',
        'significant_undisclosed_fault'
      )
    when 'buyer_courier'::public.order_type then
      p_reason = 'significant_seller_misrepresentation'
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Fetch disputes for an order (participants only)
-- ---------------------------------------------------------------------------

create or replace function public.fetch_order_disputes(p_order_id uuid)
returns setof public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.buyer_id <> v_uid and v_order.seller_id <> v_uid then
    raise exception 'You do not have access to this order';
  end if;

  return query
  select d.*
  from public.order_disputes d
  where d.order_id = p_order_id
  order by d.created_at desc;
end;
$$;

revoke all on function public.fetch_order_disputes(uuid) from public;
grant execute on function public.fetch_order_disputes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Buyer opens a dispute (freezes payout)
-- ---------------------------------------------------------------------------

create or replace function public.open_order_dispute(
  p_order_id uuid,
  p_reason text,
  p_description text,
  p_evidence_paths text[],
  p_dispute_id uuid default gen_random_uuid()
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_dispute public.order_disputes;
  v_listing_title text;
  v_description text := trim(p_description);
  v_order_type public.order_type;
  v_path text;
  v_path_prefix text;
  v_dispute_path_prefix text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_description is null or char_length(v_description) = 0 then
    raise exception 'Please describe the problem';
  end if;

  if p_evidence_paths is null or cardinality(p_evidence_paths) < 1 then
    raise exception 'At least one evidence photo is required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer can open a dispute';
  end if;

  if v_order.fulfilment_status not in (
    'collected'::public.order_fulfilment_status,
    'delivered'::public.order_fulfilment_status
  ) then
    raise exception 'Disputes can only be opened after collection or delivery';
  end if;

  if v_order.fulfilment_status in (
    'disputed'::public.order_fulfilment_status,
    'refunded'::public.order_fulfilment_status,
    'cancelled'::public.order_fulfilment_status,
    'completed'::public.order_fulfilment_status
  ) then
    raise exception 'This order cannot be disputed';
  end if;

  if v_order.payout_release_at is null or v_order.payout_release_at <= now() then
    raise exception 'The Buyer Protection window has ended';
  end if;

  if v_order.payout_released_at is not null then
    raise exception 'Payout has already been released';
  end if;

  if v_order.payout_status = 'paid'::public.payout_status then
    raise exception 'Payout has already been released';
  end if;

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = p_order_id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'An active dispute already exists for this order';
  end if;

  v_order_type := coalesce(v_order.order_type, 'collection'::public.order_type);

  if not public.is_valid_dispute_reason_for_order_type(v_order_type, p_reason) then
    raise exception 'This dispute reason is not allowed for this order type';
  end if;

  v_path_prefix := v_order.id::text || '/disputes/';
  v_dispute_path_prefix := v_path_prefix || p_dispute_id::text || '/';

  foreach v_path in array p_evidence_paths loop
    if v_path is null
       or trim(v_path) = ''
       or v_path !~ ('^' || v_path_prefix)
       or v_path !~ ('^' || v_dispute_path_prefix) then
      raise exception 'Invalid evidence path for this dispute';
    end if;
  end loop;

  insert into public.order_disputes (
    id,
    order_id,
    buyer_id,
    seller_id,
    listing_id,
    reason,
    description,
    evidence_paths,
    status
  )
  values (
    p_dispute_id,
    v_order.id,
    v_order.buyer_id,
    v_order.seller_id,
    v_order.listing_id,
    p_reason,
    v_description,
    p_evidence_paths,
    'open'
  )
  returning *
  into v_dispute;

  update public.orders
  set
    fulfilment_status = 'disputed'::public.order_fulfilment_status,
    protection_status = 'disputed',
    payout_status = 'on_hold'::public.payout_status,
    payout_release_at = null
  where id = v_order.id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.seller_id,
    'order_dispute_opened',
    'Buyer reported a problem',
    'The buyer has reported a problem with '
      || coalesce(v_listing_title, 'your order')
      || '. Payout is on hold while Equipd reviews the issue.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.buyer_id,
    'order_dispute_opened',
    'Dispute opened',
    'Your dispute for '
      || coalesce(v_listing_title, 'this order')
      || ' has been opened. Equipd will review the issue before any payout is released.',
    '/orders/' || v_order.id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.open_order_dispute(uuid, text, text, text[], uuid) from public;
grant execute on function public.open_order_dispute(uuid, text, text, text[], uuid) to authenticated;
