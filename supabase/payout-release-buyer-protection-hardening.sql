-- =============================================================================
-- Payout release hardening — enforce Buyer Protection before Stripe transfer
-- =============================================================================
--
-- Blocks legacy/manual payout paths from transferring before payout_release_at.
-- Requires: case-management-phase3-refund-closure.sql (case_status_is_active)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared: active case/dispute blocking payout
-- ---------------------------------------------------------------------------

create or replace function public.order_has_active_case_blocking_payout(p_order_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.order_disputes d
    where d.order_id = p_order_id
      and d.case_outcome is null
      and public.case_status_is_active(d.status)
  )
  or exists (
    select 1
    from public.transaction_support_requests r
    where r.order_id = p_order_id
      and r.case_outcome is null
      and public.case_status_is_active(r.status::text)
  );
$$;

revoke all on function public.order_has_active_case_blocking_payout(uuid) from public;
grant execute on function public.order_has_active_case_blocking_payout(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- mark_order_payout_processing — hard Buyer Protection guards
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_payout_processing(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payout_status = 'paid'::public.payout_status then
    return v_order;
  end if;

  if v_order.payout_status = 'processing'::public.payout_status
    and v_order.stripe_transfer_id is null then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'completed'::public.order_fulfilment_status then
    raise exception 'Order must be completed before payout can be released';
  end if;

  if v_order.protection_status <> 'released' then
    raise exception 'Buyer Protection must be released before payout can be released';
  end if;

  if v_order.payout_release_at is null then
    raise exception 'Buyer Protection release time is not set';
  end if;

  if v_order.payout_release_at > now() then
    raise exception 'Buyer Protection window has not ended yet';
  end if;

  if public.order_has_active_case_blocking_payout(p_order_id) then
    raise exception 'Order has an active case blocking payout release';
  end if;

  if v_order.payout_status not in (
    'ready'::public.payout_status,
    'failed'::public.payout_status
  ) then
    raise exception 'Payout cannot be released from status %', v_order.payout_status;
  end if;

  if v_order.stripe_transfer_id is not null then
    raise exception 'Payout transfer already recorded for this order';
  end if;

  if v_order.payout_released_at is not null then
    raise exception 'Payout has already been released';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
      and p.stripe_charge_id is not null
  ) then
    raise exception 'Paid charge required before payout can be released';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_order.listing_id
      and l.status in (
        'in_progress'::public.listing_status,
        'sold'::public.listing_status
      )
  ) then
    raise exception 'Listing must be sold or in progress before payout can be released';
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = v_order.seller_id
      and pr.stripe_account_id is not null
      and coalesce(pr.stripe_onboarding_complete, false)
  ) then
    raise exception 'Seller payout setup is not complete';
  end if;

  update public.orders
  set payout_status = 'processing'::public.payout_status
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.mark_order_payout_processing(uuid) from public;
grant execute on function public.mark_order_payout_processing(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- promote_order_after_buyer_protection_window — broader case blocking
-- ---------------------------------------------------------------------------

create or replace function public.promote_order_after_buyer_protection_window(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_seller_onboarded boolean;
  v_new_payout_status public.payout_status;
  v_completed_at timestamptz;
begin
  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.fulfilment_status not in (
    'collected'::public.order_fulfilment_status,
    'delivered'::public.order_fulfilment_status
  ) then
    raise exception 'Order fulfilment status must be collected or delivered';
  end if;

  if v_order.payout_release_at is null or v_order.payout_release_at > now() then
    raise exception 'Buyer Protection window has not ended yet';
  end if;

  if v_order.payout_status <> 'not_due'::public.payout_status then
    raise exception 'Payout status must be not_due';
  end if;

  if v_order.payout_released_at is not null then
    raise exception 'Payout has already been released';
  end if;

  if v_order.stripe_transfer_id is not null then
    raise exception 'Payout transfer already recorded for this order';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
      and p.stripe_charge_id is not null
  ) then
    raise exception 'Paid charge required before payout can be promoted';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_order.listing_id
      and l.status = 'in_progress'::public.listing_status
  ) then
    raise exception 'Listing must be in progress before payout can be promoted';
  end if;

  if public.order_has_active_case_blocking_payout(p_order_id) then
    raise exception 'Order has an active case blocking payout release';
  end if;

  select
    coalesce(pr.stripe_onboarding_complete, false)
    and pr.stripe_account_id is not null
  into v_seller_onboarded
  from public.profiles pr
  where pr.id = v_order.seller_id;

  v_new_payout_status := case
    when v_seller_onboarded then 'ready'::public.payout_status
    else 'awaiting_seller_setup'::public.payout_status
  end;

  v_completed_at := coalesce(
    v_order.buyer_confirmed_at,
    v_order.delivered_at,
    v_order.collected_at,
    now()
  );

  update public.orders o
  set
    fulfilment_status = 'completed'::public.order_fulfilment_status,
    buyer_confirmed_at = v_completed_at,
    protection_status = 'released',
    payout_status = v_new_payout_status
  where o.id = v_order.id;

  update public.listings l
  set status = 'sold'::public.listing_status
  where l.id = v_order.listing_id
    and l.status = 'in_progress'::public.listing_status;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.promote_order_after_buyer_protection_window(uuid) from public;
grant execute on function public.promote_order_after_buyer_protection_window(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- release_due_order_payouts — broader case blocking
-- ---------------------------------------------------------------------------

create or replace function public.release_due_order_payouts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_results jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_promoted public.orders;
  v_seller_onboarded boolean;
begin
  for v_order in
    select o.*
    from public.orders o
    where o.fulfilment_status in (
      'collected'::public.order_fulfilment_status,
      'delivered'::public.order_fulfilment_status
    )
      and o.payout_release_at is not null
      and o.payout_release_at <= now()
      and o.payout_status = 'not_due'::public.payout_status
      and o.payout_released_at is null
      and o.stripe_transfer_id is null
      and exists (
        select 1
        from public.payments p
        where p.id = o.payment_id
          and p.status = 'paid'::public.payment_status
          and p.stripe_charge_id is not null
      )
      and exists (
        select 1
        from public.listings l
        where l.id = o.listing_id
          and l.status = 'in_progress'::public.listing_status
      )
      and not public.order_has_active_case_blocking_payout(o.id)
    order by o.payout_release_at asc
    for update of o skip locked
  loop
    v_promoted := public.promote_order_after_buyer_protection_window(v_order.id);

    select
      coalesce(pr.stripe_onboarding_complete, false)
      and pr.stripe_account_id is not null
    into v_seller_onboarded
    from public.profiles pr
    where pr.id = v_promoted.seller_id;

    v_entry := jsonb_build_object(
      'order_id', v_promoted.id,
      'result', case
        when v_seller_onboarded then 'promoted_ready'
        else 'promoted_awaiting_seller_setup'
      end,
      'payout_status', v_promoted.payout_status::text,
      'seller_connect_ready', v_seller_onboarded
    );

    v_results := v_results || jsonb_build_array(v_entry);
  end loop;

  return v_results;
end;
$$;

revoke all on function public.release_due_order_payouts() from public;
grant execute on function public.release_due_order_payouts() to service_role;

-- ---------------------------------------------------------------------------
-- get_ready_orders_for_payout_release — broader case blocking
-- ---------------------------------------------------------------------------

create or replace function public.get_ready_orders_for_payout_release()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_results jsonb := '[]'::jsonb;
  v_seller_onboarded boolean;
begin
  for v_order in
    select o.*
    from public.orders o
    where o.payout_status in (
      'ready'::public.payout_status,
      'failed'::public.payout_status
    )
      and o.stripe_transfer_id is null
      and o.payout_released_at is null
      and o.payout_release_at is not null
      and o.payout_release_at <= now()
      and o.protection_status = 'released'
      and o.fulfilment_status = 'completed'::public.order_fulfilment_status
      and exists (
        select 1
        from public.payments p
        where p.id = o.payment_id
          and p.status = 'paid'::public.payment_status
          and p.stripe_charge_id is not null
      )
      and exists (
        select 1
        from public.profiles pr
        where pr.id = o.seller_id
          and pr.stripe_account_id is not null
          and coalesce(pr.stripe_onboarding_complete, false)
      )
      and not public.order_has_active_case_blocking_payout(o.id)
    order by o.payout_release_at asc
  loop
    select
      coalesce(pr.stripe_onboarding_complete, false)
      and pr.stripe_account_id is not null
    into v_seller_onboarded
    from public.profiles pr
    where pr.id = v_order.seller_id;

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'order_id', v_order.id,
        'payout_status', v_order.payout_status::text,
        'source', 'already_ready',
        'seller_connect_ready', v_seller_onboarded
      )
    );
  end loop;

  return v_results;
end;
$$;

revoke all on function public.get_ready_orders_for_payout_release() from public;
grant execute on function public.get_ready_orders_for_payout_release() to service_role;

-- ---------------------------------------------------------------------------
-- confirm_order_received — block current fulfilment flows; no immediate payout
-- ---------------------------------------------------------------------------

create or replace function public.confirm_order_received(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.buyer_id <> v_uid then
    raise exception 'Only the buyer can confirm this order';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) in (
    'collection'::public.order_type,
    'seller_delivery'::public.order_type,
    'buyer_courier'::public.order_type
  ) then
    raise exception 'Use the order handover flow to confirm collection or delivery';
  end if;

  if v_order.fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status then
    return v_order;
  end if;

  if v_order.fulfilment_status <> 'paid'::public.order_fulfilment_status then
    raise exception 'Order cannot be confirmed from fulfilment status %', v_order.fulfilment_status;
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before confirming receipt';
  end if;

  if not exists (
    select 1
    from public.offers o
    where o.id = v_order.offer_id
      and o.status = 'accepted'::public.offer_status
  ) then
    raise exception 'Accepted offer required before confirming receipt';
  end if;

  if not exists (
    select 1
    from public.listings l
    where l.id = v_order.listing_id
      and l.status = 'in_progress'::public.listing_status
  ) then
    raise exception 'Listing is not in progress';
  end if;

  update public.orders
  set
    fulfilment_status = 'buyer_confirmed'::public.order_fulfilment_status,
    buyer_confirmed_at = now(),
    collected_at = coalesce(collected_at, now())
  where id = p_order_id;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.confirm_order_received(uuid) from public;
grant execute on function public.confirm_order_received(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- release_order_payout_after_dispute_reject — explicit early-release state
-- ---------------------------------------------------------------------------

create or replace function public.release_order_payout_after_dispute_reject(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_seller_onboarded boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select
    coalesce(pr.stripe_onboarding_complete, false)
    and pr.stripe_account_id is not null
  into v_seller_onboarded
  from public.profiles pr
  where pr.id = v_order.seller_id;

  if v_order.payout_status = 'paid'::public.payout_status
     or v_order.payout_released_at is not null then
    update public.orders
    set
      fulfilment_status = 'completed'::public.order_fulfilment_status,
      protection_status = 'released',
      payout_status = 'paid'::public.payout_status,
      payout_release_at = coalesce(payout_release_at, now())
    where id = v_order.id;
  else
    update public.orders
    set
      fulfilment_status = 'completed'::public.order_fulfilment_status,
      protection_status = 'released',
      buyer_confirmed_at = coalesce(
        buyer_confirmed_at,
        collected_at,
        delivered_at,
        now()
      ),
      payout_status = case
        when v_seller_onboarded then 'ready'::public.payout_status
        else 'awaiting_seller_setup'::public.payout_status
      end,
      payout_release_at = now()
    where id = v_order.id;
  end if;
end;
$$;

revoke all on function public.release_order_payout_after_dispute_reject(uuid) from public;
grant execute on function public.release_order_payout_after_dispute_reject(uuid) to service_role;

notify pgrst, 'reload schema';
