-- Equipd listing delivery and collection options
-- Run after saved-listings.sql

alter table public.listings
  add column if not exists collection_available boolean not null default true,
  add column if not exists courier_available boolean not null default false,
  add column if not exists delivery_notes text;

-- Existing rows receive collection_available = true and courier_available = false from defaults.
