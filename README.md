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

Payment architecture details: [docs/payments-architecture.md](docs/payments-architecture.md)

## Stripe Edge Functions (Phase 2)

Deploy Supabase Edge Functions and set secrets in the Supabase dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI:

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe test secret key (`sk_test_…`) — never in frontend |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) |
| `APP_BASE_URL` | App URL for Checkout/Connect redirects (e.g. `http://localhost:5174`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in hosted Supabase.

Deploy functions:

```bash
supabase functions deploy stripe-webhook
supabase functions deploy stripe-connect-onboard
supabase functions deploy stripe-connect-sync
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-release-payout
```

Local development:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... APP_BASE_URL=http://localhost:5174
supabase functions serve
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

Stripe Dashboard webhook endpoint (production): `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`  
Subscribe to `checkout.session.completed`, `account.updated`, `transfer.created`, and `transfer.reversed`.

Use a fresh Supabase project, or ensure you have not already created conflicting objects. Re-running seed files is safe (they upsert). Re-running `schema.sql` on an existing project will fail if tables already exist.

### Quick verification

After setup, check in the Supabase dashboard:

- **Table Editor** — `profiles`, `categories`, `brands`, `listings`, `listing_images`, `conversations`, `messages`, `offers`, `notifications`, `saved_listings`, `payments`, `orders`
- **Database → Functions** — `accept_offer`, `create_notification`, `mark_payment_paid`, `mark_payment_captured`, `expire_payment`, `cancel_payment`, `release_expired_payments`
- **Storage** — `listing-images` bucket (public, 5 MB limit)
- **Authentication** — email provider enabled for signup/login
