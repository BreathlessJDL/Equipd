-- Equipd Order Handover — Phase 4B (RPC + race-safe get/create/update)
-- Run after order-handover-details-phase4a-foundation.sql
-- Safe to re-run (idempotent where possible).
--
-- Exposes get_order_handover_details and update_order_handover_details for UI layers.
-- Column-level permissions remain enforced by Phase 4A triggers as a backstop.

-- ---------------------------------------------------------------------------
-- Internal: race-safe row ensure (not granted to clients)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_order_handover_details_row(p_order_id uuid)
returns public.order_handover_details
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.order_handover_details;
begin
  insert into public.order_handover_details (order_id)
  values (p_order_id)
  on conflict (order_id) do nothing
  returning * into v_row;

  if not found then
    select *
    into v_row
    from public.order_handover_details
    where order_id = p_order_id;
  end if;

  if not found then
    raise exception 'Handover details row could not be created';
  end if;

  return v_row;
end;
$$;

revoke all on function public.ensure_order_handover_details_row(uuid) from public;

-- ---------------------------------------------------------------------------
-- get_order_handover_details
-- ---------------------------------------------------------------------------

drop function if exists public.get_order_handover_details(uuid);

create or replace function public.get_order_handover_details(p_order_id uuid)
returns public.order_handover_details
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_is_admin boolean := public.is_admin();
  v_is_participant boolean;
  v_row public.order_handover_details;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  v_is_participant := v_order.buyer_id = v_uid or v_order.seller_id = v_uid;

  if not v_is_admin and not v_is_participant then
    raise exception 'You do not have access to this order';
  end if;

  select *
  into v_row
  from public.order_handover_details
  where order_id = p_order_id;

  if found then
    return v_row;
  end if;

  if v_is_admin then
    return null;
  end if;

  if not public.order_handover_details_order_writable(p_order_id) then
    return null;
  end if;

  return public.ensure_order_handover_details_row(p_order_id);
end;
$$;

revoke all on function public.get_order_handover_details(uuid) from public;
grant execute on function public.get_order_handover_details(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_order_handover_details
-- ---------------------------------------------------------------------------

drop function if exists public.update_order_handover_details(uuid, jsonb);

create or replace function public.update_order_handover_details(
  p_order_id uuid,
  p_patch jsonb
)
returns public.order_handover_details
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_is_buyer boolean;
  v_is_seller boolean;
  v_key text;
  v_row public.order_handover_details;
  v_reserved_keys constant text[] := array[
    'buyer_delivery_address',
    'courier_notes',
    'handover_qr_prepared_at',
    'handover_checklist'
  ];
  v_system_keys constant text[] := array[
    'id',
    'order_id',
    'created_at',
    'updated_at'
  ];
  v_seller_keys constant text[] := array[
    'seller_collection_address',
    'seller_phone',
    'parking_loading_notes'
  ];
  v_buyer_keys constant text[] := array[
    'buyer_phone',
    'preferred_collection_time'
  ];
  v_shared_keys constant text[] := array[
    'additional_notes'
  ];
  v_allowed_keys constant text[] := array[
    'seller_collection_address',
    'seller_phone',
    'buyer_phone',
    'preferred_collection_time',
    'parking_loading_notes',
    'additional_notes'
  ];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_patch is null or p_patch = '{}'::jsonb then
    raise exception 'No handover fields provided to update';
  end if;

  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Handover patch must be a JSON object';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  v_is_buyer := v_order.buyer_id = v_uid;
  v_is_seller := v_order.seller_id = v_uid;

  if not v_is_buyer and not v_is_seller then
    raise exception 'Only the buyer or seller may update handover details for this order';
  end if;

  if not public.order_handover_details_order_writable(p_order_id) then
    raise exception 'Handover details cannot be updated for this order';
  end if;

  for v_key in
    select jsonb_object_keys(p_patch)
  loop
    if v_key = any (v_system_keys) then
      raise exception 'Cannot update system handover field: %', v_key;
    end if;

    if v_key = any (v_reserved_keys) then
      raise exception 'Reserved handover field is not yet editable: %', v_key;
    end if;

    if not (v_key = any (v_allowed_keys)) then
      raise exception 'Unknown handover field: %', v_key;
    end if;

    if v_is_seller and not v_is_buyer and v_key = any (v_buyer_keys) then
      raise exception 'Sellers cannot edit buyer-only handover field: %', v_key;
    end if;

    if v_is_buyer and not v_is_seller and v_key = any (v_seller_keys) then
      raise exception 'Buyers cannot edit seller-only handover field: %', v_key;
    end if;

    if jsonb_typeof(p_patch -> v_key) not in ('string', 'null') then
      raise exception 'Handover field % must be a string or null', v_key;
    end if;
  end loop;

  perform public.ensure_order_handover_details_row(p_order_id);

  update public.order_handover_details
  set
    seller_collection_address = case
      when p_patch ? 'seller_collection_address'
        then nullif(btrim(p_patch ->> 'seller_collection_address'), '')
      else seller_collection_address
    end,
    seller_phone = case
      when p_patch ? 'seller_phone'
        then nullif(btrim(p_patch ->> 'seller_phone'), '')
      else seller_phone
    end,
    buyer_phone = case
      when p_patch ? 'buyer_phone'
        then nullif(btrim(p_patch ->> 'buyer_phone'), '')
      else buyer_phone
    end,
    preferred_collection_time = case
      when p_patch ? 'preferred_collection_time'
        then nullif(btrim(p_patch ->> 'preferred_collection_time'), '')
      else preferred_collection_time
    end,
    parking_loading_notes = case
      when p_patch ? 'parking_loading_notes'
        then nullif(btrim(p_patch ->> 'parking_loading_notes'), '')
      else parking_loading_notes
    end,
    additional_notes = case
      when p_patch ? 'additional_notes'
        then nullif(btrim(p_patch ->> 'additional_notes'), '')
      else additional_notes
    end
  where order_id = p_order_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.update_order_handover_details(uuid, jsonb) from public;
grant execute on function public.update_order_handover_details(uuid, jsonb) to authenticated;
