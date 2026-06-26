-- Equipd Trust & Safety Phase 2 — listing/user/conversation reporting
-- Run after messaging.sql and admin-support-tools.sql
--
-- Adds reports table, create_report() RPC, and admin list/update RPCs.
-- Does not auto-hide listings/users or suspend accounts.

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  report_type text not null,
  reason text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  admin_note text,
  constraint reports_report_type_allowed check (
    report_type in ('listing', 'user', 'conversation', 'message')
  ),
  constraint reports_status_allowed check (
    status in ('open', 'under_review', 'resolved', 'dismissed')
  ),
  constraint reports_has_target check (
    reported_user_id is not null
    or listing_id is not null
    or conversation_id is not null
    or message_id is not null
  ),
  constraint reports_reason_allowed check (
    reason in (
      'suspected_fraud',
      'misleading_listing',
      'prohibited_item',
      'duplicate_listing',
      'incorrect_category',
      'offensive_content',
      'requested_off_platform_payment',
      'suspicious_behaviour',
      'harassment',
      'no_show',
      'abusive_language',
      'fraud',
      'shared_contact_details',
      'other'
    )
  )
);

create index reports_status_created_idx
  on public.reports (status, created_at desc);

create index reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);

create unique index reports_one_open_listing_per_reporter_idx
  on public.reports (reporter_id, listing_id)
  where status = 'open' and listing_id is not null;

create unique index reports_one_open_user_per_reporter_idx
  on public.reports (reporter_id, reported_user_id)
  where status = 'open' and report_type = 'user' and reported_user_id is not null;

create unique index reports_one_open_conversation_per_reporter_idx
  on public.reports (reporter_id, conversation_id)
  where status = 'open' and conversation_id is not null;

create unique index reports_one_open_message_per_reporter_idx
  on public.reports (reporter_id, message_id)
  where status = 'open' and message_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;

create policy "Reporters can read own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

create policy "Admins can read all reports"
  on public.reports for select
  to authenticated
  using (public.is_admin());

-- Inserts and updates go through RPCs only.

-- ---------------------------------------------------------------------------
-- Create a marketplace report
-- ---------------------------------------------------------------------------

create or replace function public.create_report(
  p_report_type text,
  p_reason text,
  p_description text default null,
  p_reported_user_id uuid default null,
  p_listing_id uuid default null,
  p_conversation_id uuid default null,
  p_message_id uuid default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_description text := nullif(trim(p_description), '');
  v_listing public.listings;
  v_conversation public.conversations;
  v_message public.messages;
  v_reported_user_id uuid := p_reported_user_id;
  v_report public.reports;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_report_type not in ('listing', 'user', 'conversation', 'message') then
    raise exception 'Invalid report type';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Please choose a reason';
  end if;

  if p_reason = 'other' and v_description is null then
    raise exception 'Please describe the issue when selecting Other';
  end if;

  if p_report_type = 'listing' then
    if p_reason not in (
      'suspected_fraud',
      'misleading_listing',
      'prohibited_item',
      'duplicate_listing',
      'incorrect_category',
      'offensive_content',
      'other'
    ) then
      raise exception 'Invalid reason for listing report';
    end if;

    if p_listing_id is null then
      raise exception 'Listing is required';
    end if;

    select *
    into v_listing
    from public.listings
    where id = p_listing_id;

    if not found then
      raise exception 'Listing not found';
    end if;

    if v_listing.seller_id = v_uid then
      raise exception 'You cannot report your own listing';
    end if;

    v_reported_user_id := v_listing.seller_id;
  elsif p_report_type = 'user' then
    if p_reason not in (
      'requested_off_platform_payment',
      'suspicious_behaviour',
      'harassment',
      'no_show',
      'abusive_language',
      'fraud',
      'other'
    ) then
      raise exception 'Invalid reason for user report';
    end if;

    if v_reported_user_id is null then
      raise exception 'User is required';
    end if;

    if v_reported_user_id = v_uid then
      raise exception 'You cannot report yourself';
    end if;

    if not exists (select 1 from public.profiles where id = v_reported_user_id) then
      raise exception 'User not found';
    end if;
  elsif p_report_type in ('conversation', 'message') then
    if p_reason not in (
      'requested_off_platform_payment',
      'shared_contact_details',
      'harassment',
      'abusive_language',
      'suspicious_behaviour',
      'other'
    ) then
      raise exception 'Invalid reason for conversation report';
    end if;

    if p_report_type = 'conversation' then
      if p_conversation_id is null then
        raise exception 'Conversation is required';
      end if;

      select *
      into v_conversation
      from public.conversations
      where id = p_conversation_id;

      if not found then
        raise exception 'Conversation not found';
      end if;

      if v_conversation.buyer_id <> v_uid and v_conversation.seller_id <> v_uid then
        raise exception 'You are not a participant in this conversation';
      end if;

      v_reported_user_id := case
        when v_conversation.buyer_id = v_uid then v_conversation.seller_id
        else v_conversation.buyer_id
      end;
    else
      if p_message_id is null then
        raise exception 'Message is required';
      end if;

      select *
      into v_message
      from public.messages
      where id = p_message_id;

      if not found then
        raise exception 'Message not found';
      end if;

      select *
      into v_conversation
      from public.conversations
      where id = v_message.conversation_id;

      if v_conversation.buyer_id <> v_uid and v_conversation.seller_id <> v_uid then
        raise exception 'You are not a participant in this conversation';
      end if;

      v_reported_user_id := case
        when v_conversation.buyer_id = v_uid then v_conversation.seller_id
        else v_conversation.buyer_id
      end;
    end if;
  end if;

  if exists (
    select 1
    from public.reports r
    where r.reporter_id = v_uid
      and r.status = 'open'
      and (
        (p_listing_id is not null and r.listing_id = p_listing_id)
        or (
          p_report_type = 'user'
          and v_reported_user_id is not null
          and r.reported_user_id = v_reported_user_id
          and r.report_type = 'user'
        )
        or (p_conversation_id is not null and r.conversation_id = p_conversation_id)
        or (p_message_id is not null and r.message_id = p_message_id)
      )
  ) then
    raise exception 'You already have an open report for this item';
  end if;

  insert into public.reports (
    reporter_id,
    reported_user_id,
    listing_id,
    conversation_id,
    message_id,
    report_type,
    reason,
    description
  )
  values (
    v_uid,
    v_reported_user_id,
    p_listing_id,
    p_conversation_id,
    p_message_id,
    p_report_type,
    p_reason,
    v_description
  )
  returning * into v_report;

  return v_report;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check for an open report (reporter only)
-- ---------------------------------------------------------------------------

create or replace function public.has_open_report(
  p_report_type text,
  p_reported_user_id uuid default null,
  p_listing_id uuid default null,
  p_conversation_id uuid default null,
  p_message_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1
    from public.reports r
    where r.reporter_id = v_uid
      and r.status = 'open'
      and (
        (p_listing_id is not null and r.listing_id = p_listing_id)
        or (
          p_report_type = 'user'
          and p_reported_user_id is not null
          and r.reported_user_id = p_reported_user_id
          and r.report_type = 'user'
        )
        or (p_conversation_id is not null and r.conversation_id = p_conversation_id)
        or (p_message_id is not null and r.message_id = p_message_id)
      )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin list reports
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_reports(
  p_status text default null
)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_display_name text,
  reported_user_id uuid,
  reported_user_display_name text,
  listing_id uuid,
  listing_title text,
  conversation_id uuid,
  message_id uuid,
  report_type text,
  reason text,
  description text,
  status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_note text
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
  select
    r.id,
    r.reporter_id,
    reporter.display_name as reporter_display_name,
    r.reported_user_id,
    reported.display_name as reported_user_display_name,
    r.listing_id,
    l.title as listing_title,
    r.conversation_id,
    r.message_id,
    r.report_type,
    r.reason,
    r.description,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.reviewed_by,
    r.admin_note
  from public.reports r
  left join public.profiles reporter on reporter.id = r.reporter_id
  left join public.profiles reported on reported.id = r.reported_user_id
  left join public.listings l on l.id = r.listing_id
  where p_status is null or r.status = p_status
  order by r.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin update report status
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_report_status(
  p_report_id uuid,
  p_status text,
  p_admin_note text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('open', 'under_review', 'resolved', 'dismissed') then
    raise exception 'Invalid status';
  end if;

  update public.reports
  set
    status = p_status,
    admin_note = nullif(trim(p_admin_note), ''),
    reviewed_at = case
      when p_status in ('resolved', 'dismissed', 'under_review') then now()
      else reviewed_at
    end,
    reviewed_by = case
      when p_status in ('resolved', 'dismissed', 'under_review') then auth.uid()
      else reviewed_by
    end
  where id = p_report_id
  returning * into v_report;

  if not found then
    raise exception 'Report not found';
  end if;

  return v_report;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_report(
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid
) from public;
grant execute on function public.create_report(
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid
) to authenticated;

revoke all on function public.has_open_report(text, uuid, uuid, uuid, uuid) from public;
grant execute on function public.has_open_report(text, uuid, uuid, uuid, uuid) to authenticated;

revoke all on function public.admin_list_reports(text) from public;
grant execute on function public.admin_list_reports(text) to authenticated;

revoke all on function public.admin_update_report_status(uuid, text, text) from public;
grant execute on function public.admin_update_report_status(uuid, text, text) to authenticated;
