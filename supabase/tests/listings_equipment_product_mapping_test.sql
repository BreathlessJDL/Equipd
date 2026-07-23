-- Stage 3 mapping persistence smoke checks (run against a migration-applied DB).
-- Additive columns only; does not invent historical mappings.

do $$
declare
  has_product_id boolean;
  has_product_key boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'equipment_product_id'
  ) into has_product_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'canonical_product_key'
  ) into has_product_key;

  if not has_product_id then
    raise exception 'FAIL: listings.equipment_product_id missing';
  end if;

  if not has_product_key then
    raise exception 'FAIL: listings.canonical_product_key missing';
  end if;

  raise notice 'PASS: listing equipment product mapping columns present';
end $$;
