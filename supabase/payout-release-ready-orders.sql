-- Payout worker: eligible already-ready orders for Stripe transfer
-- Run after order-lifecycle-repair-stuck-promotion.sql (step 53)
--
-- Used by stripe-release-due-payouts Edge Function after release_due_order_payouts()
-- so orders promoted outside the same cron invocation (dev bypass, repair, partial crash)
-- are still picked up for Stripe transfer.

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
      and not exists (
        select 1
        from public.order_disputes d
        where d.order_id = o.id
          and d.status in ('open', 'under_review')
      )
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

notify pgrst, 'reload schema';
