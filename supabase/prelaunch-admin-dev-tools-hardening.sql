-- Pre-launch hardening: admin-only dev order tools + notification RPC restrictions
-- Run after dev-end-buyer-protection-bypass.sql and notifications.sql
--
-- Tightens dev bypass RPCs to is_admin() only (removes buyer + app_config bypass).
-- Revokes client access to create_notification (use triggers / service_role only).
-- Restricts insert_conversation_system_message to conversation participants.

-- ---------------------------------------------------------------------------
-- Dev handover bypass — admin only
-- ---------------------------------------------------------------------------

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
  v_checks jsonb := coalesce(p_checks, '{}'::jsonb);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
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

-- ---------------------------------------------------------------------------
-- Dev Buyer Protection bypass — admin only
-- ---------------------------------------------------------------------------

create or replace function public.dev_end_buyer_protection_now(
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.protection_status is distinct from 'active' then
    raise exception 'Buyer Protection is not active on this order';
  end if;

  if v_order.fulfilment_status <> 'collected'::public.order_fulfilment_status then
    raise exception 'Order fulfilment status must be collected';
  end if;

  if v_order.payout_status <> 'not_due'::public.payout_status then
    raise exception 'Payout status must be not_due';
  end if;

  if v_order.payout_release_at is null then
    raise exception 'Buyer Protection window is not scheduled';
  end if;

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = v_order.id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'Order has an open dispute';
  end if;

  update public.orders o
  set payout_release_at = now()
  where o.id = p_order_id
    and o.payout_release_at > now();

  return public.promote_order_after_buyer_protection_window(p_order_id);
end;
$$;

revoke all on function public.dev_end_buyer_protection_now(uuid, text, jsonb) from public;
grant execute on function public.dev_end_buyer_protection_now(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications: no direct client fan-out
-- ---------------------------------------------------------------------------

revoke all on function public.create_notification(uuid, text, text, text, text) from public;
revoke execute on function public.create_notification(uuid, text, text, text, text) from authenticated;
revoke execute on function public.create_notification(uuid, text, text, text, text) from anon;
grant execute on function public.create_notification(uuid, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- System messages: participants only (legacy client fallback in offers.js)
-- ---------------------------------------------------------------------------

create or replace function public.insert_conversation_system_message(
  p_conversation_id uuid,
  p_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_conversation_id is null then
    raise exception 'Conversation is required';
  end if;

  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'System message body cannot be empty';
  end if;

  if not public.is_message_conversation_participant(p_conversation_id, v_uid) then
    raise exception 'You do not have access to this conversation';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    message_type,
    body
  )
  values (
    p_conversation_id,
    null,
    'system'::public.message_type,
    trim(p_body)
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function public.insert_conversation_system_message(uuid, text) from public;
grant execute on function public.insert_conversation_system_message(uuid, text) to authenticated;

notify pgrst, 'reload schema';
