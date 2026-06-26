-- Phase 6A: public seller shop stats (sold listing count is not visible via listings RLS alone)

create or replace function public.get_seller_sold_listing_count(p_seller_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.listings
  where seller_id = p_seller_id
    and status = 'sold'::public.listing_status;
$$;

revoke all on function public.get_seller_sold_listing_count(uuid) from public;
grant execute on function public.get_seller_sold_listing_count(uuid) to anon, authenticated;
