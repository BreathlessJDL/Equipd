\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
) values
  ('16000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quantity-seller@example.test', '', now(), now()),
  ('16000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quantity-buyer-a@example.test', '', now(), now()),
  ('16000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quantity-buyer-b@example.test', '', now(), now());

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profiles (id, display_name, stripe_onboarding_complete)
values
  ('16000000-0000-0000-0000-000000000001', 'Quantity Seller', true),
  ('16000000-0000-0000-0000-000000000002', 'Quantity Buyer A', false),
  ('16000000-0000-0000-0000-000000000003', 'Quantity Buyer B', false)
on conflict (id) do update set display_name = excluded.display_name;

insert into public.categories (id, name, slug, sort_order)
values ('26000000-0000-0000-0000-000000000001', 'Buyer Quantity Test', 'buyer-quantity-test', 993);

insert into public.listings (
  id, seller_id, category_id, slug, title, price_pence, condition, status,
  source, collection_available, courier_available,
  quantity_total, quantity_available, quantity_reserved, quantity_sold
) values
  (
    '36000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    '26000000-0000-0000-0000-000000000001',
    'buyer-quantity-six',
    'Buyer Quantity Six',
    59500, 'good', 'active', 'manual', true, false,
    6, 6, 0, 0
  ),
  (
    '36000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000001',
    '26000000-0000-0000-0000-000000000001',
    'buyer-quantity-release',
    'Buyer Quantity Release',
    20000, 'good', 'active', 'manual', true, false,
    5, 5, 0, 0
  ),
  (
    '36000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000001',
    '26000000-0000-0000-0000-000000000001',
    'buyer-quantity-unavailable',
    'Buyer Quantity Unavailable',
    20000, 'good', 'draft', 'manual', true, false,
    2, 2, 0, 0
  );

insert into public.conversations (id, listing_id, buyer_id, seller_id)
values
  (
    '46000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000001'
  ),
  (
    '46000000-0000-0000-0000-000000000002',
    '36000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000001'
  ),
  (
    '46000000-0000-0000-0000-000000000003',
    '36000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000001'
  );

do $$
begin
  if to_regprocedure('public.create_buyer_offer(uuid,uuid,integer,text)') is not null then
    raise exception 'FAIL: quantity-aware offer path permits omitted quantity';
  end if;
end;
$$;

-- Valid quantity-four offer: total £2,200 / £550 each.
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.create_buyer_offer(
  '36000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000001',
  4,
  220000,
  'Four please'
);

reset role;

do $$
declare
  v_offer public.offers;
begin
  select * into v_offer
  from public.offers
  where listing_id = '36000000-0000-0000-0000-000000000001'
    and buyer_id = '16000000-0000-0000-0000-000000000002'
    and parent_offer_id is null;

  if v_offer.quantity <> 4
     or v_offer.amount_pence <> 220000
     or v_offer.amount_pence / v_offer.quantity <> 55000 then
    raise exception 'FAIL: valid quantity-four offer snapshot is wrong';
  end if;
end;
$$;

-- Quantity-one parity remains valid and preserves a quantity-one snapshot.
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.create_buyer_offer(
  '36000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000002',
  1,
  59000,
  null
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.offers
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and buyer_id = '16000000-0000-0000-0000-000000000003'
      and quantity = 1
      and amount_pence = 59000
  ) then
    raise exception 'FAIL: quantity-one offer snapshot is wrong';
  end if;
end;
$$;

update public.offers
set status = 'withdrawn'::public.offer_status
where listing_id = '36000000-0000-0000-0000-000000000001'
  and buyer_id = '16000000-0000-0000-0000-000000000003'
  and quantity = 1;

-- Invalid quantity/total/ownership/stale availability submissions all fail.
do $$
declare
  v_quantity integer;
  v_total integer;
begin
  foreach v_quantity in array array[0, -1, 7]
  loop
    begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform public.create_buyer_offer(
        '36000000-0000-0000-0000-000000000001',
        '46000000-0000-0000-0000-000000000002',
        v_quantity,
        50000,
        null
      );
      reset role;
      raise exception 'FAIL: invalid quantity % was accepted', v_quantity;
    exception when others then
      reset role;
      if sqlerrm like 'FAIL:%' then raise; end if;
    end;
  end loop;

  foreach v_total in array array[220001, 240000]
  loop
    begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform public.create_buyer_offer(
        '36000000-0000-0000-0000-000000000001',
        '46000000-0000-0000-0000-000000000002',
        4,
        v_total,
        null
      );
      reset role;
      raise exception 'FAIL: invalid total % was accepted', v_total;
    exception when others then
      reset role;
      if sqlerrm like 'FAIL:%' then raise; end if;
    end;
  end loop;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_buyer_offer(
      '36000000-0000-0000-0000-000000000001',
      '46000000-0000-0000-0000-000000000001',
      1,
      50000,
      null
    );
    reset role;
    raise exception 'FAIL: seller offered on own listing';
  exception when others then
    reset role;
    if sqlerrm = 'FAIL: seller offered on own listing' then raise; end if;
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_buyer_offer(
      '36000000-0000-0000-0000-000000000099',
      '46000000-0000-0000-0000-000000000002',
      1,
      50000,
      null
    );
    reset role;
    raise exception 'FAIL: missing listing offer was accepted';
  exception when others then
    reset role;
    if sqlerrm = 'FAIL: missing listing offer was accepted' then raise; end if;
  end;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.create_buyer_offer(
      '36000000-0000-0000-0000-000000000003',
      '46000000-0000-0000-0000-000000000002',
      1,
      19000,
      null
    );
    reset role;
    raise exception 'FAIL: unavailable listing offer was accepted';
  exception when others then
    reset role;
    if sqlerrm = 'FAIL: unavailable listing offer was accepted' then raise; end if;
  end;
end;
$$;

-- Seller counter preserves quantity and validates the total against unit price.
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_parent_id uuid := (
    select id from public.offers
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and buyer_id = '16000000-0000-0000-0000-000000000002'
      and parent_offer_id is null
  );
begin
  begin
    perform public.counter_offer(v_parent_id, 220001);
    raise exception 'FAIL: indivisible counter total was accepted';
  exception when others then
    if sqlerrm = 'FAIL: indivisible counter total was accepted' then raise; end if;
  end;

  begin
    perform public.counter_offer(v_parent_id, 240000);
    raise exception 'FAIL: counter above unit ceiling was accepted';
  exception when others then
    if sqlerrm = 'FAIL: counter above unit ceiling was accepted' then raise; end if;
  end;
end;
$$;

select public.counter_offer(
  (
    select id from public.offers
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and buyer_id = '16000000-0000-0000-0000-000000000002'
      and parent_offer_id is null
  ),
  228000
);

reset role;

do $$
declare
  v_counter public.offers;
begin
  select * into v_counter
  from public.offers
  where listing_id = '36000000-0000-0000-0000-000000000001'
    and direction = 'seller_to_buyer'
  order by created_at desc
  limit 1;

  if v_counter.quantity <> 4
     or v_counter.amount_pence <> 228000
     or v_counter.amount_pence / v_counter.quantity <> 57000 then
    raise exception 'FAIL: counter did not preserve quantity/total';
  end if;

  begin
    update public.offers set quantity = 1 where id = v_counter.id;
    raise exception 'FAIL: counter quantity was mutable';
  exception when others then
    if sqlerrm = 'FAIL: counter quantity was mutable' then raise; end if;
  end;
end;
$$;

-- Accepting quantity four reserves exactly four and leaves two publicly saleable.
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.accept_counter_offer(
  (
    select id from public.offers
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and direction = 'seller_to_buyer'
    order by created_at desc
    limit 1
  )
);

reset role;

do $$
declare
  v_listing public.listings;
  v_offer public.offers;
  v_order public.orders;
  v_payment public.payments;
begin
  select * into v_listing from public.listings
  where id = '36000000-0000-0000-0000-000000000001';
  select * into v_offer from public.offers
  where listing_id = v_listing.id and status = 'accepted'::public.offer_status;
  select * into v_order from public.orders where offer_id = v_offer.id;
  select * into v_payment from public.payments where id = v_order.payment_id;

  if v_listing.quantity_total <> 6
     or v_listing.quantity_available <> 2
     or v_listing.quantity_reserved <> 4
     or v_listing.quantity_sold <> 0
     or v_listing.status <> 'active'::public.listing_status then
    raise exception 'FAIL: partial acceptance inventory is wrong';
  end if;

  if v_order.quantity <> 4
     or v_order.agreed_unit_price_pence <> 57000
     or v_order.item_subtotal_pence <> 228000
     or v_order.inventory_state <> 'reserved'::public.order_inventory_state
     or v_payment.quantity <> 4
     or v_payment.agreed_unit_price_pence <> 57000
     or v_payment.item_subtotal_pence <> 228000 then
    raise exception 'FAIL: order/payment quantity snapshots are wrong';
  end if;

  if not exists (
    select 1 from public.messages
    where conversation_id = v_offer.conversation_id
      and message_type = 'system'::public.message_type
      and body = 'Counter-offer accepted for 4 items: £2280.00 total (£570.00 per item).'
  ) then
    raise exception 'FAIL: quantity-aware acceptance message missing';
  end if;
end;
$$;

-- Partial reservation checkout attach must succeed while the listing stays active.
update public.orders
set order_type = 'collection'::public.order_type
where listing_id = '36000000-0000-0000-0000-000000000001'
  and quantity = 4;

select public.attach_checkout_session(
  (
    select payment_id from public.orders
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and quantity = 4
  ),
  '16000000-0000-0000-0000-000000000002',
  'cs_stage4_partial_active_listing'
);

do $$
begin
  if not exists (
    select 1
    from public.payments p
    join public.orders o on o.payment_id = p.id
    join public.listings l on l.id = p.listing_id
    where o.quantity = 4
      and l.status = 'active'::public.listing_status
      and o.inventory_state = 'reserved'::public.order_inventory_state
      and p.stripe_checkout_session_id = 'cs_stage4_partial_active_listing'
  ) then
    raise exception 'FAIL: attach_checkout_session rejected active multi-quantity listing';
  end if;
end;
$$;

-- Two offers may compete for the final two units; only one acceptance succeeds.
set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.create_buyer_offer(
  '36000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000002',
  2,
  110000,
  null
);
reset role;

insert into public.offers (
  listing_id, buyer_id, seller_id, conversation_id,
  amount_pence, quantity, status, direction
) values (
  '36000000-0000-0000-0000-000000000001',
  '16000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000001',
  100000, 2, 'pending', 'buyer_to_seller'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.accept_offer(
  (
    select id from public.offers
    where buyer_id = '16000000-0000-0000-0000-000000000003'
      and status = 'pending'::public.offer_status
    order by created_at desc limit 1
  )
);
reset role;

do $$
declare
  v_competing_offer uuid;
begin
  select id into v_competing_offer
  from public.offers
  where buyer_id = '16000000-0000-0000-0000-000000000002'
    and status = 'pending'::public.offer_status
  order by created_at desc limit 1;

  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform public.accept_offer(v_competing_offer);
    reset role;
    raise exception 'FAIL: competing final-stock offer was accepted';
  exception when others then
    reset role;
    if sqlerrm = 'FAIL: competing final-stock offer was accepted' then raise; end if;
    if sqlerrm not ilike '%insufficient inventory%' then raise; end if;
  end;

  if exists (
    select 1 from public.listings
    where id = '36000000-0000-0000-0000-000000000001'
      and (
        quantity_available <> 0
        or quantity_reserved <> 6
        or quantity_sold <> 0
        or status <> 'reserved'::public.listing_status
      )
  ) then
    raise exception 'FAIL: final reservation inventory is wrong';
  end if;
end;
$$;

-- Capture both successful reservations, then prove conservative refund rules:
-- partial monetary refund does not restock; explicit full pre-handover refund does.
select public.mark_payment_captured(
  (
    select payment_id from public.orders
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and quantity = 4
  ),
  'cs_stage4_qty4',
  'pi_stage4_qty4',
  'ch_stage4_qty4'
);

select public.mark_payment_captured(
  (
    select payment_id from public.orders
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and quantity = 2
  ),
  'cs_stage4_qty2',
  'pi_stage4_qty2',
  'ch_stage4_qty2'
);

insert into public.order_disputes (
  id, order_id, buyer_id, seller_id, listing_id, reason, description,
  evidence_paths, status, refund_amount_pence
)
select
  '66000000-0000-0000-0000-000000000001',
  o.id,
  o.buyer_id,
  o.seller_id,
  o.listing_id,
  'significant_undisclosed_fault',
  'Stage 4 partial monetary refund test',
  array['stage4/partial-evidence.jpg'],
  'partial_refund_pending',
  10000
from public.orders o
where o.listing_id = '36000000-0000-0000-0000-000000000001'
  and o.quantity = 4;

update public.orders
set fulfilment_status = 'refunded'::public.order_fulfilment_status
where listing_id = '36000000-0000-0000-0000-000000000001'
  and quantity = 4;

do $$
begin
  if not exists (
    select 1 from public.orders
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and quantity = 4
      and inventory_state = 'no_restock'::public.order_inventory_state
  ) then
    raise exception 'FAIL: partial monetary refund restocked inventory';
  end if;

  if not exists (
    select 1 from public.listings
    where id = '36000000-0000-0000-0000-000000000001'
      and quantity_available = 0
      and quantity_reserved = 0
      and quantity_sold = 6
  ) then
    raise exception 'FAIL: partial refund changed inventory counters';
  end if;
end;
$$;

insert into public.order_disputes (
  id, order_id, buyer_id, seller_id, listing_id, reason, description,
  evidence_paths, status, refund_amount_pence
)
select
  '66000000-0000-0000-0000-000000000002',
  o.id,
  o.buyer_id,
  o.seller_id,
  o.listing_id,
  'significant_undisclosed_fault',
  'Stage 4 full pre-handover refund test',
  array['stage4/full-evidence.jpg'],
  'refund_pending',
  o.buyer_total_pence
from public.orders o
where o.listing_id = '36000000-0000-0000-0000-000000000001'
  and o.quantity = 2;

do $$
declare
  v_handed_over_order public.orders;
begin
  select * into v_handed_over_order
  from public.orders
  where listing_id = '36000000-0000-0000-0000-000000000001'
    and quantity = 2;

  v_handed_over_order.collected_at := now();
  if public.order_refund_is_explicitly_full(v_handed_over_order) then
    raise exception 'FAIL: post-handover refund was classified for automatic restock';
  end if;
end;
$$;

update public.orders
set fulfilment_status = 'refunded'::public.order_fulfilment_status
where listing_id = '36000000-0000-0000-0000-000000000001'
  and quantity = 2;

do $$
begin
  if not exists (
    select 1 from public.orders
    where listing_id = '36000000-0000-0000-0000-000000000001'
      and quantity = 2
      and inventory_state = 'restocked'::public.order_inventory_state
  ) then
    raise exception 'FAIL: full pre-handover refund did not restock exact quantity';
  end if;

  if not exists (
    select 1 from public.listings
    where id = '36000000-0000-0000-0000-000000000001'
      and quantity_available = 2
      and quantity_reserved = 0
      and quantity_sold = 4
      and status = 'active'::public.listing_status
  ) then
    raise exception 'FAIL: full refund restock counters/status are wrong';
  end if;
end;
$$;

-- Exact-quantity cancellation, expiry, checkout rejection and post-handover refund.
insert into public.offers (
  id, listing_id, buyer_id, seller_id, conversation_id,
  amount_pence, quantity, status, direction
) values (
  '56000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000003',
  57000, 3, 'pending', 'buyer_to_seller'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.accept_offer('56000000-0000-0000-0000-000000000001');
reset role;

update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '56000000-0000-0000-0000-000000000001';

do $$
declare
  v_payment_id uuid := (
    select payment_id from public.orders
    where offer_id = '56000000-0000-0000-0000-000000000001'
  );
begin
  begin
    perform public.attach_checkout_session(
      v_payment_id,
      '16000000-0000-0000-0000-000000000003',
      'cs_wrong_buyer'
    );
    raise exception 'FAIL: another buyer attached checkout';
  exception when others then
    if sqlerrm = 'FAIL: another buyer attached checkout' then raise; end if;
  end;

  update public.payments set expires_at = now() - interval '1 minute' where id = v_payment_id;
  begin
    perform public.attach_checkout_session(
      v_payment_id,
      '16000000-0000-0000-0000-000000000002',
      'cs_expired'
    );
    raise exception 'FAIL: expired payment attached checkout';
  exception when others then
    if sqlerrm = 'FAIL: expired payment attached checkout' then raise; end if;
  end;
  update public.payments set expires_at = now() + interval '72 hours' where id = v_payment_id;

  perform public.attach_checkout_session(
    v_payment_id,
    '16000000-0000-0000-0000-000000000002',
    'cs_repeatable'
  );
  perform public.attach_checkout_session(
    v_payment_id,
    '16000000-0000-0000-0000-000000000002',
    'cs_repeatable'
  );

  perform public.cancel_payment(v_payment_id);

  begin
    perform public.attach_checkout_session(
      v_payment_id,
      '16000000-0000-0000-0000-000000000002',
      'cs_released'
    );
    raise exception 'FAIL: released order attached checkout';
  exception when others then
    if sqlerrm = 'FAIL: released order attached checkout' then raise; end if;
  end;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.listings
    where id = '36000000-0000-0000-0000-000000000002'
      and quantity_available = 5
      and quantity_reserved = 0
      and quantity_sold = 0
      and status = 'active'::public.listing_status
  ) then
    raise exception 'FAIL: cancellation did not release exact quantity three';
  end if;
end;
$$;

insert into public.offers (
  id, listing_id, buyer_id, seller_id, conversation_id,
  amount_pence, quantity, status, direction
) values (
  '56000000-0000-0000-0000-000000000002',
  '36000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000003',
  38000, 2, 'pending', 'buyer_to_seller'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.accept_offer('56000000-0000-0000-0000-000000000002');
reset role;

update public.payments
set expires_at = now() - interval '1 minute'
where offer_id = '56000000-0000-0000-0000-000000000002';

select public.expire_payment(
  (select id from public.payments where offer_id = '56000000-0000-0000-0000-000000000002')
);

do $$
begin
  if not exists (
    select 1 from public.listings
    where id = '36000000-0000-0000-0000-000000000002'
      and quantity_available = 5
      and quantity_reserved = 0
      and quantity_sold = 0
  ) then
    raise exception 'FAIL: expiry did not release exact quantity two';
  end if;
end;
$$;

insert into public.offers (
  id, listing_id, buyer_id, seller_id, conversation_id,
  amount_pence, quantity, status, direction
) values (
  '56000000-0000-0000-0000-000000000003',
  '36000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000002',
  '16000000-0000-0000-0000-000000000001',
  '46000000-0000-0000-0000-000000000003',
  76000, 4, 'pending', 'buyer_to_seller'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.accept_offer('56000000-0000-0000-0000-000000000003');
reset role;

update public.orders
set order_type = 'collection'::public.order_type
where offer_id = '56000000-0000-0000-0000-000000000003';

select public.mark_payment_captured(
  (select id from public.payments where offer_id = '56000000-0000-0000-0000-000000000003'),
  'cs_post_handover',
  'pi_post_handover',
  'ch_post_handover'
);

do $$
begin
  if not exists (
    select 1 from public.notifications
    where user_id = '16000000-0000-0000-0000-000000000001'
      and title = 'Buyer payment received for 4 items'
      and body like 'The buyer has paid for 4 items from Buyer Quantity Release.%'
  ) then
    raise exception 'FAIL: quantity-aware payment notification missing';
  end if;
end;
$$;

insert into public.order_disputes (
  id, order_id, buyer_id, seller_id, listing_id, reason, description,
  evidence_paths, status, refund_amount_pence
)
select
  '66000000-0000-0000-0000-000000000003',
  o.id, o.buyer_id, o.seller_id, o.listing_id,
  'significant_undisclosed_fault',
  'Stage 4 post-handover full refund test',
  array['stage4/post-handover.jpg'],
  'refund_pending',
  o.buyer_total_pence
from public.orders o
where o.offer_id = '56000000-0000-0000-0000-000000000003';

update public.orders
set
  collected_at = now(),
  fulfilment_status = 'refunded'::public.order_fulfilment_status
where offer_id = '56000000-0000-0000-0000-000000000003';

do $$
begin
  if not exists (
    select 1 from public.orders
    where offer_id = '56000000-0000-0000-0000-000000000003'
      and inventory_state = 'no_restock'::public.order_inventory_state
  ) then
    raise exception 'FAIL: post-handover refund auto-restocked inventory';
  end if;

  if not exists (
    select 1 from public.listings
    where id = '36000000-0000-0000-0000-000000000002'
      and quantity_available = 1
      and quantity_reserved = 0
      and quantity_sold = 4
  ) then
    raise exception 'FAIL: post-handover refund changed sold counters';
  end if;
end;
$$;

select set_config('request.jwt.claim.role', 'service_role', true);
update public.profiles
set is_admin = true
where id = '16000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $$
begin
  if not exists (
    select 1
    from public.admin_list_orders('all') a
    where a.listing_id = '36000000-0000-0000-0000-000000000001'
      and a.quantity = 4
      and a.agreed_unit_price_pence = 57000
      and a.item_subtotal_pence = 228000
      and a.inventory_state = 'no_restock'::public.order_inventory_state
  ) then
    raise exception 'FAIL: admin order list omitted quantity snapshots';
  end if;
end;
$$;
reset role;

rollback;

select 'buyer multi-quantity transaction tests passed' as result;
