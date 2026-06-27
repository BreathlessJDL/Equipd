-- Set the Equipd marketplace account join date to August 2025 (display only; other users unchanged).
-- Run once against production, or: node scripts/update-equipd-profile-joined-date.mjs

update public.profiles
set created_at = timestamptz '2025-08-15 12:00:00+00'
where lower(username) = 'equipd';
