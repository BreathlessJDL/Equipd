begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('14000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fixture-seller@example.test', '', now(), now()),
  ('14000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fixture-buyer@example.test', '', now(), now());

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profiles (
  id, display_name, stripe_onboarding_complete, is_admin
) values
  ('14000000-0000-0000-0000-000000000001', 'Fixture Seller', true, false),
  ('14000000-0000-0000-0000-000000000002', 'Fixture Buyer', false, false)
on conflict (id) do update
set
  display_name = excluded.display_name,
  stripe_onboarding_complete = excluded.stripe_onboarding_complete,
  is_admin = excluded.is_admin;

insert into public.categories (id, name, slug, sort_order)
values (
  '24000000-0000-0000-0000-000000000001',
  'Fixture Visibility Test',
  'fixture-visibility-test',
  995
);

-- Ordinary authenticated creation omits the marker and receives false.
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '14000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available
) values (
  '34000000-0000-0000-0000-000000000003',
  '14000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  'ordinary-authenticated-listing',
  'Ordinary authenticated listing',
  2000, 'good', 'draft', 'manual', true, false
);

reset role;

do $$
begin
  if (select is_test_data from public.listings
      where id = '34000000-0000-0000-0000-000000000003') then
    raise exception 'FAIL: ordinary listing defaulted to test data';
  end if;
end;
$$;

-- Authenticated clients cannot turn an ordinary listing into test data.
do $$
begin
  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '14000000-0000-0000-0000-000000000001',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    update public.listings
    set is_test_data = true
    where id = '34000000-0000-0000-0000-000000000003';
    reset role;
    raise exception 'FAIL: authenticated client changed is_test_data';
  exception
    when others then
      reset role;
      if sqlerrm = 'FAIL: authenticated client changed is_test_data' then
        raise;
      end if;
      if sqlerrm not ilike '%test-data marker is immutable%'
         and sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end;
$$;

-- Authenticated clients cannot mark their own listings as test data.
do $$
begin
  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '14000000-0000-0000-0000-000000000001',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition, status,
      source, collection_available, courier_available, is_test_data
    ) values (
      '34000000-0000-0000-0000-000000000099',
      '14000000-0000-0000-0000-000000000001',
      '24000000-0000-0000-0000-000000000001',
      'forbidden-client-test-data',
      'Forbidden client test data',
      2000, 'good', 'draft', 'manual', true, false, true
    );

    reset role;
    raise exception 'FAIL: authenticated client created test data';
  exception
    when insufficient_privilege then
      reset role;
    when others then
      reset role;
      if sqlerrm = 'FAIL: authenticated client created test data' then
        raise;
      end if;
      if sqlerrm not ilike '%Only service-role tooling may create test listings%'
         and sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end;
$$;

-- Anonymous clients cannot create marked test data.
do $$
begin
  begin
    set local role anon;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claim.role', 'anon', true);
    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition, status,
      source, collection_available, courier_available, is_test_data
    ) values (
      '34000000-0000-0000-0000-000000000098',
      '14000000-0000-0000-0000-000000000001',
      '24000000-0000-0000-0000-000000000001',
      'forbidden-anonymous-test-data',
      'Forbidden anonymous test data',
      2000, 'good', 'draft', 'manual', true, false, true
    );
    reset role;
    raise exception 'FAIL: anonymous client created test data';
  exception
    when others then
      reset role;
      if sqlerrm = 'FAIL: anonymous client created test data' then
        raise;
      end if;
      if sqlerrm not ilike '%Only service-role tooling may create test listings%'
         and sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);

-- The service role creates the fixture non-public from its first row version.
insert into public.listings (
  id, seller_id, category_id, slug, title, description, price_pence,
  condition, status, published_at, source, collection_available,
  courier_available, quantity_total, quantity_available, quantity_reserved,
  quantity_sold, is_test_data
) values (
  '34000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  'permanently-hidden-test-fixture',
  'Permanently hidden test fixture',
  'Local transaction-only fixture.',
  2000, 'good', 'draft', null, 'manual', true, false,
  2, 2, 0, 0, true
);

-- Control: genuine active/manual inventory remains visible.
insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '34000000-0000-0000-0000-000000000002',
  '14000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  'genuine-public-control',
  'Genuine public control',
  2000, 'good', 'active', 'manual', true, false,
  1, 1, 0, 0
);

do $$
begin
  if public.listing_is_publicly_visible(
    (select l from public.listings l
     where id = '34000000-0000-0000-0000-000000000001')
  ) then
    raise exception 'FAIL: test fixture is publicly visible immediately after insert';
  end if;

  if not public.listing_is_publicly_visible(
    (select l from public.listings l
     where id = '34000000-0000-0000-0000-000000000002')
  ) then
    raise exception 'FAIL: genuine active control is not publicly visible';
  end if;
end;
$$;

-- The commerce helper is service-role only.
do $$
begin
  begin
    set local role authenticated;
    perform set_config(
      'request.jwt.claim.sub',
      '14000000-0000-0000-0000-000000000001',
      true
    );
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_test_fixture_payment_and_order(
      '34000000-0000-0000-0000-000000000001',
      '14000000-0000-0000-0000-000000000002',
      1,
      2000
    );
    reset role;
    raise exception 'FAIL: authenticated client executed fixture commerce helper';
  exception
    when insufficient_privilege then
      reset role;
    when others then
      reset role;
      if sqlerrm = 'FAIL: authenticated client executed fixture commerce helper' then
        raise;
      end if;
      if sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);

select public.create_test_fixture_payment_and_order(
  '34000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000002',
  1,
  2000
);
select public.create_test_fixture_payment_and_order(
  '34000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000002',
  1,
  2000
);

do $$
declare
  v_listing public.listings;
begin
  select * into v_listing
  from public.listings
  where id = '34000000-0000-0000-0000-000000000001';

  if v_listing.status <> 'draft'::public.listing_status
     or v_listing.published_at is not null
     or not v_listing.is_test_data
     or v_listing.quantity_available <> 0
     or v_listing.quantity_reserved <> 2
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 2 then
    raise exception 'FAIL: hidden commerce setup produced wrong listing state';
  end if;

  if public.listing_is_publicly_visible(v_listing) then
    raise exception 'FAIL: fixture visible after commerce setup';
  end if;

  if (select count(*) from public.offers
      where listing_id = v_listing.id and status = 'accepted') <> 2
     or (select count(*) from public.payments
         where listing_id = v_listing.id and status = 'pending') <> 2
     or (select count(*) from public.orders
         where listing_id = v_listing.id
           and inventory_state = 'reserved') <> 2 then
    raise exception 'FAIL: fixture commerce records were not created';
  end if;
end;
$$;

-- Exercise release and capture while the listing remains draft/test-only.
update public.orders
set order_type = 'collection'::public.order_type
where listing_id = '34000000-0000-0000-0000-000000000001';

update public.payments
set expires_at = now() - interval '1 minute'
where id = (
  select id
  from public.payments
  where listing_id = '34000000-0000-0000-0000-000000000001'
  order by created_at
  limit 1
);

select public.expire_payment((
  select id
  from public.payments
  where listing_id = '34000000-0000-0000-0000-000000000001'
    and expires_at <= now()
  limit 1
));

select public.mark_payment_captured(
  (
    select id
    from public.payments
    where listing_id = '34000000-0000-0000-0000-000000000001'
      and status = 'pending'
    limit 1
  ),
  'cs_test_hidden_fixture',
  'pi_test_hidden_fixture',
  'ch_test_hidden_fixture'
);

do $$
declare
  v_listing public.listings;
begin
  select * into v_listing
  from public.listings
  where id = '34000000-0000-0000-0000-000000000001';

  if v_listing.status <> 'draft'::public.listing_status
     or v_listing.published_at is not null
     or not v_listing.is_test_data
     or v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 1 then
    raise exception 'FAIL: payment lifecycle changed hidden fixture state incorrectly';
  end if;

  if public.listing_is_publicly_visible(v_listing) then
    raise exception 'FAIL: fixture visible after payment lifecycle';
  end if;
end;
$$;

-- The marker and hidden-state constraints cannot be relaxed, even by service role.
do $$
begin
  begin
    update public.listings
    set is_test_data = false
    where id = '34000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: test-data marker was mutable';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.listings
    set status = 'active'::public.listing_status
    where id = '34000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: test fixture became active';
  exception
    when check_violation then null;
  end;

  begin
    update public.listings
    set published_at = now()
    where id = '34000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: test fixture became published';
  exception
    when check_violation then null;
  end;
end;
$$;

-- Anonymous RLS and the canonical browse view both exclude the fixture.
do $$
declare
  v_direct_count integer;
  v_browse_count integer;
  v_search_count integer;
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);

  select count(*) into v_direct_count
  from public.listings
  where id = '34000000-0000-0000-0000-000000000001';

  select count(*) into v_browse_count
  from public.listings_public_browse
  where id = '34000000-0000-0000-0000-000000000001';

  select count(*) into v_search_count
  from public.listings_public_browse
  where slug = 'permanently-hidden-test-fixture'
     or title ilike '%hidden test fixture%';

  reset role;

  if v_direct_count <> 0 or v_browse_count <> 0 or v_search_count <> 0 then
    raise exception 'FAIL: anonymous surface exposed fixture (%/%/%)',
      v_direct_count, v_browse_count, v_search_count;
  end if;
end;
$$;

rollback;
