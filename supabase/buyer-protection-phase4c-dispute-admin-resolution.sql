-- Equipd Buyer Protection / Order Lifecycle — Phase 4C (Dispute admin resolution)
-- Run after buyer-protection-phase4b-payout-release.sql
-- Safe to re-run (idempotent where possible).
--
-- Admin-only RPCs to review and resolve order disputes.
-- Uses profiles.is_admin via public.is_admin() (see admin-support-tools.sql).
-- Does not automate Stripe refunds.

-- ---------------------------------------------------------------------------
-- Extend order_disputes
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  add column if not exists admin_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles (id) on delete set null,
  add column if not exists resolution text;

-- ---------------------------------------------------------------------------
-- Admin read access on disputes
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can read all order disputes" on public.order_disputes;

create policy "Admins can read all order disputes"
  on public.order_disputes for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Infer fulfilment status before dispute (collection vs delivery)
-- ---------------------------------------------------------------------------

create or replace function public.infer_pre_dispute_fulfilment_status(p_order public.orders)
returns public.order_fulfilment_status
language sql
stable
as $$
  select case
    when p_order.delivered_at is not null
      or p_order.courier_delivered_at is not null then
      'delivered'::public.order_fulfilment_status
    when p_order.collected_at is not null
      or p_order.collection_confirmed_at is not null then
      'collected'::public.order_fulfilment_status
    when coalesce(p_order.order_type, 'collection'::public.order_type)
      = 'buyer_courier'::public.order_type then
      'delivered'::public.order_fulfilment_status
    else
      'collected'::public.order_fulfilment_status
  end;
$$;

-- ---------------------------------------------------------------------------
-- Fetch disputes for an order (participants + admins)
-- ---------------------------------------------------------------------------

drop function if exists public.fetch_order_disputes(uuid);

create or replace function public.fetch_order_disputes(p_order_id uuid)
returns table (
  id uuid,
  order_id uuid,
  buyer_id uuid,
  seller_id uuid,
  listing_id uuid,
  reason text,
  description text,
  evidence_paths text[],
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  seller_response text,
  seller_response_at timestamptz,
  seller_response_evidence_paths text[],
  admin_note text,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  if not v_is_admin
     and v_order.buyer_id <> v_uid
     and v_order.seller_id <> v_uid then
    raise exception 'You do not have access to this order';
  end if;

  return query
  select
    d.id,
    d.order_id,
    d.buyer_id,
    d.seller_id,
    d.listing_id,
    d.reason,
    d.description,
    d.evidence_paths,
    d.status,
    d.created_at,
    d.updated_at,
    d.seller_response,
    d.seller_response_at,
    d.seller_response_evidence_paths,
    case when v_is_admin then d.admin_note else null end as admin_note,
    d.resolved_at,
    d.resolved_by,
    case
      when v_is_admin then d.resolution
      when d.status in ('resolved_buyer', 'resolved_seller') then d.resolution
      else null
    end as resolution
  from public.order_disputes d
  where d.order_id = p_order_id
  order by d.created_at desc;
end;
$$;

revoke all on function public.fetch_order_disputes(uuid) from public;
grant execute on function public.fetch_order_disputes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared admin dispute update helper
-- ---------------------------------------------------------------------------

create or replace function public.admin_apply_dispute_update(
  p_dispute_id uuid,
  p_status text,
  p_admin_note text default null,
  p_resolution text default null,
  p_mark_resolved boolean default false
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.status = p_status then
    update public.order_disputes
    set
      admin_note = coalesce(v_note, admin_note),
      resolution = coalesce(nullif(trim(coalesce(p_resolution, '')), ''), resolution),
      resolved_at = case when p_mark_resolved then coalesce(resolved_at, now()) else resolved_at end,
      resolved_by = case when p_mark_resolved then coalesce(resolved_by, v_uid) else resolved_by end
    where id = p_dispute_id
    returning * into v_dispute;

    return v_dispute;
  end if;

  if v_dispute.status in ('resolved_buyer', 'resolved_seller', 'cancelled') then
    raise exception 'Dispute is already closed';
  end if;

  update public.order_disputes
  set
    status = p_status,
    admin_note = coalesce(v_note, admin_note),
    resolution = nullif(trim(coalesce(p_resolution, '')), ''),
    resolved_at = case when p_mark_resolved then now() else resolved_at end,
    resolved_by = case when p_mark_resolved then v_uid else resolved_by end
  where id = p_dispute_id
  returning * into v_dispute;

  return v_dispute;
end;
$$;

revoke all on function public.admin_apply_dispute_update(uuid, text, text, text, boolean) from public;

-- ---------------------------------------------------------------------------
-- Mark dispute under review
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_dispute_under_review(
  p_dispute_id uuid,
  p_admin_note text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.order_disputes;
  v_order public.orders;
  v_listing_title text;
  v_previous_status text;
begin
  select d.status
  into v_previous_status
  from public.order_disputes d
  where d.id = p_dispute_id;

  v_dispute := public.admin_apply_dispute_update(
    p_dispute_id,
    'under_review',
    p_admin_note,
    null,
    false
  );

  select *
  into v_order
  from public.orders
  where id = v_dispute.order_id;

  if v_previous_status is distinct from 'under_review' then
    select l.title
    into v_listing_title
    from public.listings l
    where l.id = v_dispute.listing_id;

    perform public.create_notification(
      v_dispute.seller_id,
      'order_dispute_under_review',
      'Dispute under review',
      'Equipd is reviewing the dispute for '
        || coalesce(v_listing_title, 'your order')
        || '. Payout remains on hold.',
      '/orders/' || v_dispute.order_id::text
    );

    perform public.create_notification(
      v_dispute.buyer_id,
      'order_dispute_under_review',
      'Dispute under review',
      'Equipd is reviewing your dispute for '
        || coalesce(v_listing_title, 'this order')
        || '.',
      '/orders/' || v_dispute.order_id::text
    );
  end if;

  return v_dispute;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve dispute in seller's favour
-- ---------------------------------------------------------------------------

create or replace function public.admin_resolve_dispute_for_seller(
  p_dispute_id uuid,
  p_admin_note text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.order_disputes;
  v_order public.orders;
  v_listing_title text;
  v_restore_status public.order_fulfilment_status;
  v_seller_onboarded boolean;
  v_resolution text :=
    'Resolved in seller''s favour. Seller payout can proceed through the normal release process.';
begin
  select *
  into v_order
  from public.orders o
  join public.order_disputes d on d.order_id = o.id
  where d.id = p_dispute_id
  for update of o;

  if not found then
    raise exception 'Dispute not found';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if v_dispute.status = 'resolved_seller' then
    return public.admin_apply_dispute_update(
      p_dispute_id,
      'resolved_seller',
      p_admin_note,
      v_resolution,
      true
    );
  end if;

  v_dispute := public.admin_apply_dispute_update(
    p_dispute_id,
    'resolved_seller',
    p_admin_note,
    v_resolution,
    true
  );

  v_restore_status := public.infer_pre_dispute_fulfilment_status(v_order);

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
      payout_release_at = null
    where id = v_order.id;
  else
    update public.orders
    set
      fulfilment_status = v_restore_status,
      protection_status = 'active',
      payout_status = case
        when v_seller_onboarded then 'ready'::public.payout_status
        else 'awaiting_seller_setup'::public.payout_status
      end,
      payout_release_at = now()
    where id = v_order.id;
  end if;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_dispute.listing_id;

  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_resolved_seller',
    'Dispute resolved in your favour',
    'The dispute for '
      || coalesce(v_listing_title, 'your order')
      || ' was resolved in your favour. Payout can now proceed.',
    '/orders/' || v_dispute.order_id::text
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_resolved_seller',
    'Dispute resolved in seller''s favour',
    'The dispute for '
      || coalesce(v_listing_title, 'this order')
      || ' was resolved in the seller''s favour.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve dispute in buyer's favour
-- ---------------------------------------------------------------------------

create or replace function public.admin_resolve_dispute_for_buyer(
  p_dispute_id uuid,
  p_admin_note text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.order_disputes;
  v_order public.orders;
  v_listing_title text;
  v_resolution text :=
    'Resolved in buyer''s favour. Refund processing is manual for now — Equipd will contact both parties.';
begin
  select *
  into v_order
  from public.orders o
  join public.order_disputes d on d.order_id = o.id
  where d.id = p_dispute_id
  for update of o;

  if not found then
    raise exception 'Dispute not found';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if v_dispute.status = 'resolved_buyer' then
    return public.admin_apply_dispute_update(
      p_dispute_id,
      'resolved_buyer',
      p_admin_note,
      v_resolution,
      true
    );
  end if;

  v_dispute := public.admin_apply_dispute_update(
    p_dispute_id,
    'resolved_buyer',
    p_admin_note,
    v_resolution,
    true
  );

  update public.orders
  set
    fulfilment_status = 'disputed'::public.order_fulfilment_status,
    protection_status = 'disputed',
    payout_status = 'on_hold'::public.payout_status,
    payout_release_at = null
  where id = v_order.id
    and v_order.payout_status is distinct from 'paid'::public.payout_status
    and v_order.payout_released_at is null;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_dispute.listing_id;

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_resolved_buyer',
    'Dispute resolved in your favour',
    'The dispute for '
      || coalesce(v_listing_title, 'this order')
      || ' was resolved in your favour. Equipd will follow up about any refund manually.',
    '/orders/' || v_dispute.order_id::text
  );

  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_resolved_buyer',
    'Dispute resolved in buyer''s favour',
    'The dispute for '
      || coalesce(v_listing_title, 'your order')
      || ' was resolved in the buyer''s favour. Seller payout remains on hold.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.admin_mark_dispute_under_review(uuid, text) from public;
grant execute on function public.admin_mark_dispute_under_review(uuid, text) to authenticated;

revoke all on function public.admin_resolve_dispute_for_seller(uuid, text) from public;
grant execute on function public.admin_resolve_dispute_for_seller(uuid, text) to authenticated;

revoke all on function public.admin_resolve_dispute_for_buyer(uuid, text) from public;
grant execute on function public.admin_resolve_dispute_for_buyer(uuid, text) to authenticated;
