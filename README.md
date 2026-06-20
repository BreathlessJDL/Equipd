# Equipd

UK marketplace for used gym equipment.

## Stack

- React + Vite
- Supabase (auth, database, storage)

## Implemented features

- **Auth** — Email/password signup, login, logout, protected routes
- **Profiles** — View and edit display name and location; email shown read-only
- **Listings** — Create (draft or publish), edit, detail view, status controls (draft, active, sold, archived)
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

Not implemented yet: payments, email/push notifications, saved-search alerts, AI processing, wanted requests, realtime messaging.

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

Use a fresh Supabase project, or ensure you have not already created conflicting objects. Re-running seed files is safe (they upsert). Re-running `schema.sql` on an existing project will fail if tables already exist.

### Quick verification

After setup, check in the Supabase dashboard:

- **Table Editor** — `profiles`, `categories`, `brands`, `listings`, `listing_images`, `conversations`, `messages`, `offers`, `notifications`, `saved_listings`
- **Database → Functions** — `accept_offer`, `create_notification`
- **Storage** — `listing-images` bucket (public, 5 MB limit)
- **Authentication** — email provider enabled for signup/login
