-- Add stable console_key to equipment_console_modifiers for valuation lookup.
-- Public display labels (e.g. LED) must not be the only join key.
-- Multiple historic keys can share the public label "LED".

alter table public.equipment_console_modifiers
  add column if not exists console_key text;

comment on column public.equipment_console_modifiers.console_key is
  'Stable console key matching equipment_consoles.console_key. Prefer this over console_name for valuation.';

-- Allow duplicate display names (LED) when console_key differs.
drop index if exists public.equipment_console_modifiers_brand_console_uidx;

create unique index if not exists equipment_console_modifiers_brand_console_key_uidx
  on public.equipment_console_modifiers (brand, console_key)
  where console_key is not null;

create index if not exists equipment_console_modifiers_brand_console_name_idx
  on public.equipment_console_modifiers (brand, lower(console_name));
