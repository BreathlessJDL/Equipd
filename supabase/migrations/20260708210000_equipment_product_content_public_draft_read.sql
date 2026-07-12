-- Allow public read of draft/stale generated content for local preview workflows.
-- Frontend VITE_SHOW_DRAFT_PRODUCT_CONTENT gates whether draft/stale is displayed on product pages.
-- Rejected and failed rows remain admin-only.

drop policy if exists "Draft and stale equipment product content is publicly readable" on public.equipment_product_content;

create policy "Draft and stale equipment product content is publicly readable"
  on public.equipment_product_content for select
  to anon, authenticated
  using (generation_status in ('draft', 'stale'));
