-- =============================================================================
-- Prelaunch cleanup: remove all listing/marketplace test data + reset admins
-- =============================================================================
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- WARNING — DESTRUCTIVE MARKETPLACE RESET
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- The DESTRUCTIVE section below permanently deletes ALL:
--   - listings and listing_images
--   - saved_listings / listing_fulfilment_private
--   - offers and payments
--   - orders (plus cascaded disputes, reviews, handover/support rows)
--   - conversations (plus cascaded messages, attachments, read state)
--   - marketplace-related notifications and listing/conversation/message reports
--
-- It then resets profiles.is_admin so ONLY these two accounts are admins:
--   - jlinnell95@gmail.com
--   - jordanlinnell1995@hotmail.co.uk
--
-- BACKUP / EXPORT REMINDER (do this BEFORE the destructive section):
--   1. Export a Supabase backup or pg_dump of the project if this is not
--      disposable dev data.
--   2. Note current listing_image storage_path values (dry-run query below).
--   3. Confirm you are on the intended project (dev vs production).
--
-- Does NOT delete:
--   - auth.users or profile rows (except is_admin flags)
--   - storage.objects files
--   - categories, brands, wanted_requests
--   - Stripe webhook config or payout cron
--
-- Dependency order used for DELETE (children → parents):
--   notifications → reports → orders → payments → offers → conversations
--   → saved_listings → listing_fulfilment_private → listing_images → listings
--
-- TO EXECUTE: change confirmed := false to confirmed := true in the block below,
-- then run the entire script top to bottom in the Supabase SQL editor.
--
-- =============================================================================
-- DRY RUN ONLY (safe — no writes, no confirmation required)
-- =============================================================================
--
-- Run through the end of this section and STOP before "DESTRUCTIVE CLEANUP".
-- In the Supabase SQL editor: select from the DRY RUN header through the
-- target-admin query, then execute selection only.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DRY RUN — row counts that will be affected (read-only)
-- -----------------------------------------------------------------------------

select '=== DRY RUN: rows to delete / reset ===' as section;

select 'listings' as entity, count(*)::bigint as row_count
from public.listings
union all
select 'listing_images', count(*)::bigint from public.listing_images
union all
select 'listing_fulfilment_private', count(*)::bigint from public.listing_fulfilment_private
union all
select 'saved_listings', count(*)::bigint from public.saved_listings
union all
select 'conversations', count(*)::bigint from public.conversations
union all
select 'messages', count(*)::bigint from public.messages
union all
select 'message_attachments', count(*)::bigint from public.message_attachments
union all
select 'conversation_reads', count(*)::bigint from public.conversation_reads
union all
select 'offers', count(*)::bigint from public.offers
union all
select 'payments', count(*)::bigint from public.payments
union all
select 'orders', count(*)::bigint from public.orders
union all
select 'order_disputes', count(*)::bigint from public.order_disputes
union all
select 'order_handover_details', count(*)::bigint from public.order_handover_details
union all
select 'order_delivery_details', count(*)::bigint from public.order_delivery_details
union all
select 'transaction_support_requests', count(*)::bigint from public.transaction_support_requests
union all
select 'reviews', count(*)::bigint from public.reviews
union all
select 'reports (listing/conversation/message)', count(*)::bigint
from public.reports
where report_type in ('listing', 'conversation', 'message')
   or listing_id is not null
   or conversation_id is not null
   or message_id is not null
union all
select 'notifications (marketplace-related)', count(*)::bigint
from public.notifications
where type in (
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
  'review_received'
)
or link_url like '/listings/%'
or link_url like '/orders/%'
or link_url like '/messages/%'
or link_url like '/hub%'
order by entity;

select 'listing_images.storage_path (storage NOT deleted)' as note,
       count(*)::bigint as path_count,
       count(distinct storage_path)::bigint as distinct_paths
from public.listing_images;

select 'profiles.is_admin = true (before reset)' as note,
       count(*)::bigint as admin_count
from public.profiles
where is_admin = true;

select 'target admin accounts' as note,
       u.email,
       u.id,
       p.is_admin as current_is_admin
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in (
  'jlinnell95@gmail.com',
  'jordanlinnell1995@hotmail.co.uk'
)
order by u.email;

-- =============================================================================
-- STOP HERE FOR DRY-RUN ONLY
-- =============================================================================
-- Everything below is DESTRUCTIVE. Back up first. Set confirmed := true below,
-- then run the remainder (or run the entire script top to bottom).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CONFIRMATION — change false → true to allow destructive cleanup
-- -----------------------------------------------------------------------------

do $$
declare
  confirmed boolean := false;  -- <<< CHANGE TO true TO EXECUTE CLEANUP
begin
  if not confirmed then
    raise exception
      'Prelaunch cleanup aborted. To execute, change confirmed := false to confirmed := true in the CONFIRMATION block above.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- DESTRUCTIVE CLEANUP (single transaction)
-- -----------------------------------------------------------------------------

begin;

do $$
declare
  v_admin_email_1 constant text := 'jlinnell95@gmail.com';
  v_admin_email_2 constant text := 'jordanlinnell1995@hotmail.co.uk';
  v_admin_id_1 uuid;
  v_admin_id_2 uuid;
  v_found int;
  v_deleted bigint;
begin
  select id into v_admin_id_1
  from auth.users
  where email = v_admin_email_1;

  if v_admin_id_1 is null then
    raise exception 'Missing required admin account: %', v_admin_email_1;
  end if;

  select id into v_admin_id_2
  from auth.users
  where email = v_admin_email_2;

  if v_admin_id_2 is null then
    raise exception 'Missing required admin account: %', v_admin_email_2;
  end if;

  select count(*) into v_found
  from auth.users
  where email in (v_admin_email_1, v_admin_email_2);

  if v_found <> 2 then
    raise exception 'Expected exactly 2 admin accounts; found %', v_found;
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Notifications tied to listings / orders / offers / messaging
  -- -------------------------------------------------------------------------
  delete from public.notifications
  where type in (
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
    'review_received'
  )
  or link_url like '/listings/%'
  or link_url like '/orders/%'
  or link_url like '/messages/%'
  or link_url like '/hub%';
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % marketplace-related notifications', v_deleted;

  -- -------------------------------------------------------------------------
  -- 2. Trust & safety reports on listings / conversations / messages
  --    (user-only reports are kept)
  -- -------------------------------------------------------------------------
  delete from public.reports
  where report_type in ('listing', 'conversation', 'message')
     or listing_id is not null
     or conversation_id is not null
     or message_id is not null;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listing/conversation/message reports', v_deleted;

  -- -------------------------------------------------------------------------
  -- 3–11. Listing marketplace graph (explicit child → parent order)
  -- -------------------------------------------------------------------------
  delete from public.orders;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % orders (+ cascaded disputes/reviews/handover/support)', v_deleted;

  delete from public.payments;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % payments', v_deleted;

  delete from public.offers;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % offers', v_deleted;

  delete from public.conversations;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % conversations (+ cascaded messages/attachments/reads)', v_deleted;

  delete from public.saved_listings;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % saved_listings', v_deleted;

  -- Prelaunch admin cleanup only: the SQL editor has no auth.uid(), so the
  -- seller-only DELETE trigger (enforce_listing_fulfilment_private_seller_only)
  -- would raise "Not authenticated". Disable for this delete, then restore.
  -- Rolls back with the transaction if final verification fails.
  alter table public.listing_fulfilment_private
    disable trigger listing_fulfilment_private_enforce_seller_only_delete;

  delete from public.listing_fulfilment_private;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listing_fulfilment_private rows', v_deleted;

  alter table public.listing_fulfilment_private
    enable trigger listing_fulfilment_private_enforce_seller_only_delete;

  delete from public.listing_images;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listing_images', v_deleted;

  delete from public.listings;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listings', v_deleted;

  -- -------------------------------------------------------------------------
  -- 12. Admin reset (profiles.is_admin is blocked for normal clients)
  -- -------------------------------------------------------------------------
  alter table public.profiles disable trigger profiles_prevent_stripe_client_updates;

  update public.profiles
  set is_admin = false;

  update public.profiles
  set is_admin = true
  where id in (v_admin_id_1, v_admin_id_2);

  alter table public.profiles enable trigger profiles_prevent_stripe_client_updates;

  if (select count(*) from public.profiles where is_admin = true) <> 2 then
    raise exception 'Admin reset failed: expected exactly 2 is_admin profiles';
  end if;

  if not exists (select 1 from public.profiles where id = v_admin_id_1 and is_admin) then
    raise exception 'Admin reset failed: % is not admin', v_admin_email_1;
  end if;

  if not exists (select 1 from public.profiles where id = v_admin_id_2 and is_admin) then
    raise exception 'Admin reset failed: % is not admin', v_admin_email_2;
  end if;

  raise notice 'Cleanup complete. Admins: %, %', v_admin_email_1, v_admin_email_2;
end $$;

-- -----------------------------------------------------------------------------
-- FINAL VERIFICATION (must pass before commit)
-- -----------------------------------------------------------------------------

select '=== FINAL VERIFICATION ===' as section;

select
  'listings' as check_name,
  (select count(*)::bigint from public.listings) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.listings) = 0 as passed;

select
  'listing_images' as check_name,
  (select count(*)::bigint from public.listing_images) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.listing_images) = 0 as passed;

select
  'orders' as check_name,
  (select count(*)::bigint from public.orders) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.orders) = 0 as passed;

select
  'offers' as check_name,
  (select count(*)::bigint from public.offers) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.offers) = 0 as passed;

select
  'conversations' as check_name,
  (select count(*)::bigint from public.conversations) as actual_count,
  0::bigint as expected_count,
  (select count(*) from public.conversations) = 0 as passed;

select
  'admins (target emails only)' as check_name,
  coalesce(
    (
      select jsonb_agg(u.email order by u.email)
      from auth.users u
      join public.profiles p on p.id = u.id
      where p.is_admin = true
    ),
    '[]'::jsonb
  ) as actual_admin_emails,
  jsonb_build_array(
    'jlinnell95@gmail.com',
    'jordanlinnell1995@hotmail.co.uk'
  ) as expected_admin_emails,
  (
    select count(*) = 2
    from public.profiles
    where is_admin = true
  )
  and not exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin = true
      and u.email not in (
        'jlinnell95@gmail.com',
        'jordanlinnell1995@hotmail.co.uk'
      )
  )
  and exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin = true
      and u.email = 'jlinnell95@gmail.com'
  )
  and exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.is_admin = true
      and u.email = 'jordanlinnell1995@hotmail.co.uk'
  ) as passed;

-- Abort commit if any verification failed
do $$
begin
  if (select count(*) from public.listings) <> 0
    or (select count(*) from public.listing_images) <> 0
    or (select count(*) from public.orders) <> 0
    or (select count(*) from public.offers) <> 0
    or (select count(*) from public.conversations) <> 0
    or (select count(*) from public.profiles where is_admin = true) <> 2
    or exists (
      select 1
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.is_admin = true
        and u.email not in (
          'jlinnell95@gmail.com',
          'jordanlinnell1995@hotmail.co.uk'
        )
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
-- public.profiles (except is_admin flags)
-- public.categories, public.brands
-- public.wanted_requests
-- public.reports where report_type = 'user' only
-- public.notifications unrelated to marketplace (if any remain)
-- public.app_config
-- storage.objects (all buckets — run separate storage cleanup later)
-- Stripe / payout cron configuration (not stored in these tables)
