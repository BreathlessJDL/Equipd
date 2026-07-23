-- Stage 3: persist reliable listing → Equipment Intelligence product mapping.
-- Additive and reversible. No historical fuzzy backfill in this migration.

alter table public.listings
  add column if not exists equipment_product_id uuid
    references public.equipment_products (id) on delete set null;

alter table public.listings
  add column if not exists canonical_product_key text;

comment on column public.listings.equipment_product_id is
  'Optional FK to an approved equipment_products row when the listing was created from valuation/equipment selection. Null means unmapped — never invent at read time.';

comment on column public.listings.canonical_product_key is
  'Optional denormalized canonical_product_key mirrored from the selected equipment product for resilient URL/join lookup. Kept in sync on listing write; null when unmapped.';

create index if not exists listings_equipment_product_id_idx
  on public.listings (equipment_product_id)
  where equipment_product_id is not null;

create index if not exists listings_canonical_product_key_idx
  on public.listings (canonical_product_key)
  where canonical_product_key is not null;

-- listings_public_browse is `select l.*` and picks up new columns automatically.
notify pgrst, 'reload schema';
