-- =============================================================================
-- Dev seed cleanup: remove data created by scripts/seed-dev.mjs
-- =============================================================================
--
-- SAFE SCOPE — only removes:
--   • Five known dev accounts (@equipd.dev sellers/buyers from seed-dev-data.mjs)
--   • Listings whose slug starts with dev-seed-
--   • Marketplace activity tied to those listings or dev users
--
-- KEEPS:
--   • Real user accounts, profiles, listings, orders, messages, notifications
--   • Categories, brands, taxonomy
--   • Dev user profile rows (optional auth deletion in separate section below)
--
-- Does NOT remove auth.users by default (see optional section at bottom).
-- Does NOT remove Stripe dashboard records.
--
-- Storage files are NOT deleted by this SQL (Supabase blocks direct storage.objects DELETE).
-- Run the Storage API script first while dev orders still exist:
--   PowerShell: $env:CLEANUP_DEV_STORAGE_ALLOW="true"; node scripts/cleanup-dev-seed-storage.mjs
--   Bash:       CLEANUP_DEV_STORAGE_ALLOW=true node scripts/cleanup-dev-seed-storage.mjs
-- Without CLEANUP_DEV_STORAGE_ALLOW the storage script previews only (no deletes).
-- Recommended order: storage script → this SQL → optional auth reset → seed:dev
--
-- Usage (Supabase SQL Editor):
--   1. Run ONLY the "PREVIEW" section (through STOP marker). Review counts.
--   2. If counts look correct, run the "EXECUTE" section with confirmed := true.
--   3. Optionally run the auth cleanup section separately.
--
-- Re-seed after cleanup:
--   SEED_DEV_ALLOW=true npm run seed:dev
--
-- =============================================================================
-- PREVIEW — safe to run (read-only)
-- =============================================================================

select '=== PREVIEW: dev users ===' as section;

select u.id, u.email, p.display_name
from auth.users u
left join public.profiles p on p.id = u.id
where u.email in (
  'dev-seller-leeds@equipd.dev',
  'dev-seller-manchester@equipd.dev',
  'dev-seller-london@equipd.dev',
  'dev-buyer-emma@equipd.dev',
  'dev-buyer-chris@equipd.dev'
)
order by u.email;

select '=== PREVIEW: dev-seed listings ===' as section;

select l.id, l.slug, l.status::text, l.title
from public.listings l
where l.slug like 'dev-seed-%'
order by l.slug;

select '=== PREVIEW: row counts to delete ===' as section;

with dev_users as (
  select u.id
  from auth.users u
  where u.email in (
    'dev-seller-leeds@equipd.dev',
    'dev-seller-manchester@equipd.dev',
    'dev-seller-london@equipd.dev',
    'dev-buyer-emma@equipd.dev',
    'dev-buyer-chris@equipd.dev'
  )
),
dev_listings as (
  select l.id
  from public.listings l
  where l.slug like 'dev-seed-%'
),
dev_orders as (
  select o.id
  from public.orders o
  where o.listing_id in (select id from dev_listings)
),
dev_offers as (
  select f.id
  from public.offers f
  where f.listing_id in (select id from dev_listings)
),
dev_conversations as (
  select c.id
  from public.conversations c
  where c.listing_id in (select id from dev_listings)
),
dev_disputes as (
  select d.id
  from public.order_disputes d
  where d.order_id in (select id from dev_orders)
     or d.listing_id in (select id from dev_listings)
)
select 'listings (dev-seed-%)' as entity, count(*)::bigint as row_count
from dev_listings
union all
select 'listing_images', count(*)::bigint
from public.listing_images li
where li.listing_id in (select id from dev_listings)
union all
select 'listing_fulfilment_private', count(*)::bigint
from public.listing_fulfilment_private fp
where fp.listing_id in (select id from dev_listings)
union all
select 'saved_listings (dev user × dev listing)', count(*)::bigint
from public.saved_listings sl
where sl.listing_id in (select id from dev_listings)
  and sl.user_id in (select id from dev_users)
union all
select 'offers (on dev listings)', count(*)::bigint
from dev_offers
union all
select 'payments (on dev listings)', count(*)::bigint
from public.payments p
where p.listing_id in (select id from dev_listings)
union all
select 'orders (on dev listings)', count(*)::bigint
from dev_orders
union all
select 'order_disputes', count(*)::bigint
from dev_disputes
union all
select 'reviews (dev orders)', count(*)::bigint
from public.reviews r
where r.order_id in (select id from dev_orders)
union all
select 'transaction_support_requests', count(*)::bigint
from public.transaction_support_requests tsr
where tsr.order_id in (select id from dev_orders)
union all
select 'conversations (on dev listings)', count(*)::bigint
from dev_conversations
union all
select 'messages (dev conversations)', count(*)::bigint
from public.messages m
where m.conversation_id in (select id from dev_conversations)
union all
select 'message_attachments (dev conversations)', count(*)::bigint
from public.message_attachments ma
where ma.message_id in (
  select m.id
  from public.messages m
  where m.conversation_id in (select id from dev_conversations)
)
union all
select 'notifications (dev users)', count(*)::bigint
from public.notifications n
where n.user_id in (select id from dev_users)
union all
select 'notifications (linking dev orders/listings)', count(*)::bigint
from public.notifications n
where exists (
  select 1
  from dev_orders o
  where n.link_url like '/orders/' || o.id::text || '%'
)
or exists (
  select 1
  from public.listings l
  where l.slug like 'dev-seed-%'
    and (
      n.link_url like '/listings/' || l.slug || '%'
      or n.link_url like '/listings/' || l.id::text || '%'
    )
)
union all
select 'reports (dev listings)', count(*)::bigint
from public.reports r
where r.listing_id in (select id from dev_listings)
order by entity;

select '=== PREVIEW: storage (use Node script — not deleted by this SQL) ===' as section;

select
  'listing-images/dev-seed/*' as target,
  'node scripts/cleanup-dev-seed-storage.mjs' as preview_command;

with dev_listings as (
  select l.id from public.listings l where l.slug like 'dev-seed-%'
),
dev_orders as (
  select o.id from public.orders o where o.listing_id in (select id from dev_listings)
)
select
  o.id::text as dev_order_id,
  'order-evidence/' || o.id::text || '/*' as order_evidence_prefix
from dev_orders o
order by o.id
limit 50;

with dev_listings as (
  select l.id from public.listings l where l.slug like 'dev-seed-%'
),
dev_orders as (
  select o.id from public.orders o where o.listing_id in (select id from dev_listings)
)
select count(*)::bigint as dev_order_count_for_storage_cleanup
from dev_orders;

select '=== PREVIEW: real-user rows that must NOT be deleted (sanity) ===' as section;

with dev_listings as (
  select l.id from public.listings l where l.slug like 'dev-seed-%'
)
select
  (select count(*)::bigint from public.listings where slug not like 'dev-seed-%') as real_listings_kept,
  (select count(*)::bigint from public.orders where listing_id not in (select id from dev_listings)) as real_orders_kept,
  (select count(*)::bigint from auth.users where email not like '%@equipd.dev') as non_equipd_dev_users;

-- =============================================================================
-- STOP HERE FOR PREVIEW ONLY
-- =============================================================================
-- Review the counts above. If dev-seed listings = 0, cleanup may already be done.
-- Everything below is DESTRUCTIVE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CONFIRMATION — set to true only after preview looks correct
-- ---------------------------------------------------------------------------

do $$
declare
  confirmed boolean := false;  -- <<< CHANGE TO true TO EXECUTE CLEANUP
begin
  if not confirmed then
    raise exception
      'Dev seed cleanup aborted. Set confirmed := true in the CONFIRMATION block after reviewing PREVIEW counts.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- EXECUTE — destructive cleanup (single transaction)
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  v_dev_emails constant text[] := array[
    'dev-seller-leeds@equipd.dev',
    'dev-seller-manchester@equipd.dev',
    'dev-seller-london@equipd.dev',
    'dev-buyer-emma@equipd.dev',
    'dev-buyer-chris@equipd.dev'
  ];
  v_deleted bigint;
  v_dev_listing_count bigint;
begin
  -- Resolve dev listing IDs once
  create temp table _dev_listings on commit drop as
  select l.id, l.slug
  from public.listings l
  where l.slug like 'dev-seed-%';

  create temp table _dev_users on commit drop as
  select u.id, u.email
  from auth.users u
  where u.email = any (v_dev_emails);

  create temp table _dev_orders on commit drop as
  select o.id
  from public.orders o
  where o.listing_id in (select id from _dev_listings);

  select count(*) into v_dev_listing_count from _dev_listings;

  if v_dev_listing_count = 0 then
    raise notice 'No dev-seed listings found — marketplace rows may already be clean.';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Notifications (not cascaded from listing delete)
  -- -------------------------------------------------------------------------

  delete from public.notifications n
  where n.user_id in (select id from _dev_users);
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % notifications for dev users', v_deleted;

  delete from public.notifications n
  where exists (
    select 1
    from _dev_orders o
    where n.link_url like '/orders/' || o.id::text || '%'
  );
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % notifications linking to dev orders', v_deleted;

  delete from public.notifications n
  where exists (
    select 1
    from _dev_listings dl
    join public.listings l on l.id = dl.id
    where n.link_url like '/listings/' || l.slug || '%'
       or n.link_url like '/listings/' || l.id::text || '%'
  );
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % notifications linking to dev listings', v_deleted;

  -- -------------------------------------------------------------------------
  -- 2. Trust & safety reports on dev listings
  -- -------------------------------------------------------------------------

  delete from public.reports r
  where r.listing_id in (select id from _dev_listings);
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % reports on dev listings', v_deleted;

  -- -------------------------------------------------------------------------
  -- 3. Phase 5 audit log (no-op if table was never created / already rolled back)
  -- -------------------------------------------------------------------------

  if to_regclass('public.buyer_protection_dispute_events') is not null then
    execute $sql$
      delete from public.buyer_protection_dispute_events e
      where e.order_id in (select id from _dev_orders)
         or e.dispute_id in (
           select d.id
           from public.order_disputes d
           where d.order_id in (select id from _dev_orders)
         )
    $sql$;
    get diagnostics v_deleted = row_count;
    raise notice 'Deleted % buyer_protection_dispute_events rows', v_deleted;
  else
    raise notice 'Skipped buyer_protection_dispute_events (table absent)';
  end if;

  -- -------------------------------------------------------------------------
  -- 4. listing_fulfilment_private (seller-only DELETE trigger)
  -- -------------------------------------------------------------------------
  -- Storage files (listing-images/dev-seed/, order-evidence/{dev-order-id}/) must be
  -- removed separately via: node scripts/cleanup-dev-seed-storage.mjs
  -- Run that script before this SQL while dev orders still exist in the database.

  alter table public.listing_fulfilment_private
    disable trigger listing_fulfilment_private_enforce_seller_only_delete;

  delete from public.listing_fulfilment_private fp
  where fp.listing_id in (select id from _dev_listings);
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listing_fulfilment_private rows', v_deleted;

  alter table public.listing_fulfilment_private
    enable trigger listing_fulfilment_private_enforce_seller_only_delete;

  -- -------------------------------------------------------------------------
  -- 5. Dev listings — cascades offers, payments, orders, disputes, reviews,
  --    conversations/messages, saved_listings, listing_images, support requests,
  --    order_handover_details, order_delivery_details (where FK ON DELETE CASCADE)
  -- -------------------------------------------------------------------------

  delete from public.listings l
  where l.id in (select id from _dev_listings);
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % dev-seed listings (+ cascaded marketplace rows)', v_deleted;

  raise notice 'Dev seed marketplace cleanup complete.';
end $$;

commit;

-- =============================================================================
-- OPTIONAL: remove dev auth users (run separately if you want a full reset)
-- =============================================================================
--
-- Supabase auth users cannot be deleted safely from plain SQL in all projects.
-- Prefer the Node seed reset which uses the Admin API:
--
--   SEED_DEV_ALLOW=true npm run seed:dev -- --reset
--
-- That runs scripts/seed-dev.mjs resetDevSeed() and recreates users.
--
-- If you must delete auth users manually:
--   Dashboard → Authentication → Users → filter @equipd.dev
--   Or use supabase.auth.admin.deleteUser via service-role script.
--
-- Deleting auth.users CASCADE removes public.profiles for those IDs.
-- Only do this when you intend to re-run seed:dev immediately.
--
-- Example (UNCOMMENT AND RUN ONLY IF YOU UNDERSTAND THE IMPACT):
--
-- delete from auth.users
-- where email in (
--   'dev-seller-leeds@equipd.dev',
--   'dev-seller-manchester@equipd.dev',
--   'dev-seller-london@equipd.dev',
--   'dev-buyer-emma@equipd.dev',
--   'dev-buyer-chris@equipd.dev'
-- );
