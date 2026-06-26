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
-- Message unread state is handled by conversation_reads (see conversation-reads.sql).
-- Bell notifications intentionally exclude messages; only the envelope badge alerts
-- users to new messages. Offer/support/order triggers below remain active.

create or replace function public.notify_message_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Disabled: track_message_unread_state() owns message unread counts.
  return new;
end;
$$;

-- Intentionally not created: messages_notify_recipient
-- Apply supabase/disable-message-bell-notifications.sql on existing databases.

create or replace function public.notify_offer_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
  v_amount text;
  v_direction text;
  v_party_name text;
  v_link text;
begin
  select l.title
  into v_listing_title
  from public.listings l
  where l.id = new.listing_id;

  v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');
  v_link := '/hub?section=offers&offerId=' || new.id::text;
  v_direction := coalesce(new.direction, 'buyer_to_seller');

  if v_direction = 'seller_to_buyer' then
    select coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      'The seller'
    )
    into v_party_name
    from public.profiles p
    where p.id = new.seller_id;

    perform public.create_notification(
      new.buyer_id,
      'counter_offer_received',
      'Counter-offer received',
      v_party_name || ' has countered your offer on '
        || coalesce(v_listing_title, 'a listing') || '.',
      v_link
    );
  elsif new.parent_offer_id is not null then
    select coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      'The buyer'
    )
    into v_party_name
    from public.profiles p
    where p.id = new.buyer_id;

    perform public.create_notification(
      new.seller_id,
      'counter_offer_received',
      'Counter-offer received',
      v_party_name || ' has countered your offer on '
        || coalesce(v_listing_title, 'a listing') || '.',
      v_link
    );
  else
    perform public.create_notification(
      new.seller_id,
      'offer_received',
      'New offer',
      '£' || v_amount || ' offer on ' || coalesce(v_listing_title, 'your listing'),
      v_link
    );
  end if;

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
  v_amount text;
  v_order_id uuid;
  v_direction text;
  v_party_name text;
  v_link text;
begin
  if old.status <> 'pending'::public.offer_status
    and not (
      old.status = 'accepted'::public.offer_status
      and new.status = 'cancelled'::public.offer_status
    ) then
    return new;
  end if;

  if new.status in (
    'countered'::public.offer_status,
    'withdrawn'::public.offer_status
  ) then
    return new;
  end if;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = new.listing_id;

  v_amount := to_char(new.amount_pence / 100.0, 'FM999999990.00');
  v_link := '/hub?section=offers&offerId=' || new.id::text;
  v_direction := coalesce(new.direction, 'buyer_to_seller');

  if new.status = 'accepted'::public.offer_status then
    if v_direction = 'seller_to_buyer' then
      select coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.username), ''),
        'The buyer'
      )
      into v_party_name
      from public.profiles p
      where p.id = new.buyer_id;

      perform public.create_notification(
        new.seller_id,
        'counter_offer_accepted',
        'Counter-offer accepted',
        v_party_name || ' accepted your £' || v_amount || ' counter-offer on '
          || coalesce(v_listing_title, 'a listing') || '.',
        v_link
      );
    else
      perform public.create_notification(
        new.buyer_id,
        'offer_accepted',
        'Offer accepted',
        'Your £' || v_amount || ' offer on '
          || coalesce(v_listing_title, 'a listing') || ' was accepted',
        v_link
      );
    end if;
  elsif new.status = 'rejected'::public.offer_status then
    if v_direction = 'seller_to_buyer' then
      select coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.username), ''),
        'The buyer'
      )
      into v_party_name
      from public.profiles p
      where p.id = new.buyer_id;

      perform public.create_notification(
        new.seller_id,
        'counter_offer_declined',
        'Counter-offer declined',
        v_party_name || ' declined your counter-offer on '
          || coalesce(v_listing_title, 'a listing') || '.',
        v_link
      );
    else
      perform public.create_notification(
        new.buyer_id,
        'offer_declined',
        'Offer declined',
        'Your £' || v_amount || ' offer on '
          || coalesce(v_listing_title, 'a listing') || ' was declined',
        v_link
      );
    end if;
  elsif new.status = 'cancelled'::public.offer_status then
    select o.id
    into v_order_id
    from public.orders o
    where o.offer_id = new.id
    limit 1;

    perform public.create_notification(
      new.buyer_id,
      'offer_cancelled',
      'Sale cancelled',
      'The seller cancelled your accepted £' || v_amount || ' offer on '
        || coalesce(v_listing_title, 'a listing') || ' before payment',
      case
        when v_order_id is not null then '/orders/' || v_order_id::text
        else v_link
      end
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
