-- Admin-only user growth statistics.
-- Counts registered accounts from public.profiles (created by handle_new_user).
-- Unique sellers are counted in SQL so listings RLS is not widened.
-- Emails for latest sign-ups are read from auth.users inside this security-definer RPC only.

create or replace function public.admin_user_statistics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_today_start timestamptz;
  v_last_7_start timestamptz;
  v_last_30_start timestamptz;
  v_counts jsonb;
  v_latest jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_today := (timezone('Europe/London', now()))::date;
  v_today_start := v_today::timestamp at time zone 'Europe/London';
  v_last_7_start := (v_today - 6)::timestamp at time zone 'Europe/London';
  v_last_30_start := (v_today - 29)::timestamp at time zone 'Europe/London';

  select jsonb_build_object(
    'totalUsers', count(*)::int,
    'newToday', count(*) filter (where p.created_at >= v_today_start)::int,
    'last7Days', count(*) filter (where p.created_at >= v_last_7_start)::int,
    'last30Days', count(*) filter (where p.created_at >= v_last_30_start)::int,
    'usersWhoHaveListed', (
      select count(distinct l.seller_id)::int
      from public.listings l
      where coalesce(l.is_test_data, false) = false
    )
  )
  into v_counts
  from public.profiles p;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'username', s.username,
        'displayName', s.display_name,
        'email', s.email,
        'createdAt', s.created_at
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_latest
  from (
    select
      p.id,
      p.username,
      p.display_name,
      p.created_at,
      u.email
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc
    limit 10
  ) s;

  return coalesce(v_counts, '{}'::jsonb) || jsonb_build_object('latestSignups', coalesce(v_latest, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_user_statistics() from public;
grant execute on function public.admin_user_statistics() to authenticated;

notify pgrst, 'reload schema';
