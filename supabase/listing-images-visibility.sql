-- Align listing_images SELECT policy with listings visibility (reserved / in_progress).
-- Fixes offer cards in chat losing thumbnails after a counter-offer is accepted.
-- Run in Supabase SQL Editor on existing databases.

drop policy if exists "Listing images follow listing visibility" on public.listing_images;

create policy "Listing images follow listing visibility"
  on public.listing_images for select
  to anon, authenticated
  using (public.listing_can_read_images(listing_id));

notify pgrst, 'reload schema';
