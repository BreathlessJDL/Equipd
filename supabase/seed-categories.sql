-- Equipd equipment categories seed
-- Run after storage.sql

insert into public.categories (name, slug, sort_order)
values
  ('Barbells & Plates', 'barbells-plates', 10),
  ('Racks & Rigs', 'racks-rigs', 20),
  ('Cardio', 'cardio', 30),
  ('Benches', 'benches', 40),
  ('Dumbbells', 'dumbbells', 50),
  ('Machines', 'machines', 60),
  ('Accessories', 'accessories', 70),
  ('Other', 'other', 80)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;
