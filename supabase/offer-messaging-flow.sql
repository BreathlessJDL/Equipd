-- Equipd offer + messaging flow (Vinted-style)
-- Run after conversation-reads.sql, offer-acceptance.sql, stripe-payments-phase3a.sql

-- ---------------------------------------------------------------------------
-- Offer extensions
-- ---------------------------------------------------------------------------

alter type public.offer_status add value if not exists 'countered';

-- direction as text (see offers-schema-alignment.sql); skip enum type for compatibility
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'offers'
      and column_name = 'direction'
  ) then
    alter table public.offers
      add column direction text not null default 'buyer_to_seller';
  end if;
end $$;

update public.offers
set direction = 'buyer_to_seller'
where direction is null;

alter table public.offers
  drop constraint if exists offers_direction_valid;

alter table public.offers
  add constraint offers_direction_valid
  check (direction in ('buyer_to_seller', 'seller_to_buyer'));

alter table public.offers
  add column if not exists parent_offer_id uuid references public.offers (id) on delete set null;

drop index if exists public.offers_one_pending_per_buyer_listing_idx;

create unique index if not exists offers_one_pending_buyer_offer_per_listing_idx
  on public.offers (listing_id, buyer_id)
  where status = 'pending'::public.offer_status
    and direction = 'buyer_to_seller';

create unique index if not exists offers_one_pending_seller_counter_per_listing_idx
  on public.offers (listing_id, buyer_id)
  where status = 'pending'::public.offer_status
    and direction = 'seller_to_buyer';

-- ---------------------------------------------------------------------------
-- Message extensions
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'message_type') then
    create type public.message_type as enum ('text', 'offer', 'system');
  end if;
end $$;

alter table public.messages
  add column if not exists message_type public.message_type not null default 'text',
  add column if not exists offer_id uuid references public.offers (id) on delete set null;

alter table public.messages
  alter column sender_id drop not null;

alter table public.messages
  drop constraint if exists messages_body_not_empty;

alter table public.messages
  add constraint messages_body_valid check (
    (message_type = 'text'::public.message_type and char_length(trim(body)) > 0)
    or (
      message_type in ('offer'::public.message_type, 'system'::public.message_type)
      and body is not null
    )
  );

create index if not exists messages_offer_id_idx
  on public.messages (offer_id)
  where offer_id is not null;

-- ---------------------------------------------------------------------------
-- System message helper
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
begin
  if p_conversation_id is null then
    raise exception 'Conversation is required';
  end if;

  if char_length(trim(coalesce(p_body, ''))) = 0 then
    raise exception 'System message body cannot be empty';
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

-- ---------------------------------------------------------------------------
-- Unread tracking for system messages
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

  if new.sender_id is null then
    insert into public.conversation_reads (conversation_id, user_id, unread_count)
    values (new.conversation_id, v_conversation.buyer_id, 1)
    on conflict (conversation_id, user_id) do update
    set unread_count = public.conversation_reads.unread_count + 1;

    insert into public.conversation_reads (conversation_id, user_id, unread_count)
    values (new.conversation_id, v_conversation.seller_id, 1)
    on conflict (conversation_id, user_id) do update
    set unread_count = public.conversation_reads.unread_count + 1;

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

-- ---------------------------------------------------------------------------
-- Offer RLS updates
-- ---------------------------------------------------------------------------

drop policy if exists "Buyers can create offers on active listings" on public.offers;

create policy "Buyers can create buyer offers on active listings"
  on public.offers for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and direction = 'buyer_to_seller'
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = seller_id
        and l.status = 'active'
    )
  );

create policy "Sellers can create counter offers"
  on public.offers for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    and direction = 'seller_to_buyer'
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
        and l.status = 'active'
    )
  );

drop policy if exists "Buyers can withdraw pending offers" on public.offers;

create policy "Buyers can withdraw pending buyer offers"
  on public.offers for update
  to authenticated
  using (
    buyer_id = auth.uid()
    and status = 'pending'::public.offer_status
    and direction = 'buyer_to_seller'
  )
  with check (
    buyer_id = auth.uid()
    and status = 'withdrawn'::public.offer_status
  );

create policy "Buyers can decline pending counter offers"
  on public.offers for update
  to authenticated
  using (
    buyer_id = auth.uid()
    and status = 'pending'::public.offer_status
    and direction = 'seller_to_buyer'
  )
  with check (
    buyer_id = auth.uid()
    and status = 'rejected'::public.offer_status
  );

-- ---------------------------------------------------------------------------
-- Message RLS updates
-- ---------------------------------------------------------------------------

drop policy if exists "Participants can send messages" on public.messages;

create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and message_type in ('text'::public.message_type, 'offer'::public.message_type)
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Counter offer RPC
-- ---------------------------------------------------------------------------

create or replace function public.counter_offer(
  p_offer_id uuid,
  p_amount_pence integer
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.offers%rowtype;
  v_new_offer public.offers%rowtype;
  v_parent_direction text;
  v_new_direction text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'Enter a valid counter-offer amount greater than zero.';
  end if;

  select *
  into v_parent
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Parent offer % not found', p_offer_id;
  end if;

  if v_parent.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be countered';
  end if;

  v_parent_direction := coalesce(v_parent.direction, 'buyer_to_seller');

  if v_parent_direction = 'buyer_to_seller' then
    if v_parent.seller_id <> auth.uid() then
      raise exception 'Only the seller can counter this offer';
    end if;
    v_new_direction := 'seller_to_buyer';
  elsif v_parent_direction = 'seller_to_buyer' then
    if v_parent.buyer_id <> auth.uid() then
      raise exception 'Only the buyer can counter this counter-offer';
    end if;
    v_new_direction := 'buyer_to_seller';
  else
    raise exception 'Unsupported offer direction: %', v_parent_direction;
  end if;

  update public.offers
  set
    status = 'countered'::public.offer_status,
    updated_at = now()
  where id = v_parent.id;

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    status,
    direction,
    parent_offer_id
  )
  values (
    v_parent.listing_id,
    v_parent.buyer_id,
    v_parent.seller_id,
    v_parent.conversation_id,
    p_amount_pence,
    'pending'::public.offer_status,
    v_new_direction,
    v_parent.id
  )
  returning * into v_new_offer;

  if v_parent.conversation_id is not null then
    insert into public.messages (
      conversation_id,
      sender_id,
      message_type,
      offer_id,
      body
    )
    values (
      v_parent.conversation_id,
      auth.uid(),
      'offer'::public.message_type,
      v_new_offer.id,
      'Counter-offer'
    );

    perform public.insert_conversation_system_message(
      v_parent.conversation_id,
      'Counter-offer sent.'
    );
  end if;

  return v_new_offer;
end;
$$;

grant execute on function public.counter_offer(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Decline offer RPC (seller declines buyer offer, buyer declines counter)
-- ---------------------------------------------------------------------------

create or replace function public.decline_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_message text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be declined';
  end if;

  if v_offer.direction = 'buyer_to_seller' then
    if v_offer.seller_id <> auth.uid() then
      raise exception 'Only the seller can decline this offer';
    end if;
    v_message := 'Offer declined.';
  elsif v_offer.direction = 'seller_to_buyer' then
    if v_offer.buyer_id <> auth.uid() then
      raise exception 'Only the buyer can decline this counter-offer';
    end if;
    v_message := 'Counter-offer declined.';
  else
    raise exception 'Unsupported offer direction';
  end if;

  update public.offers
  set status = 'rejected'::public.offer_status
  where id = p_offer_id
  returning * into v_offer;

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(v_offer.conversation_id, v_message);
  end if;

  return v_offer;
end;
$$;

grant execute on function public.decline_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Accept counter-offer (buyer accepts seller counter)
-- ---------------------------------------------------------------------------

create or replace function public.accept_counter_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_payment_id uuid;
  v_platform_fee_pence int := 0;
  v_seller_net_pence int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can accept this counter-offer';
  end if;

  if v_offer.direction <> 'seller_to_buyer' then
    raise exception 'This is not a seller counter-offer';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending counter-offers can be accepted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_offer.listing_id
      and l.status = 'active'::public.listing_status
    for update
  ) then
    raise exception 'Listing is not available for acceptance';
  end if;

  v_seller_net_pence := v_offer.amount_pence - v_platform_fee_pence;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = p_offer_id;

  update public.offers
  set status = 'rejected'::public.offer_status
  where listing_id = v_offer.listing_id
    and id <> p_offer_id
    and status = 'pending'::public.offer_status;

  update public.listings
  set status = 'reserved'::public.listing_status
  where id = v_offer.listing_id;

  insert into public.payments (
    offer_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    platform_fee_pence,
    seller_net_pence,
    status,
    expires_at
  )
  values (
    v_offer.id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_platform_fee_pence,
    v_seller_net_pence,
    'pending'::public.payment_status,
    now() + interval '3 days'
  )
  returning id into v_payment_id;

  insert into public.orders (
    offer_id,
    payment_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    platform_fee_pence,
    seller_net_pence,
    fulfilment_status,
    payout_status
  )
  values (
    v_offer.id,
    v_payment_id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_platform_fee_pence,
    v_seller_net_pence,
    'awaiting_payment'::public.order_fulfilment_status,
    'not_due'::public.payout_status
  );

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      'Counter-offer accepted.'
    );
  end if;

  return v_offer;
end;
$$;

grant execute on function public.accept_counter_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend accept_offer to add chat system message
-- ---------------------------------------------------------------------------

create or replace function public.accept_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_uid uuid := auth.uid();
  v_payment_id uuid;
  v_platform_fee_pence int := 0;
  v_seller_net_pence int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can accept this offer';
  end if;

  if v_offer.direction <> 'buyer_to_seller' then
    raise exception 'Only buyer offers can be accepted by the seller';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be accepted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_offer.listing_id
      and l.seller_id = v_uid
      and l.status = 'active'::public.listing_status
    for update
  ) then
    raise exception 'Listing is not available for acceptance';
  end if;

  v_seller_net_pence := v_offer.amount_pence - v_platform_fee_pence;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = p_offer_id;

  update public.offers
  set status = 'rejected'::public.offer_status
  where listing_id = v_offer.listing_id
    and id <> p_offer_id
    and status = 'pending'::public.offer_status;

  update public.listings
  set status = 'reserved'::public.listing_status
  where id = v_offer.listing_id;

  insert into public.payments (
    offer_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    platform_fee_pence,
    seller_net_pence,
    status,
    expires_at
  )
  values (
    v_offer.id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_platform_fee_pence,
    v_seller_net_pence,
    'pending'::public.payment_status,
    now() + interval '3 days'
  )
  returning id into v_payment_id;

  insert into public.orders (
    offer_id,
    payment_id,
    listing_id,
    buyer_id,
    seller_id,
    amount_pence,
    platform_fee_pence,
    seller_net_pence,
    fulfilment_status,
    payout_status
  )
  values (
    v_offer.id,
    v_payment_id,
    v_offer.listing_id,
    v_offer.buyer_id,
    v_offer.seller_id,
    v_offer.amount_pence,
    v_platform_fee_pence,
    v_seller_net_pence,
    'awaiting_payment'::public.order_fulfilment_status,
    'not_due'::public.payout_status
  );

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      'Offer accepted.'
    );
  end if;

  return v_offer;
end;
$$;

-- ---------------------------------------------------------------------------
-- PostgREST schema cache reload
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
