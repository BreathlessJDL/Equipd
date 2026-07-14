-- Additive admin catalogue list/summary RPCs for the Intelligence Products dashboard.
-- Does not alter product data, statuses, pricing, or public RLS behaviour.

create index if not exists equipment_products_brand_status_name_idx
  on public.equipment_products (brand, status, canonical_product_name);

create index if not exists equipment_products_updated_at_desc_idx
  on public.equipment_products (updated_at desc);

create index if not exists equipment_products_equipment_type_idx
  on public.equipment_products (equipment_type)
  where equipment_type is not null;

create index if not exists equipment_products_baseline_year_idx
  on public.equipment_products (baseline_manufacture_year)
  where baseline_manufacture_year is not null;

-- Mirror JS productHasRrp / hasCanonicalProductBasePrice
create or replace function public.equipment_product_has_rrp(p public.equipment_products)
returns boolean
language sql
immutable
as $$
  select p.original_base_price is not null
    and p.original_base_price::numeric > 0;
$$;

-- Mirror JS productHasBaselineYear (attention): year present
create or replace function public.equipment_product_has_baseline_year(p public.equipment_products)
returns boolean
language sql
immutable
as $$
  select p.baseline_manufacture_year is not null;
$$;

-- Mirror JS isValidCanonicalBaselineYear / hasCanonicalProductBaselineYear (completion)
create or replace function public.equipment_product_has_valid_baseline_year(p public.equipment_products)
returns boolean
language sql
stable
as $$
  select p.baseline_manufacture_year is not null
    and p.baseline_manufacture_year >= 1970
    and p.baseline_manufacture_year <= (extract(year from timezone('utc', now()))::integer + 1);
$$;

-- Mirror JS productHasDisplayableImage
create or replace function public.equipment_product_has_displayable_image(p public.equipment_products)
returns boolean
language sql
immutable
as $$
  select p.image_status = 'approved'
    and (
      nullif(btrim(coalesce(p.image_url, '')), '') is not null
      or nullif(btrim(coalesce(p.image_storage_path, '')), '') is not null
    );
$$;

-- Mirror JS deriveCanonicalProductCompletionStatus (excluded => null)
create or replace function public.equipment_product_completion_status(p public.equipment_products)
returns text
language sql
stable
as $$
  select case
    when p.status = 'excluded' then null
    when public.equipment_product_has_rrp(p)
      and public.equipment_product_has_valid_baseline_year(p) then 'complete'
    when not public.equipment_product_has_rrp(p)
      and not public.equipment_product_has_valid_baseline_year(p) then 'missing_both'
    when not public.equipment_product_has_rrp(p) then 'missing_price'
    else 'missing_baseline'
  end;
$$;

create or replace function public.equipment_product_content_status(p_product_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.generation_status
  from public.equipment_product_content c
  where c.equipment_product_id = p_product_id
  limit 1;
$$;

-- Mirror JS productNeedsImage / NeedsContent / Ready / Attention helpers
create or replace function public.equipment_product_needs_image(p public.equipment_products)
returns boolean
language sql
immutable
as $$
  select not public.equipment_product_has_displayable_image(p)
    or p.image_status = 'suggested';
$$;

create or replace function public.equipment_product_needs_content(
  p public.equipment_products,
  p_content_status text
)
returns boolean
language sql
immutable
as $$
  select p_content_status is null
    or p_content_status in ('draft', 'stale', 'rejected');
$$;

create or replace function public.equipment_product_is_catalogue_ready(
  p public.equipment_products,
  p_content_status text
)
returns boolean
language sql
immutable
as $$
  select p.status = 'approved'
    and public.equipment_product_has_rrp(p)
    and public.equipment_product_has_baseline_year(p)
    and not public.equipment_product_needs_image(p)
    and p_content_status = 'approved';
$$;

create or replace function public.equipment_product_matches_attention(
  p public.equipment_products,
  p_content_status text,
  p_attention text
)
returns boolean
language sql
immutable
as $$
  select case coalesce(nullif(btrim(p_attention), ''), 'all')
    when 'all' then true
    when 'ready' then public.equipment_product_is_catalogue_ready(p, p_content_status)
    when 'attention' then not public.equipment_product_is_catalogue_ready(p, p_content_status)
    when 'needs_image' then public.equipment_product_needs_image(p)
    when 'needs_price' then not public.equipment_product_has_rrp(p)
    when 'needs_year' then not public.equipment_product_has_baseline_year(p)
    when 'needs_content' then public.equipment_product_needs_content(p, p_content_status)
    when 'needs_review' then p.status in ('pending', 'needs_review')
    when 'failed_content' then p_content_status = 'failed'
    else true
  end;
$$;

create or replace function public.equipment_product_matches_completion_filter(
  p public.equipment_products,
  p_completion text
)
returns boolean
language sql
stable
as $$
  select case coalesce(nullif(btrim(p_completion), ''), '')
    when '' then true
    when 'all' then true
    when 'complete' then public.equipment_product_completion_status(p) = 'complete'
    when 'incomplete' then
      public.equipment_product_completion_status(p) is not null
      and public.equipment_product_completion_status(p) <> 'complete'
    when 'missing_price' then public.equipment_product_completion_status(p) = 'missing_price'
    when 'missing_baseline' then public.equipment_product_completion_status(p) = 'missing_baseline'
    when 'missing_both' then public.equipment_product_completion_status(p) = 'missing_both'
    else public.equipment_product_completion_status(p) = p_completion
  end;
$$;

create or replace function public.equipment_product_matches_image_filter(
  p public.equipment_products,
  p_image_filter text
)
returns boolean
language sql
immutable
as $$
  select case coalesce(nullif(btrim(p_image_filter), ''), '')
    when '' then true
    when 'all' then true
    when 'has_image' then nullif(btrim(coalesce(p.image_url, '')), '') is not null
    when 'suggested' then p.image_status = 'suggested'
    when 'approved' then
      p.image_status = 'approved'
      and nullif(btrim(coalesce(p.image_url, '')), '') is not null
    when 'needs_review' then p.image_status = 'suggested'
    when 'blocked_rejected' then p.image_status in ('rejected', 'failed')
    else true
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
  p_sort_dir text default 'asc'
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
      public.equipment_product_completion_status(p) as completion_status
    from public.equipment_products p
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
            o.updated_at,
            o.created_at,
            o.source_intelligence_row_ids,
            o.source_row_count,
            o.content_generation_status,
            o.completion_status,
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

revoke all on function public.equipment_product_has_rrp(public.equipment_products) from public;
revoke all on function public.equipment_product_has_baseline_year(public.equipment_products) from public;
revoke all on function public.equipment_product_has_valid_baseline_year(public.equipment_products) from public;
revoke all on function public.equipment_product_has_displayable_image(public.equipment_products) from public;
revoke all on function public.equipment_product_completion_status(public.equipment_products) from public;
revoke all on function public.equipment_product_content_status(uuid) from public;
revoke all on function public.equipment_product_needs_image(public.equipment_products) from public;
revoke all on function public.equipment_product_needs_content(public.equipment_products, text) from public;
revoke all on function public.equipment_product_is_catalogue_ready(public.equipment_products, text) from public;
revoke all on function public.equipment_product_matches_attention(public.equipment_products, text, text) from public;
revoke all on function public.equipment_product_matches_completion_filter(public.equipment_products, text) from public;
revoke all on function public.equipment_product_matches_image_filter(public.equipment_products, text) from public;

revoke all on function public.admin_list_equipment_products(
  text, text, text, text, text, text, text, integer, integer, text, text
) from public;

grant execute on function public.admin_list_equipment_products(
  text, text, text, text, text, text, text, integer, integer, text, text
) to authenticated;

create or replace function public.admin_equipment_products_dashboard_meta()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary jsonb;
  v_status jsonb;
  v_completion jsonb;
  v_filter_options jsonb;
  v_by_brand jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  with products as (
    select
      p.*,
      public.equipment_product_content_status(p.id) as content_generation_status
    from public.equipment_products p
  )
  select jsonb_build_object(
    'total', count(*)::int,
    'ready', count(*) filter (
      where public.equipment_product_is_catalogue_ready(p, p.content_generation_status)
    )::int,
    'needsAttention', count(*) filter (
      where not public.equipment_product_is_catalogue_ready(p, p.content_generation_status)
    )::int,
    'missingImage', count(*) filter (
      where not (
        public.equipment_product_has_displayable_image(p)
        and p.image_status = 'approved'
      )
    )::int,
    'missingRrp', count(*) filter (where not public.equipment_product_has_rrp(p))::int,
    'missingYear', count(*) filter (where not public.equipment_product_has_baseline_year(p))::int,
    'missingContent', count(*) filter (
      where coalesce(p.content_generation_status, '') <> 'approved'
    )::int,
    'failedGeneration', count(*) filter (
      where p.content_generation_status = 'failed'
    )::int,
    'needsReview', count(*) filter (
      where p.status in ('pending', 'needs_review')
    )::int,
    'imageCoveragePct', case when count(*) = 0 then 0 else round(
      100.0 * count(*) filter (
        where public.equipment_product_has_displayable_image(p)
          and p.image_status = 'approved'
      ) / count(*)
    )::int end,
    'rrpCoveragePct', case when count(*) = 0 then 0 else round(
      100.0 * count(*) filter (where public.equipment_product_has_rrp(p)) / count(*)
    )::int end,
    'yearCoveragePct', case when count(*) = 0 then 0 else round(
      100.0 * count(*) filter (where public.equipment_product_has_baseline_year(p)) / count(*)
    )::int end,
    'contentCoveragePct', case when count(*) = 0 then 0 else round(
      100.0 * count(*) filter (where p.content_generation_status = 'approved') / count(*)
    )::int end
  )
  into v_summary
  from products p;

  select jsonb_build_object(
    'pending', count(*) filter (where status = 'pending')::int,
    'needs_review', count(*) filter (where status = 'needs_review')::int,
    'approved', count(*) filter (where status = 'approved')::int,
    'excluded', count(*) filter (where status = 'excluded')::int
  )
  into v_status
  from public.equipment_products;

  with approved as (
    select
      p.*,
      public.equipment_product_completion_status(p) as completion_status
    from public.equipment_products p
    where p.status = 'approved'
  ),
  overall as (
    select
      count(*)::int as total_approved,
      count(*) filter (where completion_status = 'complete')::int as completed,
      count(*) filter (
        where completion_status is not null and completion_status <> 'complete'
      )::int as incomplete,
      count(*) filter (where completion_status = 'missing_price')::int as missing_price_only,
      count(*) filter (where completion_status = 'missing_baseline')::int as missing_baseline_only,
      count(*) filter (where completion_status = 'missing_both')::int as missing_both
    from approved
  )
  select jsonb_build_object(
    'overall', jsonb_build_object(
      'totalApproved', o.total_approved,
      'completed', o.completed,
      'incomplete', o.incomplete,
      'completionPercentage', case
        when o.total_approved = 0 then 0
        else round((o.completed::numeric * 1000) / o.total_approved) / 10
      end,
      'breakdown', jsonb_build_object(
        'missingPriceOnly', o.missing_price_only,
        'missingBaselineOnly', o.missing_baseline_only,
        'missingBoth', o.missing_both
      )
    )
  )
  into v_completion
  from overall o;

  with approved as (
    select
      coalesce(nullif(btrim(brand), ''), 'Unknown') as brand,
      public.equipment_product_completion_status(p) as completion_status
    from public.equipment_products p
    where p.status = 'approved'
  ),
  by_brand as (
    select
      brand,
      count(*)::int as total_approved,
      count(*) filter (where completion_status = 'complete')::int as completed,
      count(*) filter (
        where completion_status is not null and completion_status <> 'complete'
      )::int as incomplete
    from approved
    group by brand
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'brand', brand,
        'totalApproved', total_approved,
        'completed', completed,
        'incomplete', incomplete,
        'completionPercentage', case
          when total_approved = 0 then 0
          else round((completed::numeric * 1000) / total_approved) / 10
        end
      )
      order by incomplete desc, brand asc
    ),
    '[]'::jsonb
  )
  into v_by_brand
  from by_brand;

  select jsonb_build_object(
    'brands', coalesce(
      (
        select jsonb_agg(brand order by brand)
        from (
          select distinct brand
          from public.equipment_products
          where brand is not null and btrim(brand) <> ''
        ) brands
      ),
      '[]'::jsonb
    ),
    'equipmentTypes', coalesce(
      (
        select jsonb_agg(equipment_type order by equipment_type)
        from (
          select distinct equipment_type
          from public.equipment_products
          where equipment_type is not null and btrim(equipment_type) <> ''
        ) types
      ),
      '[]'::jsonb
    )
  )
  into v_filter_options;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'statusCounts', coalesce(v_status, '{}'::jsonb),
    'completion', coalesce(v_completion, '{}'::jsonb) || jsonb_build_object('byBrand', coalesce(v_by_brand, '[]'::jsonb)),
    'filterOptions', coalesce(v_filter_options, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_equipment_products_dashboard_meta() from public;
grant execute on function public.admin_equipment_products_dashboard_meta() to authenticated;
