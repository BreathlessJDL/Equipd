-- Seller "last active" indicator for buyer trust.

alter table public.profiles
  add column if not exists last_active_at timestamptz;

comment on column public.profiles.last_active_at is
  'Updated when the user meaningfully uses the app (throttled). Shown publicly as a friendly relative label.';

create or replace view public.profiles_public
with (security_barrier = true)
as
select
  p.id,
  p.username,
  p.display_name,
  p.location,
  p.avatar_url,
  p.created_at,
  p.last_active_at
from public.profiles p;

grant select on public.profiles_public to anon, authenticated;

create or replace function public.touch_user_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  update public.profiles
  set last_active_at = now()
  where id = v_uid
    and (
      last_active_at is null
      or last_active_at < now() - interval '15 minutes'
    );
end;
$$;

revoke all on function public.touch_user_activity() from public;
grant execute on function public.touch_user_activity() to authenticated;
