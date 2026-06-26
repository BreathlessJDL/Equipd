-- Equipd Phase 3C — Message image attachments (Step 1: schema + storage + policies)
-- Run after offer-messaging-flow.sql (requires messages, conversations, profiles)
-- Safe to re-run (idempotent where possible).
--
-- Step 1 scope: message_attachments table, private storage bucket, RLS/storage policies.
-- Step 2 will add send-flow RPC / messages_body_valid update for image-only messages.
--
-- Storage path convention:
--   message-attachments/{conversation_id}/{uploader_id}/{attachment_id}.{ext}
-- Participants may read any object under a conversation folder they belong to.
-- Uploaders may write/delete only within their own uploader folder under that conversation.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_message_conversation_participant(
  p_conversation_id uuid,
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
    from public.conversations c
    where c.id = p_conversation_id
      and (c.buyer_id = p_user_id or c.seller_id = p_user_id)
  );
$$;

revoke all on function public.is_message_conversation_participant(uuid, uuid) from public;
grant execute on function public.is_message_conversation_participant(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- message_attachments
-- ---------------------------------------------------------------------------

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  image_width integer,
  image_height integer,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint message_attachments_mime_type_valid check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint message_attachments_file_size_valid check (
    file_size_bytes > 0
    and file_size_bytes <= 8388608
  ),
  constraint message_attachments_display_order_valid check (
    display_order >= 0
    and display_order < 4
  ),
  constraint message_attachments_storage_path_not_empty check (
    char_length(trim(storage_path)) > 0
  ),
  constraint message_attachments_image_dimensions_valid check (
    (image_width is null and image_height is null)
    or (
      image_width is not null
      and image_height is not null
      and image_width > 0
      and image_height > 0
    )
  )
);

create unique index if not exists message_attachments_message_display_order_uidx
  on public.message_attachments (message_id, display_order);

create index if not exists message_attachments_message_id_idx
  on public.message_attachments (message_id);

create index if not exists message_attachments_conversation_created_idx
  on public.message_attachments (conversation_id, created_at desc);

create index if not exists message_attachments_uploader_id_idx
  on public.message_attachments (uploader_id);

create or replace function public.message_attachments_enforce_conversation_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select m.conversation_id
  into v_conversation_id
  from public.messages m
  where m.id = new.message_id;

  if v_conversation_id is null then
    raise exception 'Message not found for attachment';
  end if;

  if new.conversation_id is distinct from v_conversation_id then
    raise exception 'conversation_id must match the parent message conversation';
  end if;

  return new;
end;
$$;

drop trigger if exists message_attachments_enforce_conversation_match on public.message_attachments;

create trigger message_attachments_enforce_conversation_match
  before insert or update of message_id, conversation_id
  on public.message_attachments
  for each row execute function public.message_attachments_enforce_conversation_match();

create or replace function public.message_attachments_enforce_max_per_message()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_existing_count integer;
begin
  select count(*)
  into v_existing_count
  from public.message_attachments ma
  where ma.message_id = new.message_id;

  if v_existing_count >= 4 then
    raise exception 'A message may have at most 4 image attachments';
  end if;

  return new;
end;
$$;

drop trigger if exists message_attachments_enforce_max_per_message on public.message_attachments;

create trigger message_attachments_enforce_max_per_message
  before insert on public.message_attachments
  for each row execute function public.message_attachments_enforce_max_per_message();

-- ---------------------------------------------------------------------------
-- Row level security: message_attachments
-- ---------------------------------------------------------------------------

alter table public.message_attachments enable row level security;

drop policy if exists "Conversation participants can read message attachments"
  on public.message_attachments;

create policy "Conversation participants can read message attachments"
  on public.message_attachments for select
  to authenticated
  using (
    public.is_message_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists "Participants can insert message attachments for their messages"
  on public.message_attachments;

create policy "Participants can insert message attachments for their messages"
  on public.message_attachments for insert
  to authenticated
  with check (
    uploader_id = auth.uid()
    and public.is_message_conversation_participant(conversation_id, auth.uid())
    and exists (
      select 1
      from public.messages m
      where m.id = message_id
        and m.conversation_id = conversation_id
        and m.sender_id = auth.uid()
        and m.message_type = 'text'::public.message_type
    )
  );

drop policy if exists "Uploaders can delete their message attachments"
  on public.message_attachments;

create policy "Uploaders can delete their message attachments"
  on public.message_attachments for delete
  to authenticated
  using (
    uploader_id = auth.uid()
    and public.is_message_conversation_participant(conversation_id, auth.uid())
  );

-- Attachments are immutable after insert (no update policy).

-- ---------------------------------------------------------------------------
-- Private storage bucket: message-attachments
-- Path: {conversation_id}/{uploader_id}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Conversation participants can read message attachments storage"
  on storage.objects;

drop policy if exists "Participants can upload message attachment images"
  on storage.objects;

drop policy if exists "Uploaders can update own message attachment uploads"
  on storage.objects;

drop policy if exists "Uploaders can delete own message attachment uploads"
  on storage.objects;

create policy "Conversation participants can read message attachments storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_message_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

create policy "Participants can upload message attachment images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] is not null
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_message_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

create policy "Uploaders can update own message attachment uploads"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_message_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  )
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_message_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

create policy "Uploaders can delete own message attachment uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_message_conversation_participant(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Step 2 note (not applied in Step 1):
-- messages_body_valid currently requires non-empty body for text messages.
-- Image-only sends will need either:
--   (a) a send_message_with_attachments RPC that inserts message + rows atomically
--       with a relaxed check, or
--   (b) an updated messages_body_valid allowing empty text when attachments exist.
-- Marketplace text validation in the app remains unchanged for non-empty text input.
-- ---------------------------------------------------------------------------
