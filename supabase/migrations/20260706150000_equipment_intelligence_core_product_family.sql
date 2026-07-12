-- Product family column + richer core product group persistence / review actions.

alter table public.equipment_intelligence
  add column if not exists product_family text;

comment on column public.equipment_intelligence.product_family is
  'Meaningful product family / series line used in core product grouping (e.g. Discover, Integrity Series).';

alter table public.equipment_intelligence
  drop constraint if exists equipment_intelligence_core_product_group_status_check;

alter table public.equipment_intelligence
  add constraint equipment_intelligence_core_product_group_status_check
  check (core_product_group_status in ('pending', 'auto', 'approved', 'excluded', 'not_duplicate'));

-- Persist reviewed fields for all members, then approve the group.
create or replace function public.admin_persist_and_approve_core_product_group(
  p_core_product_key text,
  p_representative_equipment_id uuid,
  p_members jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  member jsonb;
  updated_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if coalesce(trim(p_core_product_key), '') = '' then
    raise exception 'core_product_key is required';
  end if;

  if p_representative_equipment_id is null then
    raise exception 'representative_equipment_id is required';
  end if;

  if p_members is null or jsonb_typeof(p_members) <> 'array' then
    raise exception 'members payload must be a JSON array';
  end if;

  for member in select value from jsonb_array_elements(p_members)
  loop
    update public.equipment_intelligence
    set
      core_product_name = coalesce(nullif(trim(member->>'core_product_name'), ''), core_product_name),
      core_product_key = coalesce(nullif(trim(member->>'core_product_key'), ''), core_product_key),
      product_family = coalesce(nullif(trim(member->>'product_family'), ''), product_family),
      variant_type = coalesce(nullif(trim(member->>'variant_type'), ''), variant_type),
      variant_name = coalesce(nullif(trim(member->>'variant_name'), ''), variant_name),
      core_product_group_confidence = coalesce(
        nullif(member->>'core_product_group_confidence', '')::numeric,
        core_product_group_confidence
      ),
      is_base_product = (id = (member->>'equipment_id')::uuid),
      core_product_group_status = 'approved',
      updated_at = now()
    where id = (member->>'equipment_id')::uuid
      and core_product_group_status <> 'excluded';

    updated_count := updated_count + 1;
  end loop;

  update public.equipment_intelligence
  set is_base_product = (id = p_representative_equipment_id)
  where core_product_key = p_core_product_key
    and core_product_group_status = 'approved';

  return updated_count;
end;
$$;

-- Mark every row in a suggested group as not a duplicate (review-only dismissal).
create or replace function public.admin_mark_core_product_group_not_duplicate(
  p_core_product_key text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if coalesce(trim(p_core_product_key), '') = '' then
    raise exception 'core_product_key is required';
  end if;

  update public.equipment_intelligence
  set
    core_product_group_status = 'not_duplicate',
    is_base_product = false,
    updated_at = now()
  where core_product_key = p_core_product_key;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- Mark members by equipment id list when core_product_key is not yet persisted.
create or replace function public.admin_mark_core_product_members_not_duplicate(
  p_equipment_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_intelligence
  set
    core_product_group_status = 'not_duplicate',
    is_base_product = false,
    updated_at = now()
  where id = any(p_equipment_ids);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.admin_update_core_product_member(
  p_equipment_id uuid,
  p_core_product_name text default null,
  p_core_product_key text default null,
  p_product_family text default null,
  p_variant_type text default null,
  p_variant_name text default null,
  p_is_base_product boolean default null,
  p_core_product_group_confidence numeric default null
)
returns public.equipment_intelligence
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_intelligence;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_intelligence
  set
    core_product_name = coalesce(nullif(trim(p_core_product_name), ''), core_product_name),
    core_product_key = coalesce(nullif(trim(p_core_product_key), ''), core_product_key),
    product_family = coalesce(nullif(trim(p_product_family), ''), product_family),
    variant_type = coalesce(nullif(trim(p_variant_type), ''), variant_type),
    variant_name = coalesce(nullif(trim(p_variant_name), ''), variant_name),
    is_base_product = coalesce(p_is_base_product, is_base_product),
    core_product_group_confidence = coalesce(p_core_product_group_confidence, core_product_group_confidence),
    core_product_group_status = case
      when core_product_group_status in ('excluded', 'approved', 'not_duplicate') then core_product_group_status
      else 'pending'
    end,
    updated_at = now()
  where id = p_equipment_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment row not found';
  end if;

  return result;
end;
$$;

grant execute on function public.admin_persist_and_approve_core_product_group(text, uuid, jsonb) to authenticated;
grant execute on function public.admin_mark_core_product_group_not_duplicate(text) to authenticated;
grant execute on function public.admin_mark_core_product_members_not_duplicate(uuid[]) to authenticated;
