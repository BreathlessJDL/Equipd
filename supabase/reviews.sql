-- Equipd order reviews
-- Run after admin-support-resolution-notes.sql
--
-- Adds reviews table and create_order_review() RPC.

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating >= 1 and rating <= 5),
  constraint reviews_reviewer_not_reviewee check (reviewer_id <> reviewee_id),
  constraint reviews_comment_length check (comment is null or char_length(comment) <= 500)
);

create unique index reviews_one_per_reviewer_per_order_idx
  on public.reviews (order_id, reviewer_id);

create index reviews_reviewee_created_idx
  on public.reviews (reviewee_id, created_at desc);

create index reviews_order_created_idx
  on public.reviews (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;

create policy "Reviews are publicly readable"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Inserts go through create_order_review() only.

-- ---------------------------------------------------------------------------
-- Create review for a completed order
-- ---------------------------------------------------------------------------

create or replace function public.create_order_review(
  p_order_id uuid,
  p_rating int,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_reviewee_id uuid;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
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

  if v_order.payout_status <> 'paid'::public.payout_status then
    raise exception 'Reviews can only be left after seller payout is complete';
  end if;

  if v_uid = v_order.buyer_id then
    v_reviewee_id := v_order.seller_id;
  else
    v_reviewee_id := v_order.buyer_id;
  end if;

  if exists (
    select 1
    from public.reviews r
    where r.order_id = p_order_id
      and r.reviewer_id = v_uid
  ) then
    raise exception 'You have already reviewed this order';
  end if;

  insert into public.reviews (
    order_id,
    listing_id,
    reviewer_id,
    reviewee_id,
    rating,
    comment
  )
  values (
    v_order.id,
    v_order.listing_id,
    v_uid,
    v_reviewee_id,
    p_rating,
    v_comment
  )
  returning * into v_review;

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.create_order_review(uuid, int, text) from public;
grant execute on function public.create_order_review(uuid, int, text) to authenticated;
