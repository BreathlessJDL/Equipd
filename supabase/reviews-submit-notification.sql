-- Review submitted notification for the reviewed party
-- Run after reviews-phase1.sql (step 49) and notifications.sql
--
-- Notifies reviewed_user_id when submit_review succeeds.
-- Notification failure does not roll back the review insert.

create or replace function public.submit_review(
  p_order_id uuid,
  p_rating integer,
  p_review_text text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_reviewed_user_id uuid;
  v_review_text text := nullif(trim(coalesce(p_review_text, '')), '');
  v_review public.reviews;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5 stars';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_uid <> v_order.buyer_id and v_uid <> v_order.seller_id then
    raise exception 'You do not have access to this order';
  end if;

  if v_order.fulfilment_status <> 'completed'::public.order_fulfilment_status then
    raise exception 'Reviews can only be left after the order is completed';
  end if;

  if v_uid = v_order.buyer_id then
    v_reviewed_user_id := v_order.seller_id;
  else
    v_reviewed_user_id := v_order.buyer_id;
  end if;

  if exists (
    select 1
    from public.reviews r
    where r.order_id = p_order_id
      and r.reviewer_user_id = v_uid
  ) then
    raise exception 'You have already reviewed this order';
  end if;

  insert into public.reviews (
    order_id,
    reviewer_user_id,
    reviewed_user_id,
    rating,
    review_text
  )
  values (
    v_order.id,
    v_uid,
    v_reviewed_user_id,
    p_rating,
    v_review_text
  )
  returning * into v_review;

  begin
    perform public.create_notification(
      v_reviewed_user_id,
      'review_received',
      'You received a new review',
      'Someone left you a review on a completed order.',
      '/orders/' || v_order.id::text
    );
  exception
    when others then
      raise warning 'submit_review notification failed for order % user %: %',
        v_order.id,
        v_reviewed_user_id,
        sqlerrm;
  end;

  return v_review;
end;
$$;

revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
