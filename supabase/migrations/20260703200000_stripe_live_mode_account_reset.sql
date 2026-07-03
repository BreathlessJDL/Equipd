-- Stripe live mode migration: reset stale test-mode Connect account IDs.

create or replace function public.mark_order_payout_awaiting_seller_setup(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set
    payout_status = 'awaiting_seller_setup'::public.payout_status,
    stripe_transfer_id = null
  where id = p_order_id
    and payout_status in (
      'ready'::public.payout_status,
      'processing'::public.payout_status,
      'failed'::public.payout_status
    )
  returning * into v_order;

  if not found then
    select *
    into v_order
    from public.orders
    where id = p_order_id;
  end if;

  if not found then
    raise exception 'Order not found';
  end if;

  return v_order;
end;
$$;

create or replace function public.reset_seller_stripe_connect_onboarding(
  p_seller_id uuid,
  p_notify boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orders_reverted integer := 0;
  v_had_stripe_account boolean := false;
begin
  if p_seller_id is null then
    raise exception 'Seller id is required';
  end if;

  if not exists (select 1 from public.profiles where id = p_seller_id) then
    raise exception 'Profile not found';
  end if;

  select (stripe_account_id is not null)
  into v_had_stripe_account
  from public.profiles
  where id = p_seller_id;

  update public.profiles
  set
    stripe_account_id = null,
    stripe_onboarding_complete = false
  where id = p_seller_id;

  update public.orders
  set
    payout_status = 'awaiting_seller_setup'::public.payout_status,
    stripe_transfer_id = null
  where seller_id = p_seller_id
    and payout_status in (
      'ready'::public.payout_status,
      'processing'::public.payout_status,
      'failed'::public.payout_status
    );

  get diagnostics v_orders_reverted = row_count;

  if p_notify and v_had_stripe_account then
    perform public.create_notification(
      p_seller_id,
      'seller_payout_setup_required',
      'Complete live Stripe setup',
      'Your payout account needs to be set up again for live payments. Complete Stripe setup to receive your earnings.',
      '/settings?stripeSetup=1'
    );
  end if;

  return jsonb_build_object(
    'seller_id', p_seller_id,
    'orders_reverted', v_orders_reverted,
    'notified', coalesce(p_notify, false)
  );
end;
$$;

revoke all on function public.mark_order_payout_awaiting_seller_setup(uuid) from public;
grant execute on function public.mark_order_payout_awaiting_seller_setup(uuid) to service_role;

revoke all on function public.reset_seller_stripe_connect_onboarding(uuid, boolean) from public;
grant execute on function public.reset_seller_stripe_connect_onboarding(uuid, boolean) to service_role;

notify pgrst, 'reload schema';
