-- =============================================================================
-- Equipd Case Management — Phase 2: Return / collection workflow
-- =============================================================================
--
-- Prerequisites: case-management-phase1.sql, dispute-support-simplified-02
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extend dispute statuses for return workflow
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  drop constraint if exists order_disputes_status_valid;

alter table public.order_disputes
  add constraint order_disputes_status_valid
  check (
    status in (
      'open',
      'under_review',
      'awaiting_buyer_evidence',
      'awaiting_seller_evidence',
      'return_authorised',
      'awaiting_seller_collection',
      'collection_arranged',
      'collection_confirmed',
      'ready_for_refund',
      'refund_pending',
      'partial_refund_pending',
      'rejected',
      'resolved',
      'resolved_buyer',
      'resolved_seller',
      'cancelled'
    )
  );

drop index if exists public.order_disputes_one_active_per_order_idx;

create unique index if not exists order_disputes_one_active_per_order_idx
  on public.order_disputes (order_id)
  where status in (
    'open',
    'under_review',
    'awaiting_buyer_evidence',
    'awaiting_seller_evidence',
    'return_authorised',
    'awaiting_seller_collection',
    'collection_arranged',
    'collection_confirmed',
    'ready_for_refund',
    'refund_pending',
    'partial_refund_pending'
  );

-- ---------------------------------------------------------------------------
-- Active case helpers (admin list)
-- ---------------------------------------------------------------------------

create or replace function public.case_status_is_active(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    p_status in (
      'open',
      'under_review',
      'reviewing',
      'awaiting_buyer_evidence',
      'awaiting_seller_evidence',
      'return_authorised',
      'awaiting_seller_collection',
      'collection_arranged',
      'collection_confirmed',
      'ready_for_refund',
      'refund_pending',
      'partial_refund_pending'
    ),
    false
  );
$$;

create or replace function public.case_waiting_on_label(p_status text, p_is_active boolean)
returns text
language sql
immutable
as $$
  select case
    when not coalesce(p_is_active, false) then 'none'
    when p_status = 'awaiting_buyer_evidence' then 'buyer'
    when p_status in (
      'awaiting_seller_evidence',
      'return_authorised',
      'awaiting_seller_collection'
    ) then 'seller'
    when p_status = 'collection_arranged' then 'buyer'
    else 'equipd'
  end;
$$;

-- ---------------------------------------------------------------------------
-- order_case_return_logistics
-- ---------------------------------------------------------------------------

create table if not exists public.order_case_return_logistics (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  dispute_id uuid references public.order_disputes (id) on delete set null,
  support_request_id uuid references public.transaction_support_requests (id) on delete set null,
  authorised_at timestamptz,
  collection_deadline_at timestamptz,
  arranged_at timestamptz,
  collection_date date,
  courier_name text,
  tracking_reference text,
  seller_message_to_buyer text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_case_return_logistics_order_idx
  on public.order_case_return_logistics (order_id, created_at desc);

create unique index if not exists order_case_return_logistics_one_open_per_dispute_idx
  on public.order_case_return_logistics (dispute_id)
  where dispute_id is not null and confirmed_at is null;

drop trigger if exists order_case_return_logistics_set_updated_at
  on public.order_case_return_logistics;

create trigger order_case_return_logistics_set_updated_at
  before update on public.order_case_return_logistics
  for each row execute function public.set_updated_at();

alter table public.order_case_return_logistics enable row level security;

-- ---------------------------------------------------------------------------
-- Trigger skip helper (avoid duplicate case updates from RPC + trigger)
-- ---------------------------------------------------------------------------

create or replace function public.set_skip_dispute_case_trigger(p_skip boolean)
returns void
language sql
as $$
  select set_config(
    'equipd.skip_dispute_case_log',
    case when p_skip then 'on' else 'off' end,
    true
  );
$$;

-- ---------------------------------------------------------------------------
-- Update dispute trigger to honour skip flag
-- ---------------------------------------------------------------------------

create or replace function public.trg_order_disputes_case_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
  v_status text;
begin
  if TG_OP = 'UPDATE' and coalesce(current_setting('equipd.skip_dispute_case_log', true), '') = 'on' then
    return NEW;
  end if;

  v_message := coalesce(
    nullif(trim(NEW.customer_message), ''),
    nullif(trim(NEW.resolution), '')
  );

  if TG_OP = 'INSERT' then
    if coalesce(cardinality(NEW.evidence_paths), 0) >= 1 then
      v_status := 'evidence_received';
      v_message :=
        'Your dispute has been raised and your evidence has been received. Equipd support will review the information provided and contact you if anything else is needed.';
    else
      v_status := 'awaiting_buyer_evidence';
      v_message :=
        'Your dispute has been raised. Please upload supporting evidence so Equipd can review the issue.';
    end if;

    perform public.record_order_case_update(
      NEW.order_id,
      NEW.id,
      null,
      'case_opened',
      v_status,
      v_message,
      null,
      auth.uid()
    );
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status
      or NEW.customer_message is distinct from OLD.customer_message
      or NEW.resolution is distinct from OLD.resolution then
      perform public.record_order_case_update(
        NEW.order_id,
        NEW.id,
        null,
        case
          when OLD.status is distinct from NEW.status then 'admin_decision'
          else 'support_message_update'
        end,
        NEW.status,
        v_message,
        case
          when NEW.admin_note is distinct from OLD.admin_note then NEW.admin_note
          else null
        end,
        auth.uid()
      );
    elsif NEW.admin_note is distinct from OLD.admin_note then
      perform public.record_order_case_update(
        NEW.order_id,
        NEW.id,
        null,
        'admin_note_update',
        NEW.status,
        null,
        NEW.admin_note,
        auth.uid()
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- fetch_order_case_return_logistics
-- ---------------------------------------------------------------------------

create or replace function public.fetch_order_case_return_logistics(p_order_id uuid)
returns setof public.order_case_return_logistics
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
  select l.*
  from public.order_case_return_logistics l
  where l.order_id = p_order_id
  order by l.created_at desc;
end;
$$;

revoke all on function public.fetch_order_case_return_logistics(uuid) from public;
grant execute on function public.fetch_order_case_return_logistics(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_authorise_case_return
-- ---------------------------------------------------------------------------

create or replace function public.admin_authorise_case_return(
  p_dispute_id uuid,
  p_admin_note text default null,
  p_customer_message text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_order public.orders;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_message text;
  v_deadline timestamptz := now() + interval '7 days';
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id for update;

  if v_dispute.status in (
    'resolved', 'resolved_buyer', 'resolved_seller', 'rejected', 'cancelled',
    'refund_pending', 'partial_refund_pending'
  ) then
    raise exception 'Dispute is already closed or refund is pending';
  end if;

  if v_dispute.status in (
    'return_authorised', 'awaiting_seller_collection', 'collection_arranged',
    'collection_confirmed', 'ready_for_refund'
  ) then
    raise exception 'Return is already authorised for this dispute';
  end if;

  v_message := coalesce(
    v_customer,
    'Equipd has authorised a return for this order. The seller must arrange and pay for collection within 7 calendar days. Please make the equipment reasonably available for collection. Independent courier or delivery costs are generally not refundable under Buyer Protection.'
  );

  perform public.freeze_order_payout_for_issue(v_order.id);

  insert into public.order_case_return_logistics (
    order_id,
    dispute_id,
    authorised_at,
    collection_deadline_at
  )
  values (
    v_dispute.order_id,
    v_dispute.id,
    now(),
    v_deadline
  );

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'awaiting_seller_collection',
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_message
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'return_authorised',
    'awaiting_seller_collection',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_under_review',
    'Return authorised',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_under_review',
    'Arrange equipment collection',
    'You must arrange and pay for collection within 7 calendar days. The buyer will make the equipment reasonably available.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_authorise_case_return(uuid, text, text) from public;
grant execute on function public.admin_authorise_case_return(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_issue_refund_without_return
-- ---------------------------------------------------------------------------

create or replace function public.admin_issue_refund_without_return(
  p_dispute_id uuid,
  p_admin_note text default null,
  p_customer_message text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_order public.orders;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_message text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id for update;

  if v_dispute.status in (
    'resolved', 'resolved_buyer', 'resolved_seller', 'rejected', 'cancelled'
  ) then
    raise exception 'Dispute is already closed';
  end if;

  v_message := coalesce(
    v_customer,
    'We have reviewed the evidence and approved a full refund without return. The refund will be processed shortly. We will update the order once this has been completed. Independent courier or delivery costs are generally not refundable unless legally required.'
  );

  update public.orders
  set
    fulfilment_status = 'refund_pending'::public.order_fulfilment_status,
    protection_status = 'refunded',
    payout_status = 'on_hold'::public.payout_status,
    payout_release_at = null
  where id = v_order.id;

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'refund_pending',
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_message,
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, v_uid)
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'refund_pending',
    'refund_pending',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id, 'order_dispute_resolved_buyer', 'Refund approved', v_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id, 'order_dispute_resolved_buyer', 'Refund approved for buyer',
    'Equipd approved a full refund for this order without return. Seller payout remains on hold.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_issue_refund_without_return(uuid, text, text) from public;
grant execute on function public.admin_issue_refund_without_return(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- seller_arrange_case_collection
-- ---------------------------------------------------------------------------

create or replace function public.seller_arrange_case_collection(
  p_dispute_id uuid,
  p_collection_date date,
  p_courier_name text,
  p_tracking_reference text,
  p_message_to_buyer text default null
)
returns public.order_case_return_logistics
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_logistics public.order_case_return_logistics;
  v_courier text := nullif(trim(coalesce(p_courier_name, '')), '');
  v_tracking text := nullif(trim(coalesce(p_tracking_reference, '')), '');
  v_seller_message text := nullif(trim(coalesce(p_message_to_buyer, '')), '');
  v_message text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_collection_date is null then
    raise exception 'Collection date is required';
  end if;

  if v_courier is null then
    raise exception 'Courier or company name is required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.seller_id <> v_uid then
    raise exception 'Only the seller can arrange collection';
  end if;

  if v_dispute.status not in ('return_authorised', 'awaiting_seller_collection') then
    raise exception 'Collection cannot be arranged in the current dispute status';
  end if;

  select *
  into v_logistics
  from public.order_case_return_logistics
  where dispute_id = p_dispute_id
    and confirmed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Return logistics record not found';
  end if;

  update public.order_case_return_logistics
  set
    arranged_at = now(),
    collection_date = p_collection_date,
    courier_name = v_courier,
    tracking_reference = v_tracking,
    seller_message_to_buyer = v_seller_message
  where id = v_logistics.id
  returning * into v_logistics;

  v_message :=
    'The seller has arranged collection'
    || ' on ' || to_char(p_collection_date, 'DD Mon YYYY')
    || ' via ' || v_courier
    || coalesce(' (reference: ' || v_tracking || ')', '')
    || '.'
    || coalesce(' Message from seller: ' || v_seller_message, '')
    || ' Please confirm once the equipment has been collected.';

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'collection_arranged',
    customer_message = v_message,
    resolution = v_message
  where id = p_dispute_id;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'collection_arranged',
    'collection_arranged',
    v_message,
    null,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_under_review',
    'Collection arranged',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );

  return v_logistics;
end;
$$;

revoke all on function public.seller_arrange_case_collection(uuid, date, text, text, text) from public;
grant execute on function public.seller_arrange_case_collection(uuid, date, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- buyer_confirm_case_collection
-- ---------------------------------------------------------------------------

create or replace function public.buyer_confirm_case_collection(p_dispute_id uuid)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_logistics public.order_case_return_logistics;
  v_message text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.buyer_id <> v_uid then
    raise exception 'Only the buyer can confirm collection';
  end if;

  if v_dispute.status <> 'collection_arranged' then
    raise exception 'Collection must be arranged before it can be confirmed';
  end if;

  select *
  into v_logistics
  from public.order_case_return_logistics
  where dispute_id = p_dispute_id
    and confirmed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found or v_logistics.arranged_at is null then
    raise exception 'Collection has not been arranged yet';
  end if;

  update public.order_case_return_logistics
  set
    confirmed_at = now(),
    confirmed_by = v_uid
  where id = v_logistics.id;

  v_message :=
    'The buyer has confirmed that the equipment has been collected. Equipd will now process the approved refund manually.';

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'ready_for_refund',
    customer_message = v_message,
    resolution = v_message
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'collection_confirmed',
    'ready_for_refund',
    v_message,
    null,
    v_uid
  );

  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_under_review',
    'Collection confirmed',
    'The buyer confirmed the equipment has been collected. Equipd will process the refund.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.buyer_confirm_case_collection(uuid) from public;
grant execute on function public.buyer_confirm_case_collection(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_issue_case_refund_pending
-- ---------------------------------------------------------------------------

create or replace function public.admin_issue_case_refund_pending(
  p_dispute_id uuid,
  p_admin_note text default null,
  p_customer_message text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_order public.orders;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_message text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.status not in ('collection_confirmed', 'ready_for_refund') then
    raise exception 'Refund can only be issued after collection is confirmed';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id for update;

  v_message := coalesce(
    v_customer,
    'Collection is complete and your full refund is now being processed. We will update the order once the refund has been completed. Independent courier or delivery costs are generally not refundable unless legally required.'
  );

  update public.orders
  set
    fulfilment_status = 'refund_pending'::public.order_fulfilment_status,
    protection_status = 'refunded',
    payout_status = 'on_hold'::public.payout_status,
    payout_release_at = null
  where id = v_order.id;

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'refund_pending',
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_message,
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, v_uid)
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'refund_pending',
    'refund_pending',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id, 'order_dispute_resolved_buyer', 'Refund processing', v_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id, 'order_dispute_resolved_buyer', 'Refund processing',
    'Equipd is processing the buyer refund following confirmed collection.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_issue_case_refund_pending(uuid, text, text) from public;
grant execute on function public.admin_issue_case_refund_pending(uuid, text, text) to authenticated;
