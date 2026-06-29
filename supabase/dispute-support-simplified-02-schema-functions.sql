-- =============================================================================
-- Equipd simplified dispute / support workflow — PHASE 2: SCHEMA & FUNCTIONS
-- =============================================================================
--
-- Prerequisites:
--   buyer-protection-phase4c-dispute-admin-resolution.sql
--   support-team-email-notifications.sql
--   dispute-support-simplified-01-enums.sql  (must be applied and committed first)
--
-- HOW TO RUN (Supabase SQL Editor):
--   1. Run dispute-support-simplified-01-enums.sql first. Wait for success.
--   2. Run THIS file in a separate execution.
--
-- Adds support evidence upload, extended dispute/support statuses, and admin
-- decision RPCs. No Stripe refunds. No audit log table.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- transaction_support_requests: evidence + refund amount
-- ---------------------------------------------------------------------------

alter table public.transaction_support_requests
  add column if not exists evidence_paths text[] not null default '{}',
  add column if not exists refund_amount_pence integer;

alter table public.transaction_support_requests
  drop constraint if exists transaction_support_requests_refund_amount_valid;

alter table public.transaction_support_requests
  add constraint transaction_support_requests_refund_amount_valid
  check (refund_amount_pence is null or refund_amount_pence > 0);

drop index if exists public.transaction_support_requests_one_active_per_user_order_idx;

create unique index if not exists transaction_support_requests_one_active_per_user_order_idx
  on public.transaction_support_requests (order_id, opened_by)
  where status in (
    'open'::public.support_request_status,
    'reviewing'::public.support_request_status,
    'awaiting_buyer_evidence'::public.support_request_status,
    'awaiting_seller_evidence'::public.support_request_status,
    'refund_pending'::public.support_request_status,
    'partial_refund_pending'::public.support_request_status
  );

-- ---------------------------------------------------------------------------
-- order_disputes: refund amount + customer message + extended statuses
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  add column if not exists refund_amount_pence integer,
  add column if not exists customer_message text;

alter table public.order_disputes
  drop constraint if exists order_disputes_refund_amount_valid;

alter table public.order_disputes
  add constraint order_disputes_refund_amount_valid
  check (refund_amount_pence is null or refund_amount_pence > 0);

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
    'refund_pending',
    'partial_refund_pending'
  );

-- ---------------------------------------------------------------------------
-- Storage: support evidence uploads
-- Path: {order_id}/support/{request_id}/{filename}
-- ---------------------------------------------------------------------------

create or replace function public.storage_participant_can_upload_support_evidence(
  p_order_id uuid,
  p_request_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_request public.transaction_support_requests;
begin
  if p_user_id is null or p_order_id is null or p_request_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = p_user_id or o.seller_id = p_user_id)
  ) then
    return false;
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
    and order_id = p_order_id;

  if not found then
    return true;
  end if;

  if v_request.status = 'awaiting_buyer_evidence'::public.support_request_status then
    return v_request.buyer_id = p_user_id;
  end if;

  if v_request.status = 'awaiting_seller_evidence'::public.support_request_status then
    return v_request.seller_id = p_user_id;
  end if;

  if v_request.status in (
    'open'::public.support_request_status,
    'reviewing'::public.support_request_status
  ) then
    return v_request.opened_by = p_user_id;
  end if;

  return false;
end;
$$;

revoke all on function public.storage_participant_can_upload_support_evidence(uuid, uuid, uuid) from public;
grant execute on function public.storage_participant_can_upload_support_evidence(uuid, uuid, uuid) to authenticated;

drop policy if exists "Participants can upload support evidence" on storage.objects;

create policy "Participants can upload support evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'support'
    and (storage.foldername(name))[3] is not null
    and public.storage_participant_can_upload_support_evidence(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[3])::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Helper: freeze payout while issue is open
-- ---------------------------------------------------------------------------

create or replace function public.freeze_order_payout_for_issue(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set
    fulfilment_status = case
      when fulfilment_status in (
        'collected'::public.order_fulfilment_status,
        'delivered'::public.order_fulfilment_status,
        'buyer_confirmed'::public.order_fulfilment_status,
        'completed'::public.order_fulfilment_status,
        'in_progress'::public.order_fulfilment_status,
        'paid'::public.order_fulfilment_status,
        'in_transit'::public.order_fulfilment_status
      ) then 'disputed'::public.order_fulfilment_status
      else fulfilment_status
    end,
    protection_status = coalesce(protection_status, 'dispute_open'),
    payout_status = 'on_hold'::public.payout_status,
    payout_release_at = null
  where id = p_order_id
    and payout_status is distinct from 'paid'::public.payout_status
    and payout_released_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_transaction_support_request (with evidence + payout freeze + email)
-- ---------------------------------------------------------------------------

create or replace function public.create_transaction_support_request(
  p_order_id uuid,
  p_reason public.support_request_reason,
  p_message text,
  p_evidence_paths text[] default '{}',
  p_request_id uuid default gen_random_uuid()
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
  v_opened_by_label text;
  v_path text;
  v_path_prefix text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_message is null or char_length(v_message) = 0 then
    raise exception 'Please describe the issue';
  end if;

  if p_evidence_paths is not null and cardinality(p_evidence_paths) > 8 then
    raise exception 'A maximum of 8 evidence files is allowed';
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
        'reviewing'::public.support_request_status,
        'awaiting_buyer_evidence'::public.support_request_status,
        'awaiting_seller_evidence'::public.support_request_status,
        'refund_pending'::public.support_request_status,
        'partial_refund_pending'::public.support_request_status
      )
  ) then
    raise exception 'You already have an open support request on this order';
  end if;

  v_path_prefix := p_order_id::text || '/support/' || p_request_id::text || '/';

  if p_evidence_paths is not null then
    foreach v_path in array p_evidence_paths loop
      if v_path is null or v_path !~ ('^' || v_path_prefix) then
        raise exception 'Invalid support evidence path';
      end if;
    end loop;
  end if;

  insert into public.transaction_support_requests (
    id,
    order_id,
    listing_id,
    buyer_id,
    seller_id,
    opened_by,
    reason,
    message,
    evidence_paths,
    status
  )
  values (
    p_request_id,
    v_order.id,
    v_order.listing_id,
    v_order.buyer_id,
    v_order.seller_id,
    v_uid,
    p_reason,
    v_message,
    coalesce(p_evidence_paths, '{}'),
    'open'::public.support_request_status
  )
  returning * into v_request;

  perform public.freeze_order_payout_for_issue(v_order.id);

  if v_uid = v_order.buyer_id then
    v_recipient_id := v_order.seller_id;
  else
    v_recipient_id := v_order.buyer_id;
  end if;

  select l.title into v_listing_title from public.listings l where l.id = v_order.listing_id;

  select coalesce(p.display_name, left(v_uid::text, 8) || '…')
  into v_opened_by_label
  from public.profiles p
  where p.id = v_uid;

  perform public.create_notification(
    v_recipient_id,
    'support_request_opened',
    'Support issue raised',
    'A support issue was raised on your order for '
      || coalesce(v_listing_title, 'a listing'),
    '/orders/' || v_order.id::text
  );

  perform public.notify_support_team_email(
    'support_request',
    jsonb_build_object(
      'request_id', v_request.id,
      'order_id', v_order.id,
      'listing_id', v_order.listing_id,
      'listing_title', v_listing_title,
      'reason', p_reason::text,
      'message', v_message,
      'opened_by', v_uid,
      'opened_by_label', v_opened_by_label,
      'buyer_id', v_order.buyer_id,
      'seller_id', v_order.seller_id,
      'evidence_count', cardinality(coalesce(p_evidence_paths, '{}'))
    )
  );

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- fetch_order_support_requests (with evidence; admin sees admin_notes)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Append evidence to an active support request
-- ---------------------------------------------------------------------------

create or replace function public.append_support_request_evidence(
  p_request_id uuid,
  p_evidence_paths text[]
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_path text;
  v_path_prefix text;
  v_total int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_evidence_paths is null or cardinality(p_evidence_paths) < 1 then
    raise exception 'At least one evidence file is required';
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  if v_request.status = 'awaiting_buyer_evidence'::public.support_request_status
     and v_uid <> v_request.buyer_id then
    raise exception 'Only the buyer can upload evidence for this request';
  end if;

  if v_request.status = 'awaiting_seller_evidence'::public.support_request_status
     and v_uid <> v_request.seller_id then
    raise exception 'Only the seller can upload evidence for this request';
  end if;

  if v_request.status not in (
    'open'::public.support_request_status,
    'reviewing'::public.support_request_status,
    'awaiting_buyer_evidence'::public.support_request_status,
    'awaiting_seller_evidence'::public.support_request_status
  ) then
    raise exception 'Evidence cannot be added to this support request';
  end if;

  if v_uid <> v_request.buyer_id and v_uid <> v_request.seller_id then
    raise exception 'You do not have access to this support request';
  end if;

  v_path_prefix := v_request.order_id::text || '/support/' || v_request.id::text || '/';

  foreach v_path in array p_evidence_paths loop
    if v_path is null or v_path !~ ('^' || v_path_prefix) then
      raise exception 'Invalid support evidence path';
    end if;
  end loop;

  v_total := cardinality(v_request.evidence_paths) + cardinality(p_evidence_paths);
  if v_total > 8 then
    raise exception 'A maximum of 8 evidence files is allowed';
  end if;

  update public.transaction_support_requests
  set
    evidence_paths = evidence_paths || p_evidence_paths,
    status = case
      when status in (
        'awaiting_buyer_evidence'::public.support_request_status,
        'awaiting_seller_evidence'::public.support_request_status
      ) then 'reviewing'::public.support_request_status
      else status
    end
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- fetch_order_disputes (extended columns)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Release seller payout after reject (reuse phase 4c logic)
-- ---------------------------------------------------------------------------

create or replace function public.release_order_payout_after_dispute_reject(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_restore_status public.order_fulfilment_status;
  v_seller_onboarded boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  v_restore_status := public.infer_pre_dispute_fulfilment_status(v_order);

  select
    coalesce(pr.stripe_onboarding_complete, false)
    and pr.stripe_account_id is not null
  into v_seller_onboarded
  from public.profiles pr
  where pr.id = v_order.seller_id;

  if v_order.payout_status = 'paid'::public.payout_status
     or v_order.payout_released_at is not null then
    update public.orders
    set
      fulfilment_status = 'completed'::public.order_fulfilment_status,
      protection_status = 'released',
      payout_status = 'paid'::public.payout_status,
      payout_release_at = null
    where id = v_order.id;
  else
    update public.orders
    set
      fulfilment_status = v_restore_status,
      protection_status = 'active',
      payout_status = case
        when v_seller_onboarded then 'ready'::public.payout_status
        else 'awaiting_seller_setup'::public.payout_status
      end,
      payout_release_at = now()
    where id = v_order.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_apply_dispute_decision — single admin RPC
-- ---------------------------------------------------------------------------

create or replace function public.admin_apply_dispute_decision(
  p_dispute_id uuid,
  p_decision text,
  p_admin_note text default null,
  p_customer_message text default null,
  p_refund_amount_pence integer default null,
  p_evidence_party text default 'buyer'
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
  v_listing_title text;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_new_status text;
  v_resolution text;
  v_notify_buyer_title text;
  v_notify_buyer_body text;
  v_notify_seller_title text;
  v_notify_seller_body text;
  v_notify_type text := 'order_dispute_under_review';
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_decision not in (
    'request_more_evidence',
    'approve_full_refund',
    'approve_partial_refund',
    'reject_claim',
    'mark_resolved_manually'
  ) then
    raise exception 'Invalid admin decision';
  end if;

  select *
  into v_order
  from public.orders o
  join public.order_disputes d on d.order_id = o.id
  where d.id = p_dispute_id
  for update of o;

  if not found then
    raise exception 'Dispute not found';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if v_dispute.status in (
    'resolved', 'resolved_buyer', 'resolved_seller', 'rejected', 'cancelled'
  ) then
    raise exception 'Dispute is already closed';
  end if;

  select l.title into v_listing_title from public.listings l where l.id = v_dispute.listing_id;

  if p_decision = 'request_more_evidence' then
    if p_evidence_party not in ('buyer', 'seller') then
      raise exception 'Evidence party must be buyer or seller';
    end if;
    v_new_status := case
      when p_evidence_party = 'seller' then 'awaiting_seller_evidence'
      else 'awaiting_buyer_evidence'
    end;
    v_resolution := coalesce(
      v_customer,
      'Equipd needs more evidence from the '
        || case when p_evidence_party = 'seller' then 'seller' else 'buyer' end
        || ' before this issue can be resolved.'
    );
    perform public.freeze_order_payout_for_issue(v_order.id);
    v_notify_buyer_title := 'More evidence requested';
    v_notify_buyer_body := coalesce(v_customer, 'Equipd has requested more evidence for your order issue.');
    v_notify_seller_title := v_notify_buyer_title;
    v_notify_seller_body := v_notify_buyer_body;

  elsif p_decision = 'approve_full_refund' then
    v_new_status := 'refund_pending';
    v_resolution := coalesce(
      v_customer,
      'Full refund approved. Equipd will process the refund manually — no payment has been returned yet.'
    );
    update public.orders
    set
      fulfilment_status = 'refund_pending'::public.order_fulfilment_status,
      protection_status = 'refunded',
      payout_status = 'on_hold'::public.payout_status,
      payout_release_at = null
    where id = v_order.id;
    v_notify_type := 'order_dispute_resolved_buyer';
    v_notify_buyer_title := 'Refund approved';
    v_notify_buyer_body := v_resolution;
    v_notify_seller_title := 'Refund approved for buyer';
    v_notify_seller_body := 'Equipd approved a full refund for this order. Seller payout remains on hold.';

  elsif p_decision = 'approve_partial_refund' then
    if p_refund_amount_pence is null or p_refund_amount_pence <= 0 then
      raise exception 'Partial refund amount is required';
    end if;
    v_new_status := 'partial_refund_pending';
    v_resolution := coalesce(
      v_customer,
      'Partial refund of £'
        || trim(to_char(p_refund_amount_pence / 100.0, '999999990.00'))
        || ' approved. Equipd will process this manually.'
    );
    perform public.freeze_order_payout_for_issue(v_order.id);
    v_notify_type := 'order_dispute_resolved_buyer';
    v_notify_buyer_title := 'Partial refund approved';
    v_notify_buyer_body := v_resolution;
    v_notify_seller_title := 'Partial refund approved';
    v_notify_seller_body := v_resolution;

  elsif p_decision = 'reject_claim' then
    v_new_status := 'rejected';
    v_resolution := coalesce(
      v_customer,
      'Your claim was reviewed and rejected. Seller payout can proceed through the normal release process.'
    );
    perform public.release_order_payout_after_dispute_reject(v_order.id);
    v_notify_type := 'order_dispute_resolved_seller';
    v_notify_buyer_title := 'Claim rejected';
    v_notify_buyer_body := v_resolution;
    v_notify_seller_title := 'Claim rejected';
    v_notify_seller_body := 'The buyer''s claim was rejected. Payout can proceed when eligible.';

  else
    v_new_status := 'resolved';
    v_resolution := coalesce(v_customer, 'Equipd marked this issue as resolved.');
    v_notify_type := 'order_dispute_under_review';
    v_notify_buyer_title := 'Issue resolved';
    v_notify_buyer_body := v_resolution;
    v_notify_seller_title := 'Issue resolved';
    v_notify_seller_body := v_resolution;
  end if;

  update public.order_disputes
  set
    status = v_new_status,
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_resolution,
    refund_amount_pence = case
      when p_decision = 'approve_partial_refund' then p_refund_amount_pence
      else refund_amount_pence
    end,
    resolved_at = case
      when v_new_status in ('resolved', 'rejected', 'refund_pending', 'partial_refund_pending')
      then coalesce(resolved_at, now())
      else resolved_at
    end,
    resolved_by = case
      when v_new_status in ('resolved', 'rejected', 'refund_pending', 'partial_refund_pending')
      then coalesce(resolved_by, v_uid)
      else resolved_by
    end
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.create_notification(
    v_dispute.buyer_id, v_notify_type, v_notify_buyer_title, v_notify_buyer_body,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id, v_notify_type, v_notify_seller_title, v_notify_seller_body,
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_apply_dispute_decision(
  uuid, text, text, text, integer, text
) from public;
grant execute on function public.admin_apply_dispute_decision(
  uuid, text, text, text, integer, text
) to authenticated;

revoke all on function public.create_transaction_support_request(
  uuid, public.support_request_reason, text, text[], uuid
) from public;
grant execute on function public.create_transaction_support_request(
  uuid, public.support_request_reason, text, text[], uuid
) to authenticated;

revoke all on function public.fetch_order_support_requests(uuid) from public;
grant execute on function public.fetch_order_support_requests(uuid) to authenticated;

revoke all on function public.append_support_request_evidence(uuid, text[]) from public;
grant execute on function public.append_support_request_evidence(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_apply_support_decision — same decisions for support requests
-- ---------------------------------------------------------------------------

create or replace function public.admin_apply_support_decision(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null,
  p_customer_message text default null,
  p_refund_amount_pence integer default null,
  p_evidence_party text default 'buyer'
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_order public.orders;
  v_listing_title text;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_new_status public.support_request_status;
  v_resolution text;
  v_notify_title text;
  v_notify_body text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select r.*
  into v_request
  from public.transaction_support_requests r
  where r.id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  select * into v_order from public.orders where id = v_request.order_id for update;

  if v_request.status in (
    'resolved'::public.support_request_status,
    'closed'::public.support_request_status,
    'rejected'::public.support_request_status
  ) then
    raise exception 'Support request is already closed';
  end if;

  select l.title into v_listing_title from public.listings l where l.id = v_request.listing_id;

  if p_decision = 'request_more_evidence' then
    v_new_status := case
      when p_evidence_party = 'seller' then 'awaiting_seller_evidence'::public.support_request_status
      else 'awaiting_buyer_evidence'::public.support_request_status
    end;
    v_resolution := coalesce(
      v_customer,
      'Equipd needs more evidence from the '
        || case when p_evidence_party = 'seller' then 'seller' else 'buyer' end
        || '.'
    );
    perform public.freeze_order_payout_for_issue(v_order.id);
    v_notify_title := 'More evidence requested';
    v_notify_body := v_resolution;

  elsif p_decision = 'approve_full_refund' then
    v_new_status := 'refund_pending'::public.support_request_status;
    v_resolution := coalesce(v_customer, 'Full refund approved. Equipd will process this manually.');
    update public.orders
    set
      fulfilment_status = 'refund_pending'::public.order_fulfilment_status,
      protection_status = 'refunded',
      payout_status = 'on_hold'::public.payout_status,
      payout_release_at = null
    where id = v_order.id;
    v_notify_title := 'Refund approved';
    v_notify_body := v_resolution;

  elsif p_decision = 'approve_partial_refund' then
    if p_refund_amount_pence is null or p_refund_amount_pence <= 0 then
      raise exception 'Partial refund amount is required';
    end if;
    v_new_status := 'partial_refund_pending'::public.support_request_status;
    v_resolution := coalesce(
      v_customer,
      'Partial refund of £'
        || trim(to_char(p_refund_amount_pence / 100.0, '999999990.00'))
        || ' approved. Equipd will process this manually.'
    );
    perform public.freeze_order_payout_for_issue(v_order.id);
    v_notify_title := 'Partial refund approved';
    v_notify_body := v_resolution;

  elsif p_decision = 'reject_claim' then
    v_new_status := 'rejected'::public.support_request_status;
    v_resolution := coalesce(v_customer, 'Your support claim was reviewed and rejected.');
    perform public.release_order_payout_after_dispute_reject(v_order.id);
    v_notify_title := 'Support claim rejected';
    v_notify_body := v_resolution;

  else
    v_new_status := 'resolved'::public.support_request_status;
    v_resolution := coalesce(v_customer, 'Equipd marked this support issue as resolved.');
    v_notify_title := 'Support issue resolved';
    v_notify_body := v_resolution;
  end if;

  update public.transaction_support_requests
  set
    status = v_new_status,
    admin_notes = coalesce(v_note, admin_notes),
    resolution_notes = v_resolution,
    refund_amount_pence = case
      when p_decision = 'approve_partial_refund' then p_refund_amount_pence
      else refund_amount_pence
    end,
    reviewed_by = coalesce(reviewed_by, v_uid),
    reviewed_at = coalesce(reviewed_at, now()),
    resolved_at = case
      when v_new_status in (
        'resolved'::public.support_request_status,
        'rejected'::public.support_request_status,
        'refund_pending'::public.support_request_status,
        'partial_refund_pending'::public.support_request_status
      ) then coalesce(resolved_at, now())
      else resolved_at
    end
  where id = p_request_id
  returning * into v_request;

  perform public.create_notification(
    v_request.buyer_id, 'support_request_opened', v_notify_title, v_notify_body,
    '/orders/' || v_request.order_id::text
  );
  perform public.create_notification(
    v_request.seller_id, 'support_request_opened', v_notify_title, v_notify_body,
    '/orders/' || v_request.order_id::text
  );

  return v_request;
end;
$$;

revoke all on function public.admin_apply_support_decision(
  uuid, text, text, text, integer, text
) from public;
grant execute on function public.admin_apply_support_decision(
  uuid, text, text, text, integer, text
) to authenticated;
