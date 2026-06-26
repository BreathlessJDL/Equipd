-- Equipd Phase 3C — Message image attachments (Step 2: RPC + constraint hook)
-- Run after message-attachments-phase3c-step1.sql
-- Safe to re-run (idempotent where possible).
--
-- Allows empty text bodies only inside send_message_with_attachments (session GUC).
-- Direct client inserts to messages still require non-empty text bodies.

-- ---------------------------------------------------------------------------
-- messages_body_valid — allow empty text only via RPC session flag
-- ---------------------------------------------------------------------------

alter table public.messages
  drop constraint if exists messages_body_valid;

alter table public.messages
  add constraint messages_body_valid check (
    (
      message_type = 'text'::public.message_type
      and (
        char_length(trim(body)) > 0
        or coalesce(current_setting('equipd.allow_empty_message_body', true), '') = 'true'
      )
    )
    or (
      message_type in ('offer'::public.message_type, 'system'::public.message_type)
      and body is not null
    )
  );

-- ---------------------------------------------------------------------------
-- send_message_with_attachments
-- ---------------------------------------------------------------------------

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
