-- Phase 3: transactional email audit log + async marketplace email triggers.
-- Requires: send-marketplace-email Edge Function deployed with MARKETPLACE_EMAIL_WEBHOOK_SECRET.
-- Reuses app_config.support_email_functions_base_url for the functions base URL.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.transactional_email_log (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  recipient_email text,
  recipient_user_id uuid references auth.users (id) on delete set null,
  related_order_id uuid references public.orders (id) on delete set null,
  related_offer_id uuid references public.offers (id) on delete set null,
  related_listing_id uuid references public.listings (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped', 'failed')),
  provider_message_id text,
  idempotency_key text not null,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz
);

create unique index if not exists transactional_email_log_idempotency_key_idx
  on public.transactional_email_log (idempotency_key);

create index if not exists transactional_email_log_template_key_created_idx
  on public.transactional_email_log (template_key, created_at desc);

create index if not exists transactional_email_log_recipient_user_id_idx
  on public.transactional_email_log (recipient_user_id, created_at desc);

alter table public.transactional_email_log enable row level security;

revoke all on table public.transactional_email_log from public;
revoke all on table public.transactional_email_log from anon;
revoke all on table public.transactional_email_log from authenticated;

-- No RLS policies: only service_role / SQL editor can read or write.

insert into public.app_config (key, value)
values ('marketplace_email_webhook_secret', 'YOUR_MARKETPLACE_EMAIL_SECRET')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Queue marketplace transactional email via send-marketplace-email Edge Function.
-- Failures are logged and do not block the calling transaction.
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
    'new_order_received'
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

revoke all on function public.notify_marketplace_email(text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Offer received (seller) — buyer's new offer only (not counters).
-- ---------------------------------------------------------------------------

create or replace function public.notify_offer_received_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_offer_id is not null then
    return new;
  end if;

  if coalesce(new.direction, 'buyer_to_seller') <> 'buyer_to_seller' then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'offer_received',
    jsonb_build_object('offer_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists offers_email_offer_received on public.offers;

create trigger offers_email_offer_received
  after insert on public.offers
  for each row
  execute function public.notify_offer_received_email();

-- ---------------------------------------------------------------------------
-- Offer accepted (buyer) — seller accepted buyer's offer.
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

  if coalesce(new.direction, 'buyer_to_seller') <> 'buyer_to_seller' then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'offer_accepted',
    jsonb_build_object('offer_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists offers_email_offer_accepted on public.offers;

create trigger offers_email_offer_accepted
  after update of status on public.offers
  for each row
  execute function public.notify_offer_accepted_email();

notify pgrst, 'reload schema';
