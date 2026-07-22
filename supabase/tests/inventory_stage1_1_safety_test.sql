begin;

-- Fixed UUIDs keep failures reproducible. This transaction is rolled back.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage11-seller@example.test', '', now(), now()),
  ('12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage11-buyer-a@example.test', '', now(), now()),
  ('12000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage11-buyer-b@example.test', '', now(), now()),
  ('12000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stage11-admin@example.test', '', now(), now());

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profiles (id, display_name, stripe_onboarding_complete, is_admin)
values
  ('12000000-0000-0000-0000-000000000001', 'Stage11 Seller', true, false),
  ('12000000-0000-0000-0000-000000000002', 'Stage11 Buyer A', false, false),
  ('12000000-0000-0000-0000-000000000003', 'Stage11 Buyer B', false, false),
  ('12000000-0000-0000-0000-000000000004', 'Stage11 Admin', false, true)
on conflict (id) do update
set
  display_name = excluded.display_name,
  stripe_onboarding_complete = excluded.stripe_onboarding_complete,
  is_admin = excluded.is_admin;

select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.categories (id, name, slug, sort_order)
values ('22000000-0000-0000-0000-000000000001', 'Stage11 Test', 'stage11-test', 997);

-- ---------------------------------------------------------------------------
-- A. Late payment after reservation release.
-- ---------------------------------------------------------------------------

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '32000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'stage11-late-release',
  'Stage11 Late Release',
  10000, 'good', 'active', 'manual', true, false,
  1, 1, 0, 0
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values (
  '52000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000001',
  10000, 1, 'pending', 'buyer_to_seller'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select public.accept_offer('52000000-0000-0000-0000-000000000001');
update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '52000000-0000-0000-0000-000000000001';

update public.payments
set expires_at = now() - interval '2 minutes'
where offer_id = '52000000-0000-0000-0000-000000000001';

select public.expire_payment(
  (select id from public.payments where offer_id = '52000000-0000-0000-0000-000000000001')
);

do $$
declare
  v_listing public.listings;
  v_result jsonb;
  v_payment_id uuid;
  v_order public.orders;
  v_exception public.commerce_exceptions;
  v_dup jsonb;
begin
  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000001';

  if v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0 then
    raise exception 'FAIL: release did not restore inventory before late payment';
  end if;

  select id into v_payment_id
  from public.payments
  where offer_id = '52000000-0000-0000-0000-000000000001';

  v_result := public.mark_payment_captured_or_exception(
    v_payment_id,
    'cs_test_late_release',
    'pi_test_late_release',
    'ch_test_late_release',
    'evt_test_late_release',
    jsonb_build_object('test', 'late_release')
  );

  if v_result->>'outcome' <> 'late_payment_exception' then
    raise exception 'FAIL: expected late_payment_exception, got %', v_result;
  end if;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000001';
  select * into v_order
  from public.orders
  where offer_id = '52000000-0000-0000-0000-000000000001';
  select * into v_exception
  from public.commerce_exceptions
  where id = (v_result->>'exception_id')::uuid;

  if v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0 then
    raise exception 'FAIL: late payment mutated inventory';
  end if;

  if v_order.inventory_state <> 'released'::public.order_inventory_state
     or v_order.fulfilment_status <> 'cancelled'::public.order_fulfilment_status
     or v_order.payout_status <> 'cancelled'::public.payout_status then
    raise exception 'FAIL: late payment progressed fulfilment/payout';
  end if;

  if (select status from public.payments where id = v_payment_id)
       <> 'expired'::public.payment_status then
    raise exception 'FAIL: late payment changed payment status';
  end if;

  if v_exception.exception_type <> 'late_payment_after_release'
     or v_exception.status <> 'open'::public.commerce_exception_status
     or v_exception.stripe_event_id <> 'evt_test_late_release'
     or v_exception.stripe_checkout_session_id <> 'cs_test_late_release'
     or v_exception.stripe_payment_intent_id <> 'pi_test_late_release' then
    raise exception 'FAIL: late payment exception row is wrong';
  end if;

  -- Duplicate delivery of the same Stripe event is idempotent.
  v_dup := public.mark_payment_captured_or_exception(
    v_payment_id,
    'cs_test_late_release',
    'pi_test_late_release',
    'ch_test_late_release',
    'evt_test_late_release',
    jsonb_build_object('test', 'late_release_dup')
  );

  if v_dup->>'outcome' <> 'already_recorded_exception'
     or v_dup->>'exception_id' <> v_result->>'exception_id'
     or (
       select count(*) from public.commerce_exceptions
       where payment_id = v_payment_id
         and exception_type = 'late_payment_after_release'
     ) <> 1 then
    raise exception 'FAIL: duplicate late-payment event was not idempotent: %', v_dup;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- B. Late payment after expires_at without prior expire_payment call.
-- ---------------------------------------------------------------------------

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '32000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'stage11-late-expires',
  'Stage11 Late Expires',
  10000, 'good', 'active', 'manual', true, false,
  1, 1, 0, 0
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values (
  '52000000-0000-0000-0000-000000000002',
  '32000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000001',
  10000, 1, 'pending', 'buyer_to_seller'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select public.accept_offer('52000000-0000-0000-0000-000000000002');
update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '52000000-0000-0000-0000-000000000002';
update public.payments
set expires_at = now() - interval '1 minute'
where offer_id = '52000000-0000-0000-0000-000000000002';

do $$
declare
  v_result jsonb;
  v_listing public.listings;
  v_order public.orders;
begin
  v_result := public.mark_payment_captured_or_exception(
    (select id from public.payments where offer_id = '52000000-0000-0000-0000-000000000002'),
    'cs_test_late_expires',
    'pi_test_late_expires',
    'ch_test_late_expires',
    'evt_test_late_expires',
    '{}'::jsonb
  );

  if v_result->>'outcome' <> 'late_payment_exception'
     or v_result->>'reason' <> 'payment_expired' then
    raise exception 'FAIL: expected expired late payment exception, got %', v_result;
  end if;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000002';
  select * into v_order
  from public.orders
  where offer_id = '52000000-0000-0000-0000-000000000002';

  if v_listing.quantity_reserved <> 1
     or v_listing.quantity_sold <> 0
     or v_order.inventory_state <> 'reserved'::public.order_inventory_state
     or v_order.fulfilment_status <> 'awaiting_payment'::public.order_fulfilment_status then
    raise exception 'FAIL: expires_at late payment mutated inventory or fulfilment';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- C. Ordinary on-time payment continues to work.
-- ---------------------------------------------------------------------------

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '32000000-0000-0000-0000-000000000003',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'stage11-ontime',
  'Stage11 Ontime',
  10000, 'good', 'active', 'manual', true, false,
  1, 1, 0, 0
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values (
  '52000000-0000-0000-0000-000000000003',
  '32000000-0000-0000-0000-000000000003',
  '12000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000001',
  10000, 1, 'pending', 'buyer_to_seller'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select public.accept_offer('52000000-0000-0000-0000-000000000003');
update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '52000000-0000-0000-0000-000000000003';

do $$
declare
  v_result jsonb;
  v_listing public.listings;
  v_order public.orders;
begin
  v_result := public.mark_payment_captured_or_exception(
    (select id from public.payments where offer_id = '52000000-0000-0000-0000-000000000003'),
    'cs_test_ontime',
    'pi_test_ontime',
    'ch_test_ontime',
    'evt_test_ontime',
    '{}'::jsonb
  );

  if v_result->>'outcome' <> 'captured' then
    raise exception 'FAIL: on-time payment was not captured: %', v_result;
  end if;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000003';
  select * into v_order
  from public.orders
  where offer_id = '52000000-0000-0000-0000-000000000003';

  if v_listing.quantity_available <> 0
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 1
     or v_order.inventory_state <> 'sold'::public.order_inventory_state
     or v_order.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
     or (select status from public.payments where offer_id = '52000000-0000-0000-0000-000000000003')
        <> 'paid'::public.payment_status then
    raise exception 'FAIL: on-time capture did not sell inventory / progress fulfilment';
  end if;

  -- Idempotent replay.
  v_result := public.mark_payment_captured_or_exception(
    (select id from public.payments where offer_id = '52000000-0000-0000-0000-000000000003'),
    'cs_test_ontime',
    'pi_test_ontime',
    'ch_test_ontime',
    'evt_test_ontime_replay',
    '{}'::jsonb
  );

  if v_result->>'outcome' <> 'already_captured' then
    raise exception 'FAIL: replayed on-time capture was not idempotent: %', v_result;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- D. Exception insertion failure remains retryable (raises to caller).
-- ---------------------------------------------------------------------------

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '32000000-0000-0000-0000-00000000000a',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'stage11-exception-fail',
  'Stage11 Exception Fail',
  10000, 'good', 'active', 'manual', true, false,
  1, 1, 0, 0
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values (
  '52000000-0000-0000-0000-00000000000a',
  '32000000-0000-0000-0000-00000000000a',
  '12000000-0000-0000-0000-000000000002',
  '12000000-0000-0000-0000-000000000001',
  10000, 1, 'pending', 'buyer_to_seller'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select public.accept_offer('52000000-0000-0000-0000-00000000000a');
update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '52000000-0000-0000-0000-00000000000a';
update public.payments
set expires_at = now() - interval '1 minute'
where offer_id = '52000000-0000-0000-0000-00000000000a';

create function public.stage11_force_exception_insert_failure()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced commerce_exceptions insert failure';
end;
$$;

create trigger stage11_force_exception_insert_failure_trigger
before insert on public.commerce_exceptions
for each row execute function public.stage11_force_exception_insert_failure();

do $$
begin
  begin
    perform public.mark_payment_captured_or_exception(
      (select id from public.payments where offer_id = '52000000-0000-0000-0000-00000000000a'),
      'cs_test_fail_insert',
      'pi_test_fail_insert',
      'ch_test_fail_insert',
      'evt_test_fail_insert',
      '{}'::jsonb
    );
    raise exception 'FAIL: exception insertion failure did not raise';
  exception
    when raise_exception then
      if sqlerrm = 'FAIL: exception insertion failure did not raise' then
        raise;
      end if;
      if sqlerrm <> 'forced commerce_exceptions insert failure' then
        raise exception 'FAIL: unexpected error during insertion-failure test: %', sqlerrm;
      end if;
  end;
end;
$$;

drop trigger stage11_force_exception_insert_failure_trigger on public.commerce_exceptions;
drop function public.stage11_force_exception_insert_failure();

-- Confirm a later retry succeeds once persistence works again.
do $$
declare
  v_result jsonb;
begin
  v_result := public.mark_payment_captured_or_exception(
    (select id from public.payments where offer_id = '52000000-0000-0000-0000-00000000000a'),
    'cs_test_fail_insert',
    'pi_test_fail_insert',
    'ch_test_fail_insert',
    'evt_test_fail_insert',
    '{}'::jsonb
  );

  if v_result->>'outcome' <> 'late_payment_exception' then
    raise exception 'FAIL: retry after insert failure did not persist exception: %', v_result;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- E. Quantity-1 sibling rejection vs multi-quantity retention.
-- ---------------------------------------------------------------------------

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values
  (
    '32000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    'stage11-qty1-siblings',
    'Stage11 Qty1 Siblings',
    10000, 'good', 'active', 'manual', true, false,
    1, 1, 0, 0
  ),
  (
    '32000000-0000-0000-0000-000000000005',
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    'stage11-qty3-siblings',
    'Stage11 Qty3 Siblings',
    10000, 'good', 'active', 'manual', true, false,
    3, 3, 0, 0
  );

insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  (
    '42000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001'
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000001'
  );

insert into public.offers (
  id, listing_id, buyer_id, seller_id, conversation_id, amount_pence, quantity, status, direction
) values
  (
    '52000000-0000-0000-0000-000000000004',
    '32000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    10000, 1, 'pending', 'buyer_to_seller'
  ),
  (
    '52000000-0000-0000-0000-000000000005',
    '32000000-0000-0000-0000-000000000004',
    '12000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000002',
    9000, 1, 'pending', 'buyer_to_seller'
  ),
  (
    '52000000-0000-0000-0000-000000000006',
    '32000000-0000-0000-0000-000000000005',
    '12000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    null,
    10000, 1, 'pending', 'buyer_to_seller'
  ),
  (
    '52000000-0000-0000-0000-000000000007',
    '32000000-0000-0000-0000-000000000005',
    '12000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000001',
    null,
    10000, 1, 'pending', 'buyer_to_seller'
  );

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select public.accept_offer('52000000-0000-0000-0000-000000000004');
select public.accept_offer('52000000-0000-0000-0000-000000000006');

do $$
declare
  v_qty1_pending integer;
  v_qty1_rejected integer;
  v_qty3_pending integer;
  v_declined_notifications integer;
begin
  select count(*) into v_qty1_pending
  from public.offers
  where listing_id = '32000000-0000-0000-0000-000000000004'
    and status = 'pending';

  select count(*) into v_qty1_rejected
  from public.offers
  where listing_id = '32000000-0000-0000-0000-000000000004'
    and status = 'rejected';

  select count(*) into v_qty3_pending
  from public.offers
  where listing_id = '32000000-0000-0000-0000-000000000005'
    and status = 'pending';

  if v_qty1_pending <> 0 or v_qty1_rejected <> 1 then
    raise exception 'FAIL: quantity-1 siblings were not rejected';
  end if;

  if v_qty3_pending <> 1 then
    raise exception 'FAIL: multi-quantity sibling was rejected unexpectedly';
  end if;

  select count(*) into v_declined_notifications
  from public.notifications
  where user_id = '12000000-0000-0000-0000-000000000003'
    and type = 'offer_declined';

  if v_declined_notifications < 1 then
    raise exception 'FAIL: sibling rejection did not preserve decline notification semantics';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Expiry worker resilience across malformed and valid rows.
-- ---------------------------------------------------------------------------

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values (
  '32000000-0000-0000-0000-000000000006',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'stage11-expiry-batch',
  'Stage11 Expiry Batch',
  10000, 'good', 'active', 'manual', true, false,
  2, 2, 0, 0
);

insert into public.offers (
  id, listing_id, buyer_id, seller_id, amount_pence, quantity, status, direction
) values
  (
    '52000000-0000-0000-0000-000000000008',
    '32000000-0000-0000-0000-000000000006',
    '12000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000001',
    10000, 1, 'pending', 'buyer_to_seller'
  ),
  (
    '52000000-0000-0000-0000-000000000009',
    '32000000-0000-0000-0000-000000000006',
    '12000000-0000-0000-0000-000000000003',
    '12000000-0000-0000-0000-000000000001',
    10000, 1, 'pending', 'buyer_to_seller'
  );

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
select public.accept_offer('52000000-0000-0000-0000-000000000008');
select public.accept_offer('52000000-0000-0000-0000-000000000009');

-- Valid expired payment that should still release.
update public.payments
set expires_at = now() - interval '3 minutes'
where offer_id = '52000000-0000-0000-0000-000000000009';

-- Malformed expired payment: delete its order so expire_payment would normally abort.
delete from public.orders
where offer_id = '52000000-0000-0000-0000-000000000008';

update public.payments
set expires_at = now() - interval '4 minutes'
where offer_id = '52000000-0000-0000-0000-000000000008';

do $$
declare
  v_result jsonb;
  v_valid_payment public.payments;
  v_malformed_payment public.payments;
  v_listing public.listings;
begin
  v_result := public.release_expired_payments();

  if coalesce((v_result->>'processed')::int, 0) < 2
     or coalesce((v_result->>'released')::int, 0) < 1
     or coalesce((v_result->>'failed')::int, 0) < 1 then
    raise exception 'FAIL: expiry worker counts are wrong: %', v_result;
  end if;

  select * into v_valid_payment
  from public.payments
  where offer_id = '52000000-0000-0000-0000-000000000009';
  select * into v_malformed_payment
  from public.payments
  where offer_id = '52000000-0000-0000-0000-000000000008';
  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000006';

  if v_valid_payment.status <> 'expired'::public.payment_status then
    raise exception 'FAIL: valid expired payment was not released after malformed row';
  end if;

  if v_malformed_payment.status <> 'pending'::public.payment_status then
    raise exception 'FAIL: malformed payment status changed unexpectedly';
  end if;

  if not exists (
    select 1
    from public.commerce_exceptions
    where exception_type = 'expiry_worker_malformed_payment'
      and payment_id = v_malformed_payment.id
      and status = 'open'::public.commerce_exception_status
  ) then
    raise exception 'FAIL: malformed expiry did not create an open exception';
  end if;

  -- Valid release restored one reserved unit; malformed reservation remains reserved.
  if v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 1
     or v_listing.quantity_sold <> 0 then
    raise exception 'FAIL: expiry batch left unexpected inventory %/%/%',
      v_listing.quantity_available, v_listing.quantity_reserved, v_listing.quantity_sold;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- G. Privilege / protection verification (no control changes).
-- ---------------------------------------------------------------------------

do $$
declare
  v_listing public.listings;
begin
  -- Stage 2 accepts only the authenticated seller's total and derives counters.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition, status,
      source, collection_available, courier_available,
      quantity_total, quantity_available, quantity_reserved, quantity_sold,
      inventory_version
    ) values (
      '32000000-0000-0000-0000-000000000007',
      '12000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000001',
      'stage11-auth-insert',
      'Stage11 Auth Insert',
      10000, 'good', 'active', 'manual', true, false,
      5, 99, 3, 2, 44
    );
    reset role;
  exception
    when others then
      reset role;
      raise;
  end;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000007';

  if v_listing.quantity_total <> 5
     or v_listing.quantity_available <> 5
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 0 then
    raise exception 'FAIL: authenticated atomic inventory create was not normalized';
  end if;
end;
$$;

-- Explicit role-based privilege checks.
do $$
declare
  v_listing public.listings;
begin
  -- Service-role quantity update remains available.
  begin
    set local role service_role;
    perform set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
    perform public.update_listing_quantity(
      '32000000-0000-0000-0000-000000000005',
      4,
      (select inventory_version from public.listings where id = '32000000-0000-0000-0000-000000000005')
    );
    reset role;
  exception
    when others then
      reset role;
      raise;
  end;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000005';
  if v_listing.quantity_total <> 4 then
    raise exception 'FAIL: service_role update_listing_quantity unavailable';
  end if;

  -- Stage 2 permits the authenticated owner to execute the guarded RPC.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
    perform public.update_listing_quantity(
      '32000000-0000-0000-0000-000000000005',
      5,
      v_listing.inventory_version
    );
    reset role;
  exception
    when others then
      reset role;
      raise;
  end;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000005';
  if v_listing.quantity_total <> 5 then
    raise exception 'FAIL: authenticated seller quantity update unavailable';
  end if;

  -- Authenticated cannot write inventory counters directly.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
    begin
      update public.listings
      set quantity_available = 99, inventory_version = inventory_version + 1
      where id = '32000000-0000-0000-0000-000000000005';
      reset role;
      raise exception 'FAIL: authenticated wrote inventory counters';
    exception
      when insufficient_privilege then
        reset role;
      when others then
        reset role;
        if sqlerrm = 'FAIL: authenticated wrote inventory counters' then
          raise;
        end if;
        if sqlerrm not ilike '%Inventory fields must be changed through an inventory RPC%'
           and sqlerrm not ilike '%permission denied%' then
          raise exception 'FAIL: unexpected authenticated inventory write error: %', sqlerrm;
        end if;
    end;
  end;

  -- Anonymous cannot insert listings / write inventory / call quantity RPC.
  begin
    set local role anon;
    begin
      insert into public.listings (
        id, seller_id, category_id, slug, title, price_pence, condition, status,
        source, collection_available, courier_available,
        quantity_total, quantity_available, quantity_reserved, quantity_sold
      ) values (
        '32000000-0000-0000-0000-000000000008',
        '12000000-0000-0000-0000-000000000001',
        '22000000-0000-0000-0000-000000000001',
        'stage11-anon-insert',
        'Stage11 Anon Insert',
        10000, 'good', 'active', 'manual', true, false,
        2, 2, 0, 0
      );
      reset role;
      raise exception 'FAIL: anonymous inserted a listing';
    exception
      when insufficient_privilege then
        reset role;
      when others then
        reset role;
        if sqlerrm = 'FAIL: anonymous inserted a listing' then
          raise;
        end if;
        if sqlerrm not ilike '%permission denied%'
           and sqlerrm not ilike '%new row violates row-level security%' then
          raise exception 'FAIL: unexpected anon insert error: %', sqlerrm;
        end if;
    end;
  end;

  begin
    set local role anon;
    begin
      perform public.update_listing_quantity(
        '32000000-0000-0000-0000-000000000005',
        6,
        0
      );
      reset role;
      raise exception 'FAIL: anonymous executed update_listing_quantity';
    exception
      when insufficient_privilege then
        reset role;
      when others then
        reset role;
        if sqlerrm = 'FAIL: anonymous executed update_listing_quantity' then
          raise;
        end if;
        if sqlerrm not ilike '%permission denied%' then
          raise exception 'FAIL: unexpected anon rpc error: %', sqlerrm;
        end if;
    end;
  end;
end;
$$;

-- Existing listing creation with omitted quantity still creates 1/1/0/0.
do $$
declare
  v_listing public.listings;
begin
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);
    insert into public.listings (
      id, seller_id, category_id, slug, title, price_pence, condition, status,
      source, collection_available, courier_available
    ) values (
      '32000000-0000-0000-0000-000000000009',
      '12000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000001',
      'stage11-default-qty',
      'Stage11 Default Qty',
      10000, 'good', 'active', 'manual', true, false
    );
    reset role;
  exception
    when others then
      reset role;
      raise;
  end;

  select * into v_listing
  from public.listings
  where id = '32000000-0000-0000-0000-000000000009';

  if v_listing.quantity_total <> 1
     or v_listing.quantity_available <> 1
     or v_listing.quantity_reserved <> 0
     or v_listing.quantity_sold <> 0
     or v_listing.inventory_version <> 0 then
    raise exception 'FAIL: omitted quantity did not preserve 1/1/0/0';
  end if;
end;
$$;

-- Admin view is readable for admins.
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
do $$
begin
  if not exists (
    select 1 from public.commerce_exceptions_admin
    where exception_type = 'late_payment_after_release'
  ) then
    raise exception 'FAIL: admin cannot read commerce_exceptions_admin';
  end if;
end;
$$;

-- Final invariant.
do $$
begin
  if exists (
    select 1
    from public.listings
    where id::text like '32000000%'
      and (
        quantity_available + quantity_reserved + quantity_sold <> quantity_total
        or quantity_available < 0
        or quantity_reserved < 0
        or quantity_sold < 0
      )
  ) then
    raise exception 'FAIL: listing inventory invariant violated';
  end if;
end;
$$;

rollback;
