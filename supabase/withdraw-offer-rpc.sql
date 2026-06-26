-- Equipd withdraw offer RPC (buyer withdraws pending buyer offer)
-- Run after offers-schema-alignment.sql and offer-messaging-flow.sql (for insert_conversation_system_message)

create or replace function public.withdraw_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers;
begin
  if auth.uid() is null then
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

  if v_offer.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can withdraw this offer';
  end if;

  if v_offer.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be withdrawn';
  end if;

  if coalesce(v_offer.direction, 'buyer_to_seller') <> 'buyer_to_seller' then
    raise exception 'Only buyer offers can be withdrawn from here';
  end if;

  update public.offers
  set status = 'withdrawn'::public.offer_status
  where id = p_offer_id
  returning * into v_offer;

  if v_offer.conversation_id is not null then
    perform public.insert_conversation_system_message(
      v_offer.conversation_id,
      'Offer withdrawn.'
    );
  end if;

  return v_offer;
end;
$$;

grant execute on function public.withdraw_offer(uuid) to authenticated;

notify pgrst, 'reload schema';
