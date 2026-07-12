-- AI-generated overview and SEO content for canonical equipment products.

create table if not exists public.equipment_product_content (
  id uuid primary key default gen_random_uuid(),
  equipment_product_id uuid not null references public.equipment_products(id) on delete cascade,
  overview_text text,
  seo_title text,
  seo_meta_description text,
  faq_json jsonb not null default '[]'::jsonb,
  generation_status text not null default 'draft'
    check (generation_status in ('draft', 'approved', 'rejected', 'failed', 'stale')),
  source_data_hash text,
  ai_model text,
  generated_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  error_message text,
  version integer not null default 1
    check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_product_content is
  'AI-generated overview, SEO, and FAQ content for equipment product pages. One row per product.';

comment on column public.equipment_product_content.generation_status is
  'draft | approved | rejected | failed | stale. Public pages only show approved.';

comment on column public.equipment_product_content.source_data_hash is
  'Hash of canonical product source fields used for generation; used to detect stale content.';

comment on column public.equipment_product_content.faq_json is
  'JSON array of { question, answer } objects for structured FAQ content.';

create unique index if not exists equipment_product_content_product_uidx
  on public.equipment_product_content (equipment_product_id);

create index if not exists equipment_product_content_status_idx
  on public.equipment_product_content (generation_status);

create index if not exists equipment_product_content_generated_at_idx
  on public.equipment_product_content (generated_at desc nulls last);

drop trigger if exists equipment_product_content_set_updated_at on public.equipment_product_content;

create trigger equipment_product_content_set_updated_at
  before update on public.equipment_product_content
  for each row execute function public.set_updated_at();

alter table public.equipment_product_content enable row level security;

drop policy if exists "Approved equipment product content is publicly readable" on public.equipment_product_content;
create policy "Approved equipment product content is publicly readable"
  on public.equipment_product_content for select
  to anon, authenticated
  using (generation_status = 'approved');

drop policy if exists "Admins can manage equipment product content" on public.equipment_product_content;
create policy "Admins can manage equipment product content"
  on public.equipment_product_content for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.equipment_product_content to anon, authenticated;
