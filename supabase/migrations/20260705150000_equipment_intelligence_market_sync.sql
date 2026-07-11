-- Equipd Intelligence Market Sync — prepare equipment_intelligence for AI market collection.

alter table public.equipment_intelligence
  add column if not exists last_market_sync_at timestamptz,
  add column if not exists market_sync_status text not null default 'not_synced',
  add column if not exists market_sync_notes text;

comment on column public.equipment_intelligence.last_market_sync_at is
  'When market observations were last collected for this record.';

comment on column public.equipment_intelligence.market_sync_status is
  'Market sync lifecycle: not_synced, pending, synced, failed, etc.';

comment on column public.equipment_intelligence.market_sync_notes is
  'Admin or worker notes from the latest market sync attempt.';

create index if not exists equipment_intelligence_market_sync_status_idx
  on public.equipment_intelligence (market_sync_status);

create index if not exists equipment_intelligence_last_market_sync_at_idx
  on public.equipment_intelligence (last_market_sync_at);

notify pgrst, 'reload schema';
