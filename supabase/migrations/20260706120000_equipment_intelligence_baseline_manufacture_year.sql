-- Baseline manufacture year — primary lifecycle field for depreciation.
-- Production period fields (manufacture_start_year / manufacture_end_year) remain optional metadata.

alter table public.equipment_intelligence
  add column if not exists baseline_manufacture_year integer,
  add column if not exists baseline_manufacture_year_confidence integer,
  add column if not exists baseline_manufacture_year_source text,
  add column if not exists baseline_manufacture_year_updated_at timestamptz;

comment on column public.equipment_intelligence.baseline_manufacture_year is
  'Primary manufacture year for depreciation. Valuation engine should use this field by default.';

comment on column public.equipment_intelligence.baseline_manufacture_year_confidence is
  'Confidence score (0-100) for baseline_manufacture_year.';

comment on column public.equipment_intelligence.baseline_manufacture_year_source is
  'Provenance for baseline_manufacture_year, e.g. ai_research_approved or technogym_trade_in_matrix_earliest_year.';

create index if not exists equipment_intelligence_baseline_manufacture_year_idx
  on public.equipment_intelligence (baseline_manufacture_year);

create index if not exists equipment_intelligence_baseline_source_idx
  on public.equipment_intelligence (baseline_manufacture_year_source);

-- Backfill researched rows that already have manufacture_start_year.
update public.equipment_intelligence
set
  baseline_manufacture_year = manufacture_start_year,
  baseline_manufacture_year_confidence = manufacture_year_confidence,
  baseline_manufacture_year_source = 'ai_research_approved',
  baseline_manufacture_year_updated_at = coalesce(lifecycle_updated_at, updated_at, now())
where manufacture_start_year is not null
  and baseline_manufacture_year is null;

create or replace function public.should_apply_baseline_manufacture_year(
  p_current_year integer,
  p_current_confidence integer,
  p_current_source text,
  p_proposed_year integer,
  p_proposed_confidence integer,
  p_proposed_source text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_proposed_year is null then false
    when p_current_year is null then true
    when coalesce(p_current_source, '') <> ''
      and p_current_source <> 'technogym_trade_in_matrix_earliest_year'
      and p_proposed_source = 'technogym_trade_in_matrix_earliest_year' then false
    when coalesce(p_proposed_confidence, 0) > coalesce(p_current_confidence, 0) then true
    when p_current_source = 'technogym_trade_in_matrix_earliest_year'
      and coalesce(p_proposed_source, '') <> 'technogym_trade_in_matrix_earliest_year' then true
    else false
  end;
$$;

create or replace function public.apply_baseline_manufacture_year(
  p_equipment_id uuid,
  p_year integer,
  p_confidence integer,
  p_source text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.equipment_intelligence%rowtype;
  v_applied boolean := false;
begin
  if p_equipment_id is null or p_year is null then
    return false;
  end if;

  select *
  into v_row
  from public.equipment_intelligence
  where id = p_equipment_id;

  if not found then
    return false;
  end if;

  if public.should_apply_baseline_manufacture_year(
    v_row.baseline_manufacture_year,
    v_row.baseline_manufacture_year_confidence,
    v_row.baseline_manufacture_year_source,
    p_year,
    p_confidence,
    p_source
  ) then
    update public.equipment_intelligence
    set
      baseline_manufacture_year = p_year,
      baseline_manufacture_year_confidence = p_confidence,
      baseline_manufacture_year_source = p_source,
      baseline_manufacture_year_updated_at = now(),
      updated_at = now()
    where id = p_equipment_id;

    v_applied := true;
  end if;

  return v_applied;
end;
$$;

create or replace function public.recalculate_equipment_lifecycle_best(
  p_equipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.equipment_lifecycle_sources%rowtype;
  v_baseline_applied boolean := false;
begin
  if p_equipment_id is null then
    raise exception 'equipment_id is required';
  end if;

  select els.*
  into v_source
  from public.equipment_lifecycle_sources els
  where els.equipment_id = p_equipment_id
  order by els.confidence desc, els.updated_at desc, els.created_at desc
  limit 1;

  if not found then
    update public.equipment_intelligence
    set
      manufacture_start_year = null,
      manufacture_end_year = null,
      manufacture_year_confidence = null,
      manufacture_year_source_id = null,
      lifecycle_updated_at = null,
      updated_at = now()
    where id = p_equipment_id;

    return jsonb_build_object(
      'equipment_id', p_equipment_id,
      'recalculated', false,
      'reason', 'no_lifecycle_sources'
    );
  end if;

  update public.equipment_intelligence
  set
    manufacture_start_year = v_source.manufacture_start_year,
    manufacture_end_year = v_source.manufacture_end_year,
    manufacture_year_confidence = v_source.confidence,
    manufacture_year_source_id = v_source.id,
    lifecycle_updated_at = now(),
    updated_at = now()
  where id = p_equipment_id;

  if v_source.manufacture_start_year is not null then
    v_baseline_applied := public.apply_baseline_manufacture_year(
      p_equipment_id,
      v_source.manufacture_start_year,
      v_source.confidence,
      'admin_lifecycle_source'
    );
  end if;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'recalculated', true,
    'source_id', v_source.id,
    'manufacture_start_year', v_source.manufacture_start_year,
    'manufacture_end_year', v_source.manufacture_end_year,
    'confidence', v_source.confidence,
    'baseline_applied', v_baseline_applied
  );
end;
$$;

revoke all on function public.should_apply_baseline_manufacture_year(
  integer, integer, text, integer, integer, text
) from public;
grant execute on function public.should_apply_baseline_manufacture_year(
  integer, integer, text, integer, integer, text
) to authenticated;

revoke all on function public.apply_baseline_manufacture_year(uuid, integer, integer, text) from public;
grant execute on function public.apply_baseline_manufacture_year(uuid, integer, integer, text) to authenticated;

notify pgrst, 'reload schema';
