-- Collection / handover QR default validity: 30 days
-- Run after buyer-protection-seller-delivery-handover-qr.sql
--
-- QR links remain valid until expiry, collection, cancellation, or order completion.
-- Expired tokens are replaced automatically on the next generate_collection_qr_token call.

create or replace function public.generate_collection_qr_token(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_token text;
  v_expires_at timestamptz;
  v_order_type public.order_type;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
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
    raise exception 'Only the seller can generate a handover QR code for this order';
  end if;

  v_order_type := coalesce(v_order.order_type, 'collection'::public.order_type);

  if not public.is_in_person_handover_order_type(v_order_type) then
    raise exception 'Handover QR is only available for in-person handover orders';
  end if;

  if v_order.fulfilment_status in (
    'collected'::public.order_fulfilment_status,
    'completed'::public.order_fulfilment_status,
    'cancelled'::public.order_fulfilment_status
  ) then
    raise exception 'Handover QR is no longer available for this order';
  end if;

  if v_order_type = 'collection'::public.order_type
     and v_order.fulfilment_status not in (
       'awaiting_collection'::public.order_fulfilment_status,
       'paid'::public.order_fulfilment_status
     ) then
    raise exception 'Collection QR can only be generated while awaiting collection';
  end if;

  if v_order_type = 'seller_delivery'::public.order_type
     and v_order.fulfilment_status <> 'awaiting_seller_delivery'::public.order_fulfilment_status then
    raise exception 'Handover QR can only be generated while awaiting seller delivery';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.id = v_order.payment_id
      and p.status = 'paid'::public.payment_status
  ) then
    raise exception 'Payment must be completed before generating handover QR';
  end if;

  v_expires_at := now() + interval '30 days';

  if v_order.collection_qr_token is not null
     and v_order.collection_qr_expires_at is not null
     and v_order.collection_qr_expires_at > now() then
    v_token := v_order.collection_qr_token;
    v_expires_at := v_order.collection_qr_expires_at;
  else
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

    update public.orders
    set
      collection_qr_token = v_token,
      collection_qr_expires_at = v_expires_at
    where id = p_order_id;
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_type', v_order_type::text,
    'token', v_token,
    'collect_path', '/orders/collect/' || v_token,
    'expires_at', v_expires_at
  );
end;
$$;
