-- Batch 1 follow-up: offer-note server validation, deleted-shop hiding,
-- deletion-pending write block, and retryable media-cleanup inventory.
-- No automatic purge job. Do not apply to production from this change set
-- without a reviewed staging deploy.

-- ---------------------------------------------------------------------------
-- 1. Offer notes use the same contact filters as chat (phones never allowed)
-- ---------------------------------------------------------------------------

create or replace function public.assert_marketplace_offer_note_allowed(
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
    return null;
  end if;

  -- Offer notes are pre-payment commercial text. Never unlock phones here.
  if public.marketplace_message_is_blocked(v_trimmed, false)
     and not public.marketplace_message_is_blocked(v_trimmed, true) then
    raise exception '%', public.marketplace_message_phone_block_message();
  end if;

  if public.marketplace_message_is_blocked(v_trimmed, false) then
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

        if public.marketplace_message_is_blocked(v_combined, false)
           and not public.marketplace_message_is_blocked(v_combined, true) then
          raise exception '%', public.marketplace_message_phone_block_message();
        end if;

        if public.marketplace_message_is_blocked(v_combined, false) then
          raise exception '%', public.marketplace_message_block_message();
        end if;
      end loop;
    end loop;
  end if;

  return v_trimmed;
end;
$$;

revoke all on function public.assert_marketplace_offer_note_allowed(text, uuid, uuid) from public;
grant execute on function public.assert_marketplace_offer_note_allowed(text, uuid, uuid)
  to authenticated, service_role;

create or replace function public.enforce_offer_note_marketplace_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sender uuid;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.message is null or trim(new.message) = '' then
    new.message := null;
    return new;
  end if;

  v_sender := coalesce(auth.uid(), new.buyer_id);
  new.message := public.assert_marketplace_offer_note_allowed(
    new.message,
    new.conversation_id,
    v_sender
  );

  return new;
end;
$$;

drop trigger if exists offers_enforce_marketplace_note on public.offers;
create trigger offers_enforce_marketplace_note
  before insert or update of message on public.offers
  for each row
  execute function public.enforce_offer_note_marketplace_rules();

-- Canonical buyer offer RPC: same behaviour plus note + suspension checks.
create or replace function public.create_buyer_offer(
  p_listing_id uuid,
  p_conversation_id uuid,
  p_quantity integer,
  p_total_amount_pence integer,
  p_message text default null
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_conversation public.conversations;
  v_offer public.offers;
  v_message text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform public.assert_not_suspended(v_uid);

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'Offer quantity must be a whole number between 1 and 999';
  end if;

  if p_total_amount_pence is null or p_total_amount_pence <= 0 then
    raise exception 'Enter a valid total offer amount greater than zero';
  end if;

  if p_total_amount_pence % p_quantity <> 0 then
    raise exception 'Offer total must divide evenly by quantity in pence';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found
     or not public.listing_is_publicly_visible(v_listing) then
    raise exception 'Listing is not available';
  end if;

  if v_listing.seller_id = v_uid then
    raise exception 'You cannot make an offer on your own listing';
  end if;

  if p_quantity > v_listing.quantity_available then
    raise exception 'Insufficient inventory: requested %, available %',
      p_quantity, v_listing.quantity_available;
  end if;

  if p_total_amount_pence / p_quantity > v_listing.price_pence then
    raise exception 'Offers cannot be higher than the asking price';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found
     or v_conversation.listing_id <> v_listing.id
     or v_conversation.buyer_id <> v_uid
     or v_conversation.seller_id <> v_listing.seller_id then
    raise exception 'A valid listing conversation is required';
  end if;

  v_message := public.assert_marketplace_offer_note_allowed(
    p_message,
    p_conversation_id,
    v_uid
  );

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    quantity,
    status,
    direction,
    message
  )
  values (
    v_listing.id,
    v_uid,
    v_listing.seller_id,
    p_conversation_id,
    p_total_amount_pence,
    p_quantity,
    'pending'::public.offer_status,
    'buyer_to_seller',
    v_message
  )
  returning * into v_offer;

  return v_offer;
end;
$$;

revoke all on function public.create_buyer_offer(uuid, uuid, integer, integer, text)
  from public, anon;
grant execute on function public.create_buyer_offer(uuid, uuid, integer, integer, text)
  to authenticated, service_role;

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
  v_parent public.offers;
  v_listing public.listings;
  v_new_offer public.offers;
  v_parent_direction text;
  v_new_direction text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.assert_not_suspended(auth.uid());

  select listing_id
  into v_parent.listing_id
  from public.offers
  where id = p_offer_id;

  if v_parent.listing_id is null then
    raise exception 'Parent offer not found';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_parent.listing_id
  for update;

  select *
  into v_parent
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Parent offer not found';
  end if;

  if v_parent.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be countered';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'Enter a valid counter-offer amount greater than zero';
  end if;

  if p_amount_pence % v_parent.quantity <> 0 then
    raise exception 'Counter-offer total must divide evenly by the fixed quantity';
  end if;

  if p_amount_pence / v_parent.quantity > v_listing.price_pence then
    raise exception 'Counter-offers cannot be higher than the asking price';
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
    raise exception 'Unsupported offer direction';
  end if;

  update public.offers
  set status = 'countered'::public.offer_status, updated_at = now()
  where id = v_parent.id;

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    quantity,
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
    v_parent.quantity,
    'pending'::public.offer_status,
    v_new_direction,
    v_parent.id
  )
  returning * into v_new_offer;

  if v_parent.conversation_id is not null then
    insert into public.messages (
      conversation_id, sender_id, message_type, offer_id, body
    )
    values (
      v_parent.conversation_id,
      auth.uid(),
      'offer'::public.message_type,
      v_new_offer.id,
      format(
        'Counter-offer for %s %s: £%s total (£%s per item)',
        v_new_offer.quantity,
        case when v_new_offer.quantity = 1 then 'item' else 'items' end,
        to_char(v_new_offer.amount_pence / 100.0, 'FM999999990.00'),
        to_char((v_new_offer.amount_pence / v_new_offer.quantity) / 100.0, 'FM999999990.00')
      )
    );

    perform public.insert_conversation_system_message(
      v_parent.conversation_id,
      format(
        'Counter-offer sent for %s %s: £%s total (£%s per item).',
        v_new_offer.quantity,
        case when v_new_offer.quantity = 1 then 'item' else 'items' end,
        to_char(v_new_offer.amount_pence / 100.0, 'FM999999990.00'),
        to_char((v_new_offer.amount_pence / v_new_offer.quantity) / 100.0, 'FM999999990.00')
      )
    );
  end if;

  return v_new_offer;
end;
$$;

revoke all on function public.counter_offer(uuid, integer) from public, anon;
grant execute on function public.counter_offer(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Deleted / deletion-pending accounts cannot keep writing
-- ---------------------------------------------------------------------------

create or replace function public.is_suspended(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.is_suspended
        or p.deleted_at is not null
        or p.deletion_requested_at is not null
      from public.profiles p
      where p.id = coalesce(p_user_id, auth.uid())
    ),
    false
  );
$$;

revoke all on function public.is_suspended(uuid) from public;
grant execute on function public.is_suspended(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Public shop / profile hide after deletion
-- ---------------------------------------------------------------------------

create or replace view public.profiles_public
with (security_barrier = true)
as
select
  p.id,
  p.username,
  p.display_name,
  p.location,
  p.avatar_url,
  p.created_at,
  p.last_active_at,
  p.is_official_equipd
from public.profiles p
where p.deleted_at is null;

grant select on public.profiles_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Deletion pending + retryable media inventory (no automatic purge)
-- ---------------------------------------------------------------------------

alter table public.account_deletion_events
  add column if not exists storage_cleanup jsonb not null default '{}'::jsonb;

create or replace function public.begin_account_deletion(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluation jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account deletion can only be started by the server';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.deleted_at is not null
  ) then
    return jsonb_build_object('ok', true, 'alreadyDeleted', true);
  end if;

  v_evaluation := public.evaluate_account_deletion(p_user_id);
  if coalesce((v_evaluation ->> 'allowed')::boolean, false) is not true then
    return jsonb_build_object('ok', false, 'evaluation', v_evaluation);
  end if;

  update public.profiles
  set
    is_suspended = true,
    suspended_at = coalesce(suspended_at, now()),
    suspension_reason = coalesce(suspension_reason, 'Account deletion in progress'),
    deletion_requested_at = coalesce(deletion_requested_at, now())
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'pending', true, 'evaluation', v_evaluation);
end;
$$;

revoke all on function public.begin_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;

create or replace function public.list_account_media_cleanup_targets(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing_paths jsonb := '[]'::jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media cleanup listing can only be run by the server';
  end if;

  select coalesce(jsonb_agg(li.storage_path order by li.storage_path), '[]'::jsonb)
  into v_listing_paths
  from public.listing_images li
  join public.listings l on l.id = li.listing_id
  where l.seller_id = p_user_id
    and l.status in (
      'draft'::public.listing_status,
      'archived'::public.listing_status
    )
    and not exists (
      select 1 from public.orders o where o.listing_id = l.id
    );

  return jsonb_build_object(
    'profileImagePrefix', p_user_id::text,
    'listingImagePaths', v_listing_paths,
    'retainMessageAttachments', true,
    'retainOrderEvidence', true,
    'retainSoldListingImages', true
  );
end;
$$;

revoke all on function public.list_account_media_cleanup_targets(uuid)
  from public, anon, authenticated;
grant execute on function public.list_account_media_cleanup_targets(uuid) to service_role;

create or replace function public.record_account_media_cleanup(
  p_user_id uuid,
  p_cleanup jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Media cleanup records can only be written by the server';
  end if;

  update public.account_deletion_events
  set storage_cleanup = coalesce(p_cleanup, '{}'::jsonb)
  where id = (
    select e.id
    from public.account_deletion_events e
    where e.user_id = p_user_id
    order by e.created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.record_account_media_cleanup(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_account_media_cleanup(uuid, jsonb) to service_role;

create or replace function public.abort_account_deletion_pending(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Account deletion can only be aborted by the server';
  end if;

  update public.profiles
  set
    is_suspended = false,
    suspended_at = null,
    suspension_reason = null,
    deletion_requested_at = null
  where id = p_user_id
    and deleted_at is null
    and deletion_requested_at is not null
    and coalesce(suspension_reason, '') = 'Account deletion in progress';

  return jsonb_build_object('ok', true, 'reverted', FOUND);
end;
$$;

revoke all on function public.abort_account_deletion_pending(uuid)
  from public, anon, authenticated;
grant execute on function public.abort_account_deletion_pending(uuid) to service_role;

notify pgrst, 'reload schema';
