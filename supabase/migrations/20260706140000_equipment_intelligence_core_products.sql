-- Equipment Intelligence: core product / variant grouping
-- Groups console variants under one base product for research and future valuation modifiers.

alter table public.equipment_intelligence
  add column if not exists core_product_name text,
  add column if not exists core_product_key text,
  add column if not exists variant_type text,
  add column if not exists variant_name text,
  add column if not exists is_base_product boolean not null default false,
  add column if not exists core_product_group_status text not null default 'pending',
  add column if not exists core_product_group_confidence numeric,
  add column if not exists base_original_price numeric,
  add column if not exists console_modifier_price numeric;

comment on column public.equipment_intelligence.core_product_name is
  'Canonical base product label, e.g. Life Fitness PowerMill.';

comment on column public.equipment_intelligence.core_product_key is
  'Stable slug key for grouping variants of the same base product.';

comment on column public.equipment_intelligence.variant_type is
  'Variant category, e.g. console.';

comment on column public.equipment_intelligence.variant_name is
  'Variant label stripped from model, e.g. SE3HD.';

comment on column public.equipment_intelligence.is_base_product is
  'True when this row is the approved representative/base product for its core_product_key group.';

comment on column public.equipment_intelligence.core_product_group_status is
  'Grouping review status: pending, auto, approved, excluded.';

comment on column public.equipment_intelligence.base_original_price is
  'Future valuation: base product original RRP before console modifiers.';

comment on column public.equipment_intelligence.console_modifier_price is
  'Future valuation: console variant price adjustment. final = base + modifier.';

create index if not exists equipment_intelligence_core_product_key_idx
  on public.equipment_intelligence (core_product_key);

create index if not exists equipment_intelligence_core_product_group_status_idx
  on public.equipment_intelligence (core_product_group_status);

alter table public.equipment_intelligence
  drop constraint if exists equipment_intelligence_core_product_group_status_check;

alter table public.equipment_intelligence
  add constraint equipment_intelligence_core_product_group_status_check
  check (core_product_group_status in ('pending', 'auto', 'approved', 'excluded'));

-- Approve a core product group: set status, representative flag, optional name override.
create or replace function public.admin_approve_core_product_group(
  p_core_product_key text,
  p_representative_equipment_id uuid,
  p_core_product_name text default null
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

  if p_representative_equipment_id is null then
    raise exception 'representative_equipment_id is required';
  end if;

  update public.equipment_intelligence
  set
    is_base_product = false,
    updated_at = now()
  where core_product_key = p_core_product_key;

  update public.equipment_intelligence
  set
    core_product_group_status = 'approved',
    is_base_product = (id = p_representative_equipment_id),
    core_product_name = coalesce(nullif(trim(p_core_product_name), ''), core_product_name),
    updated_at = now()
  where core_product_key = p_core_product_key
    and core_product_group_status <> 'excluded';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- Exclude one row from its core product group.
create or replace function public.admin_exclude_core_product_member(
  p_equipment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_intelligence
  set
    core_product_group_status = 'excluded',
    is_base_product = false,
    updated_at = now()
  where id = p_equipment_id;
end;
$$;

-- Update core product / variant fields for one equipment row.
create or replace function public.admin_update_core_product_member(
  p_equipment_id uuid,
  p_core_product_name text default null,
  p_core_product_key text default null,
  p_variant_type text default null,
  p_variant_name text default null,
  p_is_base_product boolean default null
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
    variant_type = coalesce(nullif(trim(p_variant_type), ''), variant_type),
    variant_name = coalesce(nullif(trim(p_variant_name), ''), variant_name),
    is_base_product = coalesce(p_is_base_product, is_base_product),
    core_product_group_status = case
      when core_product_group_status = 'excluded' then 'excluded'
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

grant execute on function public.admin_approve_core_product_group(text, uuid, text) to authenticated;
grant execute on function public.admin_exclude_core_product_member(uuid) to authenticated;
grant execute on function public.admin_update_core_product_member(uuid, text, text, text, text, boolean) to authenticated;
