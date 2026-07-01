-- Fix marketplace email pg_net payloads: use camelCase keys expected by send-marketplace-email.
-- Runtime also accepts snake_case for backwards compatibility.

create or replace function public.notify_offer_received_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_offer_id is not null then
    return new;
  end if;

  if coalesce(new.direction, 'buyer_to_seller') <> 'buyer_to_seller' then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'offer_received',
    jsonb_build_object('offerId', new.id)
  );

  return new;
end;
$$;

create or replace function public.notify_offer_accepted_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'accepted'::public.offer_status then
    return new;
  end if;

  if old.status = 'accepted'::public.offer_status then
    return new;
  end if;

  if coalesce(new.direction, 'buyer_to_seller') <> 'buyer_to_seller' then
    return new;
  end if;

  perform public.notify_marketplace_email(
    'offer_accepted',
    jsonb_build_object('offerId', new.id)
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';
