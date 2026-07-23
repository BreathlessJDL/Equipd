-- Bulk image review metadata, candidate linkage, and richer admin list filters.

alter table public.equipment_products
  add column if not exists image_reviewed_at timestamptz,
  add column if not exists image_reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists approved_image_candidate_id uuid references public.equipment_product_image_candidates (id) on delete set null;

comment on column public.equipment_products.image_reviewed_at is
  'When an admin last approved or rejected the currently reviewed image.';
comment on column public.equipment_products.image_reviewed_by is
  'Admin who last approved or rejected the currently reviewed image.';
comment on column public.equipment_products.approved_image_candidate_id is
  'Candidate row that was ultimately approved for the current hero image.';

create or replace function public.admin_pick_latest_equipment_product_image_candidate(
  p_product_id uuid
)
returns public.equipment_product_image_candidates
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_candidate public.equipment_product_image_candidates;
begin
  select *
  into v_candidate
  from public.equipment_product_image_candidates c
  where c.product_id = p_product_id
  order by
    case c.status
      when 'pending' then 0
      when 'approved' then 1
      when 'duplicate' then 2
      when 'rejected' then 3
      else 4
    end,
    coalesce(c.updated_at, c.created_at) desc,
    c.created_at desc
  limit 1;

  return v_candidate;
end;
$$;

create or replace function public.admin_approve_equipment_product_image(p_product_id uuid)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_products;
  v_candidate public.equipment_product_image_candidates;
  v_uid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_candidate := public.admin_pick_latest_equipment_product_image_candidate(p_product_id);

  if v_candidate.id is not null then
    update public.equipment_product_image_candidates
    set
      status = 'approved',
      rejection_reason = null,
      updated_at = now()
    where id = v_candidate.id;
  end if;

  update public.equipment_products
  set
    image_status = 'approved',
    image_failure_reason = null,
    image_updated_at = now(),
    image_reviewed_at = now(),
    image_reviewed_by = coalesce(v_uid, image_reviewed_by),
    approved_image_candidate_id = coalesce(v_candidate.id, approved_image_candidate_id),
    updated_at = now()
  where id = p_product_id
    and (
      nullif(trim(image_url), '') is not null
      or nullif(trim(image_storage_path), '') is not null
    )
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product image not found or missing image_url/image_storage_path';
  end if;

  return result;
end;
$$;

create or replace function public.admin_reject_equipment_product_image(
  p_product_id uuid,
  p_reason text default null
)
returns public.equipment_products
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_products;
  v_candidate public.equipment_product_image_candidates;
  v_uid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_candidate := public.admin_pick_latest_equipment_product_image_candidate(p_product_id);

  if v_candidate.id is not null and v_candidate.status <> 'approved' then
    update public.equipment_product_image_candidates
    set
      status = 'rejected',
      rejection_reason = coalesce(nullif(trim(p_reason), ''), rejection_reason, 'rejected_in_admin_review'),
      updated_at = now()
    where id = v_candidate.id;
  end if;

  update public.equipment_products
  set
    image_status = 'rejected',
    image_url = null,
    image_storage_path = null,
    image_failure_reason = coalesce(nullif(trim(p_reason), ''), image_failure_reason),
    image_updated_at = now(),
    image_reviewed_at = now(),
    image_reviewed_by = coalesce(v_uid, image_reviewed_by),
    approved_image_candidate_id = case
      when v_candidate.id is not null and v_candidate.status = 'approved' then approved_image_candidate_id
      else null
    end,
    updated_at = now()
  where id = p_product_id
  returning * into result;

  if result.id is null then
    raise exception 'Equipment product not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_list_equipment_products(
  p_search text default null,
  p_brand text default null,
  p_status text default null,
  p_equipment_type text default null,
  p_completion text default null,
  p_attention text default null,
  p_image_filter text default null,
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'canonical_product_name',
  p_sort_dir text default 'asc',
  p_image_search_job_id uuid default null,
  p_image_source_domain text default null,
  p_min_image_confidence integer default null,
  p_min_candidate_score numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_offset integer;
  v_sort text := lower(coalesce(nullif(btrim(p_sort), ''), 'canonical_product_name'));
  v_dir text := case when lower(coalesce(p_sort_dir, 'asc')) = 'desc' then 'desc' else 'asc' end;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_domain text := lower(nullif(btrim(coalesce(p_image_source_domain, '')), ''));
  v_total bigint := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_sort not in (
    'canonical_product_name',
    'brand',
    'status',
    'updated_at',
    'original_base_price',
    'baseline_manufacture_year',
    'equipment_type'
  ) then
    v_sort := 'canonical_product_name';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with filtered as (
    select
      p.*,
      public.equipment_product_content_status(p.id) as content_generation_status,
      coalesce(cardinality(p.source_intelligence_row_ids), 0) as source_row_count,
      public.equipment_product_completion_status(p) as completion_status,
      lc.id as latest_image_candidate_id,
      lc.status as latest_image_candidate_status,
      lc.job_id as latest_image_candidate_job_id,
      lc.source_domain as latest_image_candidate_source_domain,
      lc.overall_score as latest_image_candidate_score,
      lc.identity_score as latest_image_candidate_identity_score,
      lc.rejection_reason as latest_image_candidate_rejection_reason
    from public.equipment_products p
    left join lateral (
      select
        c.id,
        c.status,
        c.job_id,
        c.source_domain,
        c.overall_score,
        c.identity_score,
        c.rejection_reason
      from public.equipment_product_image_candidates c
      where c.product_id = p.id
      order by
        case c.status
          when 'pending' then 0
          when 'approved' then 1
          when 'duplicate' then 2
          when 'rejected' then 3
          else 4
        end,
        coalesce(c.updated_at, c.created_at) desc,
        c.created_at desc
      limit 1
    ) lc on true
    where
      (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = btrim(p_brand))
      and (nullif(btrim(coalesce(p_status, '')), '') is null or p.status = btrim(p_status))
      and (
        nullif(btrim(coalesce(p_equipment_type, '')), '') is null
        or p.equipment_type = btrim(p_equipment_type)
      )
      and (
        v_search is null
        or p.canonical_product_name ilike '%' || v_search || '%'
        or p.canonical_product_key ilike '%' || v_search || '%'
        or p.model ilike '%' || v_search || '%'
        or p.brand ilike '%' || v_search || '%'
        or coalesce(p.product_family, '') ilike '%' || v_search || '%'
        or coalesce(p.equipment_type, '') ilike '%' || v_search || '%'
      )
      and public.equipment_product_matches_completion_filter(p, p_completion)
      and public.equipment_product_matches_image_filter(p, p_image_filter)
      and public.equipment_product_matches_attention(
        p,
        public.equipment_product_content_status(p.id),
        p_attention
      )
      and (
        p_image_search_job_id is null
        or exists (
          select 1
          from public.equipment_product_image_candidates c2
          where c2.product_id = p.id
            and c2.job_id = p_image_search_job_id
        )
      )
      and (
        v_domain is null
        or lower(coalesce(nullif(btrim(p.image_source_domain), ''), nullif(btrim(lc.source_domain), ''))) = v_domain
      )
      and (
        p_min_image_confidence is null
        or coalesce(p.image_confidence, 0) >= p_min_image_confidence
      )
      and (
        p_min_candidate_score is null
        or coalesce(lc.overall_score, 0) >= p_min_candidate_score
      )
  ),
  counted as (
    select count(*)::bigint as total_count from filtered
  ),
  ordered as (
    select *
    from filtered
    order by
      case when v_sort = 'canonical_product_name' and v_dir = 'asc' then canonical_product_name end asc nulls last,
      case when v_sort = 'canonical_product_name' and v_dir = 'desc' then canonical_product_name end desc nulls last,
      case when v_sort = 'brand' and v_dir = 'asc' then brand end asc nulls last,
      case when v_sort = 'brand' and v_dir = 'desc' then brand end desc nulls last,
      case when v_sort = 'status' and v_dir = 'asc' then status end asc nulls last,
      case when v_sort = 'status' and v_dir = 'desc' then status end desc nulls last,
      case when v_sort = 'updated_at' and v_dir = 'asc' then updated_at end asc nulls last,
      case when v_sort = 'updated_at' and v_dir = 'desc' then updated_at end desc nulls last,
      case when v_sort = 'original_base_price' and v_dir = 'asc' then original_base_price end asc nulls last,
      case when v_sort = 'original_base_price' and v_dir = 'desc' then original_base_price end desc nulls last,
      case when v_sort = 'baseline_manufacture_year' and v_dir = 'asc' then baseline_manufacture_year end asc nulls last,
      case when v_sort = 'baseline_manufacture_year' and v_dir = 'desc' then baseline_manufacture_year end desc nulls last,
      case when v_sort = 'equipment_type' and v_dir = 'asc' then equipment_type end asc nulls last,
      case when v_sort = 'equipment_type' and v_dir = 'desc' then equipment_type end desc nulls last,
      id asc
    offset v_offset
    limit v_page_size
  )
  select
    (select total_count from counted),
    coalesce(
      (
        select jsonb_agg(to_jsonb(row_payload) order by row_ord)
        from (
          select
            o.id,
            o.brand,
            o.product_family,
            o.model,
            o.equipment_type,
            o.canonical_product_name,
            o.canonical_product_key,
            o.baseline_manufacture_year,
            o.production_start_year,
            o.production_end_year,
            o.original_base_price,
            o.original_base_price_currency,
            o.original_price_confidence,
            o.baseline_source,
            o.status,
            o.image_url,
            o.image_storage_path,
            o.image_source_url,
            o.image_source_domain,
            o.image_confidence,
            o.image_status,
            o.image_failure_reason,
            o.image_updated_at,
            o.image_reviewed_at,
            o.image_reviewed_by,
            o.approved_image_candidate_id,
            o.updated_at,
            o.created_at,
            o.source_intelligence_row_ids,
            o.source_row_count,
            o.content_generation_status,
            o.completion_status,
            o.latest_image_candidate_id,
            o.latest_image_candidate_status,
            o.latest_image_candidate_job_id,
            o.latest_image_candidate_source_domain,
            o.latest_image_candidate_score,
            o.latest_image_candidate_identity_score,
            o.latest_image_candidate_rejection_reason,
            row_number() over () as row_ord
          from ordered o
        ) row_payload
      ),
      '[]'::jsonb
    )
  into v_total, v_rows;

  return jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

revoke all on function public.admin_list_equipment_products(
  text, text, text, text, text, text, text, integer, integer, text, text, uuid, text, integer, numeric
) from public;

grant execute on function public.admin_list_equipment_products(
  text, text, text, text, text, text, text, integer, integer, text, text, uuid, text, integer, numeric
) to authenticated;
