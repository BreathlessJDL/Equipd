-- Price Guide: admin-only market observation import via security definer RPC.
-- Public/anon clients cannot insert market_observations directly.

create or replace function public.admin_import_market_observations(
  p_equipment_model_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_equipment_model_id is null then
    raise exception 'equipment_model_id is required';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one observation row is required';
  end if;

  if not exists (
    select 1
    from public.equipment_models em
    where em.id = p_equipment_model_id
  ) then
    raise exception 'Equipment model not found';
  end if;

  insert into public.market_observations (
    equipment_model_id,
    observed_price,
    currency,
    estimated_age_years,
    condition,
    source_type,
    source_domain,
    confidence_score,
    notes,
    observed_at
  )
  select
    p_equipment_model_id,
    (row_data ->> 'observed_price')::numeric,
    coalesce(nullif(trim(row_data ->> 'currency'), ''), 'GBP'),
    nullif(row_data ->> 'estimated_age_years', '')::numeric,
    nullif(trim(row_data ->> 'condition'), ''),
    nullif(trim(row_data ->> 'source_type'), ''),
    nullif(trim(row_data ->> 'source_domain'), ''),
    nullif(row_data ->> 'confidence_score', '')::numeric,
    nullif(trim(row_data ->> 'notes'), ''),
    coalesce(
      nullif(trim(row_data ->> 'observed_at'), '')::timestamptz,
      now()
    )
  from jsonb_array_elements(p_rows) as row_data
  where nullif(row_data ->> 'observed_price', '') is not null
    and (row_data ->> 'observed_price')::numeric > 0;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.admin_import_market_observations(uuid, jsonb) from public;
grant execute on function public.admin_import_market_observations(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
