-- Equipd Intelligence V2: Original New Price + Manufacture Date Evidence
-- Evidence tables, derived fields on equipment_intelligence, admin RPCs.

-- ---------------------------------------------------------------------------
-- equipment_price_sources
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_price_sources (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment_intelligence (id) on delete cascade,
  price numeric not null check (price > 0),
  currency text not null default 'GBP',
  price_year integer,
  source_type text not null,
  source_name text,
  source_url text,
  confidence integer not null check (confidence >= 0 and confidence <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_price_sources is
  'Evidence sources for original new price / RRP / MSRP per equipment intelligence row.';

create index if not exists equipment_price_sources_equipment_id_idx
  on public.equipment_price_sources (equipment_id);

create index if not exists equipment_price_sources_confidence_idx
  on public.equipment_price_sources (equipment_id, confidence desc, updated_at desc);

drop trigger if exists equipment_price_sources_set_updated_at on public.equipment_price_sources;

create trigger equipment_price_sources_set_updated_at
  before update on public.equipment_price_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- equipment_lifecycle_sources
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_lifecycle_sources (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment_intelligence (id) on delete cascade,
  manufacture_start_year integer,
  manufacture_end_year integer,
  source_type text not null,
  source_name text,
  source_url text,
  confidence integer not null check (confidence >= 0 and confidence <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_lifecycle_sources_year_present_chk check (
    manufacture_start_year is not null
    or manufacture_end_year is not null
  )
);

comment on table public.equipment_lifecycle_sources is
  'Evidence sources for manufacture start/end years per equipment intelligence row.';

create index if not exists equipment_lifecycle_sources_equipment_id_idx
  on public.equipment_lifecycle_sources (equipment_id);

create index if not exists equipment_lifecycle_sources_confidence_idx
  on public.equipment_lifecycle_sources (equipment_id, confidence desc, updated_at desc);

drop trigger if exists equipment_lifecycle_sources_set_updated_at on public.equipment_lifecycle_sources;

create trigger equipment_lifecycle_sources_set_updated_at
  before update on public.equipment_lifecycle_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Derived fields on equipment_intelligence
-- ---------------------------------------------------------------------------

alter table public.equipment_intelligence
  add column if not exists best_original_price numeric,
  add column if not exists best_original_price_currency text,
  add column if not exists best_original_price_confidence integer,
  add column if not exists best_original_price_source_id uuid
    references public.equipment_price_sources (id) on delete set null,
  add column if not exists best_original_price_updated_at timestamptz,
  add column if not exists manufacture_start_year integer,
  add column if not exists manufacture_end_year integer,
  add column if not exists manufacture_year_confidence integer,
  add column if not exists manufacture_year_source_id uuid
    references public.equipment_lifecycle_sources (id) on delete set null,
  add column if not exists lifecycle_updated_at timestamptz;

comment on column public.equipment_intelligence.best_original_price is
  'Derived best original new price from equipment_price_sources evidence.';

comment on column public.equipment_intelligence.manufacture_start_year is
  'Derived manufacture start year from equipment_lifecycle_sources evidence.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.equipment_price_sources enable row level security;
alter table public.equipment_lifecycle_sources enable row level security;

drop policy if exists "Equipment price sources are publicly readable" on public.equipment_price_sources;
create policy "Equipment price sources are publicly readable"
  on public.equipment_price_sources for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert equipment price sources" on public.equipment_price_sources;
create policy "Admins can insert equipment price sources"
  on public.equipment_price_sources for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update equipment price sources" on public.equipment_price_sources;
create policy "Admins can update equipment price sources"
  on public.equipment_price_sources for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete equipment price sources" on public.equipment_price_sources;
create policy "Admins can delete equipment price sources"
  on public.equipment_price_sources for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Equipment lifecycle sources are publicly readable" on public.equipment_lifecycle_sources;
create policy "Equipment lifecycle sources are publicly readable"
  on public.equipment_lifecycle_sources for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert equipment lifecycle sources" on public.equipment_lifecycle_sources;
create policy "Admins can insert equipment lifecycle sources"
  on public.equipment_lifecycle_sources for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update equipment lifecycle sources" on public.equipment_lifecycle_sources;
create policy "Admins can update equipment lifecycle sources"
  on public.equipment_lifecycle_sources for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete equipment lifecycle sources" on public.equipment_lifecycle_sources;
create policy "Admins can delete equipment lifecycle sources"
  on public.equipment_lifecycle_sources for delete
  to authenticated
  using (public.is_admin());

grant select on public.equipment_price_sources to anon, authenticated;
grant select on public.equipment_lifecycle_sources to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.evidence_default_confidence_for_source_type(
  p_source_type text
)
returns integer
language sql
immutable
as $$
  select case lower(trim(coalesce(p_source_type, '')))
    when 'manufacturer_pdf' then 100
    when 'official_website' then 95
    when 'dealer_catalogue' then 90
    when 'dealer_product_page' then 80
    when 'trade_publication' then 70
    when 'forum_estimate' then 50
    when 'manual_estimate' then 40
    else 40
  end;
$$;

create or replace function public.recalculate_equipment_price_best(
  p_equipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.equipment_price_sources%rowtype;
begin
  if p_equipment_id is null then
    raise exception 'equipment_id is required';
  end if;

  select eps.*
  into v_source
  from public.equipment_price_sources eps
  where eps.equipment_id = p_equipment_id
  order by eps.confidence desc, eps.updated_at desc, eps.created_at desc
  limit 1;

  if not found then
    update public.equipment_intelligence
    set
      best_original_price = null,
      best_original_price_currency = null,
      best_original_price_confidence = null,
      best_original_price_source_id = null,
      best_original_price_updated_at = null,
      updated_at = now()
    where id = p_equipment_id;

    return jsonb_build_object(
      'equipment_id', p_equipment_id,
      'recalculated', false,
      'reason', 'no_price_sources'
    );
  end if;

  update public.equipment_intelligence
  set
    best_original_price = v_source.price,
    best_original_price_currency = v_source.currency,
    best_original_price_confidence = v_source.confidence,
    best_original_price_source_id = v_source.id,
    best_original_price_updated_at = now(),
    updated_at = now()
  where id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'recalculated', true,
    'source_id', v_source.id,
    'price', v_source.price,
    'currency', v_source.currency,
    'confidence', v_source.confidence
  );
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

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'recalculated', true,
    'source_id', v_source.id,
    'manufacture_start_year', v_source.manufacture_start_year,
    'manufacture_end_year', v_source.manufacture_end_year,
    'confidence', v_source.confidence
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs: price sources
-- ---------------------------------------------------------------------------

create or replace function public.admin_upsert_equipment_price_source(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_equipment_id uuid;
  v_price numeric;
  v_currency text;
  v_price_year integer;
  v_source_type text;
  v_source_name text;
  v_source_url text;
  v_confidence integer;
  v_notes text;
  v_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_payload is null then
    raise exception 'payload is required';
  end if;

  v_id := nullif(trim(p_payload ->> 'id'), '')::uuid;
  v_equipment_id := nullif(trim(p_payload ->> 'equipment_id'), '')::uuid;
  v_price := nullif(p_payload ->> 'price', '')::numeric;
  v_currency := coalesce(nullif(trim(p_payload ->> 'currency'), ''), 'GBP');
  v_price_year := nullif(p_payload ->> 'price_year', '')::integer;
  v_source_type := nullif(trim(p_payload ->> 'source_type'), '');
  v_source_name := nullif(trim(p_payload ->> 'source_name'), '');
  v_source_url := nullif(trim(p_payload ->> 'source_url'), '');
  v_confidence := nullif(p_payload ->> 'confidence', '')::integer;
  v_notes := nullif(trim(p_payload ->> 'notes'), '');

  if v_equipment_id is null then
    raise exception 'equipment_id is required';
  end if;

  if v_price is null or v_price <= 0 then
    raise exception 'price must be a positive number';
  end if;

  if v_source_type is null then
    raise exception 'source_type is required';
  end if;

  if v_confidence is null then
    v_confidence := public.evidence_default_confidence_for_source_type(v_source_type);
  end if;

  select exists (
    select 1 from public.equipment_intelligence ei where ei.id = v_equipment_id
  )
  into v_exists;

  if not v_exists then
    raise exception 'Equipment intelligence record not found';
  end if;

  if v_id is not null then
    update public.equipment_price_sources
    set
      equipment_id = v_equipment_id,
      price = v_price,
      currency = v_currency,
      price_year = v_price_year,
      source_type = v_source_type,
      source_name = v_source_name,
      source_url = v_source_url,
      confidence = v_confidence,
      notes = v_notes,
      updated_at = now()
    where id = v_id
    returning id into v_id;

    if not found then
      raise exception 'Price source not found';
    end if;
  else
    insert into public.equipment_price_sources (
      equipment_id,
      price,
      currency,
      price_year,
      source_type,
      source_name,
      source_url,
      confidence,
      notes
    )
    values (
      v_equipment_id,
      v_price,
      v_currency,
      v_price_year,
      v_source_type,
      v_source_name,
      v_source_url,
      v_confidence,
      v_notes
    )
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'source_id', v_id,
    'equipment_id', v_equipment_id
  );
end;
$$;

create or replace function public.admin_delete_equipment_price_source(
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipment_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_source_id is null then
    raise exception 'source_id is required';
  end if;

  delete from public.equipment_price_sources
  where id = p_source_id
  returning equipment_id into v_equipment_id;

  if not found then
    raise exception 'Price source not found';
  end if;

  if exists (
    select 1
    from public.equipment_intelligence ei
    where ei.id = v_equipment_id
      and ei.best_original_price_source_id = p_source_id
  ) then
    perform public.recalculate_equipment_price_best(v_equipment_id);
  end if;

  return jsonb_build_object(
    'deleted_source_id', p_source_id,
    'equipment_id', v_equipment_id
  );
end;
$$;

create or replace function public.admin_set_best_equipment_price_source(
  p_equipment_id uuid,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.equipment_price_sources%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select eps.*
  into v_source
  from public.equipment_price_sources eps
  where eps.id = p_source_id
    and eps.equipment_id = p_equipment_id;

  if not found then
    raise exception 'Price source not found for equipment';
  end if;

  update public.equipment_intelligence
  set
    best_original_price = v_source.price,
    best_original_price_currency = v_source.currency,
    best_original_price_confidence = v_source.confidence,
    best_original_price_source_id = v_source.id,
    best_original_price_updated_at = now(),
    updated_at = now()
  where id = p_equipment_id;

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'source_id', v_source.id,
    'price', v_source.price,
    'currency', v_source.currency,
    'confidence', v_source.confidence
  );
end;
$$;

create or replace function public.admin_recalculate_equipment_price_best(
  p_equipment_id uuid
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

  return public.recalculate_equipment_price_best(p_equipment_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin RPCs: lifecycle sources
-- ---------------------------------------------------------------------------

create or replace function public.admin_upsert_equipment_lifecycle_source(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_equipment_id uuid;
  v_start_year integer;
  v_end_year integer;
  v_source_type text;
  v_source_name text;
  v_source_url text;
  v_confidence integer;
  v_notes text;
  v_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_payload is null then
    raise exception 'payload is required';
  end if;

  v_id := nullif(trim(p_payload ->> 'id'), '')::uuid;
  v_equipment_id := nullif(trim(p_payload ->> 'equipment_id'), '')::uuid;
  v_start_year := nullif(p_payload ->> 'manufacture_start_year', '')::integer;
  v_end_year := nullif(p_payload ->> 'manufacture_end_year', '')::integer;
  v_source_type := nullif(trim(p_payload ->> 'source_type'), '');
  v_source_name := nullif(trim(p_payload ->> 'source_name'), '');
  v_source_url := nullif(trim(p_payload ->> 'source_url'), '');
  v_confidence := nullif(p_payload ->> 'confidence', '')::integer;
  v_notes := nullif(trim(p_payload ->> 'notes'), '');

  if v_equipment_id is null then
    raise exception 'equipment_id is required';
  end if;

  if v_source_type is null then
    raise exception 'source_type is required';
  end if;

  if v_start_year is null and v_end_year is null then
    raise exception 'At least one manufacture year is required';
  end if;

  if v_confidence is null then
    v_confidence := public.evidence_default_confidence_for_source_type(v_source_type);
  end if;

  select exists (
    select 1 from public.equipment_intelligence ei where ei.id = v_equipment_id
  )
  into v_exists;

  if not v_exists then
    raise exception 'Equipment intelligence record not found';
  end if;

  if v_id is not null then
    update public.equipment_lifecycle_sources
    set
      equipment_id = v_equipment_id,
      manufacture_start_year = v_start_year,
      manufacture_end_year = v_end_year,
      source_type = v_source_type,
      source_name = v_source_name,
      source_url = v_source_url,
      confidence = v_confidence,
      notes = v_notes,
      updated_at = now()
    where id = v_id
    returning id into v_id;

    if not found then
      raise exception 'Lifecycle source not found';
    end if;
  else
    insert into public.equipment_lifecycle_sources (
      equipment_id,
      manufacture_start_year,
      manufacture_end_year,
      source_type,
      source_name,
      source_url,
      confidence,
      notes
    )
    values (
      v_equipment_id,
      v_start_year,
      v_end_year,
      v_source_type,
      v_source_name,
      v_source_url,
      v_confidence,
      v_notes
    )
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'source_id', v_id,
    'equipment_id', v_equipment_id
  );
end;
$$;

create or replace function public.admin_delete_equipment_lifecycle_source(
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipment_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_source_id is null then
    raise exception 'source_id is required';
  end if;

  delete from public.equipment_lifecycle_sources
  where id = p_source_id
  returning equipment_id into v_equipment_id;

  if not found then
    raise exception 'Lifecycle source not found';
  end if;

  if exists (
    select 1
    from public.equipment_intelligence ei
    where ei.id = v_equipment_id
      and ei.manufacture_year_source_id = p_source_id
  ) then
    perform public.recalculate_equipment_lifecycle_best(v_equipment_id);
  end if;

  return jsonb_build_object(
    'deleted_source_id', p_source_id,
    'equipment_id', v_equipment_id
  );
end;
$$;

create or replace function public.admin_set_best_equipment_lifecycle_source(
  p_equipment_id uuid,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.equipment_lifecycle_sources%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select els.*
  into v_source
  from public.equipment_lifecycle_sources els
  where els.id = p_source_id
    and els.equipment_id = p_equipment_id;

  if not found then
    raise exception 'Lifecycle source not found for equipment';
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

  return jsonb_build_object(
    'equipment_id', p_equipment_id,
    'source_id', v_source.id,
    'manufacture_start_year', v_source.manufacture_start_year,
    'manufacture_end_year', v_source.manufacture_end_year,
    'confidence', v_source.confidence
  );
end;
$$;

create or replace function public.admin_recalculate_equipment_lifecycle_best(
  p_equipment_id uuid
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

  return public.recalculate_equipment_lifecycle_best(p_equipment_id);
end;
$$;

revoke all on function public.evidence_default_confidence_for_source_type(text) from public;
grant execute on function public.evidence_default_confidence_for_source_type(text) to authenticated;

revoke all on function public.recalculate_equipment_price_best(uuid) from public;
revoke all on function public.recalculate_equipment_lifecycle_best(uuid) from public;

revoke all on function public.admin_upsert_equipment_price_source(jsonb) from public;
grant execute on function public.admin_upsert_equipment_price_source(jsonb) to authenticated;

revoke all on function public.admin_delete_equipment_price_source(uuid) from public;
grant execute on function public.admin_delete_equipment_price_source(uuid) to authenticated;

revoke all on function public.admin_set_best_equipment_price_source(uuid, uuid) from public;
grant execute on function public.admin_set_best_equipment_price_source(uuid, uuid) to authenticated;

revoke all on function public.admin_recalculate_equipment_price_best(uuid) from public;
grant execute on function public.admin_recalculate_equipment_price_best(uuid) to authenticated;

revoke all on function public.admin_upsert_equipment_lifecycle_source(jsonb) from public;
grant execute on function public.admin_upsert_equipment_lifecycle_source(jsonb) to authenticated;

revoke all on function public.admin_delete_equipment_lifecycle_source(uuid) from public;
grant execute on function public.admin_delete_equipment_lifecycle_source(uuid) to authenticated;

revoke all on function public.admin_set_best_equipment_lifecycle_source(uuid, uuid) from public;
grant execute on function public.admin_set_best_equipment_lifecycle_source(uuid, uuid) to authenticated;

revoke all on function public.admin_recalculate_equipment_lifecycle_best(uuid) from public;
grant execute on function public.admin_recalculate_equipment_lifecycle_best(uuid) to authenticated;

notify pgrst, 'reload schema';
