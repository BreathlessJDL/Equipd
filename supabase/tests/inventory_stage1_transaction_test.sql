\set ON_ERROR_STOP on

begin;

-- Fixed UUIDs keep failures reproducible. This transaction is rolled back.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inventory-seller@example.test', '', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inventory-buyer-a@example.test', '', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inventory-buyer-b@example.test', '', now(), now());

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profiles (id, display_name, stripe_onboarding_complete)
values
  ('10000000-0000-0000-0000-000000000001', 'Inventory Seller', true),
  ('10000000-0000-0000-0000-000000000002', 'Inventory Buyer A', false),
  ('10000000-0000-0000-0000-000000000003', 'Inventory Buyer B', false)
on conflict (id) do update
set
  display_name = excluded.display_name,
  stripe_onboarding_complete = excluded.stripe_onboarding_complete;

insert into public.categories (id, name, slug, sort_order)
values ('20000000-0000-0000-0000-000000000001', 'Inventory Test', 'inventory-test', 999);

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'inventory-stage1-main',
  'Inventory Stage 1 Main',
  50000,
  'good',
  'active',
  'manual',
  true,
  false,
  3, 3, 0, 0
);

insert into public.conversations (
  id, listing_id, buyer_id, seller_id
) values (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, conversation_id, amount_pence,
  quantity, status, direction
) values (
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  90000,
  2,
  'pending',
  'buyer_to_seller'
);

-- Counter-offer quantity is copied from its parent, never caller-controlled.
insert into public.offers (
  id, listing_id, buyer_id, seller_id, conversation_id, parent_offer_id,
  amount_pence, quantity, status, direction
) values (
  '50000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  88000,
  1,
  'pending',
  'seller_to_buyer'
);

do $$
begin
  if (select quantity from public.offers where id = '50000000-0000-0000-0000-000000000002') <> 2 then
    raise exception 'FAIL: counter-offer did not preserve parent quantity';
  end if;
end;
$$;

-- Divisibility is enforced in the database.
do $$
begin
  begin
    insert into public.offers (
      listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
    ) values (
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000001',
      90001,
      2,
      'pending',
      'buyer_to_seller'
    );
    raise exception 'FAIL: indivisible offer was accepted';
  exception
    when check_violation or raise_exception then
      if sqlerrm = 'FAIL: indivisible offer was accepted' then
        raise;
      end if;
  end;
end;
$$;

-- Accept the seller counter-offer as the buyer. Reservation, accepted status,
-- payment, order and system message must commit as one transaction.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  true
);
select public.accept_counter_offer('50000000-0000-0000-0000-000000000002');

do $$
declare
  v_listing public.listings;
  v_order public.orders;
  v_payment public.payments;
begin
  select * into v_listing
  from public.listings
  where id = '30000000-0000-0000-0000-000000000001';

  if v_listing.quantity_total <> 3
     or v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 2
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 1
     or v_listing.status <> 'active'::public.listing_status then
    raise exception 'FAIL: atomic reservation counters/status/version are wrong';
  end if;

  select * into v_order
  from public.orders
  where offer_id = '50000000-0000-0000-0000-000000000002';
  select * into v_payment
  from public.payments
  where id = v_order.payment_id;

  if v_order.quantity <> 2
     or v_order.listing_unit_price_pence <> 50000
     or v_order.agreed_unit_price_pence <> 44000
     or v_order.item_subtotal_pence <> 88000
     or v_order.inventory_state <> 'reserved'::public.order_inventory_state then
    raise exception 'FAIL: order snapshot is wrong';
  end if;

  if v_payment.quantity <> 2
     or v_payment.listing_unit_price_pence <> 50000
     or v_payment.agreed_unit_price_pence <> 44000
     or v_payment.item_subtotal_pence <> 88000
     or v_payment.amount_pence <> 88000 then
    raise exception 'FAIL: payment snapshot is wrong';
  end if;

  if not exists (
    select 1
    from public.messages
    where conversation_id = '40000000-0000-0000-0000-000000000001'
      and message_type = 'system'
      and body = 'Counter-offer accepted for 2 items: £880.00 total (£440.00 per item).'
  ) then
    raise exception 'FAIL: acceptance system message is missing';
  end if;
end;
$$;

-- Capture moves reserved -> sold exactly once.
update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '50000000-0000-0000-0000-000000000002';

select public.mark_payment_captured(
  (select id from public.payments where offer_id = '50000000-0000-0000-0000-000000000002'),
  'cs_test_stage1',
  'pi_test_stage1',
  'ch_test_stage1'
);

select public.mark_payment_captured(
  (select id from public.payments where offer_id = '50000000-0000-0000-0000-000000000002'),
  'cs_test_stage1',
  'pi_test_stage1',
  'ch_test_stage1'
);

do $$
declare
  v_listing public.listings;
  v_order public.orders;
begin
  select * into v_listing
  from public.listings
  where id = '30000000-0000-0000-0000-000000000001';
  select * into v_order
  from public.orders
  where offer_id = '50000000-0000-0000-0000-000000000002';

  if v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 2
     or v_listing.inventory_version <> 2
     or v_listing.status <> 'active'::public.listing_status then
    raise exception 'FAIL: duplicate payment capture changed inventory twice';
  end if;

  if v_order.inventory_state <> 'sold'::public.order_inventory_state
     or v_order.inventory_sold_at is null then
    raise exception 'FAIL: order was not marked sold';
  end if;
end;
$$;

-- Seller total cannot fall below sold+reserved; optimistic version is required.
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

do $$
begin
  begin
    perform public.update_listing_quantity(
      '30000000-0000-0000-0000-000000000001',
      1,
      2
    );
    raise exception 'FAIL: seller reduced total below sold quantity';
  exception
    when raise_exception then
      if sqlerrm = 'FAIL: seller reduced total below sold quantity' then
        raise;
      end if;
  end;
end;
$$;

select public.update_listing_quantity(
  '30000000-0000-0000-0000-000000000001',
  4,
  2
);

do $$
begin
  begin
    perform public.update_listing_quantity(
      '30000000-0000-0000-0000-000000000001',
      5,
      2
    );
    raise exception 'FAIL: stale inventory version was accepted';
  exception
    when others then
      if sqlerrm = 'FAIL: stale inventory version was accepted' then
        raise;
      end if;
      if sqlerrm not ilike '%changed by another transaction%' then
        raise;
      end if;
  end;
end;
$$;

-- Acceptance must roll back reservation if payment/order creation fails.
insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'inventory-stage1-rollback',
  'Inventory Stage 1 Rollback',
  10000,
  'good',
  'active',
  'manual',
  true,
  false,
  1, 1, 0, 0
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values (
  '50000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  10000,
  1,
  'pending',
  'buyer_to_seller'
);

create function public.inventory_test_force_payment_failure()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced payment insert failure';
end;
$$;

create trigger inventory_test_force_payment_failure_trigger
before insert on public.payments
for each row execute function public.inventory_test_force_payment_failure();

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

do $$
begin
  begin
    perform public.accept_offer('50000000-0000-0000-0000-000000000003');
    raise exception 'FAIL: forced acceptance failure did not fail';
  exception
    when raise_exception then
      if sqlerrm = 'FAIL: forced acceptance failure did not fail' then
        raise;
      end if;
  end;
end;
$$;

drop trigger inventory_test_force_payment_failure_trigger on public.payments;
drop function public.inventory_test_force_payment_failure();

do $$
declare
  v_listing public.listings;
begin
  select * into v_listing
  from public.listings
  where id = '30000000-0000-0000-0000-000000000002';

  if v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.inventory_version <> 0
     or (select status from public.offers where id = '50000000-0000-0000-0000-000000000003')
        <> 'pending'::public.offer_status
     or exists (
       select 1 from public.payments
       where offer_id = '50000000-0000-0000-0000-000000000003'
     ) then
    raise exception 'FAIL: failed acceptance was not fully rolled back';
  end if;
end;
$$;

-- Expiry is idempotent and releases inventory once.
select public.accept_offer('50000000-0000-0000-0000-000000000003');
update public.payments
set expires_at = now() - interval '1 minute'
where offer_id = '50000000-0000-0000-0000-000000000003';

select public.expire_payment(
  (select id from public.payments where offer_id = '50000000-0000-0000-0000-000000000003')
);
select public.expire_payment(
  (select id from public.payments where offer_id = '50000000-0000-0000-0000-000000000003')
);

do $$
declare
  v_listing public.listings;
  v_order public.orders;
begin
  select * into v_listing
  from public.listings
  where id = '30000000-0000-0000-0000-000000000002';
  select * into v_order
  from public.orders
  where offer_id = '50000000-0000-0000-0000-000000000003';

  if v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.inventory_version <> 2
     or v_order.inventory_state <> 'released'::public.order_inventory_state
     or v_order.inventory_released_at is null then
    raise exception 'FAIL: duplicate expiry did not release exactly once';
  end if;
end;
$$;

-- Final invariant across every test listing.
do $$
begin
  if exists (
    select 1
    from public.listings
    where quantity_available + quantity_reserved + quantity_sold <> quantity_total
       or quantity_available < 0
       or quantity_reserved < 0
       or quantity_sold < 0
  ) then
    raise exception 'FAIL: listing inventory invariant violated';
  end if;
end;
$$;

rollback;

\echo 'PASS: inventory Stage 1 transaction tests'
