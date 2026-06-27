-- =============================================================================
-- Production QA cleanup: remove test marketplace activity, keep listings/users
-- =============================================================================
--
-- Removes offers, orders, payments, conversations/messages, related disputes,
-- support requests, reviews (order-linked), and marketplace notifications.
--
-- KEEPS:
--   auth.users, profiles (admin flags unchanged except ensuring target admins)
--   listings, listing_images, listing_fulfilment_private, saved_listings
--   categories, brands, wanted_requests, user-only reports
--
-- Does NOT touch storage.objects or Stripe dashboard records.
--
-- Usage:
--   Dry run:  node scripts/production-qa-clear-marketplace-activity.mjs --dry-run
--   Execute:  PRODUCTION_QA_CLEANUP_CONFIRM=true node scripts/production-qa-clear-marketplace-activity.mjs --execute
--
-- Or run the DRY RUN section only in Supabase SQL editor (stop at marker below).
--
-- ---------------------------------------------------------------------------
-- Helper: marketplace notification filter (idempotent — safe before dry run)
-- ---------------------------------------------------------------------------

create or replace function public.is_marketplace_activity_notification(
  p_type text,
  p_link_url text
)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_type, '') in (
      'offer_received',
      'offer_accepted',
      'offer_declined',
      'offer_cancelled',
      'counter_offer_received',
      'counter_offer_accepted',
      'counter_offer_declined',
      'buyer_payment_received',
      'collection_confirmed',
      'courier_collection_confirmed',
      'courier_evidence_submitted',
      'courier_delivery_confirmed',
      'seller_delivery_confirmed',
      'order_dispute_opened',
      'order_dispute_under_review',
      'order_dispute_resolved_buyer',
      'order_dispute_resolved_seller',
      'support_request_opened',
      'review_received',
      'buyer_review_reminder',
      'seller_payout_complete',
      'message_received'
    )
    or coalesce(p_link_url, '') like '/listings/%'
    or coalesce(p_link_url, '') like '/orders/%'
    or coalesce(p_link_url, '') like '/messages/%'
    or coalesce(p_link_url, '') like '/hub%';
$$;

-- =============================================================================
-- DRY RUN ONLY (safe — no writes, no confirmation required)
-- =============================================================================

select '=== DRY RUN: marketplace activity to delete ===' as section;

select 'offers' as entity, count(*)::bigint as row_count from public.offers
union all select 'payments', count(*)::bigint from public.payments
union all select 'orders', count(*)::bigint from public.orders
union all select 'order_disputes', count(*)::bigint from public.order_disputes
union all select 'order_handover_details', count(*)::bigint from public.order_handover_details
union all select 'order_delivery_details', count(*)::bigint from public.order_delivery_details
union all select 'transaction_support_requests', count(*)::bigint from public.transaction_support_requests
union all select 'reviews', count(*)::bigint from public.reviews
union all select 'conversations', count(*)::bigint from public.conversations
union all select 'messages', count(*)::bigint from public.messages
union all select 'message_attachments', count(*)::bigint from public.message_attachments
union all select 'conversation_reads', count(*)::bigint from public.conversation_reads
union all select 'reports (listing/conversation/message)', count(*)::bigint
from public.reports
where report_type in ('listing', 'conversation', 'message')
   or listing_id is not null
   or conversation_id is not null
   or message_id is not null
union all select 'notifications (marketplace-related)', count(*)::bigint
from public.notifications n
where public.is_marketplace_activity_notification(n.type, n.link_url)
order by entity;

select '=== DRY RUN: rows to keep (baseline — must be unchanged after cleanup) ===' as section;

select
  (select count(*)::bigint from public.listings) as listings_total,
  (select count(*)::bigint from public.listing_images) as listing_images_total,
  (
    select count(*)::bigint
    from public.listings l
    where l.status = 'active'::public.listing_status
      and exists (
        select 1
        from public.listing_images li
        where li.listing_id = l.id
      )
  ) as visible_active_listings_with_images,
  (
    select count(*)::bigint
    from public.listings l
    where l.status in (
      'reserved'::public.listing_status,
      'in_progress'::public.listing_status,
      'sold'::public.listing_status
    )
  ) as listings_to_reactivate;

select '=== DRY RUN: listing status breakdown ===' as section;

select l.status::text as listing_status, count(*)::bigint as row_count
from public.listings l
group by l.status
order by l.status;

select '=== DRY RUN: admin accounts + unread marketplace notifications ===' as section;

select
  u.email,
  u.id as user_id,
  coalesce(p.is_admin, false) as is_admin,
  (
    select count(*)::bigint
    from public.notifications n
    where n.user_id = u.id
      and n.is_read = false
      and public.is_marketplace_activity_notification(n.type, n.link_url)
  ) as unread_marketplace_notifications
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in (
  'jlinnell95@gmail.com',
  'jordanlinnell1995@hotmail.co.uk'
)
order by u.email;

select '=== DRY RUN: all admin profiles ===' as section;

select u.email, p.is_admin
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin = true
order by u.email;

-- =============================================================================
-- STOP HERE FOR DRY-RUN ONLY
-- =============================================================================
-- Everything below is DESTRUCTIVE. Back up first. Set confirmed := true below,
-- or use: PRODUCTION_QA_CLEANUP_CONFIRM=true node scripts/... --execute
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CONFIRMATION — change false → true to allow destructive cleanup
-- ---------------------------------------------------------------------------

do $$
declare
  confirmed boolean := false;  -- <<< CHANGE TO true TO EXECUTE CLEANUP
begin
  if not confirmed then
    raise exception
      'Production QA cleanup aborted. Set confirmed := true in this block, or run the Node script with PRODUCTION_QA_CLEANUP_CONFIRM=true --execute.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- DESTRUCTIVE CLEANUP (single transaction)
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  v_admin_email_1 constant text := 'jlinnell95@gmail.com';
  v_admin_email_2 constant text := 'jordanlinnell1995@hotmail.co.uk';
  v_admin_id_1 uuid;
  v_admin_id_2 uuid;
  v_listings_before bigint;
  v_images_before bigint;
  v_visible_before bigint;
  v_deleted bigint;
begin
  select id into v_admin_id_1 from auth.users where email = v_admin_email_1;
  if v_admin_id_1 is null then
    raise exception 'Missing required admin account: %', v_admin_email_1;
  end if;

  select id into v_admin_id_2 from auth.users where email = v_admin_email_2;
  if v_admin_id_2 is null then
    raise exception 'Missing required admin account: %', v_admin_email_2;
  end if;

  select count(*) into v_listings_before from public.listings;
  select count(*) into v_images_before from public.listing_images;
  select count(*) into v_visible_before
  from public.listings l
  where l.status = 'active'::public.listing_status
    and exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    );

  if v_listings_before = 0 then
    raise exception 'Refusing cleanup: no listings found (wrong project?)';
  end if;

  raise notice 'Baseline: % listings, % images, % visible active with images',
    v_listings_before, v_images_before, v_visible_before;

  -- 1. Marketplace notifications
  delete from public.notifications n
  where public.is_marketplace_activity_notification(n.type, n.link_url);
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % marketplace-related notifications', v_deleted;

  -- 2. Trust & safety reports on listings / conversations / messages
  delete from public.reports
  where report_type in ('listing', 'conversation', 'message')
     or listing_id is not null
     or conversation_id is not null
     or message_id is not null;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listing/conversation/message reports', v_deleted;

  -- 3. Orders (+ cascaded disputes, reviews, handover/delivery, support requests)
  delete from public.orders;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % orders (+ cascaded child rows)', v_deleted;

  -- 4. Payments
  delete from public.payments;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % payments', v_deleted;

  -- 5. Offers
  delete from public.offers;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % offers', v_deleted;

  -- 6. Conversations (+ cascaded messages, attachments, read state)
  delete from public.conversations;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % conversations (+ cascaded messages)', v_deleted;

  -- 7. Reactivate listings reserved/sold by test transactions
  update public.listings
  set status = 'active'::public.listing_status
  where status in (
    'reserved'::public.listing_status,
    'in_progress'::public.listing_status,
    'sold'::public.listing_status
  );
  get diagnostics v_deleted = row_count;
  raise notice 'Reactivated % listings to active', v_deleted;

  -- 8. Ensure target admin accounts remain admin (does not demote others)
  alter table public.profiles disable trigger profiles_prevent_stripe_client_updates;

  update public.profiles
  set is_admin = true
  where id in (v_admin_id_1, v_admin_id_2)
    and is_admin is distinct from true;

  alter table public.profiles enable trigger profiles_prevent_stripe_client_updates;

  if not exists (select 1 from public.profiles where id = v_admin_id_1 and is_admin) then
    raise exception 'Admin check failed: % is not admin', v_admin_email_1;
  end if;

  if not exists (select 1 from public.profiles where id = v_admin_id_2 and is_admin) then
    raise exception 'Admin check failed: % is not admin', v_admin_email_2;
  end if;

  -- Preserve listing catalog counts
  if (select count(*) from public.listings) <> v_listings_before then
    raise exception 'Listing count changed (% → %)', v_listings_before, (select count(*) from public.listings);
  end if;

  if (select count(*) from public.listing_images) <> v_images_before then
    raise exception 'Listing image count changed (% → %)', v_images_before, (select count(*) from public.listing_images);
  end if;

  if (
    select count(*)
    from public.listings l
    where l.status = 'active'::public.listing_status
      and exists (select 1 from public.listing_images li where li.listing_id = l.id)
  ) < v_visible_before then
    raise exception 'Visible active listings with images decreased (% → %)',
      v_visible_before,
      (
        select count(*)
        from public.listings l
        where l.status = 'active'::public.listing_status
          and exists (select 1 from public.listing_images li where li.listing_id = l.id)
      );
  end if;

  raise notice 'Cleanup complete. Listings preserved: % total, % visible active with images',
    v_listings_before, v_visible_before;
end $$;

-- ---------------------------------------------------------------------------
-- FINAL VERIFICATION (must pass before commit)
-- ---------------------------------------------------------------------------

select '=== FINAL VERIFICATION ===' as section;

select
  'offers' as check_name,
  (select count(*)::bigint from public.offers) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.offers) = 0 as passed;

select
  'orders' as check_name,
  (select count(*)::bigint from public.orders) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.orders) = 0 as passed;

select
  'payments' as check_name,
  (select count(*)::bigint from public.payments) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.payments) = 0 as passed;

select
  'conversations' as check_name,
  (select count(*)::bigint from public.conversations) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.conversations) = 0 as passed;

select
  'reviews' as check_name,
  (select count(*)::bigint from public.reviews) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.reviews) = 0 as passed;

select
  'listings preserved' as check_name,
  (select count(*)::bigint from public.listings) as actual_count,
  null::bigint as expected_count,
  (select count(*) from public.listings) > 0 as passed;

select
  'listing_images preserved' as check_name,
  (select count(*)::bigint from public.listing_images) as actual_count,
  null::bigint as expected_count,
  (select count(*) from public.listing_images) > 0 as passed;

select
  'visible active listings with images' as check_name,
  (
    select count(*)::bigint
    from public.listings l
    where l.status = 'active'::public.listing_status
      and exists (select 1 from public.listing_images li where li.listing_id = l.id)
  ) as actual_count,
  null::bigint as expected_count,
  (
    select count(*)
    from public.listings l
    where l.status = 'active'::public.listing_status
      and exists (select 1 from public.listing_images li where li.listing_id = l.id)
  ) > 0 as passed;

select
  'admin unread marketplace notifications' as check_name,
  (
    select count(*)::bigint
    from public.notifications n
    join auth.users u on u.id = n.user_id
    join public.profiles p on p.id = n.user_id
    where p.is_admin = true
      and n.is_read = false
      and public.is_marketplace_activity_notification(n.type, n.link_url)
  ) as actual_count,
  0::bigint as expected_count,
  (
    select count(*)
    from public.notifications n
    join auth.users u on u.id = n.user_id
    join public.profiles p on p.id = n.user_id
    where p.is_admin = true
      and n.is_read = false
      and public.is_marketplace_activity_notification(n.type, n.link_url)
  ) = 0 as passed;

select
  'target admin accounts' as check_name,
  coalesce(
    (
      select jsonb_agg(u.email order by u.email)
      from auth.users u
      join public.profiles p on p.id = u.id
      where u.email in ('jlinnell95@gmail.com', 'jordanlinnell1995@hotmail.co.uk')
        and p.is_admin = true
    ),
    '[]'::jsonb
  ) as actual_admin_emails,
  jsonb_build_array('jlinnell95@gmail.com', 'jordanlinnell1995@hotmail.co.uk') as expected_admin_emails,
  (
    select count(*) = 2
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.email in ('jlinnell95@gmail.com', 'jordanlinnell1995@hotmail.co.uk')
      and p.is_admin = true
  ) as passed;

do $$
begin
  if (select count(*) from public.offers) <> 0
    or (select count(*) from public.orders) <> 0
    or (select count(*) from public.payments) <> 0
    or (select count(*) from public.conversations) <> 0
    or (select count(*) from public.listings) = 0
    or (select count(*) from public.listing_images) = 0
    or (
      select count(*)
      from public.listings l
      where l.status = 'active'::public.listing_status
        and exists (select 1 from public.listing_images li where li.listing_id = l.id)
    ) = 0
    or exists (
      select 1
      from public.notifications n
      join public.profiles p on p.id = n.user_id
      where p.is_admin = true
        and n.is_read = false
        and public.is_marketplace_activity_notification(n.type, n.link_url)
    )
    or not exists (
      select 1
      from auth.users u
      join public.profiles p on p.id = u.id
      where u.email = 'jlinnell95@gmail.com' and p.is_admin = true
    )
    or not exists (
      select 1
      from auth.users u
      join public.profiles p on p.id = u.id
      where u.email = 'jordanlinnell1995@hotmail.co.uk' and p.is_admin = true
    )
  then
    raise exception 'Final verification failed — rolling back (see FINAL VERIFICATION results above)';
  end if;
end $$;

commit;

-- =============================================================================
-- Tables intentionally NOT touched
-- =============================================================================
-- auth.users
-- public.profiles (except is_admin=true for target emails if missing)
-- public.listings, listing_images, listing_fulfilment_private, saved_listings
-- public.categories, public.brands, public.wanted_requests
-- public.reports where report_type = 'user' only
-- storage.objects (all buckets)
-- Stripe dashboard / webhook configuration
