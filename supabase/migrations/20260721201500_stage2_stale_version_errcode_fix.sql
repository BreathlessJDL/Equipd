-- Stage 2 bug fix: PostgREST retries transactions that fail with SQLSTATE
-- 40001, so the optimistic-lock rejection in update_listing_quantity spun
-- until the gateway timed out instead of returning the error to the client.
-- Raise the same message with the default P0001 errcode, which PostgREST
-- returns immediately. Behaviour, permissions and validation are unchanged.

create or replace function public.update_listing_quantity(
  p_listing_id uuid,
  p_new_total integer,
  p_expected_inventory_version bigint
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_min_total integer;
  v_status public.listing_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_total is null or p_new_total < 1 or p_new_total > 999 then
    raise exception 'Quantity total must be between 1 and 999';
  end if;

  select *
  into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_listing.seller_id <> v_uid then
    raise exception 'Only the seller can update listing quantity';
  end if;

  if v_listing.inventory_version <> p_expected_inventory_version then
    raise exception 'Inventory was changed by another transaction; refresh and retry';
  end if;

  v_min_total := v_listing.quantity_reserved + v_listing.quantity_sold;
  if p_new_total < v_min_total then
    raise exception 'Quantity total cannot be below reserved + sold (%)', v_min_total;
  end if;

  if v_listing.status in ('draft'::public.listing_status, 'archived'::public.listing_status) then
    v_status := v_listing.status;
  elsif p_new_total - v_min_total > 0 then
    v_status := 'active'::public.listing_status;
  elsif v_listing.quantity_reserved > 0 then
    v_status := 'reserved'::public.listing_status;
  elsif v_listing.quantity_sold > 0 then
    v_status := case
      when v_listing.status = 'sold'::public.listing_status
        then 'sold'::public.listing_status
      else 'in_progress'::public.listing_status
    end;
  else
    v_status := 'active'::public.listing_status;
  end if;

  update public.listings
  set
    quantity_total = p_new_total,
    quantity_available = p_new_total - quantity_reserved - quantity_sold,
    inventory_version = inventory_version + 1,
    status = v_status
  where id = p_listing_id
  returning * into v_listing;

  return v_listing;
end;
$$;

revoke all on function public.update_listing_quantity(uuid, integer, bigint)
  from public, anon;
grant execute on function public.update_listing_quantity(uuid, integer, bigint)
  to authenticated, service_role;

notify pgrst, 'reload schema';
