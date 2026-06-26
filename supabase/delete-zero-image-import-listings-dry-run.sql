-- Dry-run excerpt from delete-zero-image-import-listings.sql (read-only)

with targets as (
  select l.id, l.slug, l.title, l.status
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
)
select
  count(*)::bigint as zero_image_import_count,
  count(*) filter (where status = 'active')::bigint as active_count
from targets;

with targets as (
  select l.id, l.slug
  from public.listings l
  where l.source = 'import'::public.listing_source
    and not exists (
      select 1 from public.listing_images li where li.listing_id = l.id
    )
)
select 'saved_listings' as entity, count(*)::bigint as row_count
from public.saved_listings s join targets t on t.id = s.listing_id
union all
select 'listing_fulfilment_private', count(*)::bigint
from public.listing_fulfilment_private f join targets t on t.id = f.listing_id
union all
select 'offers', count(*)::bigint from public.offers o join targets t on t.id = o.listing_id
union all
select 'payments', count(*)::bigint from public.payments p join targets t on t.id = p.listing_id
union all
select 'orders', count(*)::bigint from public.orders o join targets t on t.id = o.listing_id
union all
select 'conversations', count(*)::bigint from public.conversations c join targets t on t.id = c.listing_id
union all
select 'reports', count(*)::bigint from public.reports r join targets t on t.id = r.listing_id
union all
select 'notifications', count(*)::bigint
from public.notifications n join targets t on n.link_url = '/listings/' || t.slug;

select count(*)::bigint as remaining_import_with_images
from public.listings l
where l.source = 'import'::public.listing_source
  and exists (select 1 from public.listing_images li where li.listing_id = l.id);
