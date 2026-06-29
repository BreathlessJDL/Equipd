-- Password policy: 6–18 characters with complexity rules.
-- Keep in sync with src/lib/passwordPolicy.js
-- Applies to signup / password change validation only (not login).

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

notify pgrst, 'reload schema';
