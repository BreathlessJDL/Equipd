# Equipd transactional email — master layout

Reusable SendGrid-compatible master template for all Equipd transactional emails.

**Do not add individual email content here yet.** This folder defines layout, branding, and composition only.

## Structure

```
emails/
  components/
    header.html    — Logo + optional tagline
    hero.html      — Title + optional subtitle
    content.html   — Rounded white content card ({{{body}}})
    cta.html       — Primary orange button + optional secondary link
    footer.html    — Help, support, legal, copyright
  layouts/
    master.html    — Shell, resets, dark mode, responsive CSS
  dist/
    master.html           — Composed SendGrid template (Handlebars placeholders)
    master-preview.html   — Filled preview for browser review
  DESIGN.md               — Typography, spacing, recommendations
```

## Build

```bash
node scripts/build-email-master.mjs
node scripts/screenshot-email-master-preview.mjs   # optional desktop/mobile PNGs
```

## SendGrid placeholders

| Placeholder | Required | Description |
|-------------|----------|-------------|
| `{{base_url}}` | Yes | App origin, e.g. `https://equipd.co.uk` |
| `{{preheader}}` | Yes | Hidden inbox preview line (~90 chars) |
| `{{title}}` | Yes | Hero heading |
| `{{subtitle}}` | No | Hero supporting line |
| `{{body}}` | Yes | HTML body inside content card (triple braces `{{{body}}}` if unescaped) |
| `{{cta_text}}` | No | Primary button label |
| `{{cta_url}}` | No | Primary button URL |
| `{{secondary_text}}` | No | Text link below button |
| `{{secondary_url}}` | No | Text link URL |
| `{{tagline}}` | No | Header tagline under logo |
| `{{year}}` | Yes | Footer copyright year |

Conditional blocks use Handlebars:

```handlebars
{{#if subtitle}}...{{/if}}
{{#if cta_text}}...{{/if}}
{{#if secondary_text}}...{{/if}}
{{#if tagline}}...{{/if}}
```

## Server-side composition (future)

When sending via Edge Functions, compose the same partials in code or render `emails/dist/master.html` with Handlebars. Keep transactional copy in separate template files — never hardcode order data in the layout.

## Brand tokens

| Token | Value | Usage |
|-------|-------|-------|
| Navy | `#0f2137` | Headings, body text |
| Muted | `#5c6570` | Subtitles, footer links |
| Orange | `#e8622a` | Primary CTA, inline links |
| Page bg | `#f7f8fa` | Email background |
| Card bg | `#ffffff` | Content card |
| Border | `#dde3ea` | Card + dividers |
| Footer meta | `#9aa3ad` | Copyright, sent-by |

Matches `src/styles/global.css`.

## Logo

Hosted at `{{logo_url}}` (default `https://equipd.co.uk/email/equipd-full-logo.png` from `public/email/equipd-full-logo.png`).

## Preview

Open `emails/dist/master-preview.html` in a browser after running the build script.

## SendGrid (Phase 1)

Transactional email sending infrastructure is documented in [`SENDGRID.md`](./SENDGRID.md).

Quick start:

```bash
npm run email:test-send -- you@example.com   # dry-run without SENDGRID_API_KEY
npm run email:preview:template -- offer_received
```
