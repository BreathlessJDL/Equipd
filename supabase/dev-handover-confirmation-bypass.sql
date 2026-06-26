-- Dev/test handover confirmation bypass
-- Run after buyer-protection-seller-delivery-handover-qr.sql (step 46)
--
-- Extracts shared in-person handover confirmation logic used by QR scan and a
-- dev/admin-only bypass for desktop testing.
--
-- Production QR flow is unchanged. The bypass RPC is authorized only when:
--   - caller is an admin (profiles.is_admin), OR
--   - app_config.dev_handover_bypass_enabled = 'true' AND caller is the buyer
--
-- Local buyer testing without an admin account:
--   insert into public.app_config (key, value)
--   values ('dev_handover_bypass_enabled', 'true')
--   on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------------------
-- Shared handover confirmation (collection + seller delivery)
-- ---------------------------------------------------------------------------

create or replace function public.apply_in_person_handover_confirmation(
  p_order_id uuid,
  p_confirmed_by uuid,
  p_checks jsonb,
  p_user_agent text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_listing_title text;
  v_dispute_hours int;
  v_order_type public.order_type;
  v_seller_notification_title text;
  v_seller_notification_body text;
  v_buyer_notification_title text;
  v_buyer_notification_body text;
begin
  if p_checks is null
     or coalesce((p_checks ->> 'item_collected')::boolean, false) is not true
     or coalesce((p_checks ->> 'item_inspected')::boolean, false) is not true
     or coalesce((p_checks ->> 'item_matches_listing')::boolean, false) is not true then
    raise exception 'All handover confirmation checks must be accepted';
  end if;

  if p_confirmed_by is null then
    raise exception 'Confirmed by user is required';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  v_order_type := coalesce(v_order.order_type, 'collection'::public.order_type);

  if not public.is_in_person_handover_order_type(v_order_type) then
    raise exception 'This order does not use in-person handover confirmation';
  end if;

  if v_order.fulfilment_status = 'collected'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order_type = 'collection'::public.order_type
     and v_order.fulfilment_status <> 'awaiting_collection'::public.order_fulfilment_status then
    raise exception 'Order cannot be confirmed from fulfilment status %', v_order.fulfilment_status;
  end if;

  if v_order_type = 'seller_delivery'::public.order_type
     and v_order.fulfilment_status <> 'awaiting_seller_delivery'::public.order_fulfilment_status then
    raise exception 'Order cannot be confirmed from fulfilment status %', v_order.fulfilment_status;
  end if;

  if v_order.buyer_id <> p_confirmed_by then
    raise exception 'Handover confirmation must be recorded for the buyer';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming handover';
  end if;

  v_dispute_hours := coalesce(v_order.dispute_window_hours, 24);

  update public.orders
  set
    fulfilment_status = 'collected'::public.order_fulfilment_status,
    collected_at = now(),
    collection_confirmed_at = now(),
    collection_confirmed_by = p_confirmed_by,
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

  if v_order_type = 'seller_delivery'::public.order_type then
    v_seller_notification_title := 'Handover confirmed';
    v_seller_notification_body :=
      'The buyer has confirmed handover for '
      || coalesce(v_listing_title, 'your item')
      || '. Payout is held for '
      || v_dispute_hours::text
      || ' hours.';
    v_buyer_notification_title := 'Handover confirmed';
    v_buyer_notification_body :=
      'You confirmed handover for '
      || coalesce(v_listing_title, 'your purchase')
      || '. Your '
      || v_dispute_hours::text
      || '-hour Buyer Protection window has started.';
  else
    v_seller_notification_title := 'Collection confirmed';
    v_seller_notification_body :=
      'The buyer has confirmed collection for '
      || coalesce(v_listing_title, 'your item')
      || '. Payout is held for '
      || v_dispute_hours::text
      || ' hours.';
    v_buyer_notification_title := 'Collection confirmed';
    v_buyer_notification_body :=
      'You confirmed collection for '
      || coalesce(v_listing_title, 'your purchase')
      || '. Your '
      || v_dispute_hours::text
      || '-hour Buyer Protection window has started.';
  end if;

  perform public.create_notification(
    v_order.seller_id,
    'collection_confirmed',
    v_seller_notification_title,
    v_seller_notification_body,
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.buyer_id,
    'collection_confirmed',
    v_buyer_notification_title,
    v_buyer_notification_body,
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = v_order.id;

  return v_order;
end;
$$;

revoke all on function public.apply_in_person_handover_confirmation(uuid, uuid, jsonb, text) from public;

-- ---------------------------------------------------------------------------
-- Buyer: confirm in-person handover via QR token (unchanged behaviour)
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
  v_order_type public.order_type;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_token is null or char_length(trim(p_token)) = 0 then
    raise exception 'Handover token is required';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.collection_qr_token = trim(p_token)
  for update;

  if not found then
    raise exception 'Invalid handover token';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer for this order can confirm handover';
  end if;

  v_order_type := coalesce(v_order.order_type, 'collection'::public.order_type);

  if not public.is_in_person_handover_order_type(v_order_type) then
    raise exception 'This handover code is not valid for this order type';
  end if;

  if v_order.fulfilment_status <> 'collected'::public.order_fulfilment_status then
    if v_order.collection_qr_expires_at is null
       or v_order.collection_qr_expires_at <= now() then
      raise exception 'This handover code has expired. Ask the seller to generate a new one.';
    end if;
  end if;

  return public.apply_in_person_handover_confirmation(
    v_order.id,
    v_uid,
    p_checks,
    p_user_agent
  );
end;
$$;

revoke all on function public.confirm_collection_by_qr(text, jsonb, text) from public;
grant execute on function public.confirm_collection_by_qr(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Dev/admin: confirm handover without QR scan (testing only)
-- ---------------------------------------------------------------------------

drop function if exists public.dev_confirm_order_handover(uuid, jsonb, text);

create or replace function public.dev_confirm_order_handover(
  p_order_id uuid,
  p_user_agent text default null,
  p_checks jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_dev_bypass_enabled boolean := false;
  v_checks jsonb := coalesce(p_checks, '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_checks ->> 'source' = 'dev_admin_handover_button' then
    v_checks := jsonb_build_object(
      'item_collected', true,
      'item_inspected', true,
      'item_matches_listing', true,
      'source', 'dev_admin_handover_button'
    );
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  select coalesce(nullif(trim(value), ''), '') = 'true'
  into v_dev_bypass_enabled
  from public.app_config
  where key = 'dev_handover_bypass_enabled';

  if public.is_admin() then
    null;
  elsif v_dev_bypass_enabled and v_uid = v_order.buyer_id then
    null;
  else
    raise exception 'Not authorized for test handover confirmation';
  end if;

  return public.apply_in_person_handover_confirmation(
    p_order_id,
    v_order.buyer_id,
    v_checks,
    coalesce(nullif(trim(p_user_agent), ''), 'dev-handover-bypass')
  );
end;
$$;

revoke all on function public.dev_confirm_order_handover(uuid, text, jsonb) from public;
grant execute on function public.dev_confirm_order_handover(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
