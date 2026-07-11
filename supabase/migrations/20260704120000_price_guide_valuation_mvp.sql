-- Equipd Price Guide / valuation MVP
-- Tables: equipment_models, market_observations, valuation_requests, valuation_feedback
-- Public read for catalog + observations; public insert for valuation requests/feedback;
-- market data writes restricted to service_role (RLS bypass) and admins.

-- ---------------------------------------------------------------------------
-- equipment_models
-- ---------------------------------------------------------------------------

create table if not exists public.equipment_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  model_family text,
  category text,
  slug text unique not null,
  known_release_year int,
  known_discontinued_year int,
  estimated_original_rrp numeric,
  specs jsonb not null default '{}'::jsonb,
  maintenance jsonb not null default '{}'::jsonb,
  common_faults text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_models is
  'Canonical equipment catalog for Price Guide valuations.';

drop trigger if exists equipment_models_set_updated_at on public.equipment_models;

create trigger equipment_models_set_updated_at
  before update on public.equipment_models
  for each row execute function public.set_updated_at();

-- slug uniqueness provides the slug index (equipment_models_slug_key)
create index if not exists equipment_models_brand_idx
  on public.equipment_models (brand);

create index if not exists equipment_models_model_idx
  on public.equipment_models (model);

-- ---------------------------------------------------------------------------
-- market_observations
-- ---------------------------------------------------------------------------

create table if not exists public.market_observations (
  id uuid primary key default gen_random_uuid(),
  equipment_model_id uuid references public.equipment_models (id) on delete cascade,
  observed_price numeric not null,
  currency text not null default 'GBP',
  estimated_age_years numeric,
  condition text,
  source_type text,
  source_domain text,
  observed_at timestamptz not null default now(),
  confidence_score numeric,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.market_observations is
  'External or internal price observations used to inform valuations.';

create index if not exists market_observations_equipment_model_id_idx
  on public.market_observations (equipment_model_id);

-- ---------------------------------------------------------------------------
-- valuation_requests
-- ---------------------------------------------------------------------------

create table if not exists public.valuation_requests (
  id uuid primary key default gen_random_uuid(),
  equipment_model_id uuid references public.equipment_models (id),
  user_query text,
  user_condition text,
  user_age_years numeric,
  working_status text,
  estimated_value_min numeric,
  estimated_value_max numeric,
  quick_sale_min numeric,
  quick_sale_max numeric,
  dealer_resale_min numeric,
  dealer_resale_max numeric,
  confidence text,
  created_at timestamptz not null default now()
);

comment on table public.valuation_requests is
  'User valuation requests and computed estimate ranges.';

create index if not exists valuation_requests_equipment_model_id_idx
  on public.valuation_requests (equipment_model_id);

-- ---------------------------------------------------------------------------
-- valuation_feedback
-- ---------------------------------------------------------------------------

create table if not exists public.valuation_feedback (
  id uuid primary key default gen_random_uuid(),
  valuation_request_id uuid references public.valuation_requests (id),
  was_useful boolean,
  actual_sale_price numeric,
  sold_elsewhere boolean,
  feedback text,
  created_at timestamptz not null default now()
);

comment on table public.valuation_feedback is
  'Optional user feedback on valuation usefulness and actual sale outcomes.';

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.equipment_models enable row level security;
alter table public.market_observations enable row level security;
alter table public.valuation_requests enable row level security;
alter table public.valuation_feedback enable row level security;

-- equipment_models: publicly readable; update/delete admin or service_role only
drop policy if exists "Equipment models are publicly readable" on public.equipment_models;
create policy "Equipment models are publicly readable"
  on public.equipment_models for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update equipment models" on public.equipment_models;
create policy "Admins can update equipment models"
  on public.equipment_models for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete equipment models" on public.equipment_models;
create policy "Admins can delete equipment models"
  on public.equipment_models for delete
  to authenticated
  using (public.is_admin());

-- market_observations: publicly readable; update/delete admin or service_role only
drop policy if exists "Market observations are publicly readable" on public.market_observations;
create policy "Market observations are publicly readable"
  on public.market_observations for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update market observations" on public.market_observations;
create policy "Admins can update market observations"
  on public.market_observations for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete market observations" on public.market_observations;
create policy "Admins can delete market observations"
  on public.market_observations for delete
  to authenticated
  using (public.is_admin());

-- valuation_requests: insertable by anyone (anon + authenticated)
drop policy if exists "Anyone can insert valuation requests" on public.valuation_requests;
create policy "Anyone can insert valuation requests"
  on public.valuation_requests for insert
  to anon, authenticated
  with check (true);

-- valuation_feedback: insertable by anyone (anon + authenticated)
drop policy if exists "Anyone can insert valuation feedback" on public.valuation_feedback;
create policy "Anyone can insert valuation feedback"
  on public.valuation_feedback for insert
  to anon, authenticated
  with check (true);

-- No client insert policies on market data tables: service_role bypasses RLS.
-- No client select/update/delete on valuation_requests / valuation_feedback.

grant select on public.equipment_models to anon, authenticated;
grant select on public.market_observations to anon, authenticated;
grant insert on public.valuation_requests to anon, authenticated;
grant insert on public.valuation_feedback to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: initial Price Guide equipment models
-- ---------------------------------------------------------------------------

insert into public.equipment_models (brand, model, model_family, category, slug)
values
  (
    'Concept2',
    'Model D Indoor Rower',
    'Indoor Rower',
    'Rowing Machines',
    'concept2-model-d-indoor-rower'
  ),
  (
    'Life Fitness',
    '95Ti Treadmill',
    '95 Series',
    'Treadmills',
    'life-fitness-95ti-treadmill'
  ),
  (
    'Technogym',
    'Excite Run 700',
    'Excite',
    'Treadmills',
    'technogym-excite-run-700'
  ),
  (
    'Matrix',
    'T7xi Treadmill',
    'T-Series',
    'Treadmills',
    'matrix-t7xi-treadmill'
  ),
  (
    'Wattbike',
    'Pro',
    'Pro/Trainer',
    'Exercise Bikes',
    'wattbike-pro'
  ),
  (
    'Assault Fitness',
    'Classic',
    'AssaultBike',
    'Air Bikes',
    'assaultbike-classic'
  ),
  (
    'Cybex',
    '770A Arc Trainer',
    '770 Series',
    'Cross Trainers',
    'cybex-770a-arc-trainer'
  ),
  (
    'Precor',
    'EFX 835 Elliptical',
    'Experience Series',
    'Cross Trainers',
    'precor-efx-835-elliptical'
  ),
  (
    'Hammer Strength',
    'Plate-Loaded Iso-Lateral Row',
    'Plate-Loaded',
    'Strength Machines',
    'hammer-strength-plate-loaded-iso-lateral-row'
  ),
  (
    'Hammer Strength',
    'Plate-Loaded Iso-Lateral Bench Press',
    'Plate-Loaded',
    'Strength Machines',
    'hammer-strength-plate-loaded-iso-lateral-bench-press'
  )
on conflict (slug) do update
set
  brand = excluded.brand,
  model = excluded.model,
  model_family = excluded.model_family,
  category = excluded.category,
  updated_at = now();

notify pgrst, 'reload schema';
