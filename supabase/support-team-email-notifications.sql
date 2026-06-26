-- Equipd support team email notifications
-- Run after trust-safety-phase2-reporting.sql
--
-- Sends async email alerts to support@equipd.co.uk when:
-- - A transaction support request is created
-- - A Buyer Protection dispute is opened
-- - A Trust & Safety report is submitted
--
-- Requires:
-- 1. Deploy Edge Function: send-support-email
-- 2. Edge Function secrets:
--    RESEND_API_KEY
--    SUPPORT_EMAIL_WEBHOOK_SECRET (must match app_config.support_email_webhook_secret)
--    SUPPORT_EMAIL_TO=support@equipd.co.uk (optional)
--    SUPPORT_EMAIL_FROM=Equipd Support <notifications@equipd.co.uk> (optional)
--    EQUIPD_APP_URL=https://equipd.co.uk (optional)
-- 3. Configure public.app_config rows (see README step 47)

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Server-side config (not exposed to app users via PostgREST)
-- ---------------------------------------------------------------------------

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

revoke all on table public.app_config from public;
revoke all on table public.app_config from anon;
revoke all on table public.app_config from authenticated;

-- No RLS policies: authenticated and anon cannot read or write.
-- SQL editor (postgres) and service_role can manage rows.

insert into public.app_config (key, value)
values
  (
    'support_email_functions_base_url',
    'https://mhwvzovxlqimcuxvyyjf.supabase.co/functions/v1'
  ),
  ('support_email_webhook_secret', 'YOUR_SECRET')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Queue a support-team email via the send-support-email Edge Function.
-- Failures are logged and do not block the calling transaction.
-- ---------------------------------------------------------------------------

create or replace function public.notify_support_team_email(
  p_event_type text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret text;
  v_url text;
begin
  select nullif(trim(value), '')
  into v_base_url
  from public.app_config
  where key = 'support_email_functions_base_url';

  select nullif(trim(value), '')
  into v_secret
  from public.app_config
  where key = 'support_email_webhook_secret';

  if v_base_url is null then
    raise warning 'notify_support_team_email skipped: support_email_functions_base_url is not configured in app_config';
    return;
  end if;

  if v_secret is null or v_secret = 'YOUR_SECRET' then
    raise warning 'notify_support_team_email skipped: support_email_webhook_secret is not configured in app_config';
    return;
  end if;

  if p_event_type not in (
    'support_request',
    'buyer_protection_dispute',
    'trust_safety_report',
    'general_support'
  ) then
    raise warning 'notify_support_team_email skipped: unsupported event type %', p_event_type;
    return;
  end if;

  v_url := rtrim(v_base_url, '/') || '/send-support-email';

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-support-email-secret', v_secret
    ),
    body := jsonb_build_object(
      'eventType', p_event_type,
      'metadata', coalesce(p_metadata, '{}'::jsonb)
    )
  );
exception
  when others then
    raise warning 'notify_support_team_email failed for %: %', p_event_type, sqlerrm;
end;
$$;

revoke all on function public.notify_support_team_email(text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Transaction support requests: email support after counterparty notification
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
  v_opened_by_label text;
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
      'seller_id', v_order.seller_id
    )
  );

  return v_request;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer Protection disputes: email support after buyer/seller notifications
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
    jsonb_build_object(
      'dispute_id', v_dispute.id,
      'order_id', v_order.id,
      'listing_id', v_order.listing_id,
      'listing_title', v_listing_title,
      'order_type', v_order_type::text,
      'reason', p_reason,
      'description', v_description,
      'evidence_count', cardinality(p_evidence_paths),
      'buyer_id', v_order.buyer_id,
      'seller_id', v_order.seller_id
    )
  );

  return v_dispute;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trust & Safety reports: email support when a report is created
-- ---------------------------------------------------------------------------

create or replace function public.create_report(
  p_report_type text,
  p_reason text,
  p_description text default null,
  p_reported_user_id uuid default null,
  p_listing_id uuid default null,
  p_conversation_id uuid default null,
  p_message_id uuid default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_description text := nullif(trim(p_description), '');
  v_listing public.listings;
  v_conversation public.conversations;
  v_message public.messages;
  v_reported_user_id uuid := p_reported_user_id;
  v_report public.reports;
  v_reporter_label text;
  v_listing_title text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_report_type not in ('listing', 'user', 'conversation', 'message') then
    raise exception 'Invalid report type';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Please choose a reason';
  end if;

  if p_reason = 'other' and v_description is null then
    raise exception 'Please describe the issue when selecting Other';
  end if;

  if p_report_type = 'listing' then
    if p_reason not in (
      'suspected_fraud',
      'misleading_listing',
      'prohibited_item',
      'duplicate_listing',
      'incorrect_category',
      'offensive_content',
      'other'
    ) then
      raise exception 'Invalid reason for listing report';
    end if;

    if p_listing_id is null then
      raise exception 'Listing is required';
    end if;

    select *
    into v_listing
    from public.listings
    where id = p_listing_id;

    if not found then
      raise exception 'Listing not found';
    end if;

    if v_listing.seller_id = v_uid then
      raise exception 'You cannot report your own listing';
    end if;

    v_reported_user_id := v_listing.seller_id;
    v_listing_title := v_listing.title;
  elsif p_report_type = 'user' then
    if p_reason not in (
      'requested_off_platform_payment',
      'suspicious_behaviour',
      'harassment',
      'no_show',
      'abusive_language',
      'fraud',
      'other'
    ) then
      raise exception 'Invalid reason for user report';
    end if;

    if v_reported_user_id is null then
      raise exception 'User is required';
    end if;

    if v_reported_user_id = v_uid then
      raise exception 'You cannot report yourself';
    end if;

    if not exists (select 1 from public.profiles where id = v_reported_user_id) then
      raise exception 'User not found';
    end if;
  elsif p_report_type in ('conversation', 'message') then
    if p_reason not in (
      'requested_off_platform_payment',
      'shared_contact_details',
      'harassment',
      'abusive_language',
      'suspicious_behaviour',
      'other'
    ) then
      raise exception 'Invalid reason for conversation report';
    end if;

    if p_report_type = 'conversation' then
      if p_conversation_id is null then
        raise exception 'Conversation is required';
      end if;

      select *
      into v_conversation
      from public.conversations
      where id = p_conversation_id;

      if not found then
        raise exception 'Conversation not found';
      end if;

      if v_conversation.buyer_id <> v_uid and v_conversation.seller_id <> v_uid then
        raise exception 'You are not a participant in this conversation';
      end if;

      v_reported_user_id := case
        when v_conversation.buyer_id = v_uid then v_conversation.seller_id
        else v_conversation.buyer_id
      end;
    else
      if p_message_id is null then
        raise exception 'Message is required';
      end if;

      select *
      into v_message
      from public.messages
      where id = p_message_id;

      if not found then
        raise exception 'Message not found';
      end if;

      select *
      into v_conversation
      from public.conversations
      where id = v_message.conversation_id;

      if v_conversation.buyer_id <> v_uid and v_conversation.seller_id <> v_uid then
        raise exception 'You are not a participant in this conversation';
      end if;

      v_reported_user_id := case
        when v_conversation.buyer_id = v_uid then v_conversation.seller_id
        else v_conversation.buyer_id
      end;
    end if;
  end if;

  if exists (
    select 1
    from public.reports r
    where r.reporter_id = v_uid
      and r.status = 'open'
      and (
        (p_listing_id is not null and r.listing_id = p_listing_id)
        or (
          p_report_type = 'user'
          and v_reported_user_id is not null
          and r.reported_user_id = v_reported_user_id
          and r.report_type = 'user'
        )
        or (p_conversation_id is not null and r.conversation_id = p_conversation_id)
        or (p_message_id is not null and r.message_id = p_message_id)
      )
  ) then
    raise exception 'You already have an open report for this item';
  end if;

  insert into public.reports (
    reporter_id,
    reported_user_id,
    listing_id,
    conversation_id,
    message_id,
    report_type,
    reason,
    description
  )
  values (
    v_uid,
    v_reported_user_id,
    p_listing_id,
    p_conversation_id,
    p_message_id,
    p_report_type,
    p_reason,
    v_description
  )
  returning * into v_report;

  select coalesce(p.display_name, left(v_uid::text, 8) || '…')
  into v_reporter_label
  from public.profiles p
  where p.id = v_uid;

  if v_listing_title is null and v_report.listing_id is not null then
    select l.title
    into v_listing_title
    from public.listings l
    where l.id = v_report.listing_id;
  end if;

  perform public.notify_support_team_email(
    'trust_safety_report',
    jsonb_build_object(
      'report_id', v_report.id,
      'report_type', v_report.report_type,
      'reason', v_report.reason,
      'description', v_report.description,
      'reporter_id', v_report.reporter_id,
      'reporter_label', v_reporter_label,
      'reported_user_id', v_report.reported_user_id,
      'listing_id', v_report.listing_id,
      'listing_title', v_listing_title,
      'conversation_id', v_report.conversation_id,
      'message_id', v_report.message_id
    )
  );

  return v_report;
end;
$$;

notify pgrst, 'reload schema';
