-- Signup validation: case-insensitive username uniqueness + password policy RPCs.
-- Safe to re-run. Apply via migration or: supabase db push --linked

-- ---------------------------------------------------------------------------
-- Username: case-insensitive unique index (existing users with null username OK)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Username availability (case-insensitive)
-- ---------------------------------------------------------------------------

create or replace function public.is_username_available(
  p_username text,
  p_exclude_user_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  normalized := nullif(trim(p_username), '');

  if normalized is null then
    return false;
  end if;

  if char_length(normalized) < 3
    or char_length(normalized) > 24
    or normalized !~ '^[a-zA-Z0-9_-]+$'
  then
    return false;
  end if;

  return not exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(normalized)
      and (p_exclude_user_id is null or p.id <> p_exclude_user_id)
  );
end;
$$;

revoke all on function public.is_username_available(text, uuid) from public;
grant execute on function public.is_username_available(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Password policy (keep in sync with src/lib/passwordPolicy.js)
-- ---------------------------------------------------------------------------

create or replace function public.validate_signup_password(p_password text)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public
as $$
begin
  if p_password is null then
    return jsonb_build_object('valid', false, 'error', 'Password is required.');
  end if;

  if char_length(p_password) < 6 then
    return jsonb_build_object(
      'valid', false,
      'error', 'Password must be at least 6 characters.'
    );
  end if;

  if char_length(p_password) > 18 then
    return jsonb_build_object(
      'valid', false,
      'error', 'Password must be no more than 18 characters.'
    );
  end if;

  if p_password !~ '[A-Z]' then
    return jsonb_build_object(
      'valid', false,
      'error', 'At least one uppercase letter.'
    );
  end if;

  if p_password !~ '[a-z]' then
    return jsonb_build_object(
      'valid', false,
      'error', 'At least one lowercase letter.'
    );
  end if;

  if p_password !~ '[0-9]' then
    return jsonb_build_object(
      'valid', false,
      'error', 'At least one number.'
    );
  end if;

  if p_password !~ '[^A-Za-z0-9]' then
    return jsonb_build_object(
      'valid', false,
      'error', 'At least one special character.'
    );
  end if;

  return jsonb_build_object('valid', true, 'error', null);
end;
$$;

revoke all on function public.validate_signup_password(text) from public;
grant execute on function public.validate_signup_password(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup trigger: reject duplicate usernames with a clear database error
-- ---------------------------------------------------------------------------

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
