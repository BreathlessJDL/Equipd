-- Equipd Price Guide equipment models seed (MVP catalog)
-- Run after 20260704120000_price_guide_valuation_mvp.sql (or included in that migration).

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
