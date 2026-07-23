-- Bulk canonical product image search jobs.
-- Progress is durable so work survives page refresh.
-- Candidates stay pending (suggested); bulk search never auto-approves.

-- ---------------------------------------------------------------------------
-- Status vocabulary
-- ---------------------------------------------------------------------------

alter table public.equipment_products
  drop constraint if exists equipment_products_image_status_check;

alter table public.equipment_products
  add constraint equipment_products_image_status_check
  check (image_status in (
    'missing',
    'queued',
    'searching',
    'suggested',
    'approved',
    'rejected',
    'failed',
    'no_result'
  ));

comment on column public.equipment_products.image_status is
  'Product image lifecycle: missing | queued | searching | suggested (pending review) | approved | rejected | failed | no_result';

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_product_image_search_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'cancelled', 'failed')),
  selection_mode text not null
    check (selection_mode in ('page', 'filtered')),
  filters jsonb not null default '{}'::jsonb,
  include_approved boolean not null default false,
  total_selected integer not null default 0,
  total_eligible integer not null default 0,
  total_skipped_approved integer not null default 0,
  total_queued integer not null default 0,
  total_searching integer not null default 0,
  total_candidate_found integer not null default 0,
  total_no_result integer not null default 0,
  total_failed integer not null default 0,
  total_skipped integer not null default 0,
  total_completed integer not null default 0,
  max_products integer not null default 100,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipment_product_image_search_jobs_status_idx
  on public.equipment_product_image_search_jobs (status, created_at desc);

create table if not exists public.equipment_product_image_search_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.equipment_product_image_search_jobs (id) on delete cascade,
  product_id uuid not null references public.equipment_products (id) on delete cascade,
  status text not null default 'queued'
    check (status in (
      'queued',
      'searching',
      'candidate_found',
      'no_result',
      'failed',
      'skipped_approved',
      'cancelled'
    )),
  skip_reason text,
  error_message text,
  search_queries text[] default '{}',
  candidates_saved integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, product_id)
);

create index if not exists equipment_product_image_search_job_items_job_status_idx
  on public.equipment_product_image_search_job_items (job_id, status);

create index if not exists equipment_product_image_search_job_items_product_idx
  on public.equipment_product_image_search_job_items (product_id, status);

-- At most one active (queued/searching) item per product across all jobs.
create unique index if not exists equipment_product_image_search_active_product_uidx
  on public.equipment_product_image_search_job_items (product_id)
  where status in ('queued', 'searching');

create table if not exists public.equipment_product_image_candidates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.equipment_products (id) on delete cascade,
  job_id uuid references public.equipment_product_image_search_jobs (id) on delete set null,
  job_item_id uuid references public.equipment_product_image_search_job_items (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'duplicate')),
  source_page_url text,
  image_url text not null,
  image_url_normalized text not null,
  source_domain text,
  source_type text,
  search_query text,
  identity_score numeric,
  source_quality_score numeric,
  overall_score numeric,
  rejection_reason text,
  storage_path text,
  searched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists equipment_product_image_candidates_product_url_uidx
  on public.equipment_product_image_candidates (product_id, image_url_normalized);

create index if not exists equipment_product_image_candidates_product_status_idx
  on public.equipment_product_image_candidates (product_id, status);

create index if not exists equipment_product_image_candidates_job_idx
  on public.equipment_product_image_candidates (job_id)
  where job_id is not null;

alter table public.equipment_product_image_search_jobs enable row level security;
alter table public.equipment_product_image_search_job_items enable row level security;
alter table public.equipment_product_image_candidates enable row level security;

drop policy if exists "Admins manage image search jobs" on public.equipment_product_image_search_jobs;
create policy "Admins manage image search jobs"
  on public.equipment_product_image_search_jobs for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage image search job items" on public.equipment_product_image_search_job_items;
create policy "Admins manage image search job items"
  on public.equipment_product_image_search_job_items for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins manage image candidates" on public.equipment_product_image_candidates;
create policy "Admins manage image candidates"
  on public.equipment_product_image_candidates for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.equipment_product_image_search_jobs to authenticated;
grant select, insert, update, delete on public.equipment_product_image_search_job_items to authenticated;
grant select, insert, update, delete on public.equipment_product_image_candidates to authenticated;

-- ---------------------------------------------------------------------------
-- Image filter helpers (list + job creation)
-- ---------------------------------------------------------------------------

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
    when 'missing' then p.image_status = 'missing' or (
      p.image_status is distinct from 'approved'
      and nullif(btrim(coalesce(p.image_url, '')), '') is null
    )
    when 'queued' then p.image_status = 'queued'
    when 'searching' then p.image_status = 'searching'
    when 'suggested' then p.image_status = 'suggested'
    when 'pending_review' then p.image_status = 'suggested'
    when 'needs_review' then p.image_status = 'suggested'
    when 'approved' then
      p.image_status = 'approved'
      and nullif(btrim(coalesce(p.image_url, '')), '') is not null
    when 'no_result' then p.image_status = 'no_result'
    when 'failed' then p.image_status = 'failed'
    when 'blocked_rejected' then p.image_status in ('rejected', 'failed')
    else true
  end;
$$;

create or replace function public.equipment_product_matches_list_filters(
  p public.equipment_products,
  p_search text default null,
  p_brand text default null,
  p_status text default null,
  p_equipment_type text default null,
  p_completion text default null,
  p_attention text default null,
  p_image_filter text default null
)
returns boolean
language plpgsql
stable
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_brand text := nullif(btrim(coalesce(p_brand, '')), '');
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_type text := nullif(btrim(coalesce(p_equipment_type, '')), '');
  v_completion text := lower(coalesce(nullif(btrim(p_completion), ''), 'all'));
  v_attention text := lower(coalesce(nullif(btrim(p_attention), ''), 'all'));
  v_has_price boolean := p.original_base_price is not null and p.original_base_price > 0;
  v_has_year boolean := p.baseline_manufacture_year is not null;
begin
  if v_brand is not null and lower(coalesce(p.brand, '')) <> lower(v_brand) then
    return false;
  end if;

  if v_status is not null and coalesce(p.status, '') <> v_status then
    return false;
  end if;

  if v_type is not null and lower(coalesce(p.equipment_type, '')) <> lower(v_type) then
    return false;
  end if;

  if v_search is not null then
    if position(lower(v_search) in lower(concat_ws(' ',
      p.brand, p.product_family, p.model, p.equipment_type,
      p.canonical_product_name, p.canonical_product_key
    ))) = 0 then
      return false;
    end if;
  end if;

  if not public.equipment_product_matches_image_filter(p, p_image_filter) then
    return false;
  end if;

  if v_completion = 'complete' and not (v_has_price and v_has_year) then
    return false;
  elsif v_completion = 'incomplete' and (v_has_price and v_has_year) then
    return false;
  elsif v_completion = 'missing_price' and v_has_price then
    return false;
  elsif v_completion = 'missing_baseline' and v_has_year then
    return false;
  elsif v_completion = 'missing_both' and (v_has_price or v_has_year) then
    return false;
  end if;

  if v_attention in ('needs_image', 'needs_price', 'needs_year', 'needs_review', 'ready') then
    -- Attention filters reused from list RPC semantics where practical.
    if v_attention = 'needs_image' and p.image_status = 'approved'
      and nullif(btrim(coalesce(p.image_url, '')), '') is not null then
      return false;
    elsif v_attention = 'needs_price' and v_has_price then
      return false;
    elsif v_attention = 'needs_year' and v_has_year then
      return false;
    elsif v_attention = 'needs_review' and p.status is distinct from 'needs_review' then
      return false;
    elsif v_attention = 'ready' and not (
      p.status = 'approved'
      and v_has_price
      and v_has_year
      and p.image_status = 'approved'
      and nullif(btrim(coalesce(p.image_url, '')), '') is not null
    ) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.admin_recount_equipment_product_image_search_job(p_job_id uuid)
returns public.equipment_product_image_search_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.equipment_product_image_search_jobs;
  v_remaining integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_product_image_search_jobs j
  set
    total_queued = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status = 'queued'),
    total_searching = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status = 'searching'),
    total_candidate_found = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status = 'candidate_found'),
    total_no_result = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status = 'no_result'),
    total_failed = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status = 'failed'),
    total_skipped = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status in ('skipped_approved', 'cancelled')),
    total_completed = (select count(*)::integer from public.equipment_product_image_search_job_items i where i.job_id = j.id and i.status in ('candidate_found', 'no_result', 'failed', 'skipped_approved', 'cancelled')),
    updated_at = now()
  where j.id = p_job_id
  returning * into result;

  select count(*)::integer into v_remaining
  from public.equipment_product_image_search_job_items
  where job_id = p_job_id and status in ('queued', 'searching');

  if result.status in ('queued', 'running') and v_remaining = 0 then
    update public.equipment_product_image_search_jobs
    set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = p_job_id
    returning * into result;
  elsif result.status = 'queued' and exists (
    select 1 from public.equipment_product_image_search_job_items
    where job_id = p_job_id and status = 'searching'
  ) then
    update public.equipment_product_image_search_jobs
    set status = 'running', started_at = coalesce(started_at, now()), updated_at = now()
    where id = p_job_id
    returning * into result;
  end if;

  return result;
end;
$$;

create or replace function public.admin_create_equipment_product_image_search_job(
  p_selection_mode text,
  p_product_ids uuid[] default null,
  p_search text default null,
  p_brand text default null,
  p_status text default null,
  p_equipment_type text default null,
  p_completion text default null,
  p_attention text default null,
  p_image_filter text default null,
  p_include_approved boolean default false,
  p_max_products integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(nullif(btrim(p_selection_mode), ''), ''));
  v_max integer := least(greatest(coalesce(p_max_products, 100), 1), 200);
  v_job public.equipment_product_image_search_jobs;
  v_ids uuid[] := coalesce(p_product_ids, '{}'::uuid[]);
  v_selected uuid[] := '{}'::uuid[];
  v_eligible uuid[] := '{}'::uuid[];
  v_skipped integer := 0;
  v_product public.equipment_products;
  v_id uuid;
  v_active_count integer := 0;
  v_inserted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_mode not in ('page', 'filtered') then
    raise exception 'selection_mode must be page or filtered';
  end if;

  if v_mode = 'page' then
    if coalesce(array_length(v_ids, 1), 0) = 0 then
      raise exception 'product_ids are required for page selection';
    end if;
    select coalesce(array_agg(s.x), '{}'::uuid[])
    into v_selected
    from (
      select distinct x
      from unnest(v_ids) as t(x)
      limit v_max
    ) s;
  else
    select coalesce(array_agg(p.id order by p.canonical_product_name nulls last, p.id), '{}'::uuid[])
    into v_selected
    from (
      select ep.id, ep.canonical_product_name
      from public.equipment_products ep
      where public.equipment_product_matches_list_filters(
        ep, p_search, p_brand, p_status, p_equipment_type, p_completion, p_attention, p_image_filter
      )
      order by ep.canonical_product_name nulls last, ep.id
      limit v_max
    ) p;
  end if;

  if coalesce(array_length(v_selected, 1), 0) = 0 then
    raise exception 'No products matched the selection';
  end if;

  foreach v_id in array v_selected
  loop
    select * into v_product from public.equipment_products where id = v_id;
    if v_product.id is null then
      continue;
    end if;

    if v_product.image_status = 'approved'
      and nullif(btrim(coalesce(v_product.image_url, '')), '') is not null
      and not coalesce(p_include_approved, false) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select count(*)::integer into v_active_count
    from public.equipment_product_image_search_job_items
    where product_id = v_id and status in ('queued', 'searching');

    if v_active_count > 0 then
      -- Already covered by an active job — skip silently as duplicate prevention.
      continue;
    end if;

    v_eligible := array_append(v_eligible, v_id);
  end loop;

  if coalesce(array_length(v_eligible, 1), 0) = 0 then
    raise exception 'No eligible products to search (all skipped or already queued)';
  end if;

  insert into public.equipment_product_image_search_jobs (
    created_by,
    status,
    selection_mode,
    filters,
    include_approved,
    total_selected,
    total_eligible,
    total_skipped_approved,
    total_queued,
    max_products,
    started_at
  ) values (
    auth.uid(),
    'queued',
    v_mode,
    jsonb_build_object(
      'search', p_search,
      'brand', p_brand,
      'status', p_status,
      'equipment_type', p_equipment_type,
      'completion', p_completion,
      'attention', p_attention,
      'image_filter', p_image_filter
    ),
    coalesce(p_include_approved, false),
    coalesce(array_length(v_selected, 1), 0),
    coalesce(array_length(v_eligible, 1), 0),
    v_skipped,
    coalesce(array_length(v_eligible, 1), 0),
    v_max,
    now()
  )
  returning * into v_job;

  foreach v_id in array v_eligible
  loop
    begin
      insert into public.equipment_product_image_search_job_items (job_id, product_id, status)
      values (v_job.id, v_id, 'queued');

      update public.equipment_products
      set
        image_status = case
          when image_status = 'approved' then image_status
          else 'queued'
        end,
        updated_at = now()
      where id = v_id
        and image_status is distinct from 'approved';

      v_inserted := v_inserted + 1;
    exception
      when unique_violation then
        -- Concurrent job claimed this product.
        null;
    end;
  end loop;

  if v_inserted = 0 then
    update public.equipment_product_image_search_jobs
    set status = 'failed', error_message = 'No products could be queued (duplicate active jobs)', updated_at = now()
    where id = v_job.id;
    raise exception 'No products could be queued (duplicate active jobs)';
  end if;

  perform public.admin_recount_equipment_product_image_search_job(v_job.id);

  select * into v_job from public.equipment_product_image_search_jobs where id = v_job.id;

  return jsonb_build_object(
    'job', to_jsonb(v_job),
    'eligible_count', v_inserted,
    'skipped_approved', v_skipped,
    'selected_count', coalesce(array_length(v_selected, 1), 0)
  );
end;
$$;

create or replace function public.admin_preview_equipment_product_image_search_job(
  p_selection_mode text,
  p_product_ids uuid[] default null,
  p_search text default null,
  p_brand text default null,
  p_status text default null,
  p_equipment_type text default null,
  p_completion text default null,
  p_attention text default null,
  p_image_filter text default null,
  p_include_approved boolean default false,
  p_max_products integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(nullif(btrim(p_selection_mode), ''), ''));
  v_max integer := least(greatest(coalesce(p_max_products, 100), 1), 200);
  v_ids uuid[] := coalesce(p_product_ids, '{}'::uuid[]);
  v_selected uuid[] := '{}'::uuid[];
  v_eligible integer := 0;
  v_skipped integer := 0;
  v_already_active integer := 0;
  v_id uuid;
  v_product public.equipment_products;
  v_active_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_mode = 'page' then
    select coalesce(array_agg(s.x), '{}'::uuid[])
    into v_selected
    from (
      select distinct x
      from unnest(v_ids) as t(x)
      limit v_max
    ) s;
  else
    select coalesce(array_agg(p.id), '{}'::uuid[])
    into v_selected
    from (
      select ep.id
      from public.equipment_products ep
      where public.equipment_product_matches_list_filters(
        ep, p_search, p_brand, p_status, p_equipment_type, p_completion, p_attention, p_image_filter
      )
      order by ep.canonical_product_name nulls last, ep.id
      limit v_max
    ) p;
  end if;

  foreach v_id in array coalesce(v_selected, '{}'::uuid[])
  loop
    select * into v_product from public.equipment_products where id = v_id;
    if v_product.id is null then
      continue;
    end if;

    if v_product.image_status = 'approved'
      and nullif(btrim(coalesce(v_product.image_url, '')), '') is not null
      and not coalesce(p_include_approved, false) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select count(*)::integer into v_active_count
    from public.equipment_product_image_search_job_items
    where product_id = v_id and status in ('queued', 'searching');

    if v_active_count > 0 then
      v_already_active := v_already_active + 1;
      continue;
    end if;

    v_eligible := v_eligible + 1;
  end loop;

  return jsonb_build_object(
    'selection_mode', v_mode,
    'selected_count', coalesce(array_length(v_selected, 1), 0),
    'eligible_count', v_eligible,
    'skipped_approved', v_skipped,
    'already_active', v_already_active,
    'estimated_searches', v_eligible,
    'max_products', v_max,
    'include_approved', coalesce(p_include_approved, false),
    'filters', jsonb_build_object(
      'search', p_search,
      'brand', p_brand,
      'status', p_status,
      'equipment_type', p_equipment_type,
      'completion', p_completion,
      'attention', p_attention,
      'image_filter', p_image_filter
    )
  );
end;
$$;

create or replace function public.admin_get_equipment_product_image_search_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.equipment_product_image_search_jobs;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  perform public.admin_recount_equipment_product_image_search_job(p_job_id);
  select * into v_job from public.equipment_product_image_search_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  return jsonb_build_object(
    'job', to_jsonb(v_job),
    'remaining', (
      select count(*)::integer
      from public.equipment_product_image_search_job_items
      where job_id = p_job_id and status in ('queued', 'searching')
    )
  );
end;
$$;

create or replace function public.admin_list_active_equipment_product_image_search_jobs(
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(j) order by j.created_at desc)
    from (
      select *
      from public.equipment_product_image_search_jobs
      where status in ('queued', 'running')
         or (status = 'completed' and completed_at > now() - interval '2 hours')
      order by created_at desc
      limit least(greatest(coalesce(p_limit, 5), 1), 20)
    ) j
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_cancel_equipment_product_image_search_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.equipment_product_image_search_jobs;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_product_image_search_job_items
  set status = 'cancelled', completed_at = now(), updated_at = now()
  where job_id = p_job_id and status = 'queued';

  update public.equipment_products p
  set image_status = 'missing', updated_at = now()
  from public.equipment_product_image_search_job_items i
  where i.job_id = p_job_id
    and i.product_id = p.id
    and i.status = 'cancelled'
    and p.image_status = 'queued';

  update public.equipment_product_image_search_jobs
  set status = 'cancelled', cancelled_at = now(), updated_at = now()
  where id = p_job_id
    and status in ('queued', 'running')
  returning * into v_job;

  perform public.admin_recount_equipment_product_image_search_job(p_job_id);
  select * into v_job from public.equipment_product_image_search_jobs where id = p_job_id;

  return jsonb_build_object('job', to_jsonb(v_job));
end;
$$;

create or replace function public.admin_retry_equipment_product_image_search_job(
  p_job_id uuid,
  p_statuses text[] default array['failed', 'no_result']
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.equipment_product_image_search_jobs;
  v_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.equipment_product_image_search_job_items
  set
    status = 'queued',
    error_message = null,
    completed_at = null,
    started_at = null,
    updated_at = now()
  where job_id = p_job_id
    and status = any (coalesce(p_statuses, array['failed', 'no_result']));

  get diagnostics v_count = row_count;

  update public.equipment_products p
  set image_status = case when p.image_status = 'approved' then p.image_status else 'queued' end,
      updated_at = now()
  from public.equipment_product_image_search_job_items i
  where i.job_id = p_job_id
    and i.product_id = p.id
    and i.status = 'queued';

  update public.equipment_product_image_search_jobs
  set status = 'queued', completed_at = null, error_message = null, updated_at = now()
  where id = p_job_id;

  perform public.admin_recount_equipment_product_image_search_job(p_job_id);
  select * into v_job from public.equipment_product_image_search_jobs where id = p_job_id;

  return jsonb_build_object('job', to_jsonb(v_job), 'requeued', v_count);
end;
$$;

create or replace function public.admin_claim_equipment_product_image_search_items(
  p_job_id uuid,
  p_limit integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 3), 1), 10);
  v_job public.equipment_product_image_search_jobs;
  v_items jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_job from public.equipment_product_image_search_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status = 'cancelled' then
    return jsonb_build_object('items', '[]'::jsonb, 'job', to_jsonb(v_job));
  end if;

  update public.equipment_product_image_search_jobs
  set status = 'running', started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_job_id and status in ('queued', 'running');

  with picked as (
    select i.id
    from public.equipment_product_image_search_job_items i
    where i.job_id = p_job_id and i.status = 'queued'
    order by i.created_at
    for update skip locked
    limit v_limit
  ),
  updated as (
    update public.equipment_product_image_search_job_items i
    set
      status = 'searching',
      started_at = now(),
      attempt_count = i.attempt_count + 1,
      updated_at = now()
    from picked
    where i.id = picked.id
    returning i.*
  )
  select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at), '[]'::jsonb)
  into v_items
  from updated u;

  update public.equipment_products p
  set image_status = 'searching', updated_at = now()
  from jsonb_to_recordset(v_items) as claimed(product_id uuid)
  where p.id = claimed.product_id
    and p.image_status is distinct from 'approved';

  select * into v_job from public.equipment_product_image_search_jobs where id = p_job_id;

  return jsonb_build_object(
    'items', v_items,
    'job', to_jsonb(v_job)
  );
end;
$$;

grant execute on function public.admin_recount_equipment_product_image_search_job(uuid) to authenticated;
grant execute on function public.admin_create_equipment_product_image_search_job(text, uuid[], text, text, text, text, text, text, text, boolean, integer) to authenticated;
grant execute on function public.admin_preview_equipment_product_image_search_job(text, uuid[], text, text, text, text, text, text, text, boolean, integer) to authenticated;
grant execute on function public.admin_get_equipment_product_image_search_job(uuid) to authenticated;
grant execute on function public.admin_list_active_equipment_product_image_search_jobs(integer) to authenticated;
grant execute on function public.admin_cancel_equipment_product_image_search_job(uuid) to authenticated;
grant execute on function public.admin_retry_equipment_product_image_search_job(uuid, text[]) to authenticated;
grant execute on function public.admin_claim_equipment_product_image_search_items(uuid, integer) to authenticated;
