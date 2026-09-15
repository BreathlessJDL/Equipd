-- Fix admin_user_marketplace_activity saved-listing status fallback.
-- coalesce(listing_status, 'deleted') inferred enum listing_status; 'deleted' is invalid.
-- Use text fallback 'unavailable' when the listing row is missing.

create or replace function public.admin_user_marketplace_activity(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles;
  v_email text;
  v_listing_count int;
  v_saved_count int;
  v_conversation_count int;
  v_buyer_conversation_count int;
  v_offers_made_total int;
  v_offers_received_total int;
  v_purchase_count int;
  v_sale_count int;
  v_offers_made_by_status jsonb;
  v_offers_received_by_status jsonb;
  v_offers_made jsonb;
  v_offers_received jsonb;
  v_saved_listings jsonb;
  v_conversations jsonb;
  v_activity_class text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_user_id is null then
    raise exception 'User id required';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;

  select count(*)::int into v_listing_count
  from public.listings l
  where l.seller_id = p_user_id
    and coalesce(l.is_test_data, false) = false;

  select count(*)::int into v_saved_count
  from public.saved_listings s
  where s.user_id = p_user_id;

  select
    count(*)::int,
    count(*) filter (where c.buyer_id = p_user_id)::int
  into v_conversation_count, v_buyer_conversation_count
  from public.conversations c
  where c.buyer_id = p_user_id or c.seller_id = p_user_id;

  select count(*)::int into v_offers_made_total
  from public.offers o
  where public.admin_offer_was_made_by(o, p_user_id);

  select count(*)::int into v_offers_received_total
  from public.offers o
  where public.admin_offer_was_received_by(o, p_user_id);

  select count(*)::int into v_purchase_count
  from public.orders ord
  where ord.buyer_id = p_user_id;

  select count(*)::int into v_sale_count
  from public.orders ord
  where ord.seller_id = p_user_id;

  select coalesce(
    jsonb_object_agg(status::text, cnt),
    '{}'::jsonb
  )
  into v_offers_made_by_status
  from (
    select o.status, count(*)::int as cnt
    from public.offers o
    where public.admin_offer_was_made_by(o, p_user_id)
    group by o.status
  ) x;

  select coalesce(
    jsonb_object_agg(status::text, cnt),
    '{}'::jsonb
  )
  into v_offers_received_by_status
  from (
    select o.status, count(*)::int as cnt
    from public.offers o
    where public.admin_offer_was_received_by(o, p_user_id)
    group by o.status
  ) x;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'listingId', r.listing_id,
        'listingTitle', r.listing_title,
        'listingSlug', r.listing_slug,
        'listingStatus', r.listing_status,
        'amountPence', r.amount_pence,
        'quantity', r.quantity,
        'status', r.status,
        'direction', r.direction,
        'createdAt', r.created_at,
        'otherParticipant', jsonb_build_object(
          'id', r.other_id,
          'username', op.username,
          'displayName', op.display_name
        )
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_offers_made
  from (
    select
      o.id,
      o.listing_id,
      l.title as listing_title,
      l.slug as listing_slug,
      l.status::text as listing_status,
      o.amount_pence,
      o.quantity,
      o.status,
      o.direction,
      o.created_at,
      case
        when coalesce(o.direction, 'buyer_to_seller') = 'buyer_to_seller' then o.seller_id
        else o.buyer_id
      end as other_id
    from public.offers o
    left join public.listings l on l.id = o.listing_id
    where public.admin_offer_was_made_by(o, p_user_id)
    order by o.created_at desc
    limit 100
  ) r
  left join public.profiles op on op.id = r.other_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'listingId', r.listing_id,
        'listingTitle', r.listing_title,
        'listingSlug', r.listing_slug,
        'listingStatus', r.listing_status,
        'amountPence', r.amount_pence,
        'quantity', r.quantity,
        'status', r.status,
        'direction', r.direction,
        'createdAt', r.created_at,
        'otherParticipant', jsonb_build_object(
          'id', r.other_id,
          'username', op.username,
          'displayName', op.display_name
        )
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_offers_received
  from (
    select
      o.id,
      o.listing_id,
      l.title as listing_title,
      l.slug as listing_slug,
      l.status::text as listing_status,
      o.amount_pence,
      o.quantity,
      o.status,
      o.direction,
      o.created_at,
      case
        when coalesce(o.direction, 'buyer_to_seller') = 'buyer_to_seller' then o.buyer_id
        else o.seller_id
      end as other_id
    from public.offers o
    left join public.listings l on l.id = o.listing_id
    where public.admin_offer_was_received_by(o, p_user_id)
    order by o.created_at desc
    limit 100
  ) r
  left join public.profiles op on op.id = r.other_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'savedId', r.id,
        'savedAt', r.created_at,
        'listingId', r.listing_id,
        'listingTitle', coalesce(r.listing_title, 'Listing unavailable'),
        'listingSlug', r.listing_slug,
        'listingStatus', coalesce(r.listing_status, 'unavailable'),
        'pricePence', r.price_pence,
        'seller', case
          when r.seller_id is null then null
          else jsonb_build_object(
            'id', r.seller_id,
            'username', r.seller_username,
            'displayName', r.seller_display_name
          )
        end
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_saved_listings
  from (
    select
      s.id,
      s.created_at,
      s.listing_id,
      l.title as listing_title,
      l.slug as listing_slug,
      l.status::text as listing_status,
      l.price_pence,
      l.seller_id,
      sp.username as seller_username,
      sp.display_name as seller_display_name
    from public.saved_listings s
    left join public.listings l on l.id = s.listing_id
    left join public.profiles sp on sp.id = l.seller_id
    where s.user_id = p_user_id
    order by s.created_at desc
    limit 100
  ) r;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'listingId', r.listing_id,
        'listingTitle', r.listing_title,
        'listingSlug', r.listing_slug,
        'role', r.role,
        'updatedAt', r.updated_at,
        'createdAt', r.created_at,
        'otherParticipant', jsonb_build_object(
          'id', r.other_id,
          'username', r.other_username,
          'displayName', r.other_display_name
        )
      )
      order by r.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_conversations
  from (
    select
      c.id,
      c.listing_id,
      l.title as listing_title,
      l.slug as listing_slug,
      case when c.buyer_id = p_user_id then 'buyer' else 'seller' end as role,
      c.updated_at,
      c.created_at,
      case when c.buyer_id = p_user_id then c.seller_id else c.buyer_id end as other_id,
      op.username as other_username,
      op.display_name as other_display_name
    from public.conversations c
    left join public.listings l on l.id = c.listing_id
    left join public.profiles op on op.id = case
      when c.buyer_id = p_user_id then c.seller_id
      else c.buyer_id
    end
    where c.buyer_id = p_user_id or c.seller_id = p_user_id
    order by c.updated_at desc
    limit 100
  ) r;

  v_activity_class := case
    when v_listing_count > 0
      and (
        v_saved_count > 0
        or v_offers_made_total > 0
        or v_buyer_conversation_count > 0
      )
      then 'buyer_seller'
    when v_listing_count > 0 then 'seller'
    when
      v_saved_count > 0
      or v_offers_made_total > 0
      or v_buyer_conversation_count > 0
      then 'buyer'
    else 'none'
  end;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_profile.id,
      'username', v_profile.username,
      'displayName', v_profile.display_name,
      'email', v_email,
      'createdAt', v_profile.created_at,
      'isAdmin', v_profile.is_admin,
      'isOfficialEquipd', v_profile.is_official_equipd,
      'isSuspended', v_profile.is_suspended
    ),
    'summary', jsonb_build_object(
      'listingCount', v_listing_count,
      'savedCount', v_saved_count,
      'conversationCount', v_conversation_count,
      'offersMadeCount', v_offers_made_total,
      'offersReceivedCount', v_offers_received_total,
      'purchaseCount', v_purchase_count,
      'saleCount', v_sale_count,
      'activityClass', v_activity_class
    ),
    'offersMadeByStatus', coalesce(v_offers_made_by_status, '{}'::jsonb),
    'offersReceivedByStatus', coalesce(v_offers_received_by_status, '{}'::jsonb),
    'offersMade', coalesce(v_offers_made, '[]'::jsonb),
    'offersReceived', coalesce(v_offers_received, '[]'::jsonb),
    'savedListings', coalesce(v_saved_listings, '[]'::jsonb),
    'conversations', coalesce(v_conversations, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_user_marketplace_activity(uuid) from public, anon;
grant execute on function public.admin_user_marketplace_activity(uuid) to authenticated;

notify pgrst, 'reload schema';
