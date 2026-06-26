-- Equipd conversation read state / unread message tracking
-- Run after notifications.sql (requires messaging tables)
--
-- Tracks per-user unread counts per conversation.
-- Updated by message insert trigger; cleared when a participant opens the thread.

-- ---------------------------------------------------------------------------
-- conversation_reads
-- ---------------------------------------------------------------------------

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  unread_count int not null default 0,
  updated_at timestamptz not null default now(),
  constraint conversation_reads_unread_count_non_negative check (unread_count >= 0),
  primary key (conversation_id, user_id)
);

create index conversation_reads_user_unread_idx
  on public.conversation_reads (user_id)
  where unread_count > 0;

create trigger conversation_reads_set_updated_at
  before update on public.conversation_reads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mark conversation read for current user
-- ---------------------------------------------------------------------------

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns public.conversation_reads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.conversation_reads;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (c.buyer_id = v_uid or c.seller_id = v_uid)
  ) then
    raise exception 'Conversation not found';
  end if;

  insert into public.conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    unread_count
  )
  values (
    p_conversation_id,
    v_uid,
    now(),
    0
  )
  on conflict (conversation_id, user_id) do update
  set
    last_read_at = now(),
    unread_count = 0
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Maintain unread counts when messages are sent
-- ---------------------------------------------------------------------------

create or replace function public.track_message_unread_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_recipient_id uuid;
begin
  select *
  into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if not found then
    return new;
  end if;

  if v_conversation.buyer_id = new.sender_id then
    v_recipient_id := v_conversation.seller_id;
  else
    v_recipient_id := v_conversation.buyer_id;
  end if;

  insert into public.conversation_reads (
    conversation_id,
    user_id,
    last_read_at,
    unread_count
  )
  values (
    new.conversation_id,
    new.sender_id,
    new.created_at,
    0
  )
  on conflict (conversation_id, user_id) do update
  set
    last_read_at = new.created_at,
    unread_count = 0;

  insert into public.conversation_reads (
    conversation_id,
    user_id,
    unread_count
  )
  values (
    new.conversation_id,
    v_recipient_id,
    1
  )
  on conflict (conversation_id, user_id) do update
  set unread_count = public.conversation_reads.unread_count + 1;

  return new;
end;
$$;

create trigger messages_track_unread_state
  after insert on public.messages
  for each row execute function public.track_message_unread_state();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversation_reads enable row level security;

create policy "Users read own conversation read state"
  on public.conversation_reads for select
  to authenticated
  using (user_id = auth.uid());

-- Writes happen via security definer trigger and mark_conversation_read RPC only.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
