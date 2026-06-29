-- =============================================================================
-- Equipd Case Management — Phase 1 (admin list + order_case_updates history)
-- =============================================================================
--
-- Prerequisites: dispute-support-simplified-02-schema-functions.sql
--
-- Adds:
--   - order_case_updates table
--   - record_order_case_update() helper
--   - fetch_order_case_updates() for order participants + admins
--   - admin_list_cases() unified admin queue
--   - Hooks admin_apply_dispute_decision / admin_apply_support_decision to log updates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- order_case_updates
-- ---------------------------------------------------------------------------

create table if not exists public.order_case_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  dispute_id uuid references public.order_disputes (id) on delete set null,
  support_request_id uuid references public.transaction_support_requests (id) on delete set null,
  event_type text not null,
  status text not null,
  message_to_customer text,
  internal_note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint order_case_updates_event_type_not_empty
    check (char_length(trim(event_type)) > 0),
  constraint order_case_updates_status_not_empty
    check (char_length(trim(status)) > 0)
);

create index if not exists order_case_updates_order_created_idx
  on public.order_case_updates (order_id, created_at desc);

create index if not exists order_case_updates_dispute_created_idx
  on public.order_case_updates (dispute_id, created_at desc)
  where dispute_id is not null;

create index if not exists order_case_updates_support_created_idx
  on public.order_case_updates (support_request_id, created_at desc)
  where support_request_id is not null;

alter table public.order_case_updates enable row level security;

-- All reads/writes go through security definer RPCs.

-- ---------------------------------------------------------------------------
-- Helpers
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
      'refund_pending',
      'partial_refund_pending'
    ),
    false
  );
$$;

create or replace function public.case_waiting_on_label(p_status text, p_is_active boolean)
returns text
language sql
immutable
as $$
  select case
    when not coalesce(p_is_active, false) then 'none'
    when p_status = 'awaiting_buyer_evidence' then 'buyer'
    when p_status = 'awaiting_seller_evidence' then 'seller'
    else 'equipd'
  end;
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
  select case coalesce(nullif(trim(p_filter), ''), 'all')
    when 'all' then true
    when 'review' then p_status in ('open', 'under_review', 'reviewing')
    when 'awaiting_buyer' then p_status = 'awaiting_buyer_evidence'
    when 'awaiting_seller' then p_status = 'awaiting_seller_evidence'
    when 'refund' then p_status in ('refund_pending', 'partial_refund_pending')
    when 'closed' then not coalesce(p_is_active, false)
    else true
  end;
$$;

create or replace function public.record_order_case_update(
  p_order_id uuid,
  p_dispute_id uuid,
  p_support_request_id uuid,
  p_event_type text,
  p_status text,
  p_message_to_customer text default null,
  p_internal_note text default null,
  p_created_by uuid default auth.uid()
)
returns public.order_case_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.order_case_updates;
begin
  insert into public.order_case_updates (
    order_id,
    dispute_id,
    support_request_id,
    event_type,
    status,
    message_to_customer,
    internal_note,
    created_by
  )
  values (
    p_order_id,
    p_dispute_id,
    p_support_request_id,
    trim(p_event_type),
    trim(p_status),
    nullif(trim(coalesce(p_message_to_customer, '')), ''),
    nullif(trim(coalesce(p_internal_note, '')), ''),
    p_created_by
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.record_order_case_update(
  uuid, uuid, uuid, text, text, text, text, uuid
) from public;

-- ---------------------------------------------------------------------------
-- fetch_order_case_updates — participants + admins
-- ---------------------------------------------------------------------------

create or replace function public.fetch_order_case_updates(p_order_id uuid)
returns table (
  id uuid,
  order_id uuid,
  dispute_id uuid,
  support_request_id uuid,
  event_type text,
  status text,
  message_to_customer text,
  internal_note text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not v_is_admin and not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = v_uid or o.seller_id = v_uid)
  ) then
    raise exception 'You do not have access to this order';
  end if;

  return query
  select
    u.id,
    u.order_id,
    u.dispute_id,
    u.support_request_id,
    u.event_type,
    u.status,
    u.message_to_customer,
    case when v_is_admin then u.internal_note else null end as internal_note,
    u.created_by,
    u.created_at
  from public.order_case_updates u
  where u.order_id = p_order_id
  order by u.created_at asc;
end;
$$;

revoke all on function public.fetch_order_case_updates(uuid) from public;
grant execute on function public.fetch_order_case_updates(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_list_cases
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_cases(text);

create or replace function public.admin_list_cases(p_filter text default 'all')
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

-- ---------------------------------------------------------------------------
-- Triggers: log case updates on dispute / support lifecycle changes
-- ---------------------------------------------------------------------------

create or replace function public.trg_order_disputes_case_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
  v_status text;
begin
  v_message := coalesce(
    nullif(trim(NEW.customer_message), ''),
    nullif(trim(NEW.resolution), '')
  );

  if TG_OP = 'INSERT' then
    if coalesce(cardinality(NEW.evidence_paths), 0) >= 1 then
      v_status := 'evidence_received';
      v_message :=
        'Your dispute has been raised and your evidence has been received. Equipd support will review the information provided and contact you if anything else is needed.';
    else
      v_status := 'awaiting_buyer_evidence';
      v_message :=
        'Your dispute has been raised. Please upload supporting evidence so Equipd can review the issue.';
    end if;

    perform public.record_order_case_update(
      NEW.order_id,
      NEW.id,
      null,
      'case_opened',
      v_status,
      v_message,
      null,
      auth.uid()
    );
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status
      or NEW.customer_message is distinct from OLD.customer_message
      or NEW.resolution is distinct from OLD.resolution then
      perform public.record_order_case_update(
        NEW.order_id,
        NEW.id,
        null,
        case
          when OLD.status is distinct from NEW.status then 'admin_decision'
          else 'support_message_update'
        end,
        NEW.status,
        v_message,
        case
          when NEW.admin_note is distinct from OLD.admin_note then NEW.admin_note
          else null
        end,
        auth.uid()
      );
    elsif NEW.admin_note is distinct from OLD.admin_note then
      perform public.record_order_case_update(
        NEW.order_id,
        NEW.id,
        null,
        'admin_note_update',
        NEW.status,
        null,
        NEW.admin_note,
        auth.uid()
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists order_disputes_record_case_update on public.order_disputes;

create trigger order_disputes_record_case_update
  after insert or update on public.order_disputes
  for each row execute function public.trg_order_disputes_case_update();

create or replace function public.trg_support_requests_case_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
begin
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

drop trigger if exists support_requests_record_case_update on public.transaction_support_requests;

create trigger support_requests_record_case_update
  after insert or update on public.transaction_support_requests
  for each row execute function public.trg_support_requests_case_update();

-- ---------------------------------------------------------------------------
-- Backfill: case_opened events for existing disputes / support requests
-- ---------------------------------------------------------------------------

insert into public.order_case_updates (
  order_id,
  dispute_id,
  support_request_id,
  event_type,
  status,
  message_to_customer,
  internal_note,
  created_by,
  created_at
)
select
  d.order_id,
  d.id,
  null,
  'case_opened',
  d.status,
  null,
  null,
  d.buyer_id,
  d.created_at
from public.order_disputes d
where not exists (
  select 1
  from public.order_case_updates u
  where u.dispute_id = d.id
    and u.event_type = 'case_opened'
);

insert into public.order_case_updates (
  order_id,
  dispute_id,
  support_request_id,
  event_type,
  status,
  message_to_customer,
  internal_note,
  created_by,
  created_at
)
select
  r.order_id,
  null,
  r.id,
  'case_opened',
  r.status::text,
  null,
  null,
  r.opened_by,
  r.created_at
from public.transaction_support_requests r
where not exists (
  select 1
  from public.order_case_updates u
  where u.support_request_id = r.id
    and u.event_type = 'case_opened'
);

-- Backfill latest customer-facing message as a support update where present.

insert into public.order_case_updates (
  order_id,
  dispute_id,
  support_request_id,
  event_type,
  status,
  message_to_customer,
  internal_note,
  created_by,
  created_at
)
select
  d.order_id,
  d.id,
  null,
  'legacy_support_update',
  d.status,
  coalesce(nullif(trim(d.customer_message), ''), nullif(trim(d.resolution), '')),
  null,
  d.resolved_by,
  coalesce(d.updated_at, d.created_at)
from public.order_disputes d
where coalesce(nullif(trim(d.customer_message), ''), nullif(trim(d.resolution), '')) is not null
  and not exists (
    select 1
    from public.order_case_updates u
    where u.dispute_id = d.id
      and u.event_type = 'legacy_support_update'
  );

insert into public.order_case_updates (
  order_id,
  dispute_id,
  support_request_id,
  event_type,
  status,
  message_to_customer,
  internal_note,
  created_by,
  created_at
)
select
  r.order_id,
  null,
  r.id,
  'legacy_support_update',
  r.status::text,
  nullif(trim(r.resolution_notes), ''),
  null,
  r.reviewed_by,
  coalesce(r.updated_at, r.created_at)
from public.transaction_support_requests r
where nullif(trim(r.resolution_notes), '') is not null
  and not exists (
    select 1
    from public.order_case_updates u
    where u.support_request_id = r.id
      and u.event_type = 'legacy_support_update'
  );
