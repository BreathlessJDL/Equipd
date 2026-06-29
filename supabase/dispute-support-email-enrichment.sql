-- =============================================================================
-- Enrich dispute/support team notification emails with reporter contact details
-- =============================================================================
--
-- Run after dispute-support-simplified-02-schema-functions.sql and
-- support-team-email-notifications.sql.
--
-- Adds reporter/buyer/seller names and emails plus evidence paths to the
-- metadata passed to notify_support_team_email (send-support-email edge function).

-- ---------------------------------------------------------------------------
-- Helpers: resolve display name + email for support notifications
-- ---------------------------------------------------------------------------

create or replace function public.support_team_user_contact(p_user_id uuid)
returns table (
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p.display_name, left(u.id::text, 8) || '…') as display_name,
    u.email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;
$$;

revoke all on function public.support_team_user_contact(uuid) from public;

create or replace function public.support_team_email_order_context(
  p_order_id uuid,
  p_reporter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_reporter record;
  v_buyer record;
  v_seller record;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select * into v_reporter from public.support_team_user_contact(p_reporter_id);
  select * into v_buyer from public.support_team_user_contact(v_order.buyer_id);
  select * into v_seller from public.support_team_user_contact(v_order.seller_id);

  return jsonb_build_object(
    'reporter_name', v_reporter.display_name,
    'reporter_email', v_reporter.email,
    'buyer_name', v_buyer.display_name,
    'buyer_email', v_buyer.email,
    'seller_name', v_seller.display_name,
    'seller_email', v_seller.email,
    'order_url_path', '/orders/' || p_order_id::text,
    'admin_orders_url_path', '/admin/orders'
  );
end;
$$;

revoke all on function public.support_team_email_order_context(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- create_transaction_support_request: enriched support email metadata
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
    public.support_team_email_order_context(v_order.id, v_uid)
    || jsonb_build_object(
      'request_id', v_request.id,
      'order_id', v_order.id,
      'listing_id', v_order.listing_id,
      'listing_title', v_listing_title,
      'reason', p_reason::text,
      'message', v_message,
      'description', v_message,
      'opened_by', v_uid,
      'opened_by_label', v_opened_by_label,
      'buyer_id', v_order.buyer_id,
      'seller_id', v_order.seller_id,
      'evidence_count', cardinality(coalesce(p_evidence_paths, '{}')),
      'evidence_paths', coalesce(to_jsonb(p_evidence_paths), '[]'::jsonb)
    )
  );

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- open_order_dispute: enriched dispute email metadata
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

  perform public.notify_support_team_email(
    'buyer_protection_dispute',
    public.support_team_email_order_context(v_order.id, v_uid)
    || jsonb_build_object(
      'dispute_id', v_dispute.id,
      'order_id', v_order.id,
      'listing_id', v_order.listing_id,
      'listing_title', v_listing_title,
      'order_type', v_order_type::text,
      'reason', p_reason,
      'description', v_description,
      'evidence_count', cardinality(p_evidence_paths),
      'evidence_paths', to_jsonb(p_evidence_paths),
      'buyer_id', v_order.buyer_id,
      'seller_id', v_order.seller_id
    )
  );

  return v_dispute;
end;
$$;
