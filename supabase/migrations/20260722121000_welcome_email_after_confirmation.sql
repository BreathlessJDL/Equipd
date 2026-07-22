-- Send welcome email only after the auth email address is confirmed.
-- Email/password signups: fire when email_confirmed_at transitions null → set.
-- OAuth / auto-confirmed users: fire on INSERT when email_confirmed_at is already set.
-- Idempotency remains welcome:{userId} via transactional_email_log.

create or replace function public.notify_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- INSERT path: only when already confirmed (OAuth / auto-confirm).
  if tg_op = 'INSERT' then
    if new.email_confirmed_at is null then
      return new;
    end if;
  end if;

  -- UPDATE path: only the first confirmation transition.
  if tg_op = 'UPDATE' then
    if not (
      old.email_confirmed_at is null
      and new.email_confirmed_at is not null
    ) then
      return new;
    end if;
  end if;

  perform public.notify_marketplace_email(
    'welcome',
    jsonb_build_object('userId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists auth_users_email_welcome on auth.users;
drop trigger if exists auth_users_email_welcome_on_insert on auth.users;
drop trigger if exists auth_users_email_welcome_on_confirm on auth.users;

create trigger auth_users_email_welcome_on_insert
  after insert on auth.users
  for each row
  execute function public.notify_welcome_email();

create trigger auth_users_email_welcome_on_confirm
  after update of email_confirmed_at on auth.users
  for each row
  execute function public.notify_welcome_email();

comment on function public.notify_welcome_email() is
  'Queue welcome transactional email once email is confirmed (INSERT if already confirmed; UPDATE on first confirmation).';
