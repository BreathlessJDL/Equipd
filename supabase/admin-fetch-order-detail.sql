-- Admin order detail fetch for case management
-- Run after admin-order-management.sql
--
-- Non-participant admins can read orders via orders_client, but nested PostgREST
-- joins to listings / payments / offers are still subject to those tables' RLS.
-- This RPC returns the full order detail payload for admins only.

drop function if exists public.admin_fetch_order_detail(uuid);

create or replace function public.admin_fetch_order_detail(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select to_jsonb(o)
    || jsonb_build_object(
    'listing', (
      select jsonb_build_object(
        'id', l.id,
        'slug', l.slug,
        'title', l.title,
        'brand', l.brand,
        'model', l.model,
        'price_pence', l.price_pence,
        'condition', l.condition,
        'location', l.location,
        'status', l.status,
        'seller_id', l.seller_id,
        'collection_available', l.collection_available,
        'courier_available', l.courier_available,
        'delivery_notes', l.delivery_notes,
        'category', case
          when c.id is null then null
          else jsonb_build_object('name', c.name)
        end,
        'listing_images', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', li.id,
                'storage_path', li.storage_path,
                'sort_order', li.sort_order
              )
              order by li.sort_order
            )
            from public.listing_images li
            where li.listing_id = l.id
          ),
          '[]'::jsonb
        )
      )
      from public.listings l
      left join public.categories c on c.id = l.category_id
      where l.id = o.listing_id
    ),
    'payment', (
      select to_jsonb(p)
      from public.payments p
      where p.id = o.payment_id
    ),
    'offer', (
      select jsonb_build_object(
        'id', off.id,
        'status', off.status,
        'conversation_id', off.conversation_id,
        'amount_pence', off.amount_pence,
        'created_at', off.created_at,
        'updated_at', off.updated_at
      )
      from public.offers off
      where off.id = o.offer_id
    )
  )
  into v_result
  from public.orders o
  where o.id = p_order_id;

  if v_result is null then
    raise exception 'Order not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_fetch_order_detail(uuid) from public;
grant execute on function public.admin_fetch_order_detail(uuid) to authenticated;

notify pgrst, 'reload schema';
