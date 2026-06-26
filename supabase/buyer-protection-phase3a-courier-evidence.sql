-- Equipd Buyer Protection / Order Lifecycle — Phase 3A (Courier handover evidence)
-- Run after buyer-protection-phase2-collection-qr.sql
-- Safe to re-run (idempotent where possible).

-- ---------------------------------------------------------------------------
-- Courier evidence columns on orders
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists courier_evidence_video_url text,
  add column if not exists courier_pre_collection_photo_url text,
  add column if not exists courier_handover_photo_url text,
  add column if not exists courier_name text,
  add column if not exists courier_company text,
  add column if not exists courier_tracking_reference text,
  add column if not exists courier_signature_name text,
  add column if not exists courier_signature_data text,
  add column if not exists courier_signed_at timestamptz,
  add column if not exists courier_collected_at timestamptz,
  add column if not exists courier_evidence_submitted_at timestamptz,
  add column if not exists courier_evidence_submitted_by uuid references auth.users (id);

-- ---------------------------------------------------------------------------
-- Private storage bucket: order-evidence
-- Path convention: {order_id}/{kind}/{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-evidence',
  'order-evidence',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Order participants can read order evidence" on storage.objects;
drop policy if exists "Seller can upload order evidence" on storage.objects;
drop policy if exists "Seller can update order evidence uploads" on storage.objects;
drop policy if exists "Seller can delete order evidence uploads" on storage.objects;

create policy "Order participants can read order evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
  );

create policy "Seller can upload order evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-evidence'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.seller_id = auth.uid()
        and o.order_type = 'buyer_courier'::public.order_type
        and o.fulfilment_status = 'awaiting_courier_collection'::public.order_fulfilment_status
    )
  );

create policy "Seller can update order evidence uploads"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.seller_id = auth.uid()
        and o.order_type = 'buyer_courier'::public.order_type
        and o.fulfilment_status = 'awaiting_courier_collection'::public.order_fulfilment_status
    )
  )
  with check (
    bucket_id = 'order-evidence'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.seller_id = auth.uid()
    )
  );

create policy "Seller can delete order evidence uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.seller_id = auth.uid()
        and o.order_type = 'buyer_courier'::public.order_type
        and o.fulfilment_status = 'awaiting_courier_collection'::public.order_fulfilment_status
    )
  );

-- ---------------------------------------------------------------------------
-- Seller submits courier handover evidence
-- ---------------------------------------------------------------------------

create or replace function public.submit_courier_handover_evidence(
  p_order_id uuid,
  p_payload jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_listing_title text;
  v_video_path text;
  v_pre_photo_path text;
  v_handover_photo_path text;
  v_courier_name text;
  v_courier_company text;
  v_tracking_reference text;
  v_signature_name text;
  v_signature_data text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Evidence payload is required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.seller_id <> v_uid then
    raise exception 'Only the seller can submit courier handover evidence';
  end if;

  if coalesce(v_order.order_type, 'collection'::public.order_type) <> 'buyer_courier'::public.order_type then
    raise exception 'Courier evidence is only required for buyer-organised courier orders';
  end if;

  if v_order.fulfilment_status <> 'awaiting_courier_collection'::public.order_fulfilment_status then
    raise exception 'Courier evidence can only be submitted while awaiting courier collection';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before submitting courier evidence';
  end if;

  v_video_path := nullif(trim(p_payload ->> 'courier_evidence_video_url'), '');
  v_pre_photo_path := nullif(trim(p_payload ->> 'courier_pre_collection_photo_url'), '');
  v_handover_photo_path := nullif(trim(p_payload ->> 'courier_handover_photo_url'), '');
  v_courier_name := nullif(trim(p_payload ->> 'courier_name'), '');
  v_courier_company := nullif(trim(p_payload ->> 'courier_company'), '');
  v_tracking_reference := nullif(trim(p_payload ->> 'courier_tracking_reference'), '');
  v_signature_name := nullif(trim(p_payload ->> 'courier_signature_name'), '');
  v_signature_data := nullif(trim(p_payload ->> 'courier_signature_data'), '');

  if v_video_path is null then
    raise exception 'Condition video is required';
  end if;

  if v_pre_photo_path is null then
    raise exception 'Pre-collection photo is required';
  end if;

  if v_handover_photo_path is null then
    raise exception 'Handover/loading photo is required';
  end if;

  if v_courier_name is null and v_courier_company is null then
    raise exception 'Courier name or courier company is required';
  end if;

  if v_tracking_reference is null then
    raise exception 'Tracking reference is required';
  end if;

  if v_signature_name is null then
    raise exception 'Courier signed name is required';
  end if;

  if v_signature_data is null then
    raise exception 'Courier signature is required';
  end if;

  update public.orders
  set
    courier_evidence_video_url = v_video_path,
    courier_pre_collection_photo_url = v_pre_photo_path,
    courier_handover_photo_url = v_handover_photo_path,
    courier_name = v_courier_name,
    courier_company = v_courier_company,
    courier_tracking_reference = v_tracking_reference,
    courier_signature_name = v_signature_name,
    courier_signature_data = v_signature_data,
    courier_signed_at = coalesce(
      nullif(p_payload ->> 'courier_signed_at', '')::timestamptz,
      now()
    ),
    courier_collected_at = now(),
    courier_evidence_submitted_at = now(),
    courier_evidence_submitted_by = v_uid,
    fulfilment_status = 'in_transit'::public.order_fulfilment_status,
    payout_status = 'not_due'::public.payout_status,
    payout_release_at = null
  where id = p_order_id;

  select l.title
  into v_listing_title
  from public.listings l
  where l.id = v_order.listing_id;

  perform public.create_notification(
    v_order.buyer_id,
    'courier_collection_confirmed',
    'Courier collection confirmed',
    'The seller has submitted courier handover evidence for '
      || coalesce(v_listing_title, 'your order')
      || '. Your item is now in transit.',
    '/orders/' || v_order.id::text
  );

  perform public.create_notification(
    v_order.seller_id,
    'courier_evidence_submitted',
    'Courier handover evidence submitted',
    'Your courier handover evidence for '
      || coalesce(v_listing_title, 'this order')
      || ' has been saved. The order is now in transit.',
    '/orders/' || v_order.id::text
  );

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.submit_courier_handover_evidence(uuid, jsonb) from public;
grant execute on function public.submit_courier_handover_evidence(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
