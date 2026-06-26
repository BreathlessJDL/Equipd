-- Equipd listing saved count (denormalized counter for public display)
-- Run after saved-listings.sql

alter table public.listings
  add column if not exists saved_count int not null default 0;

alter table public.listings
  drop constraint if exists listings_saved_count_non_negative;

alter table public.listings
  add constraint listings_saved_count_non_negative check (saved_count >= 0);

update public.listings l
set saved_count = coalesce(
  (
    select count(*)::int
    from public.saved_listings s
    where s.listing_id = l.id
  ),
  0
);

create or replace function public.update_listing_saved_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.listings
    set saved_count = saved_count + 1
    where id = NEW.listing_id;

    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.listings
    set saved_count = greatest(saved_count - 1, 0)
    where id = OLD.listing_id;

    return OLD;
  end if;

  return null;
end;
$$;

drop trigger if exists saved_listings_update_saved_count on public.saved_listings;

create trigger saved_listings_update_saved_count
  after insert or delete on public.saved_listings
  for each row execute function public.update_listing_saved_count();

-- Public read for listing detail saved count (bypasses saved_listings RLS)
create or replace function public.get_listing_saved_count(p_listing_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select l.saved_count
      from public.listings l
      where l.id = p_listing_id
    ),
    0
  );
$$;

grant execute on function public.get_listing_saved_count(uuid) to anon, authenticated;
