-- Support/dispute evidence storage RLS after orders SELECT revoke
-- Promoted from dispute-support-simplified-03-storage-rls-fix.sql

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

  if v_request.status = 'awaiting_buyer_evidence'::public.support_request_status then
    return v_request.buyer_id = p_user_id;
  end if;

  if v_request.status = 'awaiting_seller_evidence'::public.support_request_status then
    return v_request.seller_id = p_user_id;
  end if;

  if v_request.status in (
    'open'::public.support_request_status,
    'reviewing'::public.support_request_status
  ) then
    return v_request.opened_by = p_user_id;
  end if;

  return false;
end;
$$;

revoke all on function public.storage_participant_can_upload_support_evidence(uuid, uuid, uuid) from public;
grant execute on function public.storage_participant_can_upload_support_evidence(uuid, uuid, uuid) to authenticated;

drop policy if exists "Participants can upload support evidence" on storage.objects;

create policy "Participants can upload support evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'support'
    and (storage.foldername(name))[3] is not null
    and public.storage_participant_can_upload_support_evidence(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[3])::uuid
    )
  );

notify pgrst, 'reload schema';
