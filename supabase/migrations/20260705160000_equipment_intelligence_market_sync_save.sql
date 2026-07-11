-- Equipd Intelligence Market Sync Chunk 3: admin approve/save observations.

create or replace function public.admin_save_market_sync_observations(
  p_equipment_id uuid,
  p_observations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_count integer;
  v_observation jsonb;
  v_price numeric;
  v_normalized jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_equipment_id is null then
    raise exception 'equipment_id is required';
  end if;

  if p_observations is null
    or jsonb_typeof(p_observations) <> 'array'
    or jsonb_array_length(p_observations) = 0 then
    raise exception 'At least one observation is required';
  end if;

  select exists (
    select 1
    from public.equipment_intelligence ei
    where ei.id = p_equipment_id
  )
  into v_exists;

  if not v_exists then
    raise exception 'Equipment intelligence record not found';
  end if;

  for v_observation in select value from jsonb_array_elements(p_observations)
  loop
    v_price := nullif(v_observation ->> 'price', '')::numeric;

    if v_price is null or v_price <= 0 then
      raise exception 'Each observation must include a positive price';
    end if;

    v_normalized := v_normalized || jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'price', v_price,
          'currency', coalesce(nullif(trim(v_observation ->> 'currency'), ''), 'GBP'),
          'source', nullif(trim(v_observation ->> 'source'), ''),
          'url', nullif(trim(v_observation ->> 'url'), ''),
          'confidence', nullif(v_observation ->> 'confidence', '')::integer,
          'observed_at', coalesce(
            nullif(trim(v_observation ->> 'observed_at'), '')::timestamptz,
            now()
          )
        )
      )
    );
  end loop;

  v_count := jsonb_array_length(v_normalized);

  update public.equipment_intelligence
  set
    market_observations = v_normalized,
    last_market_sync_at = now(),
    market_sync_status = 'synced',
    market_sync_notes = format('Saved %s market observations from Brave Search', v_count),
    updated_at = now()
  where id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'saved_count', v_count
  );
end;
$$;

revoke all on function public.admin_save_market_sync_observations(uuid, jsonb) from public;
grant execute on function public.admin_save_market_sync_observations(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
