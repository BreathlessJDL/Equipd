-- Phase 4: fulfilment transactional email triggers.

-- ---------------------------------------------------------------------------
-- Extend notify_marketplace_email allowlist
-- ---------------------------------------------------------------------------

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
    'offer_accepted',
    'payment_successful',
    'new_order_received',
    'buyer_delivery_details_added',
    'collection_confirmed',
    'courier_dispatched',
    'delivery_confirmed',
    'buyer_protection_started'
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
-- Buyer delivery details submitted (seller)
-- ---------------------------------------------------------------------------

create or replace function public.notify_buyer_delivery_details_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.delivery_details_submitted_at is not null
     and (tg_op = 'INSERT' or old.delivery_details_submitted_at is null) then
    perform public.notify_marketplace_email(
      'buyer_delivery_details_added',
      jsonb_build_object('orderId', new.order_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists order_delivery_details_email_buyer_details on public.order_delivery_details;

create trigger order_delivery_details_email_buyer_details
  after insert or update on public.order_delivery_details
  for each row
  execute function public.notify_buyer_delivery_details_email();

-- ---------------------------------------------------------------------------
-- Collection / handover confirmed, courier dispatched, delivery confirmed,
-- buyer protection started (orders table transitions)
-- ---------------------------------------------------------------------------

create or replace function public.notify_orders_fulfilment_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.collection_confirmed_at is not null and old.collection_confirmed_at is null then
    perform public.notify_marketplace_email(
      'collection_confirmed',
      jsonb_build_object('orderId', new.id, 'recipientRole', 'seller')
    );
    perform public.notify_marketplace_email(
      'collection_confirmed',
      jsonb_build_object('orderId', new.id, 'recipientRole', 'buyer')
    );
  end if;

  if new.courier_evidence_submitted_at is not null and old.courier_evidence_submitted_at is null then
    perform public.notify_marketplace_email(
      'courier_dispatched',
      jsonb_build_object('orderId', new.id)
    );
  end if;

  if new.courier_delivered_at is not null and old.courier_delivered_at is null then
    perform public.notify_marketplace_email(
      'delivery_confirmed',
      jsonb_build_object('orderId', new.id, 'recipientRole', 'seller')
    );
    perform public.notify_marketplace_email(
      'delivery_confirmed',
      jsonb_build_object('orderId', new.id, 'recipientRole', 'buyer')
    );
  end if;

  if new.payout_release_at is not null and old.payout_release_at is null then
    perform public.notify_marketplace_email(
      'buyer_protection_started',
      jsonb_build_object('orderId', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_email_fulfilment on public.orders;

create trigger orders_email_fulfilment
  after update on public.orders
  for each row
  execute function public.notify_orders_fulfilment_emails();

notify pgrst, 'reload schema';
