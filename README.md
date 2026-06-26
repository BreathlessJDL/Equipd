# Equipd

UK marketplace for used gym equipment.

## Stack

- React + Vite
- Supabase (auth, database, storage)

## Implemented features

- **Auth** — Email/password signup, login, logout, protected routes
- **Profiles** — View and edit display name and location; email shown read-only
- **Listings** — Create (draft or publish), edit, detail view, status controls (draft, active, reserved, sold, archived)
- **Images** — Up to 8 photos per listing (JPEG, PNG, WebP) via Supabase Storage
- **Browse/search** — Home feed of active listings with search, category, condition, brand, and price filters
- **Location pages** — SEO landing pages for Leeds, Manchester, Birmingham, and London at `/listings/:city`
- **My listings** — Signed-in sellers see all their listings at `/my-listings`
- **Messaging** — Buyer/seller conversations per listing at `/messages`
- **Offers** — Buyers make offers; sellers accept/reject; buyers withdraw pending offers
- **Notifications** — In-app alerts for messages and offers at `/notifications`
- **Saved listings** — Save active listings and view them at `/saved-listings`
- **Delivery options** — Sellers can mark collection and/or courier availability with optional notes
- **Hub** — Buyer/seller dashboard at `/hub` (listings, offers, sold and purchased items)
- **Payments foundation** — `reserved` listings, `payments` table, and lifecycle RPCs
- **Stripe Connect + Checkout** — seller payout setup, buyer Pay now, webhook confirmation (test mode)

Not implemented yet: payment expiry cron, email/push notifications, saved-search alerts, AI processing, wanted requests, platform fee.

## Local setup

### 1. Install dependencies

```bash
cd equipd
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` (gitignored):

```bash
cp .env.example .env.local
```

On Windows (PowerShell):

```powershell
Copy-Item .env.example .env.local
```

Set these values in `.env.local` from your Supabase project (**Project Settings → API**):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Project URL (e.g. `https://your-project-id.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Anon public key |

Restart the dev server after changing `.env.local`.

### 3. Run the app

```bash
npm run dev
```

App runs at http://localhost:5174 (port 5174 avoids clashing with Siege on 5173).

## Database setup

Run these SQL files **in order** in the Supabase **SQL Editor** (one file per run, wait for success before the next):

1. `supabase/schema.sql` — core tables, enums, triggers
2. `supabase/rls.sql` — row level security policies
3. `supabase/storage.sql` — `listing-images` bucket and storage policies
4. `supabase/seed-categories.sql` — equipment categories
5. `supabase/seed-brands.sql` — brand catalog
6. `supabase/messaging.sql` — conversations and messages (requires schema + profiles/listings)
7. `supabase/offers.sql` — offers (requires messaging.sql for optional `conversation_id` link)
8. `supabase/offer-acceptance.sql` — `accept_offer` RPC and seller reject-only policy (requires offers.sql)
9. `supabase/notifications.sql` — in-app notifications and triggers (requires offer-acceptance.sql)
10. `supabase/saved-listings.sql` — saved listings (requires notifications.sql)
11. `supabase/listing-delivery-options.sql` — collection and courier fields on listings (requires saved-listings.sql)
12. `supabase/stripe-payments-foundation.sql` — payments table, `reserved` status, updated `accept_offer` (requires listing-delivery-options.sql)
13. `supabase/stripe-payments-phase2.sql` — Stripe Edge Function RPCs (requires stripe-payments-foundation.sql)
14. `supabase/stripe-payments-phase3a.sql` — orders table, held-funds enums, `mark_payment_captured()` (requires stripe-payments-phase2.sql)
15. `supabase/stripe-payments-phase3c.sql` — buyer confirmation RPC, seller payout-ready promotion (requires stripe-payments-phase3a.sql)
16. `supabase/stripe-payments-phase3d.sql` — payout release RPCs (requires stripe-payments-phase3c.sql)
17. `supabase/conversation-reads.sql` — unread message tracking per conversation (requires notifications.sql)
18. `supabase/disable-message-bell-notifications.sql` — stop duplicate message bell alerts (requires conversation-reads.sql)
19. `supabase/listing-taxonomy.sql` — controlled category seed + listing rating field (requires disable-message-bell-notifications.sql)
20. `supabase/category-label-plural.sql` — plural category display names (safe to re-run after listing-taxonomy.sql)
21. `supabase/transaction-cancellation.sql` — seller pre-payment cancellation RPC and buyer notification (requires stripe-payments-phase3a.sql and conversation-reads.sql)
22. `supabase/transaction-support-requests.sql` — support/dispute requests on paid orders (requires transaction-cancellation.sql)
23. `supabase/admin-support-tools.sql` — admin role, support request admin RPCs (requires transaction-support-requests.sql)
24. `supabase/admin-order-management.sql` — admin order list RPC and read access (requires admin-support-tools.sql)
25. `supabase/admin-support-resolution-notes.sql` — admin/resolution notes on support requests (requires admin-order-management.sql)
26. `supabase/reviews.sql` — **superseded by step 49** (legacy; do not run if using Phase 1)
27. `supabase/offers-schema-alignment.sql` — offer direction/status alignment (requires offers.sql)
28. `supabase/offer-messaging-flow.sql` — counter-offers, withdraw, messaging RPCs (requires offers-schema-alignment.sql)
29. `supabase/fix-counter-offer-rpc.sql` — counter-offer bugfix deploy (requires offer-messaging-flow.sql)
30. `supabase/withdraw-offer-rpc.sql` — withdraw offer RPC (requires offer-messaging-flow.sql)
31. `supabase/offer-counter-notifications.sql` — counter-offer notification triggers (requires offer-messaging-flow.sql)
32. `supabase/listing-images-visibility.sql` — listing image RLS for reserved listings (requires offer-messaging-flow.sql)
33. `supabase/buyer-protection-phase1a-enums.sql` — order lifecycle enum values and `order_type` (requires stripe-payments-phase3a.sql and offer-messaging-flow.sql). **Run alone first** — enum values must commit before phase1b.
34. `supabase/buyer-protection-phase1b-columns-functions.sql` — Buyer Protection columns, fee RPCs, checkout/order function updates (requires phase1a committed). Then redeploy `stripe-create-checkout`.
35. `supabase/buyer-protection-phase2-collection-qr.sql` — Collection QR tokens, buyer confirmation RPCs, 24-hour payout hold (requires phase1b).
36. `supabase/buyer-protection-phase3a-courier-evidence.sql` — Buyer-organised courier handover evidence, private `order-evidence` storage, `in_transit` transition (requires phase2).
37. `supabase/buyer-protection-phase3b-courier-delivery-confirmation.sql` — Buyer courier delivery confirmation, `delivered` status, 24-hour payout hold (requires phase3a).
38. `supabase/buyer-protection-phase4a-disputes.sql` — Buyer dispute opening during protection window, payout freeze, `order_disputes` table (requires phase3b).
39. `supabase/buyer-protection-phase4b-payout-release.sql` — Automatic payout promotion after Buyer Protection window via `release_due_order_payouts()` (requires phase4a). Deploy `stripe-release-due-payouts` and schedule it (see below).
40. `supabase/buyer-protection-phase4c-dispute-admin-resolution.sql` — Admin dispute review/resolution RPCs (requires phase4b). Admin access uses `profiles.is_admin` via `public.is_admin()`.
41. `supabase/trust-safety-phase2-reporting.sql` — User reporting for listings, users, and conversations (requires messaging.sql and admin-support-tools.sql).
42. `supabase/google-maps-phase5a-listing-location.sql` — Structured listing location columns and legacy backfill (requires base listings schema).
43. `supabase/google-maps-phase5b-distance-search.sql` — Haversine distance helper and `search_listings_with_distance()` RPC (requires phase5a).
44. `supabase/buyer-protection-fulfilment-method-selection-a-enums.sql` — Adds `awaiting_seller_delivery` to `order_fulfilment_status` (requires phase1b). **Run alone first** — enum values must commit before step 45.
45. `supabase/buyer-protection-fulfilment-method-selection-b-functions.sql` — Buyer fulfilment method selection RPCs, checkout validation, seller delivery confirmation (requires step 44 committed). Then redeploy `stripe-create-checkout`.
46. `supabase/buyer-protection-seller-delivery-handover-qr.sql` — Extends collection QR RPCs to seller delivery in-person handover; disables seller-triggered protection activation (requires step 45).
47. `supabase/support-team-email-notifications.sql` — Emails support@equipd.co.uk for new support requests, disputes, and reports (requires step 41). Deploy `send-support-email` and configure secrets (see below).
48. `supabase/general-support-inquiries.sql` — Guided `/support` contact form RPC and `general_support` email event (requires step 47). Redeploy `send-support-email --no-verify-jwt`.
49. `supabase/reviews-phase1.sql` — Phase 1 trust & reviews: `reviews` table, `submit_review`, `get_user_review_summary`, `get_user_completed_sales_count` (requires admin-support-resolution-notes.sql). Replaces `reviews.sql`.
50. `supabase/dev-handover-confirmation-bypass.sql` — Dev/admin handover test bypass reusing QR confirmation logic (requires step 46). Optional local `app_config.dev_handover_bypass_enabled=true` for buyer testing without admin.
51. `supabase/dev-end-buyer-protection-bypass.sql` — Dev/admin Buyer Protection expiry bypass (requires step 50). Reuses `promote_order_after_buyer_protection_window` (same as cron). Uses the same `dev_handover_bypass_enabled` app_config flag for buyer testing.
52. `supabase/order-lifecycle-complete-on-protection-expiry.sql` — Marks orders **completed** and listings **sold** when Buyer Protection expires (requires step 51). Reviews unlock at completion; Stripe payout remains a separate step. Updates payout RPCs for completed orders.
53. `supabase/order-lifecycle-repair-stuck-promotion.sql` — Repairs orders stuck in old `buyer_confirmed` + `protection_status=active` + cleared `payout_release_at` after a partial promote (requires step 52).
54. `supabase/payout-release-ready-orders.sql` — `get_ready_orders_for_payout_release()` RPC for the payout worker to release already-`ready` orders (requires step 53). Redeploy `stripe-release-due-payouts`.
55. `supabase/reviews-submit-notification.sql` — Notifies the reviewed party when `submit_review` succeeds (requires step 49).

**Do not run** `supabase/buyer-protection-fulfilment-method-selection.sql` — it is a deprecated stub; use steps 44 and 45 instead.

Payment architecture details: [docs/payments-architecture.md](docs/payments-architecture.md)

## Google Maps (Phase 5A)

Listing location autocomplete uses the **Maps JavaScript API** with the **Places library**.

1. Create a Google Cloud project and enable **Maps JavaScript API** and **Places API**.
2. Create a **browser** API key and restrict it by HTTP referrer (e.g. `http://localhost:5173/*`, your production domain).
3. Add to `.env.local`:

```bash
VITE_GOOGLE_MAPS_API_KEY=your-browser-api-key
```

4. Run migration step **42** (`supabase/google-maps-phase5a-listing-location.sql`).

Sellers search towns, cities, postcodes, and areas (UK only). Structured fields (`location_name`, `city`, `county`, `postcode`, `latitude`, `longitude`) are saved alongside legacy `location` text for browse compatibility.

Browse/search pages support **Search location** + **Radius** filters (10 / 25 / 50 / 100 miles or UK wide). When a buyer selects a location, listings are fetched via `search_listings_with_distance()` and cards show distance (e.g. “12 miles away”). Shareable URL params: `search`, `category`, `brand`, `condition`, `rating`, `minPrice`, `maxPrice`, `location`, `lat`, `lng`, `radius`, `sort`.

Test: `node scripts/test-listing-distance-search.mjs` and `node scripts/test-browse-filters-url.mjs`

## Stripe Edge Functions (Phase 2)

Deploy Supabase Edge Functions and set secrets in the Supabase dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI:

| Secret | Required by | Description |
|--------|-------------|-------------|
| `STRIPE_SECRET_KEY` | Stripe payout/checkout functions | Stripe secret key (`sk_test_…` / `sk_live_…`) — **never in frontend** |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Webhook signing secret (`whsec_…`) |
| `APP_BASE_URL` | Checkout/Connect redirects | App URL (e.g. `http://localhost:5174` or production domain) |
| `CRON_SECRET` | `stripe-release-due-payouts` | Bearer token for scheduled payout worker — generate a long random string |

Hosted Supabase injects these automatically for Edge Functions (do not duplicate manually unless missing):

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Project API URL |
| `SUPABASE_ANON_KEY` | Public anon key (used by authenticated user functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — used by `stripe-release-due-payouts` via `getSupabaseAdmin()` |

Verify secret **names** (not values) from the CLI:

```bash
npx supabase secrets list
```

Deploy functions:

```bash
supabase functions deploy stripe-webhook
supabase functions deploy stripe-connect-onboard
supabase functions deploy stripe-connect-sync
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-release-payout
supabase functions deploy stripe-release-due-payouts
```

Verify `stripe-release-due-payouts` is deployed and recent:

```bash
npx supabase functions list
```

Redeploy after changing `supabase/functions/_shared/release-order-payout.ts` — the worker bundles that shared module.

### Production payout automation (Buyer Protection)

After migrations **39**, **52**, and **54**, seller payouts should run automatically when Buyer Protection ends — no manual scripts in production.

The **`stripe-release-due-payouts`** Edge Function (POST, `CRON_SECRET` bearer auth) runs the full worker:

1. **Promote** due Buyer Protection orders (`release_due_order_payouts()` → `ready` or `awaiting_seller_setup`)
2. **Release** newly promoted `ready`/`failed` orders via Stripe transfer
3. **Release** already-`ready` eligible orders (`get_ready_orders_for_payout_release()`)

The worker is **idempotent** and safe to run every 15 minutes. It:

- Skips orders with open disputes
- Skips sellers without completed Stripe Connect onboarding (`awaiting_seller_setup`)
- Uses Stripe idempotency keys per order
- Does not double-pay orders already marked `paid`

#### Schedule in Supabase Dashboard (recommended: every 15 minutes)

1. Deploy the function: `supabase functions deploy stripe-release-due-payouts`
2. Set **`CRON_SECRET`** in **Project Settings → Edge Functions → Secrets** (same value you use locally — do not commit it)
3. Open **Integrations → Cron** (or **Database → Cron Jobs** depending on dashboard version)
4. Click **Create job**
5. Configure:
   - **Name:** `stripe-release-due-payouts`
   - **Schedule:** `*/15 * * * *` (every 15 minutes)
   - **Type:** HTTP request or Edge Function (if offered, pick **`stripe-release-due-payouts`**)
   - **Method:** `POST`
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/stripe-release-due-payouts`
   - **Headers:** `Authorization: Bearer <CRON_SECRET>` and `Content-Type: application/json`
   - **Body:** `{}` (empty JSON object)
6. Save and enable the job
7. After the first run, check **Edge Functions → stripe-release-due-payouts → Logs** for `releaseDueOrderPayouts: newly promoted` / `already-ready eligible`

Alternative (SQL + Vault): store `CRON_SECRET` in Supabase Vault and schedule with `pg_cron` + `pg_net`. See [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions). Use the **`CRON_SECRET`** bearer header — this function does **not** accept the service role key as auth.

#### Developer / admin warnings

- **`CRON_SECRET` must exist** in Supabase Edge Function secrets — the worker returns `401 Unauthorized` without it
- Use the **same `CRON_SECRET`** in `.env.local` when running the manual script — never expose it in frontend env vars (`VITE_*`)
- **Do not** put `CRON_SECRET` in git, client bundles, or public docs
- **Do not** manually `UPDATE orders SET payout_status = 'paid'` in SQL unless repairing bad data — use the worker or `stripe-release-payout`
- If payouts stick at `ready`, confirm step **54** is applied and the cron job is enabled

#### Manual / local test

**Dry-run** (SQL only — shows what would be promoted/released; no Stripe calls):

```bash
node scripts/run-release-due-payouts.mjs
```

**Full worker** (promotion + Stripe transfer via deployed Edge Function):

PowerShell:

```powershell
$env:CRON_SECRET="your-secret-here"
node scripts/run-release-due-payouts.mjs --invoke-edge
```

Mac/Linux:

```bash
CRON_SECRET="your-secret-here" node scripts/run-release-due-payouts.mjs --invoke-edge
```

Or add `CRON_SECRET=...` to `.env.local` (gitignored) and run:

```bash
node scripts/run-release-due-payouts.mjs --invoke-edge
```

**Health check** (read-only counts):

```bash
node scripts/payout-health-check.mjs
```

Reports: ready-eligible for worker, stuck `ready` without transfer, `failed`, `awaiting_seller_setup`, `processing`, and `paid` in the last 24 hours.

#### Verification SQL (Supabase SQL editor)

Stuck payouts needing attention:

```sql
select id, fulfilment_status, protection_status, payout_status, stripe_transfer_id, payout_released_at
from orders
where payout_status in ('ready', 'failed')
order by created_at desc;
```

Recent successful payouts:

```sql
select id, payout_status, stripe_transfer_id, payout_released_at
from orders
where payout_status = 'paid'
order by payout_released_at desc;
```

Eligible for the worker right now (requires step 54):

```sql
select * from jsonb_array_elements(get_ready_orders_for_payout_release());
```

Local development:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... APP_BASE_URL=http://localhost:5174 CRON_SECRET=your-local-cron-secret
supabase functions serve
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Stripe Dashboard webhook endpoint (production): `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`  
Subscribe to `checkout.session.completed`, `account.updated`, `transfer.created`, and `transfer.reversed`.

## Support team email alerts (step 47)

When users open a transaction support request, Buyer Protection dispute, or Trust & Safety report, the app still creates in-app notifications as before. Step 47 additionally emails `support@equipd.co.uk` via Resend.

Deploy the Edge Function and set secrets:

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API key for outbound mail |
| `SUPPORT_EMAIL_WEBHOOK_SECRET` | Shared secret; database webhook calls must send header `x-support-email-secret` |
| `SUPPORT_EMAIL_TO` | Optional; defaults to `support@equipd.co.uk` |
| `SUPPORT_EMAIL_FROM` | Optional; defaults to `Equipd Support <notifications@equipd.co.uk>` |
| `EQUIPD_APP_URL` | Base URL for admin links in emails (e.g. `https://equipd.co.uk`) |

```bash
supabase functions deploy send-support-email --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_... SUPPORT_EMAIL_WEBHOOK_SECRET=... EQUIPD_APP_URL=https://equipd.co.uk
```

`send-support-email` must have JWT verification disabled (like `stripe-webhook`): it is called from `pg_net` with `x-support-email-secret`, not a Supabase user JWT. Without `--no-verify-jwt`, the gateway returns `401 UNAUTHORIZED_NO_AUTH_HEADER` and the function never runs.

After running `support-team-email-notifications.sql`, set the webhook URL and shared secret in `public.app_config` (Supabase SQL editor). Use the same value for `support_email_webhook_secret` as the `SUPPORT_EMAIL_WEBHOOK_SECRET` Edge Function secret:

```sql
insert into public.app_config (key, value)
values
  ('support_email_functions_base_url', 'https://mhwvzovxlqimcuxvyyjf.supabase.co/functions/v1'),
  ('support_email_webhook_secret', 'YOUR_SECRET')
on conflict (key)
do update set value = excluded.value, updated_at = now();
```

Replace `YOUR_SECRET` with a long random string and set the same value in Edge Function secrets. For local Supabase, use `http://127.0.0.1:54321/functions/v1` as the functions base URL.

`public.app_config` has RLS enabled with no policies for `authenticated` or `anon`, and table privileges are revoked from those roles. Only server-side code (the `notify_support_team_email` security definer function) and SQL editor / `service_role` access it. Email delivery is skipped (with a database warning) if config is missing; user actions are unaffected.

Use a fresh Supabase project, or ensure you have not already created conflicting objects. Re-running seed files is safe (they upsert). Re-running `schema.sql` on an existing project will fail if tables already exist.

### Quick verification

After setup, check in the Supabase dashboard:

- **Table Editor** — `profiles`, `categories`, `brands`, `listings`, `listing_images`, `conversations`, `messages`, `offers`, `notifications`, `saved_listings`, `payments`, `orders`
- **Database → Functions** — `accept_offer`, `create_notification`, `mark_payment_paid`, `mark_payment_captured`, `expire_payment`, `cancel_payment`, `release_expired_payments`
- **Storage** — `listing-images` bucket (public, 5 MB limit)
- **Authentication** — email provider enabled for signup/login
