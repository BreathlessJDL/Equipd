-- Relax refund-completion RPC guards for live cases where case_outcome was set early
-- or dispute status diverged from order.fulfilment_status = refund_pending.

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
  v_order public.orders;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_reference text := nullif(trim(coalesce(p_refund_reference, '')), '');
  v_prior_status text;
  v_outcome text;
  v_refund_message text;
  v_close_message text := 'Case closed. Refund completed successfully.';
  v_order_refund_pending boolean := false;
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

  select *
  into v_order
  from public.orders
  where id = v_dispute.order_id;

  v_order_refund_pending := v_order.fulfilment_status = 'refund_pending'::public.order_fulfilment_status;

  if v_dispute.case_outcome is not null
     and v_dispute.status not in ('refund_pending', 'partial_refund_pending')
     and not v_order_refund_pending then
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

  if v_dispute.status not in ('refund_pending', 'partial_refund_pending')
     and not v_order_refund_pending then
    raise exception 'Refund can only be marked completed from refund pending status';
  end if;

  v_prior_status := case
    when v_dispute.status in ('refund_pending', 'partial_refund_pending') then v_dispute.status
    when v_order_refund_pending then 'refund_pending'
    else v_dispute.status
  end;

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
  v_order public.orders;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_reference text := nullif(trim(coalesce(p_refund_reference, '')), '');
  v_prior_status text;
  v_outcome text;
  v_refund_message text;
  v_close_message text := 'Case closed. Refund completed successfully.';
  v_order_refund_pending boolean := false;
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

  select *
  into v_order
  from public.orders
  where id = v_request.order_id;

  v_order_refund_pending := v_order.fulfilment_status = 'refund_pending'::public.order_fulfilment_status;

  if v_request.case_outcome is not null
     and v_request.status::text not in ('refund_pending', 'partial_refund_pending')
     and not v_order_refund_pending then
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

  if v_request.status::text not in ('refund_pending', 'partial_refund_pending')
     and not v_order_refund_pending then
    raise exception 'Refund can only be marked completed from refund pending status';
  end if;

  v_prior_status := case
    when v_request.status::text in ('refund_pending', 'partial_refund_pending') then v_request.status::text
    when v_order_refund_pending then 'refund_pending'
    else v_request.status::text
  end;

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

revoke all on function public.admin_mark_dispute_refund_completed(uuid, text, text, text) from public;
grant execute on function public.admin_mark_dispute_refund_completed(uuid, text, text, text) to authenticated;

revoke all on function public.admin_mark_support_refund_completed(uuid, text, text, text) from public;
grant execute on function public.admin_mark_support_refund_completed(uuid, text, text, text) to authenticated;
