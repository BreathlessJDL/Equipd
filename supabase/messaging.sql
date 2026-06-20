-- Equipd messaging tables and RLS
-- Run after seed-brands.sql (requires listings and profiles)

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_buyer_seller_different check (buyer_id <> seller_id),
  constraint conversations_listing_buyer_unique unique (listing_id, buyer_id)
);

create index conversations_buyer_updated_idx
  on public.conversations (buyer_id, updated_at desc);

create index conversations_seller_updated_idx
  on public.conversations (seller_id, updated_at desc);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_not_empty check (char_length(trim(body)) > 0)
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

-- Bump conversation.updated_at when a message is sent
create or replace function public.bump_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation_updated_at
  after insert on public.messages
  for each row execute function public.bump_conversation_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;

create policy "Participants can read conversations"
  on public.conversations for select
  to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy "Buyers can start conversations on active listings"
  on public.conversations for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = seller_id
        and l.status = 'active'
    )
  );

alter table public.messages enable row level security;

create policy "Participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );
