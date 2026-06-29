-- =============================================================================
-- Equipd Case Management — Phase 3: Refund completion & case closure
-- =============================================================================
--
-- Prerequisites:
--   case-management-phase3-01-enums.sql (committed separately)
--   case-management-phase2-5-admin-polish.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Refund completion columns
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  add column if not exists refund_reference text,
  add column if not exists refund_completed_at timestamptz,
  add column if not exists refund_completed_by uuid references public.profiles (id) on delete set null;

alter table public.transaction_support_requests
  add column if not exists refund_reference text,
  add column if not exists refund_completed_at timestamptz,
  add column if not exists refund_completed_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Extend dispute statuses
-- ---------------------------------------------------------------------------

alter table public.order_disputes
  drop constraint if exists order_disputes_status_valid;

alter table public.order_disputes
  add constraint order_disputes_status_valid
  check (
    status in (
      'open',
      'under_review',
      'awaiting_buyer_evidence',
      'awaiting_seller_evidence',
      'return_authorised',
      'awaiting_seller_collection',
      'collection_arranged',
      'collection_confirmed',
      'ready_for_refund',
      'refund_pending',
      'partial_refund_pending',
      'refund_completed',
      'rejected',
      'resolved',
      'resolved_buyer',
      'resolved_seller',
      'cancelled'
    )
  );

drop index if exists public.order_disputes_one_active_per_order_idx;

create unique index if not exists order_disputes_one_active_per_order_idx
  on public.order_disputes (order_id)
  where status in (
    'open',
    'under_review',
    'awaiting_buyer_evidence',
    'awaiting_seller_evidence',
    'return_authorised',
    'awaiting_seller_collection',
    'collection_arranged',
    'collection_confirmed',
    'ready_for_refund',
    'refund_pending',
    'partial_refund_pending',
    'refund_completed'
  );

drop index if exists public.transaction_support_requests_one_active_per_user_order_idx;

create unique index if not exists transaction_support_requests_one_active_per_user_order_idx
  on public.transaction_support_requests (order_id, opened_by)
  where status in (
    'open'::public.support_request_status,
    'reviewing'::public.support_request_status,
    'awaiting_buyer_evidence'::public.support_request_status,
    'awaiting_seller_evidence'::public.support_request_status,
    'refund_pending'::public.support_request_status,
    'partial_refund_pending'::public.support_request_status,
    'refund_completed'::public.support_request_status
  );

-- ---------------------------------------------------------------------------
-- Active case helpers & admin filters
-- ---------------------------------------------------------------------------

create or replace function public.case_status_is_active(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    p_status in (
      'open',
      'under_review',
      'reviewing',
      'awaiting_buyer_evidence',
      'awaiting_seller_evidence',
      'return_authorised',
      'awaiting_seller_collection',
      'collection_arranged',
      'collection_confirmed',
      'ready_for_refund',
      'refund_pending',
      'partial_refund_pending',
      'refund_completed'
    ),
    false
  );
$$;

create or replace function public.case_matches_admin_filter(
  p_filter text,
  p_status text,
  p_is_active boolean
)
returns boolean
language sql
immutable
as $$
  select case coalesce(nullif(trim(p_filter), ''), 'active')
    when 'all' then true
    when 'active' then coalesce(p_is_active, false)
    when 'review' then p_status in ('open', 'under_review', 'reviewing')
    when 'awaiting_buyer' then p_status = 'awaiting_buyer_evidence'
    when 'awaiting_seller' then p_status = 'awaiting_seller_evidence'
    when 'refund' then p_status in (
      'refund_pending',
      'partial_refund_pending',
      'refund_completed',
      'ready_for_refund'
    )
    when 'closed' then not coalesce(p_is_active, false)
    else true
  end;
$$;

-- ---------------------------------------------------------------------------
-- Support trigger skip helper
-- ---------------------------------------------------------------------------

create or replace function public.set_skip_support_case_trigger(p_skip boolean)
returns void
language sql
as $$
  select set_config(
    'equipd.skip_support_case_log',
    case when p_skip then 'on' else 'off' end,
    true
  );
$$;

create or replace function public.trg_support_requests_case_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
  if TG_OP = 'UPDATE' and coalesce(current_setting('equipd.skip_support_case_log', true), '') = 'on' then
    return NEW;
  end if;

  v_message := nullif(trim(coalesce(NEW.resolution_notes, '')), '');

  if TG_OP = 'INSERT' then
    perform public.record_order_case_update(
      NEW.order_id,
      null,
      NEW.id,
      'case_opened',
      NEW.status::text,
      null,
      null,
      auth.uid()
    );
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status
      or NEW.resolution_notes is distinct from OLD.resolution_notes then
      perform public.record_order_case_update(
        NEW.order_id,
        null,
        NEW.id,
        case
          when OLD.status is distinct from NEW.status then 'admin_decision'
          else 'support_message_update'
        end,
        NEW.status::text,
        v_message,
        case
          when NEW.admin_notes is distinct from OLD.admin_notes then NEW.admin_notes
          else null
        end,
        auth.uid()
      );
    elsif NEW.admin_notes is distinct from OLD.admin_notes then
      perform public.record_order_case_update(
        NEW.order_id,
        null,
        NEW.id,
        'admin_note_update',
        NEW.status::text,
        null,
        NEW.admin_notes,
        auth.uid()
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_mark_dispute_refund_completed
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_dispute_refund_completed(
  p_dispute_id uuid,
  p_admin_note text default null,
  p_customer_message text default null,
  p_refund_reference text default null
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
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_reference text := nullif(trim(coalesce(p_refund_reference, '')), '');
  v_message text;
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

  if v_dispute.status not in ('refund_pending', 'partial_refund_pending') then
    raise exception 'Refund can only be marked completed from refund pending status';
  end if;

  v_message := coalesce(
    v_customer,
    'The refund has now been completed. Equipd will close this case once final checks are complete.'
  );

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'refund_completed',
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_message,
    refund_reference = coalesce(v_reference, refund_reference),
    refund_completed_at = now(),
    refund_completed_by = v_uid
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'refund_completed',
    'refund_completed',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_resolved_buyer',
    'Refund completed',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_resolved_buyer',
    'Refund completed',
    'The buyer refund for this order has been completed.',
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_mark_dispute_refund_completed(uuid, text, text, text) from public;
grant execute on function public.admin_mark_dispute_refund_completed(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_mark_support_refund_completed
-- ---------------------------------------------------------------------------

create or replace function public.admin_mark_support_refund_completed(
  p_request_id uuid,
  p_admin_note text default null,
  p_customer_message text default null,
  p_refund_reference text default null
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_reference text := nullif(trim(coalesce(p_refund_reference, '')), '');
  v_message text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  if v_request.status::text not in ('refund_pending', 'partial_refund_pending') then
    raise exception 'Refund can only be marked completed from refund pending status';
  end if;

  v_message := coalesce(
    v_customer,
    'The refund has now been completed. Equipd will close this case once final checks are complete.'
  );

  perform public.set_skip_support_case_trigger(true);

  update public.transaction_support_requests
  set
    status = 'refund_completed'::public.support_request_status,
    admin_notes = coalesce(v_note, admin_notes),
    resolution_notes = coalesce(v_customer, resolution_notes),
    refund_reference = coalesce(v_reference, refund_reference),
    refund_completed_at = now(),
    refund_completed_by = v_uid
  where id = p_request_id
  returning * into v_request;

  perform public.set_skip_support_case_trigger(false);

  perform public.record_order_case_update(
    v_request.order_id,
    null,
    v_request.id,
    'refund_completed',
    'refund_completed',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_request.buyer_id,
    'support_request_resolved',
    'Refund completed',
    v_message,
    '/orders/' || v_request.order_id::text
  );
  perform public.create_notification(
    v_request.seller_id,
    'support_request_resolved',
    'Refund completed',
    v_message,
    '/orders/' || v_request.order_id::text
  );

  return v_request;
end;
$$;

revoke all on function public.admin_mark_support_refund_completed(uuid, text, text, text) from public;
grant execute on function public.admin_mark_support_refund_completed(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_close_dispute_case
-- ---------------------------------------------------------------------------

create or replace function public.admin_close_dispute_case(
  p_dispute_id uuid,
  p_case_outcome text,
  p_admin_note text default null,
  p_customer_message text default null
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_order public.orders;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_outcome text := nullif(trim(coalesce(p_case_outcome, '')), '');
  v_message text;
  v_can_close boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_outcome is null or v_outcome not in (
    'buyer_upheld_full_refund',
    'buyer_upheld_partial_refund',
    'seller_upheld',
    'mutual_agreement',
    'outside_buyer_protection',
    'duplicate',
    'cancelled'
  ) then
    raise exception 'A valid case outcome is required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.case_outcome is not null then
    raise exception 'Case is already closed';
  end if;

  v_can_close := v_dispute.status in (
    'refund_completed',
    'rejected',
    'resolved',
    'resolved_buyer',
    'resolved_seller',
    'open',
    'under_review',
    'awaiting_buyer_evidence',
    'awaiting_seller_evidence'
  );

  if not v_can_close then
    raise exception 'This dispute cannot be closed in its current status';
  end if;

  select * into v_order from public.orders where id = v_dispute.order_id for update;

  v_message := coalesce(v_customer, 'This case has now been resolved and closed.');

  perform public.set_skip_dispute_case_trigger(true);

  update public.order_disputes
  set
    status = 'resolved',
    case_outcome = v_outcome,
    admin_note = coalesce(v_note, admin_note),
    customer_message = coalesce(v_customer, customer_message),
    resolution = v_message,
    resolved_at = coalesce(resolved_at, now()),
    resolved_by = coalesce(resolved_by, v_uid)
  where id = p_dispute_id
  returning * into v_dispute;

  perform public.set_skip_dispute_case_trigger(false);

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'case_closed',
    'resolved',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_dispute.buyer_id,
    'order_dispute_resolved_buyer',
    'Case closed',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );
  perform public.create_notification(
    v_dispute.seller_id,
    'order_dispute_resolved_seller',
    'Case closed',
    v_message,
    '/orders/' || v_dispute.order_id::text
  );

  return v_dispute;
end;
$$;

revoke all on function public.admin_close_dispute_case(uuid, text, text, text) from public;
grant execute on function public.admin_close_dispute_case(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_close_support_case
-- ---------------------------------------------------------------------------

create or replace function public.admin_close_support_case(
  p_request_id uuid,
  p_case_outcome text,
  p_admin_note text default null,
  p_customer_message text default null
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
  v_customer text := nullif(trim(coalesce(p_customer_message, '')), '');
  v_outcome text := nullif(trim(coalesce(p_case_outcome, '')), '');
  v_message text;
  v_can_close boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_outcome is null or v_outcome not in (
    'buyer_upheld_full_refund',
    'buyer_upheld_partial_refund',
    'seller_upheld',
    'mutual_agreement',
    'outside_buyer_protection',
    'duplicate',
    'cancelled'
  ) then
    raise exception 'A valid case outcome is required';
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  if v_request.case_outcome is not null then
    raise exception 'Case is already closed';
  end if;

  v_can_close := v_request.status::text in (
    'refund_completed',
    'rejected',
    'resolved',
    'open',
    'reviewing',
    'awaiting_buyer_evidence',
    'awaiting_seller_evidence'
  );

  if not v_can_close then
    raise exception 'This support request cannot be closed in its current status';
  end if;

  v_message := coalesce(v_customer, 'This case has now been resolved and closed.');

  perform public.set_skip_support_case_trigger(true);

  update public.transaction_support_requests
  set
    status = 'closed'::public.support_request_status,
    case_outcome = v_outcome,
    admin_notes = coalesce(v_note, admin_notes),
    resolution_notes = coalesce(v_customer, resolution_notes),
    resolved_at = coalesce(resolved_at, now()),
    reviewed_by = coalesce(reviewed_by, v_uid),
    reviewed_at = coalesce(reviewed_at, now())
  where id = p_request_id
  returning * into v_request;

  perform public.set_skip_support_case_trigger(false);

  perform public.record_order_case_update(
    v_request.order_id,
    null,
    v_request.id,
    'case_closed',
    'closed',
    v_message,
    v_note,
    v_uid
  );

  perform public.create_notification(
    v_request.buyer_id,
    'support_request_resolved',
    'Case closed',
    v_message,
    '/orders/' || v_request.order_id::text
  );
  perform public.create_notification(
    v_request.seller_id,
    'support_request_resolved',
    'Case closed',
    v_message,
    '/orders/' || v_request.order_id::text
  );

  return v_request;
end;
$$;

revoke all on function public.admin_close_support_case(uuid, text, text, text) from public;
grant execute on function public.admin_close_support_case(uuid, text, text, text) to authenticated;

-- Default admin_list_cases filter to active
create or replace function public.admin_list_cases(p_filter text default 'active')
returns table (
  case_id uuid,
  case_type text,
  order_id uuid,
  listing_title text,
  buyer_id uuid,
  buyer_display_name text,
  buyer_email text,
  seller_id uuid,
  seller_display_name text,
  seller_email text,
  reason text,
  status text,
  evidence_count integer,
  opened_at timestamptz,
  updated_at timestamptz,
  is_active boolean,
  waiting_on text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  with combined as (
    select
      d.id as case_id,
      'buyer_protection_dispute'::text as case_type,
      d.order_id,
      coalesce(l.title, 'Listing unavailable') as listing_title,
      d.buyer_id,
      buyer_contact.display_name as buyer_display_name,
      buyer_contact.email as buyer_email,
      d.seller_id,
      seller_contact.display_name as seller_display_name,
      seller_contact.email as seller_email,
      d.reason,
      d.status,
      (
        coalesce(cardinality(d.evidence_paths), 0)
        + coalesce(cardinality(d.seller_response_evidence_paths), 0)
      )::integer as evidence_count,
      d.created_at as opened_at,
      d.updated_at,
      public.case_status_is_active(d.status) as is_active,
      public.case_waiting_on_label(
        d.status,
        public.case_status_is_active(d.status)
      ) as waiting_on
    from public.order_disputes d
    left join public.listings l on l.id = d.listing_id
    left join lateral public.support_team_user_contact(d.buyer_id) buyer_contact on true
    left join lateral public.support_team_user_contact(d.seller_id) seller_contact on true

    union all

    select
      r.id as case_id,
      'support_request'::text as case_type,
      r.order_id,
      coalesce(l.title, 'Listing unavailable') as listing_title,
      r.buyer_id,
      buyer_contact.display_name as buyer_display_name,
      buyer_contact.email as buyer_email,
      r.seller_id,
      seller_contact.display_name as seller_display_name,
      seller_contact.email as seller_email,
      r.reason::text,
      r.status::text,
      coalesce(cardinality(r.evidence_paths), 0)::integer as evidence_count,
      r.created_at as opened_at,
      r.updated_at,
      public.case_status_is_active(r.status::text) as is_active,
      public.case_waiting_on_label(
        r.status::text,
        public.case_status_is_active(r.status::text)
      ) as waiting_on
    from public.transaction_support_requests r
    left join public.listings l on l.id = r.listing_id
    left join lateral public.support_team_user_contact(r.buyer_id) buyer_contact on true
    left join lateral public.support_team_user_contact(r.seller_id) seller_contact on true
  )
  select
    c.case_id,
    c.case_type,
    c.order_id,
    c.listing_title,
    c.buyer_id,
    c.buyer_display_name,
    c.buyer_email,
    c.seller_id,
    c.seller_display_name,
    c.seller_email,
    c.reason,
    c.status,
    c.evidence_count,
    c.opened_at,
    c.updated_at,
    c.is_active,
    c.waiting_on
  from combined c
  where public.case_matches_admin_filter(p_filter, c.status, c.is_active)
  order by
    c.is_active desc,
    case when c.is_active then c.updated_at end asc nulls last,
    c.opened_at desc;
end;
$$;

revoke all on function public.admin_list_cases(text) from public;
grant execute on function public.admin_list_cases(text) to authenticated;
