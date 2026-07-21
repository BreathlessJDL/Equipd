-- Stage 2: atomically initialize seller inventory and permit authenticated
-- listing owners to use the existing quantity-edit RPC.
-- No tables or columns are added.

create or replace function public.guard_listing_inventory_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Trusted server/test-fixture paths retain their ability to provide a
  -- complete internally-consistent inventory state.
  if current_user in ('postgres', 'service_role') then
    return new;
  end if;

  -- Omitted values have already received the column default (1) before this
  -- trigger runs. An explicit null or out-of-range total is rejected.
  if new.quantity_total is null then
    raise exception 'Quantity total is required'
      using errcode = '23502';
  end if;

  if new.quantity_total < 1 or new.quantity_total > 999 then
    raise exception 'Quantity total must be between 1 and 999'
      using errcode = '23514';
  end if;

  -- quantity_total is the only client-controlled inventory input at create.
  new.quantity_available := new.quantity_total;
  new.quantity_reserved := 0;
  new.quantity_sold := 0;
  new.inventory_version := 0;

  return new;
end;
$$;

revoke all on function public.update_listing_quantity(uuid, integer, bigint)
  from public, anon;
grant execute on function public.update_listing_quantity(uuid, integer, bigint)
  to authenticated, service_role;

notify pgrst, 'reload schema';
