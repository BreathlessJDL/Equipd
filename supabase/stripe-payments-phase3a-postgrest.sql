-- PostgREST schema reload after orders table / FK changes (Phase 3a follow-up)
-- Run once in Supabase SQL Editor if the API reports a missing offers↔orders relationship.

notify pgrst, 'reload schema';
