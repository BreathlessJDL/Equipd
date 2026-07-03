-- Phase 5: case, review, payout, and account transactional email triggers.

-- ---------------------------------------------------------------------------
-- Extend notify_marketplace_email allowlist
-- ---------------------------------------------------------------------------

create or replace function public.notify_marketplace_email(
  p_event_key text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text;
  v_secret text;
  v_url text;
begin
  if p_event_key not in (
    'offer_received',
    'offer_accepted',
    'payment_successful',
    'new_order_received',
    'buyer_delivery_details_added',
    'collection_confirmed',
    'courier_dispatched',
    'delivery_confirmed',
    'buyer_protection_started',
    'dispute_opened',
    'evidence_requested',
    'return_authorised',
    'collection_arranged',
    'refund_pending',
    'refund_completed_case_closed',
    'case_closed_no_refund',
    'review_available',
    'review_received',
    'payout_released',
    'seller_onboarding_required',
    'welcome',
    'email_changed',
    'password_changed'
  ) then
    raise warning 'notify_marketplace_email skipped: unsupported event key %', p_event_key;
    return;
  end if;

  select nullif(trim(value), '')
  into v_base_url
  from public.app_config
  where key = 'support_email_functions_base_url';

  select nullif(trim(value), '')
  into v_secret
  from public.app_config
  where key = 'marketplace_email_webhook_secret';

  if v_base_url is null then
    raise warning 'notify_marketplace_email skipped: support_email_functions_base_url is not configured in app_config';
    return;
  end if;

  if v_secret is null or v_secret = 'YOUR_MARKETPLACE_EMAIL_SECRET' then
    raise warning 'notify_marketplace_email skipped: marketplace_email_webhook_secret is not configured in app_config';
    return;
  end if;

  v_url := rtrim(v_base_url, '/') || '/send-marketplace-email';

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-marketplace-email-secret', v_secret
    ),
    body := jsonb_build_object(
      'eventKey', p_event_key,
      'payload', coalesce(p_payload, '{}'::jsonb)
    )
  );
exception
  when others then
    raise warning 'notify_marketplace_email failed for %: %', p_event_key, sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Buyer Protection / case emails (order_case_updates)
-- ---------------------------------------------------------------------------

create or replace function public.notify_order_case_update_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute_id uuid;
  v_payload jsonb;
begin
  v_dispute_id := new.dispute_id;
  if v_dispute_id is null then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'disputeId', v_dispute_id,
    'orderId', new.order_id,
    'caseUpdateId', new.id
  );

  if new.event_type = 'case_opened' then
    perform public.notify_marketplace_email(
      'dispute_opened',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    perform public.notify_marketplace_email(
      'dispute_opened',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    return new;
  end if;

  if new.event_type = 'admin_decision'
     and new.new_status in ('awaiting_buyer_evidence', 'awaiting_seller_evidence') then
    perform public.notify_marketplace_email(
      'evidence_requested',
      v_payload || jsonb_build_object(
        'recipientRole',
        case when new.new_status = 'awaiting_buyer_evidence' then 'buyer' else 'seller' end
      )
    );
    return new;
  end if;

  if new.event_type = 'return_authorised' then
    perform public.notify_marketplace_email(
      'return_authorised',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'return_authorised',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'collection_arranged' then
    perform public.notify_marketplace_email(
      'collection_arranged',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'collection_arranged',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'refund_pending'
     or new.new_status in ('refund_pending', 'partial_refund_pending') then
    perform public.notify_marketplace_email(
      'refund_pending',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'refund_pending',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'refund_completed' then
    perform public.notify_marketplace_email(
      'refund_completed_case_closed',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'refund_completed_case_closed',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'case_closed' then
    if exists (
      select 1
      from public.order_case_updates u
      where u.dispute_id = v_dispute_id
        and u.event_type = 'refund_completed'
        and u.id <> new.id
        and u.created_at >= new.created_at - interval '5 minutes'
    ) then
      return new;
    end if;

    perform public.notify_marketplace_email(
      'case_closed_no_refund',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'case_closed_no_refund',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists order_case_updates_marketplace_email on public.order_case_updates;

create trigger order_case_updates_marketplace_email
  after insert on public.order_case_updates
  for each row
  execute function public.notify_order_case_update_emails();

-- ---------------------------------------------------------------------------
-- Review available (buyer) + payout released + seller onboarding (orders)
-- ---------------------------------------------------------------------------

create or replace function public.notify_orders_phase5_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_onboarded boolean;
begin
  if new.fulfilment_status = 'completed'::public.order_fulfilment_status
     and old.fulfilment_status is distinct from 'completed'::public.order_fulfilment_status then
    perform public.notify_marketplace_email(
      'review_available',
      jsonb_build_object('orderId', new.id)
    );
  end if;

  if new.payout_status = 'paid'::public.payout_status
     and old.payout_status is distinct from 'paid'::public.payout_status then
    perform public.notify_marketplace_email(
      'payout_released',
      jsonb_build_object('orderId', new.id)
    );
  end if;

  if old.fulfilment_status = 'awaiting_payment'::public.order_fulfilment_status
     and new.fulfilment_status is distinct from 'awaiting_payment'::public.order_fulfilment_status
     and new.fulfilment_status <> 'cancelled'::public.order_fulfilment_status then
    select coalesce(pr.stripe_onboarding_complete, false)
    into v_seller_onboarded
    from public.profiles pr
    where pr.id = new.seller_id;

    if not coalesce(v_seller_onboarded, false) then
      perform public.notify_marketplace_email(
        'seller_onboarding_required',
        jsonb_build_object('orderId', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_email_phase5 on public.orders;

create trigger orders_email_phase5
  after update on public.orders
  for each row
  execute function public.notify_orders_phase5_emails();

-- ---------------------------------------------------------------------------
-- Review received
-- ---------------------------------------------------------------------------

create or replace function public.notify_review_received_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_marketplace_email(
    'review_received',
    jsonb_build_object('reviewId', new.id, 'orderId', new.order_id)
  );
  return new;
end;
$$;

drop trigger if exists reviews_email_received on public.reviews;

create trigger reviews_email_received
  after insert on public.reviews
  for each row
  execute function public.notify_review_received_email();

-- ---------------------------------------------------------------------------
-- Account emails (auth.users)
-- ---------------------------------------------------------------------------

create or replace function public.notify_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_marketplace_email(
    'welcome',
    jsonb_build_object('userId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists auth_users_email_welcome on auth.users;

create trigger auth_users_email_welcome
  after insert on auth.users
  for each row
  execute function public.notify_welcome_email();

create or replace function public.notify_auth_account_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    perform public.notify_marketplace_email(
      'email_changed',
      jsonb_build_object(
        'userId', new.id,
        'newEmail', new.email
      )
    );
  end if;

  if new.encrypted_password is distinct from old.encrypted_password then
    perform public.notify_marketplace_email(
      'password_changed',
      jsonb_build_object(
        'userId', new.id,
        'changedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auth_users_email_account_changes on auth.users;

create trigger auth_users_email_account_changes
  after update on auth.users
  for each row
  execute function public.notify_auth_account_emails();

notify pgrst, 'reload schema';

80 x 13
Please add a manual test script for fulfilment emails so we can test SendGrid delivery without creating fake marketplace orders.



Create/extend a script like:



npm run email:test-send -- <template_key> <recipient_email>



It should support:

- buyer_delivery_details_added

- collection_confirmed

- courier_dispatched

- delivery_confirmed

- buyer_protection_started



Requirements:

- Use realistic mock dynamic data for each template.

- Use the real SendGrid template IDs from env vars.

- Send to the recipient email passed in.

- Print the template key, template ID, subject, recipient, and SendGrid response.

- Confirm the subject is populated.

- Do not write to marketplace tables.

- Do not create fake orders/offers.

- Do not trigger real business logic.



Also add a convenience command to send all fulfilment test emails:



npm run email:test-fulfilment -- <recipient_email>



This should send all 5 fulfilment templates to the same recipient.



Run:

npm run test:marketplace-email

npm run build



Report the exact PowerShell commands I should run.

Phase 5: Finish the remaining transactional emails.



Use the existing approved Equipd master email layout, SendGrid infrastructure, dynamic subjects, username identity rules, audit logging and idempotency.



Do not redesign the email template.



Create templates, previews, SendGrid-ready HTML/plain text, tests, and wiring for the remaining emails:



Buyer Protection / cases:

1. dispute_opened

2. evidence_requested

3. return_authorised

4. collection_arranged

5. refund_pending

6. refund_completed_case_closed

7. case_closed_no_refund



Reviews:

8. review_available

9. review_received



Seller payouts:

10. payout_released

11. seller_onboarding_required



Account/security:

12. welcome

13. email_changed

14. password_changed



For each email, provide a clear upload checklist:

- SendGrid template name

- template key

- env var

- HTML file to paste

- TXT file to paste

- subject pattern

- recipient

- trigger



Important rules:

- Buyer emails must never show Seller Service Fee, “You’ll receive”, seller payout, or payout amount.

- Seller payout emails may show Seller Service Fee and net payout.

- Use Equipd usernames, not email local-parts.

- Use `{{subject}}` subject patch via API, not manual SendGrid UI.

- Add manual test-send support for all new templates.

- Add batch command:

  npm run email:test-all-remaining -- <recipient_email>

- Add/extend SQL migrations and triggers where needed.

- Do not automate Stripe refunds.

- Do not change payment, payout, QR, or case workflow logic.



Run:

npm run test:marketplace-email

npm run build



Report:

1. Files changed

2. SendGrid upload checklist

3. SQL migrations to apply

4. Supabase secrets to add

5. Functions to redeploy

6. Manual test commands

import {
  buildRemainingTestDynamicData,
  REMAINING_EMAIL_TEMPLATE_KEYS,
dist/index.html                     1.14 kB │ gzip:   0.53 kB
dist/assets/index-C_YrjJ97.css    330.52 kB │ gzip:  45.92 kB
dist/assets/index-CRfWZtCn.js   1,289.79 kB │ gzip: 341.70 kB

✓ built in 2.39s
  assert(testData?.subject?.trim(), `remaining test data subject populated for ${templateKey}`)
  if (testData?.order_id) {
    assert(testData.cta_url?.includes(testData.order_id), `remaining test data CTA for ${templateKey}`)
  if (testData?.order_id && testData.cta_url?.includes(testData.order_id)) {
ok: review_available avoids seller payout copy
ok: first email log reservation sends
ok: duplicate offer_received idempotency key skips second send

107 passed, 0 failed
?? scripts/fulfilmentEmailTestSend.mjs
?? scripts/remainingEmailTestData.mjs
?? scripts/remainingEmailTestSend.mjs
?? supabase/functions/_shared/marketplaceEmailComposePhase5.js
?? supabase/migrations/20260701120000_phase5_marketplace_emails.sql
Phase 5 transactional emails are implemented end-to-end. npm run test:marketplace-email (107 passed) and npm run build both succeeded.

1. Files changed
Template definitions (14 new)

emails/templates/disputeOpened.js … passwordChanged.js
emails/templates/index.js — PHASE5_EMAIL_TEMPLATES, ALL_EMAIL_TEMPLATES
SendGrid assets (generated)

emails/sendgrid/<key>.html + .txt for all 14 keys
emails/dist/preview-<key>.html previews
Runtime / compose

supabase/functions/_shared/marketplaceEmailComposePhase5.js — compose + subjects + idempotency
supabase/functions/_shared/marketplaceEmailCore.js — event keys, loaders, send wiring
supabase/functions/_shared/emailTemplateConfig.js — all keys/env vars/fields
supabase/functions/send-marketplace-email/index.ts — payload validation
SQL

supabase/migrations/20260701120000_phase5_marketplace_emails.sql
Test / manual send

scripts/remainingEmailTestData.mjs, scripts/remainingEmailTestSend.mjs
scripts/email-test-all-remaining.mjs
scripts/email-test-send.mjs — routes Phase 5 keys
scripts/test-marketplace-email.mjs — Phase 5 assertions
scripts/build-email-master.mjs, emails/preview/mockData.js, package.json
2. SendGrid upload checklist
Set each template subject to {{subject}} in SendGrid (API sends the real subject).

#	SendGrid template name	Template key	Env var	HTML	TXT	Subject pattern	Recipient	Trigger
1
Equipd — Dispute opened
dispute_opened
SENDGRID_TEMPLATE_DISPUTE_OPENED
emails/sendgrid/dispute_opened.html