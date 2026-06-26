-- Equipd row level security
-- Run after schema.sql

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------

alter table public.brands enable row level security;

create policy "Brands are publicly readable"
  on public.brands for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;

create policy "Categories are publicly readable"
  on public.categories for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------

create or replace function public.listing_has_images(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listing_images li
    where li.listing_id = p_listing_id
  );
$$;

create or replace function public.listing_is_publicly_visible(p_listing public.listings)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_listing.status = 'active'::public.listing_status
    and (
      p_listing.source is distinct from 'import'::public.listing_source
      or public.listing_has_images(p_listing.id)
    );
$$;

create or replace function public.listing_can_read_images(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listings l
    where l.id = p_listing_id
      and (
        public.listing_is_publicly_visible(l)
        or l.seller_id = auth.uid()
        or exists (
          select 1
          from public.offers o
          where o.listing_id = l.id
            and o.buyer_id = auth.uid()
            and o.status = 'accepted'::public.offer_status
        )
      )
  );
$$;

create or replace function public.listing_primary_image_storage_path(p_listing_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select li.storage_path
  from public.listing_images li
  where li.listing_id = p_listing_id
    and public.listing_can_read_images(p_listing_id)
  order by li.sort_order asc, li.created_at asc
  limit 1;
$$;

create or replace view public.listings_public_browse
with (security_invoker = true)
as
select l.*
from public.listings l
where public.listing_is_publicly_visible(l);

grant select on public.listings_public_browse to anon, authenticated;

alter table public.listings enable row level security;

create policy "Active listings are publicly readable"
  on public.listings for select
  to anon, authenticated
  using (
    public.listing_is_publicly_visible(listings)
    or seller_id = auth.uid()
    or exists (
      select 1
      from public.offers o
      where o.listing_id = listings.id
        and o.buyer_id = auth.uid()
        and o.status = 'accepted'::public.offer_status
    )
  );

create policy "Authenticated users can create listings"
  on public.listings for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    and source = 'manual'
  );

create policy "Sellers can update own listings"
  on public.listings for update
  to authenticated
  using (seller_id = auth.uid())
  with check (
    seller_id = auth.uid()
    and source = 'manual'
  );

create policy "Sellers can delete own listings"
  on public.listings for delete
  to authenticated
  using (seller_id = auth.uid());

-- ---------------------------------------------------------------------------
-- listing_images
-- ---------------------------------------------------------------------------

alter table public.listing_images enable row level security;

create policy "Listing images follow listing visibility"
  on public.listing_images for select
  to anon, authenticated
  using (public.listing_can_read_images(listing_id));

create policy "Sellers can insert images on own listings"
  on public.listing_images for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  );

create policy "Sellers can update images on own listings"
  on public.listing_images for update
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  );

create policy "Sellers can delete images on own listings"
  on public.listing_images for delete
  to authenticated
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.seller_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- wanted_requests
-- ---------------------------------------------------------------------------

alter table public.wanted_requests enable row level security;

create policy "Users can read own wanted requests"
  on public.wanted_requests for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own wanted requests"
  on public.wanted_requests for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own wanted requests"
  on public.wanted_requests for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own wanted requests"
  on public.wanted_requests for delete
  to authenticated
  using (user_id = auth.uid());
