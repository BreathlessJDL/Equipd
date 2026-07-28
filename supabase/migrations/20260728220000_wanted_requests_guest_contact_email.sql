-- Allow guest wanted requests (created via Edge Function with service role)
-- and store the contact email used for notifications.

alter table public.wanted_requests
  alter column user_id drop not null;

alter table public.wanted_requests
  add column if not exists contact_email text;

comment on column public.wanted_requests.contact_email is
  'Buyer email for notifications (authenticated or guest).';

create index if not exists wanted_requests_contact_email_created_idx
  on public.wanted_requests (contact_email, created_at desc)
  where contact_email is not null;

create unique index if not exists wanted_requests_criteria_client_request_id_uidx
  on public.wanted_requests ((criteria ->> 'clientRequestId'))
  where (criteria ? 'clientRequestId');
