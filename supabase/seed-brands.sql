-- Equipd brands seed (minimal catalog for future structured matching)
-- Run after seed-categories.sql

insert into public.brands (name, slug)
values
  ('Rogue Fitness', 'rogue-fitness'),
  ('Eleiko', 'eleiko'),
  ('Technogym', 'technogym'),
  ('Life Fitness', 'life-fitness'),
  ('Hammer Strength', 'hammer-strength'),
  ('Concept2', 'concept2'),
  ('Rep Fitness', 'rep-fitness'),
  ('Other', 'other')
on conflict (slug) do update
set name = excluded.name;
