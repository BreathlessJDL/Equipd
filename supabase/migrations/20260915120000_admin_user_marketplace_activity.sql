-- Admin marketplace activity visibility (read-only).
-- Extends admin_search_users with activity counts; adds per-user detail + dashboard summary RPCs.
-- Does not change marketplace behaviour, RLS on tables, or offer/save semantics.

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER; used only by admin RPCs below)
-- ---------------------------------------------------------------------------

create or replace function public.admin_offer_was_made_by(p_offer public.offers, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    (
      coalesce(p_offer.direction, 'buyer_to_seller') = 'buyer_to_seller'
      and p_offer.buyer_id = p_user_id
    )
    or (
      p_offer.direction = 'seller_to_buyer'
      and p_offer.seller_id = p_user_id
    );
$$;

create or replace function public.admin_offer_was_received_by(p_offer public.offers, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    (
      coalesce(p_offer.direction, 'buyer_to_seller') = 'buyer_to_seller'
      and p_offer.seller_id = p_user_id
    )
    or (
      p_offer.direction = 'seller_to_buyer'
      and p_offer.buyer_id = p_user_id
    );
$$;

revoke all on function public.admin_offer_was_made_by(public.offers, uuid) from public, anon, authenticated;
revoke all on function public.admin_offer_was_received_by(public.offers, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_search_users — add compact activity metrics (single aggregated pass)
-- ---------------------------------------------------------------------------

create or replace function public.admin_search_users(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer;
  v_raw text;
  v_like text;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_raw := nullif(trim(coalesce(p_query, '')), '');
  v_like := case
    when v_raw is null then null
    else '%' || replace(replace(v_raw, '\', '\\'), '%', '\%') || '%'
  end;

  with matched as (
    select
      p.id,
      p.username,
      p.display_name,
      p.created_at,
      p.is_admin,
      p.is_official_equipd,
      p.is_suspended,
      p.suspended_at,
      p.suspension_reason,
      u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where
      v_like is null
      or p.username ilike v_like escape '\'
      or coalesce(p.display_name, '') ilike v_like escape '\'
      or coalesce(u.email, '') ilike v_like escape '\'
    order by p.created_at desc
    limit v_limit
  ),
  listing_counts as (
    select l.seller_id as user_id, count(*)::int as listing_count
    from public.listings l
    where l.seller_id in (select id from matched)
      and coalesce(l.is_test_data, false) = false
    group by l.seller_id
  ),
  saved_counts as (
    select s.user_id, count(*)::int as saved_count
    from public.saved_listings s
    where s.user_id in (select id from matched)
    group by s.user_id
  ),
  offer_counts as (
    select
      m.id as user_id,
      count(*) filter (
        where public.admin_offer_was_made_by(o, m.id)
      )::int as offers_made_count,
      count(*) filter (
        where public.admin_offer_was_received_by(o, m.id)
      )::int as offers_received_count
    from matched m
    left join public.offers o
      on o.buyer_id = m.id or o.seller_id = m.id
    group by m.id
  ),
  conversation_counts as (
    select
      m.id as user_id,
      count(*) filter (
        where c.id is not null
      )::int as conversation_count,
      count(*) filter (
        where c.buyer_id = m.id
      )::int as buyer_conversation_count
    from matched m
    left join public.conversations c
      on c.buyer_id = m.id or c.seller_id = m.id
    group by m.id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'username', s.username,
        'displayName', s.display_name,
        'email', s.email,
        'createdAt', s.created_at,
        'listingCount', coalesce(lc.listing_count, 0),
        'savedCount', coalesce(sc.saved_count, 0),
        'offersMadeCount', coalesce(oc.offers_made_count, 0),
        'offersReceivedCount', coalesce(oc.offers_received_count, 0),
        'conversationCount', coalesce(cc.conversation_count, 0),
        'activityClass', case
          when coalesce(lc.listing_count, 0) > 0
            and (
              coalesce(sc.saved_count, 0) > 0
              or coalesce(oc.offers_made_count, 0) > 0
              or coalesce(cc.buyer_conversation_count, 0) > 0
            )
            then 'buyer_seller'
          when coalesce(lc.listing_count, 0) > 0 then 'seller'
          when
            coalesce(sc.saved_count, 0) > 0
            or coalesce(oc.offers_made_count, 0) > 0
            or coalesce(cc.buyer_conversation_count, 0) > 0
            then 'buyer'
          else 'none'
        end,
        'isAdmin', s.is_admin,
        'isOfficialEquipd', s.is_official_equipd,
        'isSuspended', s.is_suspended,
        'suspendedAt', s.suspended_at,
        'suspensionReason', s.suspension_reason
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_items
  from matched s
  left join listing_counts lc on lc.user_id = s.id
  left join saved_counts sc on sc.user_id = s.id
  left join offer_counts oc on oc.user_id = s.id
  left join conversation_counts cc on cc.user_id = s.id;

  return jsonb_build_object('items', coalesce(v_items, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_search_users(text, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-user marketplace activity detail (read-only)
-- ---------------------------------------------------------------------------

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
      l.status as listing_status,
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
      l.status as listing_status,
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
        'listingStatus', coalesce(r.listing_status::text, 'unavailable'),
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
      l.status as listing_status,
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

-- ---------------------------------------------------------------------------
-- Dashboard marketplace activity summary
-- ---------------------------------------------------------------------------

create or replace function public.admin_marketplace_activity_statistics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_last_7_start timestamptz;
  v_saved_total int;
  v_saved_last_7 int;
  v_offers_total int;
  v_offers_last_7 int;
  v_offers_by_status jsonb;
  v_conversations_total int;
  v_conversations_last_7 int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_today := (timezone('Europe/London', now()))::date;
  v_last_7_start := (v_today - 6)::timestamp at time zone 'Europe/London';

  select count(*)::int, count(*) filter (where s.created_at >= v_last_7_start)::int
  into v_saved_total, v_saved_last_7
  from public.saved_listings s;

  select count(*)::int, count(*) filter (where o.created_at >= v_last_7_start)::int
  into v_offers_total, v_offers_last_7
  from public.offers o;

  select coalesce(jsonb_object_agg(status::text, cnt), '{}'::jsonb)
  into v_offers_by_status
  from (
    select o.status, count(*)::int as cnt
    from public.offers o
    group by o.status
  ) x;

  select count(*)::int, count(*) filter (where c.created_at >= v_last_7_start)::int
  into v_conversations_total, v_conversations_last_7
  from public.conversations c;

  return jsonb_build_object(
    'savedListings', jsonb_build_object(
      'total', coalesce(v_saved_total, 0),
      'last7Days', coalesce(v_saved_last_7, 0)
    ),
    'offers', jsonb_build_object(
      'total', coalesce(v_offers_total, 0),
      'last7Days', coalesce(v_offers_last_7, 0),
      'byStatus', coalesce(v_offers_by_status, '{}'::jsonb)
    ),
    'conversations', jsonb_build_object(
      'total', coalesce(v_conversations_total, 0),
      'last7Days', coalesce(v_conversations_last_7, 0)
    )
  );
end;
$$;

revoke all on function public.admin_marketplace_activity_statistics() from public, anon;
grant execute on function public.admin_marketplace_activity_statistics() to authenticated;

notify pgrst, 'reload schema';
