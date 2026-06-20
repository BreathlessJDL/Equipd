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

alter table public.listings enable row level security;

create policy "Active listings are publicly readable"
  on public.listings for select
  to anon, authenticated
  using (
    status = 'active'
    or seller_id = auth.uid()
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
  using (
    exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and (l.status = 'active' or l.seller_id = auth.uid())
    )
  );

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
