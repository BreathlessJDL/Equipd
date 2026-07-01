# SendGrid transactional email — Phase 1 infrastructure

Equipd transactional emails use SendGrid **Dynamic Templates** built from the approved master layout (`emails/dist/master.html`). This document covers environment setup, sending, previews, and adding new templates.

**Phase 1 scope:** plumbing only. Marketplace events are not wired yet.

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
6. **Create API key** — Restrict to Mail Send; store as `SENDGRID_API_KEY`.
7. **Test** — `npm run email:test-send -- you@example.com`

Repeat step 3–5 for each transactional email in Phase 2, using the same master layout with different default copy.

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
| `preheader` | No | Required |
| `body` | No | HTML, use `{{{body}}}` in SendGrid |
| `subtitle`, `cta_*`, `secondary_*` | No | Optional Handlebars `{{#if}}` blocks |

See `emails/README.md` and `emails/DESIGN.md` for layout documentation.
