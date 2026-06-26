-- =============================================================================
-- Delete Bubble import listings with zero images
-- =============================================================================
--
-- Permanently removes listings where:
--   source = 'import'
--   AND no rows in listing_images
--
-- Does NOT delete:
--   - auth.users / profiles
--   - import listings that have 1+ images
--   - manual or api source listings
--   - storage.objects (no image rows exist for targets)
--
-- Expected target count (dev, 2026-06): 86 listings
--
-- WORKFLOW:
--   1. Run the DRY RUN section only (through "STOP HERE FOR DRY-RUN ONLY").
--   2. Review counts, slugs, and blocker checks.
--   3. Set confirmed := true in the CONFIRMATION block.
--   4. Run the full script (or from CONFIRMATION through end).
--
-- =============================================================================
-- DRY RUN ONLY (safe — no writes, no confirmation required)
-- =============================================================================

select '=== DRY RUN: zero-image import listings ===' as section;

with targets as (
  select l.id, l.slug, l.title, l.status, l.seller_id, l.created_at
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1
      from public.listing_images li
      where li.listing_id = l.id
    )
)
select
  count(*)::bigint as zero_image_import_count,
  count(*) filter (where status = 'active')::bigint as active_count,
  count(*) filter (where status <> 'active')::bigint as non_active_count
from targets;

with targets as (
  select l.id, l.slug, l.title, l.status
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
)
select slug, title, status
from targets
order by slug;

select '=== DRY RUN: dependent rows for target listings ===' as section;

with targets as (
  select l.id, l.slug
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
)
select 'saved_listings' as entity, count(*)::bigint as row_count
from public.saved_listings s
join targets t on t.id = s.listing_id
union all
select 'listing_fulfilment_private', count(*)::bigint
from public.listing_fulfilment_private f
join targets t on t.id = f.listing_id
union all
select 'listing_images', count(*)::bigint
from public.listing_images li
join targets t on t.id = li.listing_id
union all
select 'offers', count(*)::bigint
from public.offers o
join targets t on t.id = o.listing_id
union all
select 'payments', count(*)::bigint
from public.payments p
join targets t on t.id = p.listing_id
union all
select 'orders', count(*)::bigint
from public.orders o
join targets t on t.id = o.listing_id
union all
select 'conversations', count(*)::bigint
from public.conversations c
join targets t on t.id = c.listing_id
union all
select 'messages (via conversations)', count(*)::bigint
from public.messages m
join public.conversations c on c.id = m.conversation_id
join targets t on t.id = c.listing_id
union all
select 'reviews (via orders)', count(*)::bigint
from public.reviews r
join public.orders o on o.id = r.order_id
join targets t on t.id = o.listing_id
union all
select 'reports (listing_id)', count(*)::bigint
from public.reports r
join targets t on t.id = r.listing_id
union all
select 'notifications (/listings/ slug links)', count(*)::bigint
from public.notifications n
join targets t on n.link_url = '/listings/' || t.slug
order by entity;

select '=== DRY RUN: blocker check (must all be 0 before delete) ===' as section;

with targets as (
  select l.id
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
)
select
  (select count(*) from public.offers o join targets t on t.id = o.listing_id)::bigint as offers,
  (select count(*) from public.payments p join targets t on t.id = p.listing_id)::bigint as payments,
  (select count(*) from public.orders o join targets t on t.id = o.listing_id)::bigint as orders,
  (select count(*) from public.conversations c join targets t on t.id = c.listing_id)::bigint as conversations,
  (select count(*) from public.reviews r join public.orders o on o.id = r.order_id join targets t on t.id = o.listing_id)::bigint as reviews;

select '=== DRY RUN: remaining import listings (should be 54 with images) ===' as section;

select
  count(*)::bigint as remaining_import_listings,
  count(*) filter (
    where exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
  )::bigint as remaining_with_images,
  count(*) filter (
    where not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
  )::bigint as remaining_without_images
from public.listings l
where l.source = 'import'::public.listing_source
  and l.id not in (
    select l2.id
    from public.listings l2
    where l2.source = 'import'::public.listing_source
      and not exists (
        select 1 from public.listing_images li where li.listing_id = l2.id
      )
  );

-- =============================================================================
-- STOP HERE FOR DRY-RUN ONLY
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CONFIRMATION — change false → true to allow destructive cleanup
-- -----------------------------------------------------------------------------

do $$
declare
  confirmed boolean := false;  -- <<< CHANGE TO true TO EXECUTE DELETE
begin
  if not confirmed then
    raise exception
      'Zero-image import cleanup aborted. Set confirmed := true in the CONFIRMATION block to execute.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- DESTRUCTIVE DELETE (single transaction)
-- -----------------------------------------------------------------------------

begin;

do $$
declare
  v_expected_targets constant int := 86;
  v_target_count int;
  v_deleted bigint;
  v_offers int;
  v_payments int;
  v_orders int;
  v_conversations int;
  v_reviews int;
  v_remaining_import int;
  v_remaining_zero_image int;
begin
  create temp table tmp_zero_image_import_listings on commit drop as
  select l.id, l.slug, l.title
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1
      from public.listing_images li
      where li.listing_id = l.id
    );

  select count(*) into v_target_count from tmp_zero_image_import_listings;

  if v_target_count = 0 then
    raise exception 'No zero-image import listings found; nothing to delete.';
  end if;

  if v_target_count <> v_expected_targets then
    raise warning
      'Target count % differs from expected %. Proceeding because confirmed=true.',
      v_target_count,
      v_expected_targets;
  end if;

  select
    (select count(*) from public.offers o join tmp_zero_image_import_listings t on t.id = o.listing_id),
    (select count(*) from public.payments p join tmp_zero_image_import_listings t on t.id = p.listing_id),
    (select count(*) from public.orders o join tmp_zero_image_import_listings t on t.id = o.listing_id),
    (select count(*) from public.conversations c join tmp_zero_image_import_listings t on t.id = c.listing_id),
    (
      select count(*)
      from public.reviews r
      join public.orders o on o.id = r.order_id
      join tmp_zero_image_import_listings t on t.id = o.listing_id
    )
  into v_offers, v_payments, v_orders, v_conversations, v_reviews;

  if v_offers > 0 or v_payments > 0 or v_orders > 0 or v_conversations > 0 or v_reviews > 0 then
    raise exception
      'Blocker: offers=%, payments=%, orders=%, conversations=%, reviews=% — resolve before deleting listings.',
      v_offers,
      v_payments,
      v_orders,
      v_conversations,
      v_reviews;
  end if;

  -- Notifications pointing at listing detail URLs (no FK to listings).
  delete from public.notifications n
  using tmp_zero_image_import_listings t
  where n.link_url = '/listings/' || t.slug;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % notifications linked to target listing URLs', v_deleted;

  -- Reports on target listings (FK is on delete set null; remove explicitly).
  delete from public.reports r
  using tmp_zero_image_import_listings t
  where r.listing_id = t.id;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % reports linked to target listings', v_deleted;

  -- saved_listings / listing_fulfilment_private cascade from listings delete, but
  -- fulfilment_private has a seller-only delete trigger that blocks SQL-editor runs.
  alter table public.listing_fulfilment_private
    disable trigger listing_fulfilment_private_enforce_seller_only_delete;

  delete from public.saved_listings s
  using tmp_zero_image_import_listings t
  where s.listing_id = t.id;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % saved_listings rows', v_deleted;

  delete from public.listing_fulfilment_private f
  using tmp_zero_image_import_listings t
  where f.listing_id = t.id;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listing_fulfilment_private rows', v_deleted;

  delete from public.listings l
  using tmp_zero_image_import_listings t
  where l.id = t.id;
  get diagnostics v_deleted = row_count;
  raise notice 'Deleted % listings', v_deleted;

  if v_deleted <> v_target_count then
    raise exception 'Listing delete mismatch: expected %, deleted %', v_target_count, v_deleted;
  end if;

  alter table public.listing_fulfilment_private
    enable trigger listing_fulfilment_private_enforce_seller_only_delete;

  select count(*) into v_remaining_zero_image
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    );

  if v_remaining_zero_image <> 0 then
    raise exception 'Verification failed: % zero-image import listings remain', v_remaining_zero_image;
  end if;

  select count(*) into v_remaining_import
  from public.listings l
  where l.source = 'import'::public.listing_source;

  if v_remaining_import <> 54 then
    raise warning
      'Remaining import listing count is % (expected 54). Review if imports changed since dry-run.',
      v_remaining_import;
  end if;

  if exists (
    select 1
    from public.listings l
    where l.source = 'import'::public.listing_source
      and not exists (
        select 1 from public.listing_images li where li.listing_id = l.id
      )
  ) then
    raise exception 'Verification failed: an import listing without images still exists';
  end if;

  raise notice 'SUCCESS: deleted % zero-image import listings; % import listings remain', v_deleted, v_remaining_import;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- POST-DELETE VERIFICATION (read-only)
-- -----------------------------------------------------------------------------

select '=== POST-DELETE VERIFICATION ===' as section;

select count(*)::bigint as zero_image_import_listings
from public.listings l
where l.source = 'import'::public.listing_source
  and not exists (
    select 1 from public.listing_images li where li.listing_id = l.id
  );

select
  count(*)::bigint as remaining_import_listings,
  count(*) filter (
    where exists (select 1 from public.listing_images li where li.listing_id = l.id)
  )::bigint as all_have_images
from public.listings l
where l.source = 'import'::public.listing_source;

select count(*)::bigint as total_active_public_browse
from public.listings_public_browse
where status = 'active';

-- =============================================================================
-- OPTIONAL: visibility rule note (do not simplify RLS after cleanup)
-- =============================================================================
-- listing_is_publicly_visible() and listings_public_browse remain intentional:
-- future Bubble imports may arrive without images before image sync completes.
-- No RLS/view changes are required after this delete.
