-- Add Rowers category and recategorise Bubble-imported rower listings.
-- Safe to re-run (idempotent).

insert into public.categories (name, slug, sort_order)
values ('Rowers', 'rowers', 145)
on conflict (slug) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order;

-- Bubble imports stored as `other` with Rowers slugs (e.g. concept2-rowers-preston).
update public.listings l
set category_id = rowers.id
from public.categories other_cat,
     public.categories rowers
where l.category_id = other_cat.id
  and other_cat.slug = 'other'
  and rowers.slug = 'rowers'
  and l.source = 'import'
  and l.slug like '%-rowers-%';

-- Verification (run manually after apply):
-- select l.slug, l.title, c.slug as category_slug
-- from public.listings l
-- join public.categories c on c.id = l.category_id
-- where l.slug like '%-rowers-%'
-- order by l.slug;
