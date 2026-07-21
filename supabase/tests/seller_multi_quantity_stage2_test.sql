begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('15000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage2-seller@example.test', '', now(), now()),
  ('15000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage2-other@example.test', '', now(), now());

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profiles (id, display_name, stripe_onboarding_complete, is_admin)
values
  ('15000000-0000-0000-0000-000000000001', 'Stage 2 Seller', true, false),
  ('15000000-0000-0000-0000-000000000002', 'Stage 2 Other', true, false)
on conflict (id) do update
set display_name = excluded.display_name;

insert into public.categories (id, name, slug, sort_order)
values (
  '25000000-0000-0000-0000-000000000001',
  'Stage 2 Quantity',
  'stage2-quantity',
  994
);

-- One authenticated insert accepts only quantity_total as inventory input.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available, quantity_total
) values (
  '35000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  'stage2-six-items',
  'Stage 2 six items',
  50000, 'good', 'draft', 'manual', true, false,
  6
);

reset role;

do $$
declare
  v_listing public.listings;
begin
  select * into v_listing
  from public.listings
  where id = '35000000-0000-0000-0000-000000000001';

  if v_listing.quantity_total <> 6
     or v_listing.quantity_available <> 6
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 0
     or v_listing.is_test_data then
    raise exception 'FAIL: atomic seller quantity-six creation state is wrong';
  end if;
end;
$$;

-- The owner can increase total quantity.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.update_listing_quantity(
  '35000000-0000-0000-0000-000000000001',
  8,
  0
);
reset role;

-- Simulate two reserved units through the trusted inventory layer.
update public.listings
set
  quantity_available = 6,
  quantity_reserved = 2,
  inventory_version = inventory_version + 1
where id = '35000000-0000-0000-0000-000000000001';

-- Reducing below reserved + sold is rejected.
do $$
begin
  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '15000000-0000-0000-0000-000000000001',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.update_listing_quantity(
      '35000000-0000-0000-0000-000000000001',
      1,
      2
    );
    reset role;
    raise exception 'FAIL: seller reduced quantity below reserved + sold';
  exception
    when others then
      reset role;
      if sqlerrm = 'FAIL: seller reduced quantity below reserved + sold' then
        raise;
      end if;
      if sqlerrm not ilike '%cannot be below reserved + sold%' then
        raise;
      end if;
  end;
end;
$$;

-- Another authenticated seller cannot update the listing.
do $$
begin
  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '15000000-0000-0000-0000-000000000002',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.update_listing_quantity(
      '35000000-0000-0000-0000-000000000001',
      9,
      2
    );
    reset role;
    raise exception 'FAIL: non-owner updated listing quantity';
  exception
    when others then
      reset role;
      if sqlerrm = 'FAIL: non-owner updated listing quantity' then
        raise;
      end if;
      if sqlerrm not ilike '%Only the seller can update listing quantity%' then
        raise;
      end if;
  end;
end;
$$;

-- Anonymous execution remains unavailable.
do $$
begin
  begin
    set local role anon;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    perform public.update_listing_quantity(
      '35000000-0000-0000-0000-000000000001',
      9,
      2
    );
    reset role;
    raise exception 'FAIL: anonymous client executed quantity RPC';
  exception
    when insufficient_privilege then
      reset role;
    when others then
      reset role;
      if sqlerrm = 'FAIL: anonymous client executed quantity RPC' then
        raise;
      end if;
      if sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end;
$$;

-- Zero, negative, over-limit, explicit-null, and decimal JSON quantities fail.
do $$
declare
  v_quantity integer;
begin
  foreach v_quantity in array array[0, -1, 1000]
  loop
    begin
      set local role authenticated;
      perform set_config(
        'request.jwt.claim.sub',
        '15000000-0000-0000-0000-000000000001',
        true
      );
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      insert into public.listings (
        id, seller_id, category_id, slug, title, price_pence, condition,
        status, source, collection_available, courier_available, quantity_total
      ) values (
        gen_random_uuid(),
        '15000000-0000-0000-0000-000000000001',
        '25000000-0000-0000-0000-000000000001',
        'stage2-invalid-' || replace(v_quantity::text, '-', 'negative'),
        'Stage 2 invalid quantity',
        50000, 'good', 'draft', 'manual', true, false, v_quantity
      );
      reset role;
      raise exception 'FAIL: invalid quantity % was accepted', v_quantity;
    exception
      when check_violation then
        reset role;
    end;
  end loop;

  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '15000000-0000-0000-0000-000000000001',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition,
      status, source, collection_available, courier_available, quantity_total
    ) values (
      gen_random_uuid(),
      '15000000-0000-0000-0000-000000000001',
      '25000000-0000-0000-0000-000000000001',
      'stage2-null-quantity',
      'Stage 2 null quantity',
      50000, 'good', 'draft', 'manual', true, false, null
    );
    reset role;
    raise exception 'FAIL: null quantity was accepted';
  exception
    when not_null_violation then
      reset role;
  end;

  begin
    perform jsonb_populate_record(
      null::public.listings,
      '{"quantity_total": 1.5}'::jsonb
    );
    raise exception 'FAIL: decimal quantity JSON was accepted';
  exception
    when invalid_text_representation then null;
  end;
end;
$$;

-- Derived inventory fields supplied by a client are overwritten atomically.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold,
  inventory_version
) values (
  '35000000-0000-0000-0000-000000000003',
  '15000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  'stage2-derived-fields-overridden',
  'Stage 2 derived fields overridden',
  50000, 'good', 'draft', 'manual', true, false,
  4, 50, 10, 5, 99
);
reset role;

do $$
declare
  v_listing public.listings;
begin
  select * into v_listing
  from public.listings
  where id = '35000000-0000-0000-0000-000000000003';

  if v_listing.quantity_total <> 4
     or v_listing.quantity_available <> 4
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 0 then
    raise exception 'FAIL: client controlled derived inventory fields';
  end if;
end;
$$;

-- Authenticated users still cannot directly update inventory counters.
do $$
begin
  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '15000000-0000-0000-0000-000000000001',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    update public.listings
    set
      quantity_available = 99,
      inventory_version = inventory_version + 1
    where id = '35000000-0000-0000-0000-000000000003';
    reset role;
    raise exception 'FAIL: authenticated client directly updated inventory';
  exception
    when insufficient_privilege then
      reset role;
    when others then
      reset role;
      if sqlerrm = 'FAIL: authenticated client directly updated inventory' then
        raise;
      end if;
      if sqlerrm not ilike '%Inventory fields must be changed through an inventory RPC%'
         and sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end;
$$;

-- Quantity-one listings keep their original inventory state.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '15000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available
) values (
  '35000000-0000-0000-0000-000000000002',
  '15000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  'stage2-quantity-one',
  'Stage 2 quantity one',
  50000, 'good', 'draft', 'manual', true, false
);
reset role;

do $$
declare
  v_listing public.listings;
begin
  select * into v_listing
  from public.listings
  where id = '35000000-0000-0000-0000-000000000002';

  if v_listing.quantity_total <> 1
     or v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 0
     or v_listing.is_test_data then
    raise exception 'FAIL: quantity-one listing behavior changed';
  end if;
end;
$$;

rollback;
