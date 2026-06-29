-- Rollback Buyer Protection Phase 5 (admin dispute resolution actions)
-- Run manually in Supabase SQL Editor if buyer-protection-phase5-admin-dispute-resolution.sql
-- was already applied. Safe to re-run.
--
-- Restores Phase 4C dispute admin baseline (resolve for buyer/seller, under review).
-- Does not touch dispute opening, evidence upload, payout cron, or payment flows.

-- ---------------------------------------------------------------------------
-- Normalize Phase 5-only dispute rows before constraint restore
-- ---------------------------------------------------------------------------

update public.order_disputes
set status = 'resolved_buyer'
where status = 'resolved'
  and dispute_outcome in ('refund_full', 'refund_partial');

update public.order_disputes
set status = 'resolved_seller'
where status = 'resolved'
  and dispute_outcome = 'rejected';

update public.order_disputes
set status = 'under_review'
where status in ('awaiting_buyer_evidence', 'awaiting_seller_evidence');

-- ---------------------------------------------------------------------------
-- Drop Phase 5 trigger and audit log
-- ---------------------------------------------------------------------------

drop trigger if exists order_disputes_log_opened_event on public.order_disputes;
drop function if exists public.log_dispute_opened_event();

drop table if exists public.buyer_protection_dispute_events cascade;

-- ---------------------------------------------------------------------------
-- Drop Phase 5 RPCs
-- ---------------------------------------------------------------------------

drop function if exists public.admin_resolve_dispute_full_refund(uuid, text, text);
drop function if exists public.admin_resolve_dispute_partial_refund(uuid, integer, text, text);
drop function if exists public.admin_reject_dispute(uuid, text, text);
drop function if exists public.admin_request_dispute_more_evidence(uuid, text, text, text, integer);
drop function if exists public.admin_save_dispute_notes(uuid, text);
drop function if exists public.fetch_dispute_events(uuid);

drop function if exists public.log_buyer_protection_dispute_event(
  uuid, uuid, text, uuid, text, text, jsonb
);

drop function if exists public.is_dispute_closed(text);
drop function if exists public.is_dispute_active_status(text);
drop function if exists public.assert_admin_dispute_resolution_inputs(
  public.order_disputes, text, integer, text
);

-- ---------------------------------------------------------------------------
-- Restore Phase 4C admin_apply_dispute_update (5-arg)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_apply_dispute_update(
  uuid, text, text, text, boolean, text, integer, text, timestamptz
);

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
-- Restore Phase 4C fetch_order_disputes
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
-- Restore notification cleanup trigger (pre-Phase 5)
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_dispute_notifications_on_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stale_types text[] := array[
    'order_dispute_opened',
    'order_dispute_under_review'
  ];
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status in (
    'resolved_buyer',
    'resolved_seller',
    'cancelled'
  ) then
    perform public.mark_related_notifications_read(
      new.buyer_id,
      v_stale_types,
      p_order_id => new.order_id
    );
    perform public.mark_related_notifications_read(
      new.seller_id,
      v_stale_types,
      p_order_id => new.order_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists order_disputes_cleanup_notifications_on_resolve on public.order_disputes;

create trigger order_disputes_cleanup_notifications_on_resolve
  after update of status on public.order_disputes
  for each row
  execute function public.cleanup_dispute_notifications_on_resolve();

-- ---------------------------------------------------------------------------
-- Remove Phase 5-only columns and constraints
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  drop constraint if exists order_disputes_outcome_valid,
  drop constraint if exists order_disputes_refund_status_valid,
  drop constraint if exists order_disputes_refund_amount_valid;

alter table public.order_disputes
  drop column if exists dispute_outcome,
  drop column if exists refund_amount_pence,
  drop column if exists refund_status,
  drop column if exists evidence_deadline_at;

alter table public.order_disputes
  drop constraint if exists order_disputes_status_valid;

alter table public.order_disputes
  add constraint order_disputes_status_valid
  check (
    status in (
      'open',
      'under_review',
      'resolved_buyer',
      'resolved_seller',
      'cancelled'
    )
  );

drop index if exists public.order_disputes_one_active_per_order_idx;

create unique index if not exists order_disputes_one_active_per_order_idx
  on public.order_disputes (order_id)
  where status in ('open', 'under_review');
