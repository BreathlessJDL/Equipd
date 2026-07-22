select jsonb_build_object(
  'insert_guard_definition',
  pg_get_functiondef('public.guard_listing_inventory_insert()'::regprocedure),
  'quantity_rpc',
  (
    select jsonb_build_object(
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
    where oid = 'public.update_listing_quantity(uuid,integer,bigint)'::regprocedure
  ),
  'other_inventory_rpcs_still_restricted',
  (
    select jsonb_agg(jsonb_build_object(
      'name', p.oid::regprocedure::text,
      'authenticated_execute',
        has_function_privilege('authenticated', p.oid, 'execute')
    ) order by p.oid::regprocedure::text)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'transition_order_inventory_state',
        'release_expired_payments',
        'mark_payment_captured_or_exception',
        'record_commerce_exception',
        'create_test_fixture_payment_and_order'
      )
  ),
  'inventory_invariants',
  (
    select jsonb_build_object(
      'listings_total', count(*),
      'invariant_failures', count(*) filter (
        where quantity_available + quantity_reserved + quantity_sold
                <> quantity_total
          or quantity_total < 1
          or quantity_total > 999
          or least(quantity_available, quantity_reserved, quantity_sold) < 0
          or inventory_version < 0
      ),
      'quantity_one_listings', count(*) filter (where quantity_total = 1),
      'multi_quantity_listings', count(*) filter (where quantity_total > 1)
    )
    from public.listings
  ),
  'public_visibility_count',
  (select count(*) from public.listings_public_browse)
) as stage2_verification;
