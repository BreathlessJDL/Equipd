-- Transactional email: notify the other conversation participant when a text message is inserted.
-- Email failures must never roll back a stored message (notify_marketplace_email catches errors).

create or replace function public.notify_marketplace_email(
  p_event_key text,
  p_payload jsonb default '{}'::jsonb
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
  if p_event_key not in (
    'offer_received',
    'counter_offer_received',
    'offer_accepted',
    'payment_successful',
    'new_order_received',
    'buyer_delivery_details_added',
    'collection_confirmed',
    'courier_dispatched',
    'delivery_confirmed',
    'buyer_protection_started',
    'dispute_opened',
    'evidence_requested',
    'return_authorised',
    'collection_arranged',
    'refund_pending',
    'refund_completed_case_closed',
    'case_closed_no_refund',
    'review_available',
    'review_received',
    'payout_released',
    'seller_onboarding_required',
    'welcome',
    'email_changed',
    'password_changed',
    'message_received'
  ) then
    raise warning 'notify_marketplace_email skipped: unsupported event key %', p_event_key;
    return;
  end if;

  select nullif(trim(value), '')
  into v_base_url
  from public.app_config
  where key = 'support_email_functions_base_url';

  select nullif(trim(value), '')
  into v_secret
  from public.app_config
  where key = 'marketplace_email_webhook_secret';

  if v_base_url is null then
    raise warning 'notify_marketplace_email skipped: support_email_functions_base_url is not configured in app_config';
    return;
  end if;

  if v_secret is null or v_secret = 'YOUR_MARKETPLACE_EMAIL_SECRET' then
    raise warning 'notify_marketplace_email skipped: marketplace_email_webhook_secret is not configured in app_config';
    return;
  end if;

  v_url := rtrim(v_base_url, '/') || '/send-marketplace-email';

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-marketplace-email-secret', v_secret
    ),
    body := jsonb_build_object(
      'eventKey', p_event_key,
      'payload', coalesce(p_payload, '{}'::jsonb)
    )
  );
exception
  when others then
    raise warning 'notify_marketplace_email failed for %: %', p_event_key, sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Message received (other participant) — text messages only.
-- Offer/system messages keep their own email paths (or none).
-- Bell notifications remain disabled via notify_message_received() no-op.
-- ---------------------------------------------------------------------------

create or replace function public.notify_message_received_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_seller_id uuid;
  v_recipient_id uuid;
begin
  if new.message_type is distinct from 'text'::public.message_type then
    return new;
  end if;

  if new.sender_id is null then
    return new;
  end if;

  select c.buyer_id, c.seller_id
  into v_buyer_id, v_seller_id
  from public.conversations c
  where c.id = new.conversation_id;

  if not found then
    return new;
  end if;

  if new.sender_id = v_buyer_id then
    v_recipient_id := v_seller_id;
  elsif new.sender_id = v_seller_id then
    v_recipient_id := v_buyer_id;
  else
    return new;
  end if;

  if v_recipient_id is null or v_recipient_id = new.sender_id then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'message_received',
    jsonb_build_object(
      'messageId', new.id,
      'conversationId', new.conversation_id,
      'senderId', new.sender_id,
      'recipientUserId', v_recipient_id
    )
  );

  return new;
exception
  when others then
    raise warning 'notify_message_received_email failed for message %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists messages_notify_message_received_email on public.messages;

create trigger messages_notify_message_received_email
  after insert on public.messages
  for each row
  execute function public.notify_message_received_email();

notify pgrst, 'reload schema';
