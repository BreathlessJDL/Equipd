-- =============================================================================
-- Deploy in Supabase SQL Editor — fixes counter_offer "p_parent" SQL errors.
--
-- Frontend RPC: counter_offer({ p_offer_id, p_amount_pence })
-- Target:       public.counter_offer(uuid, integer)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Diagnostics — list every counter_offer overload BEFORE deploy
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
  v_count int := 0;
begin
  raise notice '=== counter_offer overloads BEFORE deploy ===';

  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args,
      p.oid::regprocedure as regprocedure,
      (pg_get_functiondef(p.oid) ~* '\mp_parent\.') as has_broken_p_parent_dot,
      (pg_get_functiondef(p.oid) ~* '\mp_parent[^a-z_]') as has_broken_p_parent_token
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'counter_offer'
    order by n.nspname, pg_get_function_identity_arguments(p.oid)
  loop
    v_count := v_count + 1;
    raise notice
      'overload %: %.%(%) regprocedure=% broken_p_parent_dot=% broken_p_parent_token=%',
      v_count,
      r.schema_name,
      r.function_name,
      r.args,
      r.regprocedure,
      r.has_broken_p_parent_dot,
      r.has_broken_p_parent_token;
  end loop;

  if v_count = 0 then
    raise notice 'No counter_offer overloads found before deploy.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Drop known overloads (specific signatures only — no CASCADE)
-- -----------------------------------------------------------------------------

drop function if exists public.counter_offer(uuid, integer);
drop function if exists public.counter_offer(uuid, int);
drop function if exists public.counter_offer(uuid, numeric);

-- -----------------------------------------------------------------------------
-- 3. Recreate the exact overload used by PostgREST / frontend
-- -----------------------------------------------------------------------------

create or replace function public.counter_offer(
  p_offer_id uuid,
  p_amount_pence integer
)
returns public.offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.offers%rowtype;
  v_new_offer public.offers%rowtype;
  v_parent_direction text;
  v_new_direction text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'Enter a valid counter-offer amount greater than zero.';
  end if;

  select *
  into v_parent
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Parent offer % not found', p_offer_id;
  end if;

  if v_parent.status <> 'pending'::public.offer_status then
    raise exception 'Only pending offers can be countered';
  end if;

  v_parent_direction := coalesce(v_parent.direction, 'buyer_to_seller');

  if v_parent_direction = 'buyer_to_seller' then
    if v_parent.seller_id <> auth.uid() then
      raise exception 'Only the seller can counter this offer';
    end if;
    v_new_direction := 'seller_to_buyer';
  elsif v_parent_direction = 'seller_to_buyer' then
    if v_parent.buyer_id <> auth.uid() then
      raise exception 'Only the buyer can counter this counter-offer';
    end if;
    v_new_direction := 'buyer_to_seller';
  else
    raise exception 'Unsupported offer direction: %', v_parent_direction;
  end if;

  update public.offers
  set
    status = 'countered'::public.offer_status,
    updated_at = now()
  where id = v_parent.id;

  insert into public.offers (
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    status,
    direction,
    parent_offer_id
  )
  values (
    v_parent.listing_id,
    v_parent.buyer_id,
    v_parent.seller_id,
    v_parent.conversation_id,
    p_amount_pence,
    'pending'::public.offer_status,
    v_new_direction,
    v_parent.id
  )
  returning * into v_new_offer;

  if v_parent.conversation_id is not null then
    insert into public.messages (
      conversation_id,
      sender_id,
      message_type,
      offer_id,
      body
    )
    values (
      v_parent.conversation_id,
      auth.uid(),
      'offer'::public.message_type,
      v_new_offer.id,
      'Counter-offer'
    );

    perform public.insert_conversation_system_message(
      v_parent.conversation_id,
      'Counter-offer sent.'
    );
  end if;

  return v_new_offer;
end;
$$;

grant execute on function public.counter_offer(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- 4. Diagnostics — list every counter_offer overload AFTER deploy
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
  v_count int := 0;
begin
  raise notice '=== counter_offer overloads AFTER deploy ===';

  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args,
      p.oid::regprocedure as regprocedure,
      (pg_get_functiondef(p.oid) ~* '\mp_parent\.') as has_broken_p_parent_dot,
      (pg_get_functiondef(p.oid) ~* '\mp_parent[^a-z_]') as has_broken_p_parent_token
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'counter_offer'
    order by n.nspname, pg_get_function_identity_arguments(p.oid)
  loop
    v_count := v_count + 1;
    raise notice
      'overload %: %.%(%) regprocedure=% broken_p_parent_dot=% broken_p_parent_token=%',
      v_count,
      r.schema_name,
      r.function_name,
      r.args,
      r.regprocedure,
      r.has_broken_p_parent_dot,
      r.has_broken_p_parent_token;
  end loop;

  if v_count = 0 then
    raise exception 'counter_offer missing after deploy';
  elsif v_count > 1 then
    raise warning 'Multiple counter_offer overloads remain — PostgREST may resolve the wrong one';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Verify the exact recreated overload (not name-only)
-- -----------------------------------------------------------------------------

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.counter_offer(uuid, integer)'::regprocedure)
  into v_def;

  if v_def is null then
    raise exception 'public.counter_offer(uuid, integer) not found after deploy';
  end if;

  -- Match undeclared table reference "p_parent." only — NOT v_parent, parent_offer_id, or comments
  if v_def ~* '\mp_parent\.' then
    raise exception 'counter_offer(uuid, integer) still contains broken token p_parent.';
  end if;

  if position('v_parent.id' in lower(v_def)) = 0 then
    raise exception 'counter_offer(uuid, integer) missing expected v_parent.id update';
  end if;

  raise notice 'counter_offer(uuid, integer) deployed OK — no broken p_parent references';
end;
$$;

-- -----------------------------------------------------------------------------
-- Manual inspection (optional — run separately in SQL Editor)
-- -----------------------------------------------------------------------------
--
-- SELECT
--   n.nspname AS schema,
--   p.proname AS function_name,
--   pg_get_function_identity_arguments(p.oid) AS args,
--   p.oid::regprocedure AS regprocedure,
--   pg_get_functiondef(p.oid) AS definition
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.proname = 'counter_offer';
--
-- SELECT pg_get_functiondef('public.counter_offer(uuid, integer)'::regprocedure);
