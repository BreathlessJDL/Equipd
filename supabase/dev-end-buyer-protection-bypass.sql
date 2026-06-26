-- Dev/test Buyer Protection window bypass
-- Run after dev-handover-confirmation-bypass.sql (step 50)
--
-- Ends the Buyer Protection window immediately using the same promotion logic as
-- release_due_order_payouts() (phase 4b). Production cron behaviour is unchanged.
--
-- Authorized only when:
--   - caller is an admin (profiles.is_admin), OR
--   - app_config.dev_handover_bypass_enabled = 'true' AND caller is the buyer

-- ---------------------------------------------------------------------------
-- Shared promotion after Buyer Protection window ends (single order)
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

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = v_order.id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'Order has an open dispute';
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
-- Batch promotion (cron) — delegates to shared single-order helper
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
      and not exists (
        select 1
        from public.order_disputes d
        where d.order_id = o.id
          and d.status in ('open', 'under_review')
      )
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
-- Dev/admin: end Buyer Protection window immediately (testing only)
-- ---------------------------------------------------------------------------

create or replace function public.dev_end_buyer_protection_now(
  p_order_id uuid,
  p_user_agent text default null,
  p_checks jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_dev_bypass_enabled boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select coalesce(nullif(trim(value), ''), '') = 'true'
  into v_dev_bypass_enabled
  from public.app_config
  where key = 'dev_handover_bypass_enabled';

  if public.is_admin() then
    null;
  elsif v_dev_bypass_enabled and v_uid = v_order.buyer_id then
    null;
  else
    raise exception 'Not authorized for test Buyer Protection bypass';
  end if;

  if v_order.protection_status is distinct from 'active' then
    raise exception 'Buyer Protection is not active on this order';
  end if;

  if v_order.fulfilment_status <> 'collected'::public.order_fulfilment_status then
    raise exception 'Order fulfilment status must be collected';
  end if;

  if v_order.payout_status <> 'not_due'::public.payout_status then
    raise exception 'Payout status must be not_due';
  end if;

  if v_order.payout_release_at is null then
    raise exception 'Buyer Protection window is not scheduled';
  end if;

  if exists (
    select 1
    from public.order_disputes d
    where d.order_id = v_order.id
      and d.status in ('open', 'under_review')
  ) then
    raise exception 'Order has an open dispute';
  end if;

  update public.orders o
  set payout_release_at = now()
  where o.id = p_order_id
    and o.payout_release_at > now();

  return public.promote_order_after_buyer_protection_window(p_order_id);
end;
$$;

revoke all on function public.dev_end_buyer_protection_now(uuid, text, jsonb) from public;
grant execute on function public.dev_end_buyer_protection_now(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
