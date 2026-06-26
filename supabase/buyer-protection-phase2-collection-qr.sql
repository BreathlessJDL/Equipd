-- Equipd Buyer Protection / Order Lifecycle — Phase 2 (Collection QR)
-- Run after buyer-protection-phase1b-columns-functions.sql
-- Safe to re-run (idempotent where possible).

-- ---------------------------------------------------------------------------
-- Collection QR columns on orders
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists collection_qr_token text,
  add column if not exists collection_qr_expires_at timestamptz,
  add column if not exists collection_confirmed_by uuid references public.profiles (id),
  add column if not exists collection_confirmed_at timestamptz,
  add column if not exists collection_confirmation_checks jsonb,
  add column if not exists collection_confirmation_ip text,
  add column if not exists collection_confirmation_user_agent text;

create unique index if not exists orders_collection_qr_token_unique_idx
  on public.orders (collection_qr_token)
  where collection_qr_token is not null;

alter table public.orders
  drop constraint if exists orders_collection_confirmation_checks_object;

alter table public.orders
  add constraint orders_collection_confirmation_checks_object
  check (
    collection_confirmation_checks is null
    or jsonb_typeof(collection_confirmation_checks) = 'object'
  );

-- ---------------------------------------------------------------------------
-- Seller: generate or refresh collection QR token
-- ---------------------------------------------------------------------------

create or replace function public.generate_collection_qr_token(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_token text;
  v_expires_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.seller_id <> v_uid then
    raise exception 'Only the seller can generate a collection QR code for this order';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'collection'::public.order_type then
    raise exception 'Collection QR is only available for collection orders';
  end if;

  if v_order.fulfilment_status <> 'awaiting_collection'::public.order_fulfilment_status then
    raise exception 'Collection QR can only be generated while awaiting collection';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before generating collection QR';
  end if;

  v_expires_at := now() + interval '30 days';

  if v_order.collection_qr_token is not null
     and v_order.collection_qr_expires_at is not null
     and v_order.collection_qr_expires_at > now() then
    v_token := v_order.collection_qr_token;
    v_expires_at := v_order.collection_qr_expires_at;
  else
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

    update public.orders
    set
      collection_qr_token = v_token,
      collection_qr_expires_at = v_expires_at
    where id = p_order_id;
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'token', v_token,
    'collect_path', '/orders/collect/' || v_token,
    'expires_at', v_expires_at
  );
end;
$$;

revoke all on function public.generate_collection_qr_token(uuid) from public;
grant execute on function public.generate_collection_qr_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Buyer/seller preview for collection QR landing page
-- ---------------------------------------------------------------------------

create or replace function public.get_collection_qr_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_payment public.payments;
  v_listing_title text;
  v_seller_username text;
  v_seller_display_name text;
begin
  if p_token is null or char_length(trim(p_token)) = 0 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.collection_qr_token = trim(p_token);

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select p.*
  into v_payment
  from public.payments p
  where p.id = v_order.payment_id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  select
    nullif(trim(p.username), ''),
    coalesce(nullif(trim(p.display_name), ''), 'Seller')
  into v_seller_username, v_seller_display_name
  from public.profiles p
  where p.id = v_order.seller_id;

  if v_order.fulfilment_status = 'collected'::public.order_fulfilment_status then
    return jsonb_build_object(
      'status', 'already_collected',
      'order_id', v_order.id,
      'listing_title', v_listing_title,
      'collected_at', v_order.collected_at,
      'payout_release_at', v_order.payout_release_at
    );
  end if;

  if v_order.fulfilment_status <> 'awaiting_collection'::public.order_fulfilment_status then
    return jsonb_build_object(
      'status', 'unavailable',
      'order_id', v_order.id,
      'fulfilment_status', v_order.fulfilment_status::text,
      'listing_title', v_listing_title
    );
  end if;

  if v_order.collection_qr_expires_at is null
     or v_order.collection_qr_expires_at <= now() then
    return jsonb_build_object(
      'status', 'expired',
      'order_id', v_order.id,
      'listing_title', v_listing_title
    );
  end if;

  if v_uid is null then
    return jsonb_build_object(
      'status', 'login_required',
      'order_id', v_order.id,
      'listing_title', v_listing_title
    );
  end if;

  if v_uid <> v_order.buyer_id then
    return jsonb_build_object(
      'status', 'wrong_user',
      'order_id', v_order.id,
      'listing_title', v_listing_title
    );
  end if;

  if v_payment.status <> 'paid'::public.payment_status then
    return jsonb_build_object(
      'status', 'unavailable',
      'order_id', v_order.id,
      'listing_title', v_listing_title
    );
  end if;

  return jsonb_build_object(
    'status', 'ready',
    'order_id', v_order.id,
    'listing_title', v_listing_title,
    'seller_username', v_seller_username,
    'seller_display_name', v_seller_display_name,
    'item_price_pence', coalesce(v_order.item_price_pence, v_order.amount_pence),
    'buyer_protection_fee_pence', coalesce(v_order.buyer_protection_fee_pence, 0),
    'buyer_total_pence', coalesce(
      v_order.buyer_total_pence,
      coalesce(v_order.item_price_pence, v_order.amount_pence)
        + coalesce(v_order.buyer_protection_fee_pence, 0)
    ),
    'token_expires_at', v_order.collection_qr_expires_at
  );
end;
$$;

revoke all on function public.get_collection_qr_preview(text) from public;
grant execute on function public.get_collection_qr_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Buyer: confirm collection via QR token
-- ---------------------------------------------------------------------------

create or replace function public.confirm_collection_by_qr(
  p_token text,
  p_checks jsonb,
  p_user_agent text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_listing_title text;
  v_dispute_hours int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Collection token is required';
  end if;

  if p_checks is null
     or coalesce((p_checks ->> 'item_collected')::boolean, false) is not true
     or coalesce((p_checks ->> 'item_inspected')::boolean, false) is not true
     or coalesce((p_checks ->> 'item_matches_listing')::boolean, false) is not true then
    raise exception 'All collection confirmation checks must be accepted';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.collection_qr_token = trim(p_token)
  for update;

  if not found then
    raise exception 'Invalid collection token';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer for this order can confirm collection';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'collection'::public.order_type then
    raise exception 'This collection code is not valid for this order type';
  end if;

  if v_order.fulfilment_status = 'collected'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'awaiting_collection'::public.order_fulfilment_status then
    raise exception 'Order cannot be confirmed from fulfilment status %', v_order.fulfilment_status;
  end if;

  if v_order.collection_qr_expires_at is null
     or v_order.collection_qr_expires_at <= now() then
    raise exception 'This collection code has expired. Ask the seller to generate a new one.';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming collection';
  end if;

  v_dispute_hours := coalesce(v_order.dispute_window_hours, 24);

  update public.orders
  set
    fulfilment_status = 'collected'::public.order_fulfilment_status,
    collected_at = now(),
    collection_confirmed_at = now(),
    collection_confirmed_by = v_uid,
    collection_confirmation_checks = p_checks,
    collection_confirmation_user_agent = nullif(trim(p_user_agent), ''),
    payout_release_at = now() + make_interval(hours => v_dispute_hours),
    payout_status = 'not_due'::public.payout_status,
    protection_status = coalesce(protection_status, 'active')
  where id = v_order.id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.seller_id,
    'collection_confirmed',
    'Collection confirmed',
    'The buyer has confirmed collection for '
      || coalesce(v_listing_title, 'your item')
      || '. Payout is held for '
      || v_dispute_hours::text
      || ' hours.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.buyer_id,
    'collection_confirmed',
    'Collection confirmed',
    'You confirmed collection for '
      || coalesce(v_listing_title, 'your purchase')
      || '. Your '
      || v_dispute_hours::text
      || '-hour Buyer Protection window has started.',
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = v_order.id;

  return v_order;
end;
$$;

revoke all on function public.confirm_collection_by_qr(text, jsonb, text) from public;
grant execute on function public.confirm_collection_by_qr(text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
