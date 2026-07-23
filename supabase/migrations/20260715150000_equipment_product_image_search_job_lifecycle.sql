-- Image search job lifecycle: pause status, list sections, delete/clear/cleanup, rerun.

alter table public.equipment_product_image_search_jobs
  drop constraint if exists equipment_product_image_search_jobs_status_check;

alter table public.equipment_product_image_search_jobs
  add constraint equipment_product_image_search_jobs_status_check
  check (status in ('queued', 'running', 'paused', 'completed', 'cancelled', 'failed'));

alter table public.equipment_product_image_search_jobs
  add column if not exists deleted_at timestamptz;

create index if not exists equipment_product_image_search_jobs_deleted_at_idx
  on public.equipment_product_image_search_jobs (deleted_at)
  where deleted_at is null;

create index if not exists equipment_product_image_search_jobs_completed_cleanup_idx
  on public.equipment_product_image_search_jobs (completed_at)
  where status = 'completed' and deleted_at is null;

comment on column public.equipment_product_image_search_jobs.deleted_at is
  'Soft-delete timestamp for job history. Null means visible. Hard cleanup may still remove old completed rows.';

-- ---------------------------------------------------------------------------
-- Auto-cleanup: hard-delete completed jobs older than 30 days.
-- Never touches queued / running / paused / failed.
-- Candidates keep on-delete-set-null; products and images are untouched.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_old_equipment_product_image_search_jobs(
  p_older_than interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.equipment_product_image_search_jobs
  where status = 'completed'
    and deleted_at is null
    and coalesce(completed_at, updated_at, created_at) < now() - p_older_than;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_old_equipment_product_image_search_jobs(interval) from public;
grant execute on function public.cleanup_old_equipment_product_image_search_jobs(interval) to authenticated;

-- ---------------------------------------------------------------------------
-- List jobs: active first, then completed history (excludes soft-deleted)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_equipment_product_image_search_jobs(
  p_active_limit integer default 20,
  p_completed_limit integer default 20,
  p_run_cleanup boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cleaned integer := 0;
  v_active jsonb := '[]'::jsonb;
  v_completed jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if coalesce(p_run_cleanup, true) then
    v_cleaned := public.cleanup_old_equipment_product_image_search_jobs(interval '30 days');
  end if;

  select coalesce(jsonb_agg(to_jsonb(j) order by j.created_at desc), '[]'::jsonb)
  into v_active
  from (
    select *
    from public.equipment_product_image_search_jobs
    where deleted_at is null
      and status in ('queued', 'running', 'paused', 'failed')
    order by
      case status
        when 'running' then 0
        when 'queued' then 1
        when 'paused' then 2
        when 'failed' then 3
        else 4
      end,
      created_at desc
    limit least(greatest(coalesce(p_active_limit, 20), 1), 50)
  ) j;

  select coalesce(jsonb_agg(to_jsonb(j) order by coalesce(j.completed_at, j.created_at) desc), '[]'::jsonb)
  into v_completed
  from (
    select *
    from public.equipment_product_image_search_jobs
    where deleted_at is null
      and status in ('completed', 'cancelled')
    order by coalesce(completed_at, created_at) desc
    limit least(greatest(coalesce(p_completed_limit, 20), 1), 50)
  ) j;

  return jsonb_build_object(
    'active', v_active,
    'completed', v_completed,
    'cleaned', v_cleaned
  );
end;
$$;

-- Keep legacy name as a thin wrapper for older clients.
create or replace function public.admin_list_active_equipment_product_image_search_jobs(
  p_limit integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_payload := public.admin_list_equipment_product_image_search_jobs(
    least(greatest(coalesce(p_limit, 5), 1), 50),
    least(greatest(coalesce(p_limit, 5), 1), 50),
    true
  );

  return coalesce(v_payload->'active', '[]'::jsonb)
    || coalesce(v_payload->'completed', '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete a single completed (or failed/cancelled history) job.
-- Does NOT delete products, image status, approved images, or candidates.
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_equipment_product_image_search_job(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.equipment_product_image_search_jobs;
  v_candidate_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_job
  from public.equipment_product_image_search_jobs
  where id = p_job_id
    and deleted_at is null;

  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  if v_job.status in ('queued', 'running', 'paused') then
    raise exception 'Only completed, failed, or cancelled jobs can be deleted';
  end if;

  if v_job.status not in ('completed', 'failed', 'cancelled') then
    raise exception 'Job status % cannot be deleted', v_job.status;
  end if;

  select count(*)::integer into v_candidate_count
  from public.equipment_product_image_candidates
  where job_id = p_job_id;

  -- Detach candidates so hard delete cannot cascade-remove them.
  update public.equipment_product_image_candidates
  set job_id = null, job_item_id = null, updated_at = now()
  where job_id = p_job_id;

  delete from public.equipment_product_image_search_jobs
  where id = p_job_id;

  return jsonb_build_object(
    'deleted', true,
    'job_id', p_job_id,
    'previous_status', v_job.status,
    'candidates_preserved', v_candidate_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Bulk clear completed job history only
-- ---------------------------------------------------------------------------

create or replace function public.admin_clear_completed_equipment_product_image_search_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_ids
  from public.equipment_product_image_search_jobs
  where deleted_at is null
    and status = 'completed';

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('deleted', 0);
  end if;

  update public.equipment_product_image_candidates
  set job_id = null, job_item_id = null, updated_at = now()
  where job_id = any (v_ids);

  delete from public.equipment_product_image_search_jobs
  where id = any (v_ids)
    and status = 'completed';

  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- ---------------------------------------------------------------------------
-- Run again: create a fresh job from the previous job's filters + products
-- ---------------------------------------------------------------------------

create or replace function public.admin_rerun_equipment_product_image_search_job(
  p_job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.equipment_product_image_search_jobs;
  v_ids uuid[];
  v_filters jsonb;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_job
  from public.equipment_product_image_search_jobs
  where id = p_job_id
    and deleted_at is null;

  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  if v_job.status in ('queued', 'running', 'paused') then
    raise exception 'Cannot run again while the job is still active';
  end if;

  select coalesce(array_agg(distinct product_id), '{}'::uuid[])
  into v_ids
  from public.equipment_product_image_search_job_items
  where job_id = p_job_id;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Previous job has no products to re-run';
  end if;

  v_filters := coalesce(v_job.filters, '{}'::jsonb);

  v_result := public.admin_create_equipment_product_image_search_job(
    'page',
    v_ids,
    nullif(v_filters->>'search', ''),
    nullif(v_filters->>'brand', ''),
    nullif(v_filters->>'status', ''),
    nullif(v_filters->>'equipment_type', ''),
    nullif(v_filters->>'completion', ''),
    nullif(v_filters->>'attention', ''),
    nullif(v_filters->>'image_filter', ''),
    coalesce(v_job.include_approved, false),
    coalesce(v_job.max_products, 100)
  );

  return v_result;
end;
$$;

grant execute on function public.admin_list_equipment_product_image_search_jobs(integer, integer, boolean) to authenticated;
grant execute on function public.admin_delete_equipment_product_image_search_job(uuid) to authenticated;
grant execute on function public.admin_clear_completed_equipment_product_image_search_jobs() to authenticated;
grant execute on function public.admin_rerun_equipment_product_image_search_job(uuid) to authenticated;
