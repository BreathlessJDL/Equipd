# Equipd UI Rebuild Plan

Planning document for aligning the React app with [`DESIGN_REFERENCE.md`](./DESIGN_REFERENCE.md) and assets in `public/design-reference/`. Ranks work by **business impact** (user-facing conversion and trust), then recommends a **build order** that respects shared components and dependencies.

**Scope:** Visual and layout rebuild only. No changes to Stripe checkout, payout release logic, database schema, or backend APIs unless separately approved.

---

## Business impact ranking

| Rank | Page | Why it matters |
|------|------|----------------|
| 1 | **Homepage** | Primary acquisition surface; sets brand, trust, and discovery entry point for all visitors. |
| 2 | **Browse / Search** | Core marketplace discovery; most sessions that convert pass through search or filtered listings. |
| 3 | **Listing Detail** | Purchase decision point — price, trust, delivery, Buy Now / Make an Offer. |
| 4 | **Hub** | Authenticated seller/buyer command centre — offers, payments, listings, Stripe onboarding. |
| 5 | **Messages** | Pre- and post-sale coordination; supports offer negotiation and order questions. |
| 6 | **Orders** | Post-checkout fulfilment, QR collection, buyer confirmation, support. |
| 7 | **Admin** | Internal operations; small audience, no Bubble-era reference assets. |

---

## Shared foundations (do first)

Several pages depend on the same primitives. Build or finish these before page-specific work:

| Foundation | Reference | Current gap |
|------------|-----------|-------------|
| Design tokens | §1–2 | Orange/navy tokens exist in `global.css`; serif hero font may not be loaded; Stripe purple scoped inconsistently. |
| Logo lockup | `Full logo.png`, `Equipd logo.png` | Generated `logo.svg` / `EquipdLogo.jsx` — swap to official assets. |
| Top utility bar | Homepage §3 | `HomeTrustBar` exists; verify Stripe wordmark uses official purple asset. |
| App header | Homepage §3, authenticated variant | Home has centred search; non-home uses `AppShell` with tagline, no centred search. Unify patterns. |
| Footer | §9 `Footer example.png` | `HomeFooter` is 3-column + brand; reference is 4-column Quick Links / Equipd / Customer Support / Contact Us + legal bar. |
| Grid listing card | §4 | `ListingCard` `variant="home"` partially aligned; missing “New” badge, heart save, title → condition → price → location hierarchy. |
| Row listing card | §4 | Browse uses **grid** cards, not reference **row** layout (condition pill, orange price pill, collection line, seller). |
| Buyer Protection modal | §7 | `BuyerProtectionInfo` exists; align shield icon, section copy, “Sounds good” CTA to modal reference. |
| UiState components | — | `LoadingState`, `ErrorState`, `EmptyState` in place from launch polish; reuse across rebuild. |

---

## Page plans

### 1. Homepage

**Business impact:** Highest — first impression, SEO landing, trust positioning.

#### Current state

Partial Bubble-inspired rebuild is in place (`HomePage.jsx`, `src/components/home/*`):

- Utility bar (`HomeTrustBar`), header with centred search (`HomeHeader`), photo hero (`HomeHero`), three-column trust card (`HomeTrustPayments`), recently added grid (`HomeRecentListings`), category section (`HomeCategoryGrid`), location grid (`HomeLocationGrid`), reviews section (`HomeReviewsSection`), embedded browse block (`#browse` with `ListingBrowseFilters` + grid results), and marketing footer (`HomeFooter`).
- App shell header/footer hidden on `/`.
- Gaps vs reference: no **text category navigation row** above hero; category grid uses emoji icons on light cards (“Browse by category”) instead of **orange product-photo tiles** (“Shop our most popular”); no secondary seller/QR marketing banners in scroll order; footer column structure differs; browse block at bottom duplicates discovery (reference ends with category grid + footer); reviews section has no reference asset; serif hero typography may be missing.

#### Target state (from design reference)

Exact section order (§3):

1. Light grey utility bar — padlock + Stripe checkout trust; QR Code Collection + Help links.
2. Main header — logo, centred search + orange Search, Log In / Sign Up.
3. **Category text links** — Treadmills, Crosstrainers, etc. (flat navy links).
4. Full-width photo hero — serif headline, sans subhead, orange “Browse equipment” pill.
5. White three-column trust bar overlapping hero.
6. “Recently Added” grid — orange “New” badges, heart saves, “View all >”.
7. **“Shop our most popular”** — 2×4 orange category tiles with product photography.
8. Secondary marketing blocks (seller hero, QR collection banner) — placement inferred.
9. Four-column dark footer with contact accents.

Grid cards in recently added: image → title → condition → **bold orange price** → location pin (§4).

#### Estimated complexity

**Medium** — ~60% structurally present; remaining work is visual alignment (category patterns, section order, footer, marketing banners, card hierarchy, typography).

#### Recommended implementation order

1. Load serif headline font + verify token hex values against reference.
2. Replace logo with official assets.
3. Add category text nav row; reorder sections to match reference.
4. Rebuild category section as orange tile grid with real category images.
5. Align `HomeRecentListings` cards (New badge, save heart, hierarchy).
6. Add seller + QR marketing banner components; place after categories.
7. Rebuild footer to four-column spec; extract as shared `SiteFooter` for other routes.
8. Decide fate of embedded `#browse` block (keep as anchor vs link to dedicated browse route).
9. Mobile pass — stacked search, horizontal-scroll categories (§10 — no full mobile reference).

---

### 2. Browse / Search

**Business impact:** Second highest — primary equipment discovery after homepage.

#### Current state

- No dedicated `/browse` route. Search and filters live on homepage `#browse` and on **location pages** (`LocationListingsPage.jsx` via `/listings/:locationSlug`).
- `ListingBrowseFilters` — text search, category, condition, brand, min/max price fields (no sort dropdown, no price slider, no Apply/Reset button row).
- `ListingBrowseResults` — **grid** of default `ListingCard` components, not horizontal rows.
- `LocationListingsPage` has SEO title, intro copy, filters, grid results, and a text sidebar (areas + local trust bullets) — closer to reference layout than homepage browse but still grid-based cards.
- Non-home pages use `AppShell` header without centred search bar.

#### Target state (from design reference)

**Browse page** (`Browse equipment example.png`, §6):

- Page title “Browse Gym Equipment” + grey subhead.
- Filter row: Sort By | All Types | All Conditions dropdowns + **orange-handled price slider** + orange “Apply Filters” / “Reset Filters”.
- “Available Equipment” section with divider.
- **Row card** listings (§4): image left; title; grey condition pill; **orange price pill (white text)**; collection available + green check; location; seller username + menu; row dividers.
- Header: centred search on browse (§3 search placement).

**Location page** (`Location page example.png`, §6):

- Same filter bar and row cards.
- Two-column layout: listings left; sidebar right with map placeholder, “Areas included near {city}” (orange bullets), “Why buy locally” (green checks).

#### Estimated complexity

**High** — requires new `ListingRowCard` component (or card variant), filter UI overhaul (slider, sort, apply/reset UX), shared browse shell with reference header, and decision on route structure (dedicated browse vs homepage anchor). Location sidebar needs map embed polish.

#### Recommended implementation order

1. Build **row listing card** component (shared by browse, location, search results).
2. Refactor filters — dropdowns, price range slider, Apply/Reset actions.
3. Introduce dedicated browse route or promote `#browse` to a full page with reference layout.
4. Add centred-search header variant to `AppShell` (or shared `MarketplaceHeader`).
5. Restyle `LocationListingsPage` — row cards + sidebar map/trust blocks per reference.
6. Wire category text nav and “View all >” from homepage to browse with pre-applied filters.
7. Mobile — full-width stacked row cards, collapsible filter drawer (inferred from §10).

---

### 3. Listing Detail

**Business impact:** Third — directly drives Buy Now, offers, and trust at point of purchase.

#### Current state

- Functional single-column / stacked layout in `ListingDetailPage.jsx` + `ListingDetail.css`.
- Features present: image gallery (basic), title, price, condition, delivery labels, Buy Now / Make an Offer, offers section, seller contact, `BuyerProtectionInfo`, `SellerReviewsSummary`, owner publish controls, save listing.
- Layout does not match reference **three-column** container (gallery | info+actions | seller+Why Buy).
- Price styling, Stripe inline logo, quantity highlight, delivery/collection grey card, and “Why Buy on Equipd?” green-check panel differ from reference.
- Delivery options deep-link not styled per `Example delivery options.png`.
- Reviews on listing page not in reference (may stay as modernisation per §14).

#### Target state (from design reference)

**Item page** (`Item page example.png`, §5):

- Large white rounded page container; three columns.
- **Left:** main gallery with arrow overlays, heart save, thumbnail strip.
- **Middle:** title → large orange price → “In stock - secure payments with **stripe**” (official logo) → quantity (orange highlight) → light grey Delivery & Collection card with green check + “Learn more >” → Buy Now (orange) + Make an Offer (outline) → Equipment Details table.
- **Right:** seller card (orange avatar fallback, shop name, Contact Seller + Store buttons, orange star rating) → “Why Buy on Equipd?” card with green checks (five bullets).
- Buyer Protection accessible via shield/modal pattern (§7).

**Delivery options page** (`Example delivery options.png`, §8) — postcode estimate, stacked option cards, peach tips box (may be modal or sub-route from “Learn more”).

#### Estimated complexity

**High** — full layout restructure, gallery UX upgrade, new seller/trust panels, Stripe asset integration, delivery card + optional delivery options surface. Logic (offers, checkout, save) stays; presentation is largely new CSS + markup reorganization.

#### Recommended implementation order

1. Three-column responsive shell (stack on mobile per §10).
2. Gallery — arrows, thumbnails, save overlay.
3. Middle column hierarchy — price, Stripe line, quantity, delivery card.
4. Action button pair styling (Buy Now / Make an Offer).
5. Right column — seller panel + “Why Buy on Equipd?” (reuse copy from `trustMessaging.js`).
6. Equipment details section styling.
7. Delivery options UI (`Example delivery options.png`) linked from collection card.
8. Buyer Protection modal polish to match `Buyer protection information.png`.
9. Preserve existing offers, owner controls, and review summary in aligned slots.

---

### 4. Hub

**Business impact:** Fourth — retention for sellers and buyers managing active transactions.

#### Current state

- `HubPage.jsx` — tabbed/sectioned dashboard: Stripe onboarding banner, my listings, offers made/received (pending/accepted/cancelled), payment CTAs, buyer protection snippet, `ListingCard` grids, `HubSection` / `HubOfferList` components.
- Uses standard `AppShell` chrome; functional but utilitarian styling (`Hub.css`).
- Launch polish added: soft refresh, partial fetch warnings, corrected empty orders messaging, `UiState` patterns.
- **No Bubble design reference** for hub layout (§14 gaps).

#### Target state (from design reference)

- No dedicated hub screenshot. Infer from authenticated header (`About Equipd example page.png`): search + inbox + heart + Browse / Seller Hub / Buyer Hub + orange “+ Create Listing”.
- Card-based sections, orange primary CTAs, navy headings, trust callouts consistent with marketplace pages.
- Offer/order rows should eventually use row-card visual language where listings appear.
- Stripe onboarding and payment actions retain official Stripe purple where payment-branded.

#### Estimated complexity

**Medium** — no pixel-perfect reference; mostly apply shared header, tokens, card/button styles, and row patterns from browse/detail work. Logic is mature.

#### Recommended implementation order

1. Authenticated header variant (shared with About, profile, listing edit).
2. Apply global typography and card styles to `HubSection` blocks.
3. Replace grid listing previews with row or compact card variants where appropriate.
4. Style offer lists as reference-aligned rows (status pills, orange price, actions).
5. Stripe onboarding + Pay Now CTAs — button spec from §12.
6. Mobile — stack sections; sticky payment CTAs on accepted offers.

---

### 5. Messages

**Business impact:** Fifth — supports negotiation and order communication, but narrower audience than browse/detail.

#### Current state

- `MessagesPage.jsx` — two-panel master-detail (conversation list + thread), compose box, read/unread handling, mobile master-detail toggle from launch polish.
- Standard `AppShell` header; minimal styling (`Messages.css`).
- **No design reference** for inbox UI.

#### Target state (from design reference)

- Infer from authenticated header (inbox icon in `About Equipd example page.png`).
- Clean white panels, navy thread titles, orange send/primary actions, grey timestamps.
- Consistent with card/button specs (§11–12); mobile single-column with back navigation (partially implemented).

#### Estimated complexity

**Medium-Low** — layout exists; primarily visual reskin + header integration. No new product flows.

#### Recommended implementation order

1. Authenticated header with inbox badge (shared component).
2. Restyle conversation list — avatars, unread state, orange accent.
3. Thread panel — message bubbles or flat rows per brand tone (reference implies flat/professional, not chat-app bubbles).
4. Compose area — orange send, full-width on mobile.
5. Empty/error states via existing `UiState`.

---

### 6. Orders

**Business impact:** Sixth — post-purchase; critical for collection/payout but fewer unique visitors than browse.

#### Current state

- `OrderDetailPage.jsx` — order summary, timeline (`OrderTimeline`), buyer confirmation / QR flow (`BuyerOrderConfirmation`), support requests, reviews, cancel actions, admin viewer access, `BuyerProtectionInfo`, `UiState` error handling.
- Functional stacked layout (`OrderDetail.css`); not aligned to reference containers.
- **Confirm collection mobile screen** has reference (`Confirm collection example.png`, §7): QR verified badge, warning peach box, checkbox, full-width orange confirm CTA.

#### Target state (from design reference)

- Order detail: apply card layout, navy headings, orange CTAs, trust messaging (held funds, release on confirmation) from §7.
- Buyer confirmation flow: match confirm-collection mobile spec — status-first stack, peach warnings, orange bullets, “Confirm Collection & Release Payment” button (§7, §10).
- QR four-step narrative available via how-it-works / marketing components (`QR code explain banner.png`).
- Timeline and support sections styled as white cards with green/orange status indicators.

#### Estimated complexity

**Medium** — confirmation flow has a clear reference; order detail page is larger but mostly restyling existing sections. Avoid touching payout logic.

#### Recommended implementation order

1. Restyle `BuyerOrderConfirmation` to `Confirm collection example.png` (mobile-first).
2. Order detail page shell — card sections, typography.
3. Timeline visual pass — status colors, icons.
4. Support + review sections — card styling consistent with hub.
5. Trust copy blocks via `BuyerProtectionInfo` / `trustMessaging.js`.
6. Desktop layout — multi-column summary where helpful (no strict reference).

---

### 7. Admin

**Business impact:** Lowest — internal ops (`AdminOrdersPage`, `AdminSupportPage`); not customer-converting.

#### Current state

- Table-based admin UI with filters, warning badges, links to orders/listings, access-denied state on `AdminProtectedRoute`.
- `UiState` for loading/error/empty; functional but unstyled vs brand.
- **No admin design reference.**

#### Target state (from design reference)

- Apply core tokens (navy headings, orange actions, white cards) for consistency.
- Tables with readable row hierarchy, filter chips/dropdowns styled like browse filters.
- No need for marketing chrome (utility bar, hero, footer columns).
- Priority: clarity and scanability over pixel-perfect Bubble match.

#### Estimated complexity

**Low** — CSS pass on existing tables and filters; no layout paradigm shift.

#### Recommended implementation order

1. Admin sub-layout (minimal header, no marketing footer).
2. Token + typography pass on tables and filters.
3. Status/warning pills aligned with marketplace tag styles.
4. Access-denied and empty states — already use `UiState`; minor styling.
5. Defer dark-mode or advanced dashboard widgets unless requested.

---

## Consolidated implementation roadmap

Recommended **build sequence** across pages (differs from business rank where dependencies matter):

| Phase | Work | Pages / artifacts | Depends on |
|-------|------|-------------------|------------|
| **0** | Tokens, fonts, official logo, shared footer, Buyer Protection modal | Foundation | — |
| **1** | Finish homepage gaps (category nav, orange tiles, section order, footer) | Homepage | Phase 0 |
| **2** | Row listing card + filter bar (slider, sort, apply/reset) | Browse / Search | Phase 0 |
| **3** | Browse route + `AppShell` centred-search header; location page row layout | Browse / Search | Phase 2 |
| **4** | Listing detail three-column layout + gallery + seller/trust panels | Listing Detail | Phase 0–2 (cards, buttons) |
| **5** | Delivery options UI + item-page delivery card link | Listing Detail | Phase 4 |
| **6** | Authenticated header variant | Hub, Messages, Orders | Phase 0 |
| **7** | Hub visual pass + offer row styling | Hub | Phase 2, 6 |
| **8** | Messages reskin | Messages | Phase 6 |
| **9** | Order detail + confirm-collection mobile alignment | Orders | Phase 0, 7 |
| **10** | Admin token/table pass | Admin | Phase 0 |

---

## Out of scope for this plan (no reference assets)

These routes exist but are not in the ranked list. Rebuild when assets are added or after core marketplace pages:

| Route / page | Notes |
|--------------|-------|
| Login / Signup | No reference; use header button styles (§12). |
| Profile, My Listings, Add/Edit Listing | No reference; follow authenticated header + form card patterns. |
| Saved Listings, Notifications | No reference. |
| Buyer Protection, How It Works, About | Partial references exist (§7, §13); largely built — polish to match screenshots. |
| Make Offer modal, checkout | Not in reference set; preserve current flows. |

---

## Success criteria

- [ ] Homepage section order and components match §3 of `DESIGN_REFERENCE.md`.
- [ ] Browse and location pages use **row cards** and reference filter bar.
- [ ] Listing detail matches three-column §5 layout on desktop; stacks on mobile.
- [ ] Shared header/footer/authenticated variants consistent across routes.
- [ ] Official Stripe wordmark and logo assets used per §1 and §7.
- [ ] Confirm collection flow matches `Confirm collection example.png`.
- [ ] No regressions to checkout, payouts, offers, or messaging behaviour.
- [ ] `npm run build` passes after each phase.

---

## Related documents

- [`DESIGN_REFERENCE.md`](./DESIGN_REFERENCE.md) — visual specification
- [`public/design-reference/README.md`](../public/design-reference/README.md) — asset index
