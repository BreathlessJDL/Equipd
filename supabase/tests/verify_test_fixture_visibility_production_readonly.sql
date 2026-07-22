with visible_control as (
  select l
  from public.listings l
  where public.listing_is_publicly_visible(l)
  limit 1
),
predicate_probe as (
  select
    public.listing_is_publicly_visible(l) as normal_visible,
    public.listing_is_publicly_visible(
      jsonb_populate_record(
        null::public.listings,
        to_jsonb(l) || '{"is_test_data": true}'::jsonb
      )
    ) as same_row_marked_test_visible
  from visible_control
)
select jsonb_build_object(
  'column',
  (
    select jsonb_build_object(
      'data_type', data_type,
      'nullable', is_nullable,
      'default', column_default
    )
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'is_test_data'
  ),
  'backfill',
  (
    select jsonb_build_object(
      'total', count(*),
      'false_count', count(*) filter (where not is_test_data),
      'true_count', count(*) filter (where is_test_data),
      'null_count', count(*) filter (where is_test_data is null)
    )
    from public.listings
  ),
  'constraint',
  (
    select jsonb_build_object(
      'name', conname,
      'validated', convalidated,
      'definition', pg_get_constraintdef(oid)
    )
    from pg_constraint
    where conrelid = 'public.listings'::regclass
      and conname = 'listings_test_data_non_public_check'
  ),
  'guard_trigger',
  (
    select jsonb_build_object(
      'enabled', tgenabled,
      'definition', pg_get_triggerdef(oid)
    )
    from pg_trigger
    where tgrelid = 'public.listings'::regclass
      and tgname = 'guard_listing_test_data_trigger'
  ),
  'predicate_definition',
  pg_get_functiondef(
    'public.listing_is_publicly_visible(public.listings)'::regprocedure
  ),
  'predicate_probe',
  (select to_jsonb(predicate_probe) from predicate_probe),
  'rpc',
  (
    select jsonb_build_object(
      'exists',
      to_regprocedure(
        'public.create_test_fixture_payment_and_order(uuid,uuid,integer,integer)'
      ) is not null,
      'owner', pg_get_userbyid(proowner),
      'security_definer', prosecdef,
      'anon_execute', has_function_privilege('anon', oid, 'execute'),
      'authenticated_execute',
        has_function_privilege('authenticated', oid, 'execute'),
      'service_role_execute',
        has_function_privilege('service_role', oid, 'execute'),
      'acl', proacl
    )
    from pg_proc
    where oid = (
      'public.create_test_fixture_payment_and_order(uuid,uuid,integer,integer)'
    )::regprocedure
  )
) as verification;
