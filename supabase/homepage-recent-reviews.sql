-- Public homepage reviews with listing title (no usernames exposed).
-- Run after reviews-phase1.sql.
--
-- Must drop first: PostgreSQL cannot change the return row type with CREATE OR REPLACE.

drop function if exists public.get_recent_reviews_for_homepage(int);

create function public.get_recent_reviews_for_homepage(p_limit int default 8)
returns table (
  id uuid,
  order_id uuid,
  reviewer_user_id uuid,
  rating int,
  review_text text,
  created_at timestamptz,
  listing_title text,
  is_buyer_reviewer boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.order_id,
    r.reviewer_user_id,
    r.rating,
    r.review_text,
    r.created_at,
    l.title as listing_title,
    (r.reviewer_user_id = o.buyer_id) as is_buyer_reviewer
  from public.reviews r
  inner join public.orders o on o.id = r.order_id
  inner join public.listings l on l.id = o.listing_id
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

revoke all on function public.get_recent_reviews_for_homepage(int) from public;
grant execute on function public.get_recent_reviews_for_homepage(int) to anon, authenticated;
