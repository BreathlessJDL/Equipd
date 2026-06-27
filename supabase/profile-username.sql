-- Add unique usernames to profiles (nullable for existing users).
-- Run after schema.sql and rls.sql.

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (
    username is null
    or (
      char_length(username) >= 3
      and char_length(username) <= 24
      and username ~ '^[a-zA-Z0-9_-]+$'
    )
  );

create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username))
  where username is not null;

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
    if exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(raw_username)
    ) then
      raise exception 'That username is already taken.'
        using errcode = '23505';
    end if;
  end if;

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    raw_username
  );

  return new;
exception
  when unique_violation then
    raise exception 'That username is already taken.'
      using errcode = '23505';
end;
$$;
