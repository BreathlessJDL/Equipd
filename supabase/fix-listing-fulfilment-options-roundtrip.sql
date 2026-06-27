-- Fix listing fulfilment option round-trip for collection + seller delivery.
-- Removes sellerOnly heuristic from get_listing_order_types; honours collection marker.
-- Safe to re-run.

create or replace function public.get_listing_order_types(p_listing_id uuid)
returns public.order_type[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_collection_available boolean;
  v_courier_available boolean;
  v_notes text;
  v_notes_lower text;
  v_structured_radius integer;
  v_has_collection_marker boolean;
  v_has_buyer_courier boolean;
  v_has_seller_delivery boolean;
  v_types public.order_type[] := array[]::public.order_type[];
begin
  select
    coalesce(l.collection_available, true),
    coalesce(l.courier_available, false),
    coalesce(l.delivery_notes, ''),
    l.seller_delivery_radius_miles
  into v_collection_available, v_courier_available, v_notes, v_structured_radius
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return array['collection'::public.order_type];
  end if;

  v_notes_lower := lower(v_notes);
  v_has_collection_marker := v_notes_lower like '%in-person collection available%';
  v_has_buyer_courier := v_notes_lower like '%buyer can arrange%';
  v_has_seller_delivery :=
    v_notes_lower like '%seller delivery%'
    or v_notes_lower like '%seller can personally%'
    or (v_structured_radius is not null and v_structured_radius > 0);

  if v_has_buyer_courier then
    v_types := array_append(v_types, 'buyer_courier'::public.order_type);
  end if;

  if v_has_seller_delivery then
    v_types := array_append(v_types, 'seller_delivery'::public.order_type);
  end if;

  if v_has_collection_marker then
    v_types := array_append(v_types, 'collection'::public.order_type);
  elsif v_collection_available then
    if not v_courier_available then
      v_types := array_append(v_types, 'collection'::public.order_type);
    elsif v_courier_available and v_has_seller_delivery and not v_has_buyer_courier then
      v_types := array_append(v_types, 'collection'::public.order_type);
    end if;
  end if;

  if cardinality(v_types) = 0 and v_courier_available then
    v_types := array['buyer_courier'::public.order_type];
  end if;

  if cardinality(v_types) = 0 then
    v_types := array['collection'::public.order_type];
  end if;

  return (
    select coalesce(array_agg(distinct t), array['collection'::public.order_type])
    from unnest(v_types) as t
  );
end;
$$;

revoke all on function public.get_listing_order_types(uuid) from public;
grant execute on function public.get_listing_order_types(uuid) to authenticated, anon, service_role;
