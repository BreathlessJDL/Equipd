# Equipd email master layout — design specification

## Design intent

A single reusable shell for every Equipd transactional email: modern, clean, premium, and calm — closer to Stripe, Airbnb, Vinted, and Notion than marketing newsletters.

Principles:

- **Mobile-first** — readable without zoom; full-width CTA on small screens.
- **Generous whitespace** — breathing room between header, hero, card, CTA, and footer.
- **Simple typography** — one sans-serif stack; no decorative fonts in email.
- **Professional, not promotional** — one primary action; no banners or heavy imagery.
- **Brand-consistent** — Equipd navy text, orange reserved for actions and links.

---

## Typography

| Element | Font | Size | Weight | Colour (light) | Line height |
|---------|------|------|--------|----------------|-------------|
| Hero title | Inter, Segoe UI, system-ui | 28px (24px mobile) | 600 | `#0f2137` | 1.25 |
| Hero subtitle | Inter, Segoe UI, system-ui | 16px (15px mobile) | 400 | `#5c6570` | 1.55 |
| Body (card) | Inter, Segoe UI, system-ui | 16px | 400 | `#0f2137` | 1.6 |
| Body strong | Inter, Segoe UI, system-ui | 16px | 600 | `#0f2137` | 1.6 |
| CTA button | Inter, Segoe UI, system-ui | 16px | 600 | `#ffffff` on `#e8622a` | 1.2 |
| Secondary link | Inter, Segoe UI, system-ui | 14px | 500 | `#e8622a` | 1.5 |
| Header tagline | Inter, Segoe UI, system-ui | 13px | 400 | `#5c6570` | 1.5 |
| Footer links | Inter, Segoe UI, system-ui | 13px | 500 | `#5c6570` | 1.8 |
| Footer meta | Inter, Segoe UI, system-ui | 12px | 400 | `#9aa3ad` | 1.5 |

**Web font note:** Inter is referenced for clients that support `@font-face` or linked fonts. The stack falls back to system UI fonts everywhere else — do not rely on web fonts loading in email.

**Dark mode:** Headings `#f3f4f6`, body `#e5e7eb`, muted `#9ca3af`, card `#1f2937` on page `#111827`.

---

## Spacing

| Area | Padding / gap |
|------|----------------|
| Email max width | 600px |
| Content card max width | 520px |
| Header top | 32px |
| Header → hero | 8px + optional tagline 16px |
| Hero bottom | 24px |
| Content card inner | 28px (22px mobile) |
| Content card radius | 16px (14px mobile) |
| CTA section bottom | 32px |
| CTA button padding | 16px × 28px |
| CTA button radius | 12px |
| Secondary link top margin | 20px |
| Footer top divider | 24px after CTA |
| Footer bottom | 32px |

Vertical rhythm inside `{{body}}`: paragraph margin-bottom **16px**; list margin-bottom **16px**; list item gap **8px**.

---

## Colour contrast (light mode)

| Pair | Ratio | WCAG |
|------|-------|------|
| Navy `#0f2137` on white | ~14.5:1 | AAA |
| Muted `#5c6570` on white | ~5.8:1 | AA |
| White on orange `#e8622a` | ~4.6:1 | AA (large text / buttons) |
| Footer meta `#9aa3ad` on `#f7f8fa` | ~2.8:1 | Decorative/meta only |

Orange is used only for primary buttons and intentional links — not for large text blocks.

---

## HTML structure (composed)

```
body.email-bg
└── table.email-shell (max 600px)
    ├── header — logo, optional tagline
    ├── hero — {{title}}, {{subtitle}}
    ├── content — white card with {{{body}}}
    ├── cta — orange button, optional secondary link
    └── footer — help links, legal, copyright
```

---

## Outlook & client notes

- **Outlook (Windows):** VML roundrect fallback for CTA; 600px MSO wrapper table.
- **Gmail / Apple Mail:** Standard table layout + inline styles.
- **Dark mode:** `@media (prefers-color-scheme: dark)` + `[data-ogsc]` overrides for Gmail iOS.
- **Logo:** `equipd-full-logo.png` at 160×54px display. Public URL: `https://equipd.co.uk/email/equipd-full-logo.png`

---

## Recommendations before building individual templates

1. **Host logo on CDN** — Use a stable absolute URL (not dev paths) in SendGrid; add `@2x` asset for retina.
2. **Dark logo variant** — Optional light wordmark asset for dark-mode clients if contrast becomes an issue; layout supports a swap via `email-logo--dark`.
3. **Preheader discipline** — Every email must set `{{preheader}}`; never leave it empty (clients show body snippet otherwise).
4. **Plain-text twin** — Generate a text/plain version alongside HTML for accessibility and deliverability.
5. **Handlebars partials in SendGrid** — Upload `master.html` as a Dynamic Template; individual emails pass `dynamic_template_data` only.
6. **Shared renderer** — Add `supabase/functions/_shared/emailLayout.ts` to compose HTML server-side with the same tokens (next step after layout approval).
7. **Litmus / Email on Acid** — Test master across Gmail, Outlook, Apple Mail, and Yahoo before cloning for transactional types.
8. **Unsubscribe / preference links** — Add to footer for marketing-style mailings only; transactional emails may omit but document which types are transactional vs marketing.
9. **Body HTML sanitisation** — Sanitise `{{{body}}}` server-side; allow only safe tags (`p`, `a`, `strong`, `ul`, `ol`, `li`, `br`).

---

## Approval checklist

- [ ] Desktop preview (`emails/dist/master-preview.html`)
- [ ] Mobile preview (390px width)
- [ ] Dark mode preview (OS dark mode or devtools)
- [ ] CTA tappable area ≥ 44px height on mobile
- [ ] Footer links match live site routes
- [ ] Placeholders documented for template authors
- [ ] No order-specific copy in master layout
