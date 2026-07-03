-- Post-QA: counter-offer emails, accepted counter-offer payment email, fulfilment delete trigger.

-- ---------------------------------------------------------------------------
-- listing_fulfilment_private delete trigger must return OLD (not NEW/null)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_fulfilment_private_seller_only()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_listing_seller(coalesce(NEW.listing_id, OLD.listing_id), v_uid) then
    raise exception 'Only the listing seller may change private fulfilment details';
  end if;

  if TG_OP = 'UPDATE' and NEW.listing_id is distinct from OLD.listing_id then
    raise exception 'Cannot reassign private fulfilment details to another listing';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- Extend notify_marketplace_email allowlist with counter_offer_received
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
    'password_changed'
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
-- Counter-offer received email (buyer or seller recipient)
-- ---------------------------------------------------------------------------

create or replace function public.notify_counter_offer_received_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_offer_id is null then
    return new;
  end if;

  if new.status <> 'pending'::public.offer_status then
    return new;
  end if;

  if coalesce(new.direction, 'buyer_to_seller') not in ('buyer_to_seller', 'seller_to_buyer') then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'counter_offer_received',
    jsonb_build_object('offerId', new.id)
  );

  return new;
end;
$$;

drop trigger if exists offers_email_counter_offer_received on public.offers;

create trigger offers_email_counter_offer_received
  after insert on public.offers
  for each row
  execute function public.notify_counter_offer_received_email();

-- ---------------------------------------------------------------------------
-- Offer accepted email also when buyer accepts a seller counter-offer
-- ---------------------------------------------------------------------------

create or replace function public.notify_offer_accepted_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'accepted'::public.offer_status then
    return new;
  end if;

  if old.status = 'accepted'::public.offer_status then
    return new;
  end if;

  if coalesce(new.direction, 'buyer_to_seller') not in ('buyer_to_seller', 'seller_to_buyer') then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'offer_accepted',
    jsonb_build_object('offerId', new.id)
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';
