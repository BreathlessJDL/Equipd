-- Refresh listings_public_browse so newly added listing columns are exposed.
-- PostgreSQL expands `select l.*` at CREATE VIEW time; later ALTER TABLE columns
-- (quantity_*, is_test_data, equipment_product_id, canonical_product_key, …)
-- are not visible through the view until it is replaced.

create or replace view public.listings_public_browse
with (security_invoker = true)
as
select l.*
from public.listings l
where public.listing_is_publicly_visible(l);

comment on view public.listings_public_browse is
  'Marketplace browse feed: active listings visible to the public (import listings need images). Column list refreshed to include inventory, test-data, and equipment mapping fields.';

grant select on public.listings_public_browse to anon, authenticated;

notify pgrst, 'reload schema';
