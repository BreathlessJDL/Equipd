-- =============================================================================
-- Equipd Case Management — Additional evidence uploads on active cases
-- =============================================================================
--
-- Allows buyer and seller to upload extra evidence to an active dispute or
-- support request without opening a duplicate ticket.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage: participants can upload to active dispute folders
-- ---------------------------------------------------------------------------

create or replace function public.storage_participant_can_upload_dispute_case_evidence(
  p_order_id uuid,
  p_dispute_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.order_disputes d
    where d.id = p_dispute_id
      and d.order_id = p_order_id
      and (d.buyer_id = p_user_id or d.seller_id = p_user_id)
      and d.status in (
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
      )
  );
$$;

revoke all on function public.storage_participant_can_upload_dispute_case_evidence(uuid, uuid, uuid) from public;
grant execute on function public.storage_participant_can_upload_dispute_case_evidence(uuid, uuid, uuid) to authenticated;

drop policy if exists "Participants can upload dispute case evidence" on storage.objects;
drop policy if exists "Buyer can upload dispute evidence" on storage.objects;
drop policy if exists "Participants can upload dispute evidence" on storage.objects;

create policy "Participants can upload dispute evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'disputes'
    and (storage.foldername(name))[3] is not null
    and (
      public.storage_participant_can_upload_dispute_case_evidence(
        ((storage.foldername(name))[1])::uuid,
        ((storage.foldername(name))[3])::uuid,
        auth.uid()
      )
      or public.storage_buyer_can_upload_dispute_evidence(
        ((storage.foldername(name))[1])::uuid,
        auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Narrow courier-only seller upload policy (avoid matching dispute paths)
-- ---------------------------------------------------------------------------

drop policy if exists "Seller can upload order evidence" on storage.objects;

create policy "Seller can upload order evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'courier'
    and public.storage_seller_can_upload_courier_evidence(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------------
-- Storage: broaden support evidence uploads for active cases
-- ---------------------------------------------------------------------------

create or replace function public.storage_participant_can_upload_support_evidence(
  p_order_id uuid,
  p_request_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_request public.transaction_support_requests;
begin
  if p_user_id is null or p_order_id is null or p_request_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = p_user_id or o.seller_id = p_user_id)
  ) then
    return false;
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
    and order_id = p_order_id;

  if not found then
    return true;
  end if;

  if not public.case_status_is_active(v_request.status::text) then
    return false;
  end if;

  return v_request.buyer_id = p_user_id or v_request.seller_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- append_order_dispute_evidence
-- ---------------------------------------------------------------------------

create or replace function public.append_order_dispute_evidence(
  p_dispute_id uuid,
  p_evidence_paths text[]
)
returns public.order_disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dispute public.order_disputes;
  v_path text;
  v_path_prefix text;
  v_total int;
  v_message text := 'Additional evidence has been uploaded and will be reviewed by Equipd support.';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_evidence_paths is null or cardinality(p_evidence_paths) < 1 then
    raise exception 'At least one evidence file is required';
  end if;

  select *
  into v_dispute
  from public.order_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if not public.case_status_is_active(v_dispute.status) then
    raise exception 'Evidence cannot be added to a closed dispute';
  end if;

  if v_uid <> v_dispute.buyer_id and v_uid <> v_dispute.seller_id then
    raise exception 'You do not have access to this dispute';
  end if;

  v_path_prefix := v_dispute.order_id::text || '/disputes/' || v_dispute.id::text || '/';

  foreach v_path in array p_evidence_paths loop
    if v_path is null or v_path !~ ('^' || v_path_prefix) then
      raise exception 'Invalid dispute evidence path';
    end if;
  end loop;

  if v_uid = v_dispute.seller_id then
    v_total := coalesce(cardinality(v_dispute.seller_response_evidence_paths), 0)
      + cardinality(p_evidence_paths);
    if v_total > 8 then
      raise exception 'A maximum of 8 evidence files is allowed';
    end if;

    update public.order_disputes
    set seller_response_evidence_paths = coalesce(seller_response_evidence_paths, '{}'::text[])
      || p_evidence_paths
    where id = p_dispute_id
    returning * into v_dispute;
  else
    v_total := coalesce(cardinality(v_dispute.evidence_paths), 0) + cardinality(p_evidence_paths);
    if v_total > 8 then
      raise exception 'A maximum of 8 evidence files is allowed';
    end if;

    update public.order_disputes
    set evidence_paths = evidence_paths || p_evidence_paths
    where id = p_dispute_id
    returning * into v_dispute;
  end if;

  perform public.record_order_case_update(
    v_dispute.order_id,
    v_dispute.id,
    null,
    'additional_evidence',
    'additional_evidence_uploaded',
    v_message,
    null,
    v_uid
  );

  return v_dispute;
end;
$$;

revoke all on function public.append_order_dispute_evidence(uuid, text[]) from public;
grant execute on function public.append_order_dispute_evidence(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- append_support_request_evidence — active cases + history entry
-- ---------------------------------------------------------------------------

create or replace function public.append_support_request_evidence(
  p_request_id uuid,
  p_evidence_paths text[]
)
returns public.transaction_support_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.transaction_support_requests;
  v_path text;
  v_path_prefix text;
  v_total int;
  v_message text := 'Additional evidence has been uploaded and will be reviewed by Equipd support.';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_evidence_paths is null or cardinality(p_evidence_paths) < 1 then
    raise exception 'At least one evidence file is required';
  end if;

  select *
  into v_request
  from public.transaction_support_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;

  if not public.case_status_is_active(v_request.status::text) then
    raise exception 'Evidence cannot be added to a closed support request';
  end if;

  if v_uid <> v_request.buyer_id and v_uid <> v_request.seller_id then
    raise exception 'You do not have access to this support request';
  end if;

  v_path_prefix := v_request.order_id::text || '/support/' || v_request.id::text || '/';

  foreach v_path in array p_evidence_paths loop
    if v_path is null or v_path !~ ('^' || v_path_prefix) then
      raise exception 'Invalid support evidence path';
    end if;
  end loop;

  v_total := cardinality(v_request.evidence_paths) + cardinality(p_evidence_paths);
  if v_total > 8 then
    raise exception 'A maximum of 8 evidence files is allowed';
  end if;

  update public.transaction_support_requests
  set
    evidence_paths = evidence_paths || p_evidence_paths,
    status = case
      when status in (
        'awaiting_buyer_evidence'::public.support_request_status,
        'awaiting_seller_evidence'::public.support_request_status
      ) then 'reviewing'::public.support_request_status
      else status
    end
  where id = p_request_id
  returning * into v_request;

  perform public.record_order_case_update(
    v_request.order_id,
    null,
    v_request.id,
    'additional_evidence',
    'additional_evidence_uploaded',
    v_message,
    null,
    v_uid
  );

  return v_request;
end;
$$;
