-- Equipd in-app notifications
-- Run after offer-acceptance.sql

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_type_not_empty check (char_length(trim(type)) > 0),
  constraint notifications_title_not_empty check (char_length(trim(title)) > 0),
  constraint notifications_body_not_empty check (char_length(trim(body)) > 0)
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where is_read = false;

-- ---------------------------------------------------------------------------
-- Create notification (security definer; inserts bypass RLS)
-- ---------------------------------------------------------------------------

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link_url text default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.notifications;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  insert into public.notifications (user_id, type, title, body, link_url)
  values (p_user_id, p_type, p_title, p_body, p_link_url)
  returning * into v_notification;

  return v_notification;
end;
$$;

grant execute on function public.create_notification(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Automatic notifications
-- ---------------------------------------------------------------------------

create or replace function public.notify_message_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_listing_title text;
  v_recipient_id uuid;
  v_body_preview text;
begin
  select *
  into v_conversation
  from public.conversations
  where id = new.conversation_id;

  select title
  into v_listing_title
  from public.listings
  where id = v_conversation.listing_id;

  if v_conversation.buyer_id = new.sender_id then
    v_recipient_id := v_conversation.seller_id;
  else
    v_recipient_id := v_conversation.buyer_id;
  end if;

  v_body_preview := left(trim(new.body), 120);
  if char_length(trim(new.body)) > 120 then
    v_body_preview := v_body_preview || '…';
  end if;

  perform public.create_notification(
    v_recipient_id,
    'message_received',
    'New message',
    coalesce(
      nullif(v_body_preview, ''),
      'New message about ' || coalesce(v_listing_title, 'your listing')
    ),
    '/messages/' || new.conversation_id::text
  );

  return new;
end;
$$;

create trigger messages_notify_recipient
  after insert on public.messages
  for each row execute function public.notify_message_received();

create or replace function public.notify_offer_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_amount text;
begin
  select l.title
  into v_listing_title
  from public.listings l
  where l.id = new.listing_id;

  v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');

  perform public.create_notification(
    new.seller_id,
    'offer_received',
    'New offer',
    '£' || v_amount || ' offer on ' || coalesce(v_listing_title, 'your listing'),
    '/listings/' || (
      select slug from public.listings where id = new.listing_id
    )
  );

  return new;
end;
$$;

create trigger offers_notify_seller
  after insert on public.offers
  for each row execute function public.notify_offer_received();

create or replace function public.notify_offer_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_listing_slug text;
  v_amount text;
begin
  if old.status <> 'pending'::public.offer_status then
    return new;
  end if;

  if new.status = 'accepted'::public.offer_status then
    select l.title, l.slug
    into v_listing_title, v_listing_slug
    from public.listings l
    where l.id = new.listing_id;

    v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');

    perform public.create_notification(
      new.buyer_id,
      'offer_accepted',
      'Offer accepted',
      'Your £' || v_amount || ' offer on ' || coalesce(v_listing_title, 'a listing') || ' was accepted',
      '/listings/' || v_listing_slug
    );
  elsif new.status = 'rejected'::public.offer_status then
    select l.title, l.slug
    into v_listing_title, v_listing_slug
    from public.listings l
    where l.id = new.listing_id;

    v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');

    perform public.create_notification(
      new.buyer_id,
      'offer_rejected',
      'Offer declined',
      'Your £' || v_amount || ' offer on ' || coalesce(v_listing_title, 'a listing') || ' was declined',
      '/listings/' || v_listing_slug
    );
  end if;

  return new;
end;
$$;

create trigger offers_notify_buyer_status_change
  after update of status on public.offers
  for each row execute function public.notify_offer_status_change();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.notifications enable row level security;

create policy "Users read own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users update own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
