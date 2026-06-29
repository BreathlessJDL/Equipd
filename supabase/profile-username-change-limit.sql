-- Username change cooldown (30 days) + server-side uniqueness enforcement on update.
-- Run after profile-username.sql and signup-validation.sql.

alter table public.profiles
  add column if not exists username_last_changed_at timestamptz;

create or replace function public.enforce_profile_username_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_normalized text;
  new_normalized text;
begin
  old_normalized := lower(coalesce(trim(old.username), ''));
  new_normalized := lower(coalesce(trim(new.username), ''));

  if new_normalized = old_normalized then
    new.username_last_changed_at := old.username_last_changed_at;
    return new;
  end if;

  if old.username is not null
     and old.username_last_changed_at is not null
     and old.username_last_changed_at > now() - interval '30 days'
  then
    raise exception 'You can only change your username once every 30 days.'
      using errcode = 'P0001';
  end if;

  if new.username is not null then
    if not public.is_username_available(new.username, new.id) then
      raise exception 'That username is already taken.'
        using errcode = '23505';
    end if;
  end if;

  new.username_last_changed_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_profile_username_change_trigger on public.profiles;

create trigger enforce_profile_username_change_trigger
  before update of username on public.profiles
  for each row
  execute function public.enforce_profile_username_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
begin
  raw_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  if raw_username is not null then
    if not public.is_username_available(raw_username) then
      raise exception 'That username is already taken.'
        using errcode = '23505';
    end if;
  end if;

  insert into public.profiles (id, display_name, username, username_last_changed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    raw_username,
    case when raw_username is not null then now() else null end
  );

  return new;
exception
  when unique_violation then
    raise exception 'That username is already taken.'
      using errcode = '23505';
end;
$$;

notify pgrst, 'reload schema';
