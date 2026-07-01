# Equipd transactional email

Reusable SendGrid-compatible master layout plus Phase 2 transactional templates.

Marketplace events are **not** wired yet — templates are built and previewed locally only.

## Structure

```
emails/
  components/          — Header, hero, content, CTA, footer partials
  layouts/master.html  — Shell, resets, dark mode, responsive CSS
  templates/           — Phase 2 copy + mock data per template key
  sendgrid/            — SendGrid import files (HTML + plain text per template)
  dist/
    master.html        — Composed master shell (reference)
    preview-<key>.html — Filled browser previews (mock data)
  preview/
    <key>-desktop.png  — Desktop screenshots
    <key>-mobile.png   — Mobile screenshots
```

## Build

```bash
npm run email:build-master
npm run email:preview:template-screenshots
npm run email:preview:template -- offer_received
```

## SendGrid import files (after `npm run email:build-master`)

| Template | HTML (paste into SendGrid) | Plain text |
|----------|----------------------------|------------|
| Offer Received | `emails/sendgrid/offer_received.html` | `emails/sendgrid/offer_received.txt` |
| Offer Accepted | `emails/sendgrid/offer_accepted.html` | `emails/sendgrid/offer_accepted.txt` |
| Payment Successful | `emails/sendgrid/payment_successful.html` | `emails/sendgrid/payment_successful.txt` |
| New Order Received | `emails/sendgrid/new_order_received.html` | `emails/sendgrid/new_order_received.txt` |

Browser previews (filled mock data): `emails/dist/preview-<key>.html`

## Logo

`{{logo_url}}` → `https://equipd.co.uk/email/equipd-full-logo.png`

## SendGrid setup

See [`SENDGRID.md`](./SENDGRID.md).
