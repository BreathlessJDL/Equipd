-- Public marketplace browse: only listings visible to anonymous visitors.
-- Sellers still see all own listings via the listings table (My Listings, edit, hub).
-- Fixes logged-in import owner seeing hidden zero-image rows on /browse with "No photo".

create or replace view public.listings_public_browse
with (security_invoker = true)
as
select l.*
from public.listings l
where public.listing_is_publicly_visible(l);

comment on view public.listings_public_browse is
  'Marketplace browse feed: active listings visible to the public (import listings need images).';

grant select on public.listings_public_browse to anon, authenticated;

notify pgrst, 'reload schema';
