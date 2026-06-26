-- Equipd Buyer Protection — fulfilment method selection (enums only)
-- Run after buyer-protection-phase1b-columns-functions.sql
--
-- IMPORTANT: Run this script alone in Supabase SQL Editor, then run
-- buyer-protection-fulfilment-method-selection-b-functions.sql in a separate
-- execution. PostgreSQL cannot use newly added enum values in the same
-- transaction/script before commit (error 55P04).
--
-- Safe to re-run (idempotent).

-- ---------------------------------------------------------------------------
-- order_fulfilment_status — seller delivery lifecycle value
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'order_fulfilment_status'
      and e.enumlabel = 'awaiting_seller_delivery'
  ) then
    alter type public.order_fulfilment_status add value 'awaiting_seller_delivery';
  end if;
end $$;
