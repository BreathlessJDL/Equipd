-- Equipd offer acceptance RPC
-- Run after offers.sql

-- ---------------------------------------------------------------------------
-- Accept offer (atomic: accept one, reject others, mark listing sold)
-- ---------------------------------------------------------------------------

create or replace function public.accept_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if v_offer.seller_id <> v_uid then
    raise exception 'Only the seller can accept this offer';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be accepted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_offer.listing_id
      and l.seller_id = v_uid
      and l.status = 'active'::public.listing_status
    for update
  ) then
    raise exception 'Listing is not available for acceptance';
  end if;

  update public.offers
  set status = 'accepted'::public.offer_status
  where id = p_offer_id;

  update public.offers
  set status = 'rejected'::public.offer_status
  where listing_id = v_offer.listing_id
    and id <> p_offer_id
    and status = 'pending'::public.offer_status;

  update public.listings
  set status = 'sold'::public.listing_status
  where id = v_offer.listing_id;

  select *
  into v_offer
  from public.offers
  where id = p_offer_id;

  return v_offer;
end;
$$;

grant execute on function public.accept_offer(uuid) to authenticated;

-- Accept must go through accept_offer(); sellers may still reject directly.
drop policy if exists "Sellers can respond to pending offers" on public.offers;

create policy "Sellers can reject pending offers"
  on public.offers for update
  to authenticated
  using (
    seller_id = auth.uid()
    and status = 'pending'::public.offer_status
  )
  with check (
    seller_id = auth.uid()
    and status = 'rejected'::public.offer_status
  );
