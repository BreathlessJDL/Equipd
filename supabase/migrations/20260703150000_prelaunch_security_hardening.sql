-- Pre-launch security hardening (promoted from prelaunch-security-fixes.sql)
-- profiles_public: 20260701140000_profile_last_active_at.sql
-- orders_client: 20260701160000_orders_client_seller_service_fee.sql
--
-- 1. Owner/admin-only profiles SELECT (public reads via profiles_public view)
-- 2. Revoke client SELECT on public.orders (QR token protection)
-- 3. Server-side message validation + revoke direct text INSERT

-- ---------------------------------------------------------------------------
-- Priority 1: Safe public profile access
-- ---------------------------------------------------------------------------

drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Priority 2: Hide collection QR token from client SELECT
-- ---------------------------------------------------------------------------
-- orders_client view is maintained by 20260701160000_orders_client_seller_service_fee.sql

revoke select on public.orders from anon, authenticated;

-- Storage RLS policies reference public.orders; use security definer helpers so
-- revoking client SELECT on orders does not break unrelated bucket uploads.
create or replace function public.storage_order_is_participant(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = p_user_id or o.seller_id = p_user_id)
  );
$$;

create or replace function public.storage_seller_can_upload_courier_evidence(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.seller_id = p_user_id
      and o.order_type = 'buyer_courier'::public.order_type
      and o.fulfilment_status = 'awaiting_courier_collection'::public.order_fulfilment_status
  );
$$;

create or replace function public.storage_seller_owns_order(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.seller_id = p_user_id
  );
$$;

create or replace function public.storage_buyer_can_upload_dispute_evidence(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.buyer_id = p_user_id
      and o.fulfilment_status in (
        'collected'::public.order_fulfilment_status,
        'delivered'::public.order_fulfilment_status
      )
      and o.payout_release_at is not null
      and o.payout_release_at > now()
      and o.payout_released_at is null
      and o.fulfilment_status not in (
        'disputed'::public.order_fulfilment_status,
        'refunded'::public.order_fulfilment_status,
        'cancelled'::public.order_fulfilment_status,
        'completed'::public.order_fulfilment_status
      )
      and not exists (
        select 1
        from public.order_disputes d
        where d.order_id = o.id
          and d.status in ('open', 'under_review')
      )
  );
$$;

revoke all on function public.storage_order_is_participant(uuid, uuid) from public;
grant execute on function public.storage_order_is_participant(uuid, uuid) to authenticated;

revoke all on function public.storage_seller_can_upload_courier_evidence(uuid, uuid) from public;
grant execute on function public.storage_seller_can_upload_courier_evidence(uuid, uuid) to authenticated;

revoke all on function public.storage_seller_owns_order(uuid, uuid) from public;
grant execute on function public.storage_seller_owns_order(uuid, uuid) to authenticated;

revoke all on function public.storage_buyer_can_upload_dispute_evidence(uuid, uuid) from public;
grant execute on function public.storage_buyer_can_upload_dispute_evidence(uuid, uuid) to authenticated;

drop policy if exists "Order participants can read order evidence" on storage.objects;
drop policy if exists "Seller can upload order evidence" on storage.objects;
drop policy if exists "Seller can update order evidence uploads" on storage.objects;
drop policy if exists "Seller can delete order evidence uploads" on storage.objects;
drop policy if exists "Buyer can upload dispute evidence" on storage.objects;

create policy "Order participants can read order evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and public.storage_order_is_participant(((storage.foldername(name))[1])::uuid)
  );

create policy "Seller can upload order evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and public.storage_seller_can_upload_courier_evidence(((storage.foldername(name))[1])::uuid)
  );

create policy "Seller can update order evidence uploads"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and public.storage_seller_can_upload_courier_evidence(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'order-evidence'
    and public.storage_seller_owns_order(((storage.foldername(name))[1])::uuid)
  );

create policy "Seller can delete order evidence uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and public.storage_seller_can_upload_courier_evidence(((storage.foldername(name))[1])::uuid)
  );

create policy "Buyer can upload dispute evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'disputes'
    and public.storage_buyer_can_upload_dispute_evidence(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Priority 3: Server-side marketplace message validation
-- ---------------------------------------------------------------------------

create or replace function public.marketplace_message_block_message()
returns text
language sql
immutable
as $$
  select 'For everyone''s safety, please keep communication and payments on Equipd. Collection details are shared securely after payment.';
$$;

create or replace function public.marketplace_message_has_price_context(p_body text)
returns boolean
language sql
immutable
as $$
  select
    coalesce(trim(p_body), '') ~* '(£[\d,]|pounds?|quid|\y(?:would you take|would you accept|can you do|could you do|i can offer|my offer|best price|lower the price|lower price|too low|accept|offer|price)\y)';
$$;

create or replace function public.marketplace_message_has_street_terms(p_body text)
returns boolean
language sql
immutable
as $$
  select coalesce(trim(p_body), '') ~* '\y(?:road|street|high street|avenue|lane|drive|close|court|way|place|terrace|crescent|industrial estate|business park|rd|st|ave|dr|ln)\y';
$$;

create or replace function public.marketplace_message_has_address_intent(p_body text)
returns boolean
language sql
immutable
as $$
  select coalesce(trim(p_body), '') ~* '\y(?:address is|postcode is|my postcode|pick up from|collect from|collect at|come to mine|come to my (?:house|home|address|place)|my house|my home|send my address|i''ll send my address)\y';
$$;

create or replace function public.marketplace_message_is_blocked(p_body text)
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

  -- Measurement-only messages are allowed.
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

  if v_text ~ '(?:\+?\d[\d\s().-]{7,}\d)' then
    return true;
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

  if v_text ~* '\y(?:call me|text me|email me|message me on|contact me on|add me on|dm me|reach me on)\y' then
    return true;
  end if;

  if v_text ~* '\y(?:my number is|phone number|mobile number|send me your number)\y' then
    return true;
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

  if public.marketplace_message_is_blocked(v_trimmed) then
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

        if public.marketplace_message_is_blocked(v_combined) then
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

-- Text-only send RPC
create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text;
  v_message public.messages;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if not public.is_message_conversation_participant(p_conversation_id, v_user_id) then
    raise exception 'You do not have access to this conversation';
  end if;

  v_body := public.assert_marketplace_message_allowed(p_body, p_conversation_id, v_user_id);

  insert into public.messages (
    conversation_id,
    sender_id,
    body,
    message_type
  )
  values (
    p_conversation_id,
    v_user_id,
    v_body,
    'text'::public.message_type
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function public.send_message(uuid, text) from public;
grant execute on function public.send_message(uuid, text) to authenticated;

-- Validate text in attachment RPC
create or replace function public.send_message_with_attachments(
  p_conversation_id uuid,
  p_body text default '',
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := coalesce(p_body, '');
  v_trimmed_body text := trim(v_body);
  v_attachment_count integer;
  v_message public.messages;
  v_item jsonb;
  v_storage_path text;
  v_mime_type text;
  v_file_size integer;
  v_width integer;
  v_height integer;
  v_display_order smallint;
  v_seen_orders boolean[] := array[false, false, false, false];
  v_storage_size bigint;
  v_result_attachments jsonb := '[]'::jsonb;
  v_attachment_row public.message_attachments;
  v_path_prefix text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_conversation_id is null then
    raise exception 'conversation_id is required';
  end if;

  if not public.is_message_conversation_participant(p_conversation_id, v_user_id) then
    raise exception 'You do not have access to this conversation';
  end if;

  if jsonb_typeof(p_attachments) is distinct from 'array' then
    raise exception 'attachments must be a JSON array';
  end if;

  v_attachment_count := jsonb_array_length(p_attachments);

  if v_attachment_count > 4 then
    raise exception 'A message may have at most 4 image attachments';
  end if;

  if v_trimmed_body = '' and v_attachment_count = 0 then
    raise exception 'Message must include text or at least one image';
  end if;

  if v_trimmed_body <> '' then
    v_trimmed_body := public.assert_marketplace_message_allowed(
      v_trimmed_body,
      p_conversation_id,
      v_user_id
    );
  end if;

  v_path_prefix := p_conversation_id::text || '/' || v_user_id::text || '/';

  if v_attachment_count > 0 then
    for v_item in select value from jsonb_array_elements(p_attachments) as t(value)
    loop
      v_storage_path := nullif(trim(v_item->>'storage_path'), '');
      v_mime_type := nullif(trim(v_item->>'mime_type'), '');
      v_file_size := nullif(v_item->>'file_size_bytes', '')::integer;
      v_width := nullif(v_item->>'image_width', '')::integer;
      v_height := nullif(v_item->>'image_height', '')::integer;
      v_display_order := nullif(v_item->>'display_order', '')::smallint;

      if v_storage_path is null then
        raise exception 'storage_path is required for each attachment';
      end if;

      if not starts_with(v_storage_path, v_path_prefix) then
        raise exception 'Invalid attachment storage path';
      end if;

      if position('/../' in v_storage_path) > 0 or right(v_storage_path, 1) = '/' then
        raise exception 'Invalid attachment storage path';
      end if;

      if v_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
        raise exception 'Unsupported attachment mime type';
      end if;

      if v_file_size is null or v_file_size <= 0 or v_file_size > 8388608 then
        raise exception 'Invalid attachment file size';
      end if;

      if v_display_order is null or v_display_order < 0 or v_display_order > 3 then
        raise exception 'display_order must be between 0 and 3';
      end if;

      if v_seen_orders[v_display_order + 1] then
        raise exception 'display_order values must be unique';
      end if;

      v_seen_orders[v_display_order + 1] := true;

      if (v_width is null) <> (v_height is null) then
        raise exception 'image_width and image_height must both be provided or both omitted';
      end if;

      if v_width is not null and (v_width <= 0 or v_height <= 0) then
        raise exception 'image_width and image_height must be positive when provided';
      end if;

      select coalesce((o.metadata->>'size')::bigint, 0)
      into v_storage_size
      from storage.objects o
      where o.bucket_id = 'message-attachments'
        and o.name = v_storage_path;

      if v_storage_size <= 0 then
        raise exception 'Attachment file not found in storage';
      end if;

      if v_storage_size > 8388608 then
        raise exception 'Attachment file exceeds maximum size';
      end if;
    end loop;
  end if;

  perform set_config('equipd.allow_empty_message_body', 'true', true);

  insert into public.messages (
    conversation_id,
    sender_id,
    body,
    message_type
  )
  values (
    p_conversation_id,
    v_user_id,
    v_trimmed_body,
    'text'::public.message_type
  )
  returning * into v_message;

  if v_attachment_count > 0 then
    for v_item in select value from jsonb_array_elements(p_attachments) as t(value)
    loop
      insert into public.message_attachments (
        message_id,
        conversation_id,
        uploader_id,
        storage_path,
        mime_type,
        file_size_bytes,
        image_width,
        image_height,
        display_order
      )
      values (
        v_message.id,
        p_conversation_id,
        v_user_id,
        trim(v_item->>'storage_path'),
        trim(v_item->>'mime_type'),
        nullif(v_item->>'file_size_bytes', '')::integer,
        nullif(v_item->>'image_width', '')::integer,
        nullif(v_item->>'image_height', '')::integer,
        nullif(v_item->>'display_order', '')::smallint
      )
      returning * into v_attachment_row;

      v_result_attachments :=
        v_result_attachments
        || jsonb_build_array(to_jsonb(v_attachment_row));
    end loop;
  end if;

  return jsonb_build_object(
    'id', v_message.id,
    'conversation_id', v_message.conversation_id,
    'sender_id', v_message.sender_id,
    'body', v_message.body,
    'message_type', v_message.message_type,
    'offer_id', v_message.offer_id,
    'created_at', v_message.created_at,
    'attachments', v_result_attachments
  );
end;
$$;

revoke all on function public.send_message_with_attachments(uuid, text, jsonb) from public;
grant execute on function public.send_message_with_attachments(uuid, text, jsonb) to authenticated;

-- Revoke direct client text message INSERT; offer/system paths remain.
drop policy if exists "Participants can send messages" on public.messages;
drop policy if exists "Participants can send offer and system messages" on public.messages;

create policy "Participants can send offer and system messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and message_type in ('offer'::public.message_type, 'system'::public.message_type)
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

notify pgrst, 'reload schema';
