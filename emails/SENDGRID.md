# SendGrid transactional email — Phase 1 infrastructure

Equipd transactional emails use SendGrid **Dynamic Templates** built from the approved master layout (`emails/dist/master.html`). This document covers environment setup, sending, previews, and adding new templates.

**Phase 1 scope:** plumbing only. Marketplace events are not wired yet.

**Phase 2 scope:** local preview templates for `offer_received`, `offer_accepted`, `payment_successful`, and `new_order_received`. Build with `npm run email:build-master`. Paste each file from `emails/sendgrid/<key>.html` into its SendGrid dynamic template, plus `emails/sendgrid/<key>.txt` for plain text.

**Phase 3 scope:** these four templates are wired to live marketplace events via `sendMarketplaceEmail()` with audit logging and idempotency. See [Phase 3 — Wired marketplace events](#phase-3--wired-marketplace-events) below.

---

### Logo not loading in email clients

1. Confirm `public/email/equipd-full-logo.png` is **committed and deployed** (untracked files are not on Vercel).
2. Open `https://equipd.co.uk/email/equipd-full-logo.png` in a browser — must show the PNG, not the Equipd homepage.
3. Run `npm run email:verify-logo` locally.
4. `vercel.json` must not rewrite paths with file extensions to `index.html` (see repo `vercel.json`).
5. Re-paste `emails/dist/master.html` into SendGrid; ensure `<img src="{{logo_url}}">` and activate the new version.
6. Disable SendGrid **Subscription Tracking** to remove raw `<%asm_group_unsubscribe_raw_url%>` markup.

---

## Unsubscribe markup in SendGrid

Our source HTML does not include unsubscribe placeholders. If you see raw `[<%asm_group_unsubscribe_raw_url%>...]` at the top of received emails:

1. Open the Dynamic Template in SendGrid.
2. Go to **Settings** → disable **Subscription Tracking** (or remove the unsubscribe module from the template body).
3. Transactional Equipd emails do not use marketing unsubscribe footers.

---

## Logo URL (`{{logo_url}}`)

The header logo must be an absolute HTTPS URL. The sender auto-fills:

`https://equipd.co.uk/email/equipd-full-logo.png`

Hosted from `public/email/equipd-full-logo.png` on the deployed site. Must be committed and deployed — untracked files are not served in production.

Override with `EMAIL_LOGO_URL` or pass `logo_url` in `dynamicData` if needed.

Ensure your SendGrid template uses `{{logo_url}}` in the header `<img src="">` after re-pasting `emails/dist/master.html`.

---

## Required environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | Yes (to send) | SendGrid API key with Mail Send permission |
| `SENDGRID_FROM_EMAIL` | Yes (to send) | Verified sender address (e.g. `notifications@equipd.co.uk`) |
| `SENDGRID_FROM_NAME` | No | Sender display name (default: `Equipd`) |
| `SENDGRID_REPLY_TO_EMAIL` | No | Reply-to address (defaults to `SENDGRID_FROM_EMAIL`) |
| `APP_BASE_URL` | Recommended | App origin for links and `{{base_url}}` (e.g. `https://equipd.co.uk`) |
| `EMAIL_LOGO_URL` | No | Override logo URL (default: `https://equipd.co.uk/email/equipd-full-logo.png`) |
| `EMAIL_TEST_TO` | Test sends | Default recipient for `npm run email:test-send` |
| `EMAIL_DRY_RUN` | No | Set to `true` to log payloads without sending (even if API key is set) |

### Per-template SendGrid IDs

Each template key maps to an environment variable holding the SendGrid template ID (`d-xxxxxxxx`):

| Template key | Environment variable |
|--------------|-------------------|
| `master_test` | `SENDGRID_TEMPLATE_MASTER_TEST` |
| `offer_received` | `SENDGRID_TEMPLATE_OFFER_RECEIVED` |
| `offer_accepted` | `SENDGRID_TEMPLATE_OFFER_ACCEPTED` |
| `payment_successful` | `SENDGRID_TEMPLATE_PAYMENT_SUCCESSFUL` |
| `new_order_received` | `SENDGRID_TEMPLATE_NEW_ORDER_RECEIVED` |
| `buyer_delivery_details_added` | `SENDGRID_TEMPLATE_BUYER_DELIVERY_DETAILS_ADDED` |
| `collection_confirmed` | `SENDGRID_TEMPLATE_COLLECTION_CONFIRMED` |
| `courier_dispatched` | `SENDGRID_TEMPLATE_COURIER_DISPATCHED` |
| `delivery_confirmed` | `SENDGRID_TEMPLATE_DELIVERY_CONFIRMED` |
| `buyer_protection_started` | `SENDGRID_TEMPLATE_BUYER_PROTECTION_STARTED` |
| `dispute_opened` | `SENDGRID_TEMPLATE_DISPUTE_OPENED` |
| `refund_completed` | `SENDGRID_TEMPLATE_REFUND_COMPLETED` |
| `case_closed` | `SENDGRID_TEMPLATE_CASE_CLOSED` |
| `payout_released` | `SENDGRID_TEMPLATE_PAYOUT_RELEASED` |

Config source: `supabase/functions/_shared/emailTemplateConfig.js` (re-exported from `emails/templateConfig.js`).

### Supabase Edge Functions

Set secrets for deployed functions:

```bash
supabase secrets set \
  SENDGRID_API_KEY=SG.xxx \
  SENDGRID_FROM_EMAIL=notifications@equipd.co.uk \
  SENDGRID_FROM_NAME=Equipd \
  SENDGRID_REPLY_TO_EMAIL=support@equipd.co.uk \
  APP_BASE_URL=https://equipd.co.uk \
  SENDGRID_TEMPLATE_MASTER_TEST=d-xxxxxxxx
```

`EQUIPD_APP_URL` is still supported as a fallback for `APP_BASE_URL`.

### Local development (`.env.local`)

```env
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=notifications@equipd.co.uk
SENDGRID_FROM_NAME=Equipd
SENDGRID_REPLY_TO_EMAIL=support@equipd.co.uk
APP_BASE_URL=http://localhost:5174
EMAIL_TEST_TO=you@example.com
SENDGRID_TEMPLATE_MASTER_TEST=d-xxxxxxxx
```

**Never** add `SENDGRID_API_KEY` to Vite `VITE_*` variables or frontend code.

---

## Architecture

```
emails/
  templateConfig.js          # Re-export of template key map
  renderMasterEmail.js       # Local HTML preview rendering
  preview/mockData.js        # Mock dynamic_template_data per template key
  node/sendTransactionalEmail.mjs   # Node sender (@sendgrid/mail)
  node/loadEnv.mjs

supabase/functions/_shared/
  emailTemplateConfig.js     # Template key → env var map (canonical)
  transactionalEmailCore.js  # Validation, enrichment, dry-run (shared)
  transactionalEmail.ts      # Edge Function sender (fetch → SendGrid REST API)
```

### `sendTransactionalEmail({ to, templateKey, dynamicData, replyTo })`

- Resolves SendGrid template ID from config + env
- Validates recipient and required `dynamicData` fields
- Adds `base_url`, `year`, and default `tagline` automatically
- Applies sender + reply-to from env
- **Never throws** on send failure — returns `{ ok: false, error }`
- **Dry-run** when `SENDGRID_API_KEY` is missing or `EMAIL_DRY_RUN=true`

**Edge Functions (Deno):**

```ts
import { sendTransactionalEmail } from '../_shared/transactionalEmail.ts'

const result = await sendTransactionalEmail({
  to: 'buyer@example.com',
  templateKey: 'offer_received',
  dynamicData: { title: '...', preheader: '...', body: '...' },
})

if (!result.ok) {
  console.error('Email failed', result.error)
}
```

**Node scripts:**

```js
import { sendTransactionalEmail } from '../emails/node/sendTransactionalEmail.mjs'
```

---

## Dry-run mode

Dry-run is enabled when:

1. `SENDGRID_API_KEY` is not set, **or**
2. `EMAIL_DRY_RUN` is `true`, `1`, or `yes`

In dry-run mode the full payload is logged to stderr and the function returns `{ ok: true, dryRun: true, payload }`. No email is sent. This is the default in local dev without an API key.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run email:build-master` | Build `emails/dist/master.html` (SendGrid upload source) |
| `npm run email:preview:template -- <key>` | Render local HTML preview with mock data |
| `npm run email:test-send -- you@example.com` | Send `master_test` via SendGrid |

### Local HTML preview

```powershell
npm run email:preview:template -- offer_received
# Open emails/dist/preview-offer_received.html
```

Mock data lives in `emails/preview/mockData.js`. The approved master **design** is unchanged — only placeholder copy is used.

### Test send (PowerShell)

```powershell
# Dry-run (no API key)
npm run email:test-send -- you@example.com

# Live send
$env:SENDGRID_API_KEY="SG.xxx"
$env:SENDGRID_TEMPLATE_MASTER_TEST="d-xxxxxxxx"
npm run email:test-send -- you@example.com
```

Or set `EMAIL_TEST_TO` in `.env.local` and run `npm run email:test-send`.

---

## SendGrid setup checklist

1. **Verify domain** — Authenticate `equipd.co.uk` in SendGrid (DNS: SPF, DKIM, link branding).
2. **Create sender** — Use `notifications@equipd.co.uk` (or your chosen from-address).
3. **Create Dynamic Template** — Paste HTML from `emails/dist/master.html`.
4. **Map Handlebars fields** — Ensure template uses the same placeholders: `{{title}}`, `{{subtitle}}`, `{{{body}}}`, `{{cta_text}}`, `{{cta_url}}`, `{{base_url}}`, `{{year}}`, etc.
5. **Copy template ID** — Set `SENDGRID_TEMPLATE_MASTER_TEST=d-...` for the test template.
6. **Set template subject** — In each Dynamic Template version, set the **Subject** field to `{{subject}}`. Equipd supplies `subject` via the Mail Send API (`payload.subject`, `personalizations[0].subject`, and `dynamic_template_data.subject`). If the template subject is blank or locked to a static value, recipients may see a blank subject even when the API payload includes one.
7. **Create API key** — Restrict to Mail Send; store as `SENDGRID_API_KEY`.
8. **Test** — `npm run email:test-send -- you@example.com`

To verify API subject behaviour for `offer_received`:

```powershell
npm run email:test-sendgrid-subject -- you@example.com
```

This sends with hardcoded subject `TEST SUBJECT FROM API` and prints the exact JSON body plus the active SendGrid template version subject.

Repeat step 3–6 for each transactional email in Phase 2, using the same master layout with different default copy.

---

## Adding a new transactional email (Phase 2+)

1. Add template key + env var name to `supabase/functions/_shared/emailTemplateConfig.js`.
2. Add required `dynamicData` fields to `EMAIL_TEMPLATE_REQUIRED_FIELDS`.
3. Add mock preview data to `emails/preview/mockData.js`.
4. Create SendGrid Dynamic Template from `emails/dist/master.html` (or duplicate an existing one).
5. Set the `SENDGRID_TEMPLATE_*` secret in Supabase and `.env.local`.
6. Call `sendTransactionalEmail` from the relevant Edge Function (do not block the main flow on failure).
7. Preview locally: `npm run email:preview:template -- your_template_key`.

---

## Master template placeholders

| Placeholder | Auto-filled | Notes |
|-------------|-------------|-------|
| `base_url` | Yes | From `APP_BASE_URL` |
| `logo_url` | Yes | Absolute HTTPS logo URL (auto-filled) |
| `year` | Yes | Current year |
| `tagline` | Default | Overridable |
| `title` | No | Required |
| `subject` | No | Required for marketplace emails; set SendGrid template subject to `{{subject}}` |
| `preheader` | No | Required |
| `body` | No | HTML, use `{{{body}}}` in SendGrid |
| `subtitle`, `cta_*`, `secondary_*` | No | Optional Handlebars `{{#if}}` blocks |

See `emails/README.md` and `emails/DESIGN.md` for layout documentation.

---

## Phase 3 — Wired marketplace events

### Events wired

| Event key | Trigger | Recipient | CTA |
|-----------|---------|-----------|-----|
| `offer_received` | `offers` INSERT (buyer offer, not a counter) | Seller | `/hub?section=selling&tab=offers` |
| `offer_accepted` | `offers` UPDATE → `accepted` (buyer offer) | Buyer | `/hub?section=buying&tab=awaiting_payment` |
| `payment_successful` | `stripe-webhook` after `mark_payment_captured` | Buyer | `/orders/{order_id}` |
| `new_order_received` | Same payment success flow | Seller | `/orders/{order_id}` |

**Not wired yet:** disputes, refunds, payout, reviews.

### Phase 4 — Fulfilment events (wired)

| Event key | Trigger | Recipient(s) | CTA |
|-----------|---------|--------------|-----|
| `buyer_delivery_details_added` | `order_delivery_details` first complete save | Seller | `/orders/{order_id}` |
| `collection_confirmed` | `orders.collection_confirmed_at` set (QR handover) | Buyer + seller | `/orders/{order_id}` |
| `courier_dispatched` | `orders.courier_evidence_submitted_at` set | Buyer | `/orders/{order_id}` |
| `delivery_confirmed` | `orders.courier_delivered_at` set | Buyer + seller | `/orders/{order_id}` |
| `buyer_protection_started` | `orders.payout_release_at` first set | Buyer | `/orders/{order_id}` |

Dual-recipient events pass `recipientRole: 'buyer' | 'seller'` in the webhook payload.

Idempotency keys: `{event}:{order_id}:{recipient_user_id}` (seller for `buyer_delivery_details_added`).

Migration: `supabase/migrations/20260628200000_fulfilment_marketplace_emails.sql`

Build SendGrid import files: `npm run email:build-master` → `emails/sendgrid/<key>.html` + `.txt`

**Not wired yet:** disputes, refunds, payout, reviews, delivery/collection emails beyond the above.

### Central service

```ts
import { sendMarketplaceEmail } from '../_shared/marketplaceEmail.ts'

await sendMarketplaceEmail('offer_received', { offerId })
await sendMarketplaceEmail('payment_successful', { orderId })
```

Implementation: `supabase/functions/_shared/marketplaceEmailCore.js` (compose + idempotency + logging).

Offer events are queued from Postgres via `notify_marketplace_email()` → `send-marketplace-email` Edge Function. Payment events run inside `stripe-webhook` after capture (non-blocking).

### Idempotency keys

| Event | Key format |
|-------|------------|
| `offer_received` | `offer_received:{offer_id}:{seller_id}` |
| `offer_accepted` | `offer_accepted:{offer_id}:{buyer_id}` |
| `payment_successful` | `payment_successful:{order_id}:{buyer_id}` |
| `new_order_received` | `new_order_received:{order_id}:{seller_id}` |

Unique constraint on `transactional_email_log.idempotency_key` prevents duplicate sends.

### Email audit log

Table: `public.transactional_email_log`

Inspect in Supabase SQL editor (service role):

```sql
select template_key, recipient_email, status, idempotency_key, error_message, created_at, sent_at
from public.transactional_email_log
order by created_at desc
limit 50;
```

Statuses: `pending`, `sent`, `skipped`, `failed`.

- **skipped** — missing recipient email, dry-run, or duplicate idempotency key
- **failed** — SendGrid error (marketplace action still succeeds)

### Required template env vars (Phase 3)

| Env var | Template key |
|---------|--------------|
| `SENDGRID_TEMPLATE_OFFER_RECEIVED` | `offer_received` |
| `SENDGRID_TEMPLATE_OFFER_ACCEPTED` | `offer_accepted` |
| `SENDGRID_TEMPLATE_PAYMENT_SUCCESSFUL` | `payment_successful` |
| `SENDGRID_TEMPLATE_NEW_ORDER_RECEIVED` | `new_order_received` |

Plus shared sender config: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_REPLY_TO_EMAIL`, `APP_BASE_URL`.

### Supabase secrets (Edge Functions)

```bash
supabase secrets set \
  SENDGRID_API_KEY=SG.xxx \
  SENDGRID_FROM_EMAIL=notifications@equipd.co.uk \
  SENDGRID_FROM_NAME=Equipd \
  SENDGRID_REPLY_TO_EMAIL=support@equipd.co.uk \
  APP_BASE_URL=https://equipd.co.uk \
  MARKETPLACE_EMAIL_WEBHOOK_SECRET=your-secret \
  SENDGRID_TEMPLATE_OFFER_RECEIVED=d-xxx \
  SENDGRID_TEMPLATE_OFFER_ACCEPTED=d-xxx \
  SENDGRID_TEMPLATE_PAYMENT_SUCCESSFUL=d-xxx \
  SENDGRID_TEMPLATE_NEW_ORDER_RECEIVED=d-xxx
```

Configure `app_config.marketplace_email_webhook_secret` to match `MARKETPLACE_EMAIL_WEBHOOK_SECRET` (migration seeds a placeholder).

Deploy Edge Functions: `send-marketplace-email`, `stripe-webhook`.

Apply migration: `supabase/migrations/20260628180000_transactional_email_log.sql`

### Buyer vs seller email safety

- **Buyer emails** (`offer_accepted`, `payment_successful`) never include Seller Service Fee, payout amounts, or “You'll receive” copy.
- **Seller emails** (`offer_received`, `new_order_received`) may include fee and net payout on `new_order_received`.

### Manual resend (later)

To resend, delete the row for that `idempotency_key` in `transactional_email_log`, then re-trigger the event or call:

```bash
npm run email:test-send -- offer_received you@example.com
```

(Test send uses mock data — for production resend, trigger the real event or add an admin tool later.)

### Tests

```bash
npm run test:marketplace-email
npm run email:test-send -- offer_received you@example.com
```
