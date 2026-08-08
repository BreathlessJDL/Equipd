-- Transactional email: notify the listing owner when another user saves their listing.
-- Email failures must never roll back a saved favourite (notify_marketplace_email catches errors).

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
    'message_received',
    'equipment_item_saved'
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
-- Listing saved (seller) — AFTER INSERT on saved_listings only.
-- Self-saves are skipped. Unsave does not notify. Duplicate saver/listing
-- emails are blocked by transactional_email_log idempotency in the Edge Function.
-- ---------------------------------------------------------------------------

create or replace function public.notify_listing_saved_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
begin
  if new.user_id is null or new.listing_id is null then
    return new;
  end if;

  select l.seller_id
  into v_seller_id
  from public.listings l
  where l.id = new.listing_id;

  if v_seller_id is null then
    return new;
  end if;

  if new.user_id = v_seller_id then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'equipment_item_saved',
    jsonb_build_object(
      'listingId', new.listing_id,
      'saverUserId', new.user_id,
      'savedListingId', new.id
    )
  );

  return new;
exception
  when others then
    raise warning 'notify_listing_saved_email failed for saved listing %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists saved_listings_notify_listing_saved_email on public.saved_listings;

create trigger saved_listings_notify_listing_saved_email
  after insert on public.saved_listings
  for each row
  execute function public.notify_listing_saved_email();

notify pgrst, 'reload schema';
