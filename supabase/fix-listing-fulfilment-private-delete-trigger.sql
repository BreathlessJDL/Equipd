-- Fix listing_fulfilment_private delete trigger returning NEW (null) which cancels deletes.
-- Required for listing deletion when private fulfilment details exist.

create or replace function public.enforce_listing_fulfilment_private_seller_only()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_listing_seller(coalesce(NEW.listing_id, OLD.listing_id), v_uid) then
    raise exception 'Only the listing seller may change private fulfilment details';
  end if;

  if TG_OP = 'UPDATE' and NEW.listing_id is distinct from OLD.listing_id then
    raise exception 'Cannot reassign private fulfilment details to another listing';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;
