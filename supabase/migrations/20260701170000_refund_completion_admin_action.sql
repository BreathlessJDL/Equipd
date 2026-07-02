-- Admin "Mark refund completed" workflow: schema, RPCs, timeline, and order updates.
-- Reuses case-management-refund-auto-close.sql behaviour (refund_completed + case_closed).

-- ---------------------------------------------------------------------------
-- Schema (idempotent)
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  add column if not exists case_outcome text,
  add column if not exists refund_reference text,
  add column if not exists refund_completed_at timestamptz,
  add column if not exists refund_completed_by uuid references public.profiles (id) on delete set null;

alter table public.transaction_support_requests
  add column if not exists case_outcome text,
  add column if not exists refund_reference text,
  add column if not exists refund_completed_at timestamptz,
  add column if not exists refund_completed_by uuid references public.profiles (id) on delete set null;

alter table public.order_disputes
  drop constraint if exists order_disputes_case_outcome_valid;

alter table public.order_disputes
  add constraint order_disputes_case_outcome_valid
  check (
    case_outcome is null
    or case_outcome in (
      'buyer_upheld_full_refund',
      'buyer_upheld_partial_refund',
      'seller_upheld',
      'mutual_agreement',
      'outside_buyer_protection',
      'duplicate',
      'cancelled'
    )
  );

alter table public.transaction_support_requests
  drop constraint if exists transaction_support_requests_case_outcome_valid;

alter table public.transaction_support_requests
  add constraint transaction_support_requests_case_outcome_valid
  check (
    case_outcome is null
    or case_outcome in (
      'buyer_upheld_full_refund',
      'buyer_upheld_partial_refund',
      'seller_upheld',
      'mutual_agreement',
      'outside_buyer_protection',
      'duplicate',
      'cancelled'
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.infer_refund_case_outcome(
  p_existing_outcome text,
  p_prior_status text,
  p_refund_amount_pence integer
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(coalesce(p_existing_outcome, '')), ''),
    case
      when p_prior_status = 'partial_refund_pending'
        or coalesce(p_refund_amount_pence, 0) > 0
      then 'buyer_upheld_partial_refund'
      else 'buyer_upheld_full_refund'
    end
  );
$$;

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
-- admin_mark_dispute_refund_completed
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_dispute_refund_completed(
  p_dispute_id uuid,
  p_admin_note text default null,
  p_customer_message text default null,
  p_refund_reference text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_reference text := nullif(trim(coalesce(p_refund_reference, '')), '');
  v_prior_status text;
  v_outcome text;
  v_refund_message text;
  v_close_message text := 'Case closed. Refund completed successfully.';
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

  if v_dispute.case_outcome is not null then
    raise exception 'Case is already closed';
  end if;

  if exists (
    select 1
    from public.order_case_updates u
    where u.dispute_id = p_dispute_id
      and u.event_type = 'refund_completed'
  ) then
    raise exception 'Refund has already been marked completed';
  end if;

  if v_dispute.status not in ('refund_pending', 'partial_refund_pending') then
    raise exception 'Refund can only be marked completed from refund pending status';
  end if;

  v_prior_status := v_dispute.status;
  v_outcome := public.infer_refund_case_outcome(
    v_dispute.case_outcome,
    v_prior_status,
    v_dispute.refund_amount_pence
  );

  v_refund_message := coalesce(
    v_customer,
    'The refund has now been completed.'
  );

  update public.orders
  set
    fulfilment_status = 'refunded'::public.order_fulfilment_status,
    protection_status = 'refunded',
    payout_status = 'cancelled'::public.payout_status,
    payout_release_at = null
  where id = v_dispute.order_id;

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'resolved',
    case_outcome = v_outcome,
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_close_message,
    refund_reference = coalesce(v_reference, refund_reference),
    refund_completed_at = now(),
    refund_completed_by = v_uid,
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, v_uid)
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'refund_completed',
    'refund_completed',
    v_refund_message,
    v_note,
    v_uid
  );

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'case_closed',
    'resolved',
    v_close_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_resolved_buyer',
    'Case closed',
    v_close_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_resolved_seller',
    'Case closed',
    v_close_message,
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_mark_dispute_refund_completed(uuid, text, text, text) from public;
grant execute on function public.admin_mark_dispute_refund_completed(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_mark_support_refund_completed
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_support_refund_completed(
  p_request_id uuid,
  p_admin_note text default null,
  p_customer_message text default null,
  p_refund_reference text default null
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_reference text := nullif(trim(coalesce(p_refund_reference, '')), '');
  v_prior_status text;
  v_outcome text;
  v_refund_message text;
  v_close_message text := 'Case closed. Refund completed successfully.';
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

  if v_request.case_outcome is not null then
    raise exception 'Case is already closed';
  end if;

  if exists (
    select 1
    from public.order_case_updates u
    where u.support_request_id = p_request_id
      and u.event_type = 'refund_completed'
  ) then
    raise exception 'Refund has already been marked completed';
  end if;

  if v_request.status::text not in ('refund_pending', 'partial_refund_pending') then
    raise exception 'Refund can only be marked completed from refund pending status';
  end if;

  v_prior_status := v_request.status::text;
  v_outcome := public.infer_refund_case_outcome(
    v_request.case_outcome,
    v_prior_status,
    v_request.refund_amount_pence
  );

  v_refund_message := coalesce(
    v_customer,
    'The refund has now been completed.'
  );

  update public.orders
  set
    fulfilment_status = 'refunded'::public.order_fulfilment_status,
    protection_status = 'refunded',
    payout_status = 'cancelled'::public.payout_status,
    payout_release_at = null
  where id = v_request.order_id;

  perform public.set_skip_support_case_trigger(true);

  update public.transaction_support_requests
  set
    status = 'closed'::public.support_request_status,
    case_outcome = v_outcome,
    admin_notes = coalesce(v_note, admin_notes),
    resolution_notes = coalesce(v_customer, resolution_notes),
    refund_reference = coalesce(v_reference, refund_reference),
    refund_completed_at = now(),
    refund_completed_by = v_uid,
    resolved_at = coalesce(resolved_at, now()),
    reviewed_by = coalesce(reviewed_by, v_uid),
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_request_id
  returning * into v_request;

  perform public.set_skip_support_case_trigger(false);

  perform public.record_order_case_update(
    v_request.order_id,
    null,
    v_request.id,
    'refund_completed',
    'refund_completed',
    v_refund_message,
    v_note,
    v_uid
  );

  perform public.record_order_case_update(
    v_request.order_id,
    null,
    v_request.id,
    'case_closed',
    'closed',
    v_close_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_request.buyer_id,
    'support_request_resolved',
    'Case closed',
    v_close_message,
    '/orders/' || v_request.order_id::text
  );
  perform public.create_notification(
    v_request.seller_id,
    'support_request_resolved',
    'Case closed',
    v_close_message,
    '/orders/' || v_request.order_id::text
  );

  return v_request;
end;
$$;

revoke all on function public.admin_mark_support_refund_completed(uuid, text, text, text) from public;
grant execute on function public.admin_mark_support_refund_completed(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Manual close — non-refund outcomes only (refund outcomes use mark completed)
-- ---------------------------------------------------------------------------

create or replace function public.admin_close_dispute_case(
  p_dispute_id uuid,
  p_case_outcome text,
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
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_outcome text := nullif(trim(coalesce(p_case_outcome, '')), '');
  v_message text;
  v_can_close boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_outcome is null or v_outcome not in (
    'buyer_upheld_full_refund',
    'buyer_upheld_partial_refund',
    'seller_upheld',
    'mutual_agreement',
    'outside_buyer_protection',
    'duplicate',
    'cancelled'
  ) then
    raise exception 'A valid case outcome is required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.case_outcome is not null then
    raise exception 'Case is already closed';
  end if;

  if v_outcome in ('buyer_upheld_full_refund', 'buyer_upheld_partial_refund')
    and v_dispute.status <> 'refund_completed' then
    raise exception 'Refund outcomes are set automatically when marking a refund completed';
  end if;

  v_can_close := v_dispute.status in (
    'refund_completed',
    'rejected',
    'resolved',
    'resolved_buyer',
    'resolved_seller',
    'open',
    'under_review',
    'awaiting_buyer_evidence',
    'awaiting_seller_evidence'
  );

  if not v_can_close then
    raise exception 'This dispute cannot be closed in its current status';
  end if;

  v_message := coalesce(v_customer, 'This case has now been resolved and closed.');

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'resolved',
    case_outcome = v_outcome,
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
    'case_closed',
    'resolved',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_resolved_buyer',
    'Case closed',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_resolved_seller',
    'Case closed',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_close_dispute_case(uuid, text, text, text) from public;
grant execute on function public.admin_close_dispute_case(uuid, text, text, text) to authenticated;

create or replace function public.admin_close_support_case(
  p_request_id uuid,
  p_case_outcome text,
  p_admin_note text default null,
  p_customer_message text default null
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_outcome text := nullif(trim(coalesce(p_case_outcome, '')), '');
  v_message text;
  v_can_close boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_outcome is null or v_outcome not in (
    'buyer_upheld_full_refund',
    'buyer_upheld_partial_refund',
    'seller_upheld',
    'mutual_agreement',
    'outside_buyer_protection',
    'duplicate',
    'cancelled'
  ) then
    raise exception 'A valid case outcome is required';
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  if v_request.case_outcome is not null then
    raise exception 'Case is already closed';
  end if;

  if v_outcome in ('buyer_upheld_full_refund', 'buyer_upheld_partial_refund')
    and v_request.status::text <> 'refund_completed' then
    raise exception 'Refund outcomes are set automatically when marking a refund completed';
  end if;

  v_can_close := v_request.status::text in (
    'refund_completed',
    'rejected',
    'resolved',
    'open',
    'reviewing',
    'awaiting_buyer_evidence',
    'awaiting_seller_evidence'
  );

  if not v_can_close then
    raise exception 'This support request cannot be closed in its current status';
  end if;

  v_message := coalesce(v_customer, 'This case has now been resolved and closed.');

  perform public.set_skip_support_case_trigger(true);

  update public.transaction_support_requests
  set
    status = 'closed'::public.support_request_status,
    case_outcome = v_outcome,
    admin_notes = coalesce(v_note, admin_notes),
    resolution_notes = coalesce(v_customer, resolution_notes),
    resolved_at = coalesce(resolved_at, now()),
    reviewed_by = coalesce(reviewed_by, v_uid),
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_request_id
  returning * into v_request;

  perform public.set_skip_support_case_trigger(false);

  perform public.record_order_case_update(
    v_request.order_id,
    null,
    v_request.id,
    'case_closed',
    'closed',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_request.buyer_id,
    'support_request_resolved',
    'Case closed',
    v_message,
    '/orders/' || v_request.order_id::text
  );
  perform public.create_notification(
    v_request.seller_id,
    'support_request_resolved',
    'Case closed',
    v_message,
    '/orders/' || v_request.order_id::text
  );

  return v_request;
end;
$$;

revoke all on function public.admin_close_support_case(uuid, text, text, text) from public;
grant execute on function public.admin_close_support_case(uuid, text, text, text) to authenticated;
