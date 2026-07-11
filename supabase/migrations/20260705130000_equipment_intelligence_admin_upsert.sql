-- Equipd Intelligence Step 2: admin CSV upsert by slug.
-- Security definer RPC; public RLS unchanged.

create or replace function public.admin_upsert_equipment_intelligence(
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_slug text;
  v_exists boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'At least one row is required';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_slug := nullif(trim(v_row ->> 'slug'), '');

    if v_slug is null then
      raise exception 'Each row must include a slug';
    end if;

    if nullif(trim(v_row ->> 'brand'), '') is null
      or nullif(trim(v_row ->> 'model'), '') is null then
      raise exception 'Each row must include brand and model (slug: %)', v_slug;
    end if;

    select exists (
      select 1
      from public.equipment_intelligence ei
      where ei.slug = v_slug
    )
    into v_exists;

    if v_exists then
      update public.equipment_intelligence
      set
        brand = trim(v_row ->> 'brand'),
        series = nullif(trim(v_row ->> 'series'), ''),
        model = trim(v_row ->> 'model'),
        category = nullif(trim(v_row ->> 'category'), ''),
        equipment_type = nullif(trim(v_row ->> 'equipment_type'), ''),
        manufacture_year = nullif(v_row ->> 'manufacture_year', '')::integer,
        original_rrp = nullif(v_row ->> 'original_rrp', '')::numeric,
        estimated_trade_in_value = nullif(v_row ->> 'estimated_trade_in_value', '')::numeric,
        confidence = coalesce(nullif(trim(v_row ->> 'confidence'), ''), 'Low'),
        currency = coalesce(nullif(trim(v_row ->> 'currency'), ''), 'GBP'),
        market_observations = case
          when coalesce((v_row ->> 'update_market_observations')::boolean, false)
            then coalesce(v_row -> 'market_observations', '[]'::jsonb)
          else market_observations
        end,
        updated_at = now()
      where slug = v_slug;

      v_updated := v_updated + 1;
    else
      insert into public.equipment_intelligence (
        brand,
        series,
        model,
        category,
        equipment_type,
        manufacture_year,
        original_rrp,
        estimated_trade_in_value,
        market_observations,
        confidence,
        currency,
        slug
      )
      values (
        trim(v_row ->> 'brand'),
        nullif(trim(v_row ->> 'series'), ''),
        trim(v_row ->> 'model'),
        nullif(trim(v_row ->> 'category'), ''),
        nullif(trim(v_row ->> 'equipment_type'), ''),
        nullif(v_row ->> 'manufacture_year', '')::integer,
        nullif(v_row ->> 'original_rrp', '')::numeric,
        nullif(v_row ->> 'estimated_trade_in_value', '')::numeric,
        case
          when coalesce((v_row ->> 'update_market_observations')::boolean, false)
            then coalesce(v_row -> 'market_observations', '[]'::jsonb)
          else '[]'::jsonb
        end,
        coalesce(nullif(trim(v_row ->> 'confidence'), ''), 'Low'),
        coalesce(nullif(trim(v_row ->> 'currency'), ''), 'GBP'),
        v_slug
      );

      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
end;
$$;

revoke all on function public.admin_upsert_equipment_intelligence(jsonb) from public;
grant execute on function public.admin_upsert_equipment_intelligence(jsonb) to authenticated;

notify pgrst, 'reload schema';
