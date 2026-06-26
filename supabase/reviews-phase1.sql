-- Equipd Reviews Phase 1
-- Run after admin-support-resolution-notes.sql
--
-- Replaces supabase/reviews.sql with the Phase 1 trust & reviews schema.
-- If reviews.sql was already applied, this migration drops the legacy table/RPC
-- and recreates Phase 1 objects (existing review rows are not preserved).

-- ---------------------------------------------------------------------------
-- Legacy cleanup
-- ---------------------------------------------------------------------------

drop function if exists public.create_order_review(uuid, int, text);
drop function if exists public.submit_review(uuid, int, text);
drop function if exists public.get_user_review_summary(uuid);
drop function if exists public.get_user_completed_sales_count(uuid);

drop table if exists public.reviews cascade;

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_user_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null,
  review_text text,
  created_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_reviewer_not_reviewed check (reviewer_user_id <> reviewed_user_id),
  constraint reviews_review_text_length check (
    review_text is null or char_length(review_text) <= 500
  ),
  constraint reviews_one_per_reviewer_per_order unique (order_id, reviewer_user_id)
);

create index reviews_reviewed_user_id_idx
  on public.reviews (reviewed_user_id, created_at desc);

create index reviews_reviewer_user_id_idx
  on public.reviews (reviewer_user_id, created_at desc);

create index reviews_order_id_idx
  on public.reviews (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Inserts go through submit_review() only. No update or delete policies.

-- ---------------------------------------------------------------------------
-- Submit a review for a completed order
-- ---------------------------------------------------------------------------

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

  return v_review;
end;
$$;

revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Review summary for a user profile
-- ---------------------------------------------------------------------------

create or replace function public.get_user_review_summary(
  p_user_id uuid
)
returns table (
  average_rating numeric,
  review_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    round(avg(r.rating)::numeric, 1) as average_rating,
    count(*)::bigint as review_count
  from public.reviews r
  where r.reviewed_user_id = p_user_id;
$$;

revoke all on function public.get_user_review_summary(uuid) from public;
grant execute on function public.get_user_review_summary(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Completed sales count for seller trust signals
-- ---------------------------------------------------------------------------

create or replace function public.get_user_completed_sales_count(
  p_user_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.orders o
  where o.seller_id = p_user_id
    and o.fulfilment_status = 'completed'::public.order_fulfilment_status;
$$;

revoke all on function public.get_user_completed_sales_count(uuid) from public;
grant execute on function public.get_user_completed_sales_count(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
