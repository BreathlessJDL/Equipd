-- Batch 1: post-payment phone exchange in paid-order conversations,
-- offer-accepted handover copy, and account deletion / anonymisation foundation.
-- Do not apply to production from this change set without a reviewed deploy.

-- ---------------------------------------------------------------------------
-- 1. Paid-order phone exchange (authoritative on the server)
-- ---------------------------------------------------------------------------

create or replace function public.conversation_allows_phone_exchange(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  if p_conversation_id is null or p_user_id is null then
    return false;
  end if;

  if auth.role() is distinct from 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_user_id then
      return false;
    end if;
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found then
    return false;
  end if;

  if p_user_id is distinct from v_conversation.buyer_id
     and p_user_id is distinct from v_conversation.seller_id then
    return false;
  end if;

  return exists (
    select 1
    from public.orders o
    join public.offers off on off.id = o.offer_id
    join public.payments pay on pay.id = o.payment_id
    where off.conversation_id = v_conversation.id
      and o.listing_id = v_conversation.listing_id
      and o.buyer_id = v_conversation.buyer_id
      and o.seller_id = v_conversation.seller_id
      and (p_user_id = o.buyer_id or p_user_id = o.seller_id)
      and pay.status = 'paid'::public.payment_status
      and o.fulfilment_status::text not in ('cancelled', 'refunded')
  );
end;
$$;

revoke all on function public.conversation_allows_phone_exchange(uuid, uuid) from public;
grant execute on function public.conversation_allows_phone_exchange(uuid, uuid) to authenticated, service_role;

create or replace function public.marketplace_message_phone_block_message()
returns text
language sql
immutable
as $$
  select 'Please keep phone numbers on Equipd until payment is confirmed. Once this order is paid, you can share a contact number in this conversation. Collection and delivery details stay in Order Details after payment.';
$$;

drop function if exists public.marketplace_message_is_blocked(text);

create or replace function public.marketplace_message_is_blocked(
  p_body text,
  p_allow_phone boolean default false
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_text text := coalesce(trim(p_body), '');
  v_price_context boolean;
  v_skip_location_rules boolean;
begin
  if v_text = '' then
    return true;
  end if;

  if v_text ~* '\y\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|cm|mm|m|metres?|meters?|miles?|mi|hours?|hrs?|hr)\y' then
    return false;
  end if;

  v_price_context := public.marketplace_message_has_price_context(v_text);
  v_skip_location_rules :=
    v_price_context
    and not public.marketplace_message_has_street_terms(v_text)
    and not public.marketplace_message_has_address_intent(v_text);

  if v_text ~* '\y[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\y' then
    return true;
  end if;

  if v_text ~* '(?:https?://|www\.)[^\s]+' then
    return true;
  end if;

  if v_text ~* '\y(?:[a-z0-9-]+\.)+(?:com|co\.uk|net|org|io|me|app)(?:/[^\s]*)?\y' then
    return true;
  end if;

  if not coalesce(p_allow_phone, false) then
    if v_text ~ '(?:\+?\d[\d\s().-]{7,}\d)' then
      return true;
    end if;
  end if;

  if v_text ~ '(?:^|\s)@[A-Za-z0-9._]{2,}\y' then
    return true;
  end if;

  if v_text ~* '\ywhatsapp\y' then
    return true;
  end if;

  if v_text ~* '\y(?:telegram|signal|instagram|insta|facebook|fb|snapchat|tiktok|twitter|discord)\y' then
    return true;
  end if;

  if v_text ~* '\y(?:email me|message me on|contact me on|add me on|dm me|reach me on)\y' then
    return true;
  end if;

  if not coalesce(p_allow_phone, false) then
    if v_text ~* '\y(?:call me|text me|my number is|phone number|mobile number|send me your number)\y' then
      return true;
    end if;
  end if;

  if v_text ~* '\y(?:pay outside equipd|pay off platform|outside equipd|off platform|direct payment)\y' then
    return true;
  end if;

  if v_text ~* '\y(?:bank transfer|wire transfer|sort code|account number|bacs|faster payment)\y' then
    return true;
  end if;

  if v_text ~* '\y(?:cash on collection|pay cash|pay in cash|cash payment|cash instead|can i pay cash|cash only|cash in hand)\y' then
    return true;
  end if;

  if v_text ~* '(?:£\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?)\s+cash\y' then
    return true;
  end if;

  if v_text ~* '\y(?:paypal(?:\.me)?|venmo)\y' then
    return true;
  end if;

  if not v_skip_location_rules then
    if v_text ~* '\y(?:GIR\s?0AA|[A-Z]{1,2}\d{1,2}[A-Z]?(?:\s+\d[A-Z]{2}|\d[A-Z]{2}))\y' then
      return true;
    end if;

    if v_text ~* '\y(?:(?:flat|unit|apartment)\s+\d+[A-Za-z]?(?:\s*,\s*|\s+)\d+|unit\s+\d+[A-Za-z]?\s*(?:,?\s*)?(?:industrial estate|business park)|(?:unit\s+\d+[A-Za-z]?\s*,?\s*)?(?:industrial estate|business park)|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)*(?:road|avenue|crescent|terrace|high street)\y|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)+street\y|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)+(?:lane|drive|close|court|way|place)\y|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)+(?:rd|st|ave|dr|ln)\y)' then
      return true;
    end if;

    if v_text ~* '\y(?:collect from my (?:house|home|address|place)|come to my (?:house|home|address|place)|(?:i''ll|i will)\s+send (?:you\s+)?my address|meet (?:at|me at)\s+my (?:house|home|address|place)|pick up from|collect at|my postcode is|(?:my\s+)?address is)\y' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.assert_marketplace_message_allowed(
  p_body text,
  p_conversation_id uuid,
  p_sender_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trimmed text := trim(coalesce(p_body, ''));
  v_allow_phone boolean := false;
  v_recent record;
  v_recent_bodies text[] := array[]::text[];
  v_combined text;
  v_i integer;
  v_j integer;
  v_tail text[];
begin
  if v_trimmed = '' then
    raise exception 'Message cannot be empty.';
  end if;

  v_allow_phone := public.conversation_allows_phone_exchange(p_conversation_id, p_sender_id);

  if public.marketplace_message_is_blocked(v_trimmed, false)
     and not public.marketplace_message_is_blocked(v_trimmed, true)
     and not v_allow_phone then
    raise exception '%', public.marketplace_message_phone_block_message();
  end if;

  if public.marketplace_message_is_blocked(v_trimmed, v_allow_phone) then
    raise exception '%', public.marketplace_message_block_message();
  end if;

  if p_conversation_id is not null and p_sender_id is not null then
    for v_recent in
      select m.body
      from public.messages m
      where m.conversation_id = p_conversation_id
        and m.sender_id = p_sender_id
        and m.message_type = 'text'::public.message_type
        and m.created_at >= now() - interval '10 minutes'
      order by m.created_at desc
      limit 5
    loop
      v_recent_bodies := array_prepend(trim(v_recent.body), v_recent_bodies);
    end loop;

    v_tail := v_recent_bodies || v_trimmed;

    for v_i in 1 .. coalesce(array_length(v_tail, 1), 0)
    loop
      for v_j in v_i + 1 .. coalesce(array_length(v_tail, 1), 0)
      loop
        v_combined := array_to_string(v_tail[v_i:v_j], ' ');

        if public.marketplace_message_is_blocked(v_combined, false)
           and not public.marketplace_message_is_blocked(v_combined, true)
           and not v_allow_phone then
          raise exception '%', public.marketplace_message_phone_block_message();
        end if;

        if public.marketplace_message_is_blocked(v_combined, v_allow_phone) then
          raise exception '%', public.marketplace_message_block_message();
        end if;
      end loop;
    end loop;
  end if;

  return v_trimmed;
end;
$$;

revoke all on function public.assert_marketplace_message_allowed(text, uuid, uuid) from public;
grant execute on function public.assert_marketplace_message_allowed(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Offer accepted system copy — payment first, then Order Details
-- ---------------------------------------------------------------------------

create or replace function public.offer_accepted_handover_system_message(
  p_is_counter boolean
)
returns text
language sql
immutable
as $$
  select case
    when p_is_counter then
      'Counter-offer accepted! Complete your payment to secure the equipment. Once payment is confirmed, you can find contact details and collection or delivery information in your Order Details.'
    else
      'Offer accepted! Complete your payment to secure the equipment. Once payment is confirmed, you can find contact details and collection or delivery information in your Order Details.'
  end;
$$;

create or replace function public.accept_offer_with_inventory(
  p_offer_id uuid,
  p_expected_direction text
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_listing public.listings;
  v_listing_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_expected_direction not in ('buyer_to_seller', 'seller_to_buyer') then
    raise exception 'Invalid offer direction';
  end if;

  select listing_id into v_listing_id
  from public.offers where id = p_offer_id;
  if v_listing_id is null then raise exception 'Offer not found'; end if;

  select * into v_listing
  from public.listings where id = v_listing_id for update;
  if not found then raise exception 'Listing not found or seller mismatch'; end if;

  select * into v_offer
  from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;

  if v_offer.listing_id <> v_listing.id then
    raise exception 'Offer listing changed during acceptance';
  end if;
  if v_offer.direction <> p_expected_direction then
    raise exception 'Offer direction does not match acceptance flow';
  end if;
  if p_expected_direction = 'buyer_to_seller' and v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can accept this offer';
  end if;
  if p_expected_direction = 'seller_to_buyer' and v_offer.buyer_id <> v_uid then
    raise exception 'Only the buyer can accept this counter-offer';
  end if;
  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be accepted';
  end if;
  if v_offer.quantity < 1
     or v_offer.amount_pence <= 0
     or v_offer.amount_pence % v_offer.quantity <> 0 then
    raise exception 'Invalid offer quantity or indivisible total';
  end if;
  if v_listing.seller_id <> v_offer.seller_id then
    raise exception 'Listing not found or seller mismatch';
  end if;
  if v_listing.status <> 'active'::public.listing_status
     or v_listing.quantity_available < v_offer.quantity then
    raise exception 'Insufficient inventory: requested %, available %',
      v_offer.quantity, coalesce(v_listing.quantity_available, 0);
  end if;

  update public.listings
  set
    quantity_available = quantity_available - v_offer.quantity,
    quantity_reserved = quantity_reserved + v_offer.quantity,
    inventory_version = inventory_version + 1,
    status = case
      when quantity_available - v_offer.quantity > 0 then 'active'::public.listing_status
      else 'reserved'::public.listing_status
    end
  where id = v_listing.id
  returning * into v_listing;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = v_offer.id;

  if v_listing.quantity_total = 1 then
    update public.offers
    set status = 'rejected'::public.offer_status
    where listing_id = v_offer.listing_id
      and id <> v_offer.id
      and status = 'pending'::public.offer_status;
  end if;

  perform public.create_payment_and_order_for_accepted_offer(
    (select o from public.offers o where o.id = v_offer.id)
  );

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      public.offer_accepted_handover_system_message(
        p_expected_direction = 'seller_to_buyer'
      )
    );
  end if;

  select * into v_offer from public.offers where id = p_offer_id;
  return v_offer;
end;
$$;

revoke all on function public.accept_offer_with_inventory(uuid, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Account deletion / anonymisation (no Auth cascade; no client privilege)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  add column if not exists deletion_requested_at timestamptz;

create index if not exists profiles_deleted_at_idx
  on public.profiles (deleted_at)
  where deleted_at is not null;

comment on column public.profiles.deleted_at is
  'Set by server-side account anonymisation. Profile row is retained for financial and legal records.';

create table if not exists public.account_deletion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  blockers jsonb,
  stripe_account_id_retained text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_events enable row level security;

revoke all on public.account_deletion_events from public, anon, authenticated;

create or replace function public.prevent_profile_deletion_client_updates()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.deleted_at is not null or new.deletion_requested_at is not null then
      raise exception 'Account deletion fields can only be set by the server';
    end if;
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at
     or new.deletion_requested_at is distinct from old.deletion_requested_at then
    raise exception 'Account deletion fields can only be updated by the server';
  end if;

  if old.deleted_at is not null then
    raise exception 'This account has been deleted.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_deletion_client_updates on public.profiles;
create trigger profiles_prevent_deletion_client_updates
  before insert or update on public.profiles
  for each row
  execute function public.prevent_profile_deletion_client_updates();

create or replace function public.listing_is_publicly_visible(
  p_listing public.listings
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    not coalesce(p_listing.is_test_data, false)
    and p_listing.status = 'active'::public.listing_status
    and p_listing.quantity_available > 0
    and (
      p_listing.source is distinct from 'import'::public.listing_source
      or public.listing_has_images(p_listing.id)
    )
    and not exists (
      select 1
      from public.profiles seller
      where seller.id = p_listing.seller_id
        and (
          seller.is_suspended = true
          or seller.deleted_at is not null
        )
    );
$$;

create or replace function public.evaluate_account_deletion(
  p_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_blockers jsonb := '[]'::jsonb;
  v_active_orders integer := 0;
  v_open_disputes integer := 0;
  v_pending_payouts integer := 0;
  v_pending_refunds integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    if v_caller is null then
      raise exception 'Authentication required';
    end if;
    if p_user_id is distinct from v_caller then
      raise exception 'You can only evaluate deletion for your own account';
    end if;
  end if;

  if p_user_id is null then
    raise exception 'Authentication required';
  end if;

  select count(*)
  into v_active_orders
  from public.orders o
  where (o.buyer_id = p_user_id or o.seller_id = p_user_id)
    and o.fulfilment_status::text not in ('completed', 'cancelled', 'refunded');

  select count(*)
  into v_open_disputes
  from public.order_disputes d
  where (d.buyer_id = p_user_id or d.seller_id = p_user_id)
    and d.status in ('open', 'under_review');

  select count(*)
  into v_pending_refunds
  from public.orders o
  where (o.buyer_id = p_user_id or o.seller_id = p_user_id)
    and o.fulfilment_status::text in ('refund_pending');

  select count(*)
  into v_pending_payouts
  from public.orders o
  join public.payments pay on pay.id = o.payment_id
  where o.seller_id = p_user_id
    and pay.status = 'paid'::public.payment_status
    and o.payout_status::text in (
      'ready',
      'processing',
      'awaiting_seller_setup',
      'on_hold',
      'failed'
    );

  if v_active_orders > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'active_orders',
      'message', 'You have orders that are still in progress, awaiting payment, or not fully completed.'
    ));
  end if;

  if v_open_disputes > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_disputes',
      'message', 'You have an open dispute that must be resolved before your account can be deleted.'
    ));
  end if;

  if v_pending_refunds > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'pending_refunds',
      'message', 'You have an unresolved refund. Contact Equipd support if you need help completing it.'
    ));
  end if;

  if v_pending_payouts > 0 then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'pending_payouts',
      'message', 'You have a pending payout. Wait until it is paid before deleting your account.'
    ));
  end if;

  return jsonb_build_object(
    'allowed', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'counts', jsonb_build_object(
      'activeOrders', v_active_orders,
      'openDisputes', v_open_disputes,
      'pendingRefunds', v_pending_refunds,
      'pendingPayouts', v_pending_payouts
    )
  );
end;
$$;

revoke all on function public.evaluate_account_deletion(uuid) from public;
grant execute on function public.evaluate_account_deletion(uuid) to authenticated, service_role;

create or replace function public.anonymize_deleted_account(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluation jsonb;
  v_username text;
  v_stripe_account_id text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account deletion can only be completed by the server';
  end if;

  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.deleted_at is not null
  ) then
    return jsonb_build_object('ok', true, 'alreadyDeleted', true);
  end if;

  select stripe_account_id into v_stripe_account_id
  from public.profiles
  where id = p_user_id;

  v_evaluation := public.evaluate_account_deletion(p_user_id);
  if coalesce((v_evaluation ->> 'allowed')::boolean, false) is not true then
    return jsonb_build_object(
      'ok', false,
      'evaluation', v_evaluation
    );
  end if;

  v_username := 'gone_' || substr(replace(p_user_id::text, '-', ''), 1, 8);

  update public.listings
  set status = 'archived'::public.listing_status
  where seller_id = p_user_id
    and coalesce(quantity_reserved, 0) = 0
    and status in (
      'draft'::public.listing_status,
      'active'::public.listing_status
    );

  if to_regclass('public.saved_listings') is not null then
    delete from public.saved_listings
    where user_id = p_user_id;
  end if;

  if to_regclass('public.wanted_requests') is not null then
    update public.wanted_requests
    set status = 'archived'::public.wanted_request_status
    where user_id = p_user_id;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'wanted_requests'
        and column_name = 'contact_email'
    ) then
      update public.wanted_requests
      set contact_email = null
      where user_id = p_user_id;
    end if;
  end if;

  update public.profiles
  set
    username = v_username,
    display_name = 'Deleted account',
    location = null,
    latitude = null,
    longitude = null,
    avatar_url = null,
    last_active_at = null,
    is_suspended = true,
    suspended_at = coalesce(suspended_at, now()),
    suspension_reason = coalesce(suspension_reason, 'Account deleted by user'),
    deletion_requested_at = coalesce(deletion_requested_at, now()),
    deleted_at = now()
  where id = p_user_id;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('city', 'county', 'postcode')
  ) = 3 then
    update public.profiles
    set
      city = null,
      county = null,
      postcode = null
    where id = p_user_id;
  end if;

  insert into public.account_deletion_events (
    user_id,
    blockers,
    stripe_account_id_retained,
    completed_at
  )
  values (
    p_user_id,
    v_evaluation -> 'blockers',
    v_stripe_account_id,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'evaluation', v_evaluation,
    'stripeAccountIdRetained', v_stripe_account_id
  );
end;
$$;

revoke all on function public.anonymize_deleted_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_deleted_account(uuid) to service_role;

notify pgrst, 'reload schema';
