-- Buyer offers cannot exceed listing asking price.
-- Run on linked/production Supabase after offers-schema-alignment.sql.

create or replace function public.validate_buyer_offer_amount()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_listing_price int;
  v_direction text;
begin
  v_direction := coalesce(new.direction, 'buyer_to_seller');

  if v_direction <> 'buyer_to_seller' then
    return new;
  end if;

  select l.price_pence
  into v_listing_price
  from public.listings l
  where l.id = new.listing_id;

  if v_listing_price is null then
    raise exception 'Listing not found';
  end if;

  if new.amount_pence > v_listing_price then
    raise exception 'Offers cannot be higher than the asking price.';
  end if;

  return new;
end;
$$;

drop trigger if exists offers_validate_buyer_amount on public.offers;

create trigger offers_validate_buyer_amount
  before insert on public.offers
  for each row execute function public.validate_buyer_offer_amount();
