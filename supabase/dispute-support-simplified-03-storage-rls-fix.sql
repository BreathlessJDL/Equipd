-- =============================================================================
-- Fix order-evidence Storage RLS after orders SELECT revoked from clients
-- =============================================================================
--
-- Run after dispute-support-simplified-02-schema-functions.sql (and
-- prelaunch-security-fixes.sql, which revokes SELECT on public.orders).
--
-- Problem: policies that query public.orders directly fail with
-- "permission denied for table orders" because authenticated users read orders
-- via orders_client / RPCs only.
--
-- Fix: SECURITY DEFINER helpers + storage policies that call them.

-- ---------------------------------------------------------------------------
-- Support evidence upload helper
-- Path: {order_id}/support/{request_id}/{filename}
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
    -- Initial upload before create_transaction_support_request commits the row.
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

-- Ensure dispute evidence helper exists (from prelaunch-security-fixes.sql).
create or replace function public.storage_buyer_can_upload_dispute_evidence(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.buyer_id = p_user_id
      and o.fulfilment_status in (
        'collected'::public.order_fulfilment_status,
        'delivered'::public.order_fulfilment_status
      )
      and o.payout_release_at is not null
      and o.payout_release_at > now()
      and o.payout_released_at is null
      and o.fulfilment_status not in (
        'disputed'::public.order_fulfilment_status,
        'refunded'::public.order_fulfilment_status,
        'cancelled'::public.order_fulfilment_status,
        'completed'::public.order_fulfilment_status
      )
      and not exists (
        select 1
        from public.order_disputes d
        where d.order_id = o.id
          and d.status in ('open', 'under_review')
      )
  );
$$;

revoke all on function public.storage_buyer_can_upload_dispute_evidence(uuid, uuid) from public;
grant execute on function public.storage_buyer_can_upload_dispute_evidence(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage policies (order-evidence bucket)
-- ---------------------------------------------------------------------------

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

drop policy if exists "Buyer can upload dispute evidence" on storage.objects;

create policy "Buyer can upload dispute evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and (storage.foldername(name))[2] = 'disputes'
    and public.storage_buyer_can_upload_dispute_evidence(((storage.foldername(name))[1])::uuid)
  );
