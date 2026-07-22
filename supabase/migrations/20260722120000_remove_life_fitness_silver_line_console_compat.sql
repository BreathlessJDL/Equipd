-- Remove Life Fitness Silver Line console compatibility so valuation uses
-- the base product without a console selector or console modifier.
-- Silver Line machines shipped with one fixed console configuration.

with silver_line_products as (
  select id
  from public.equipment_products
  where brand = 'Life Fitness'
    and canonical_product_key = any (array[
      'life-fitness-stepper-stair-climber-silver-line-95si-stepper',
      'life-fitness-exercise-bike-silver-line-93ci-upright-bike',
      'life-fitness-exercise-bike-silver-line-95ci-upright-bike',
      'life-fitness-treadmill-silver-line-95ti',
      'life-fitness-cross-trainer-silver-line-93xi-crosstrainer',
      'life-fitness-cross-trainer-silver-line-95xi-crosstrainer',
      'life-fitness-exercise-bike-silver-line-93ri-recumbent-bike',
      'life-fitness-treadmill-silver-line-93ti',
      'life-fitness-exercise-bike-silver-line-95ri-recumbent-bike',
      'life-fitness-silver-line-93li-summit-trainer',
      'life-fitness-stepper-stair-climber-silver-line-93si-stepper',
      'life-fitness-silver-line-95li-summit-trainer'
    ]::text[])
)
delete from public.product_console_compat
where product_id in (select id from silver_line_products);

with silver_line_products as (
  select id
  from public.equipment_products
  where brand = 'Life Fitness'
    and canonical_product_key = any (array[
      'life-fitness-stepper-stair-climber-silver-line-95si-stepper',
      'life-fitness-exercise-bike-silver-line-93ci-upright-bike',
      'life-fitness-exercise-bike-silver-line-95ci-upright-bike',
      'life-fitness-treadmill-silver-line-95ti',
      'life-fitness-cross-trainer-silver-line-93xi-crosstrainer',
      'life-fitness-cross-trainer-silver-line-95xi-crosstrainer',
      'life-fitness-exercise-bike-silver-line-93ri-recumbent-bike',
      'life-fitness-treadmill-silver-line-93ti',
      'life-fitness-exercise-bike-silver-line-95ri-recumbent-bike',
      'life-fitness-silver-line-93li-summit-trainer',
      'life-fitness-stepper-stair-climber-silver-line-93si-stepper',
      'life-fitness-silver-line-95li-summit-trainer'
    ]::text[])
)
delete from public.product_console_options
where product_id in (select id from silver_line_products);
