# Equipd Design Reference

Official design specification derived from the historical Bubble-era assets in `public/design-reference/`. This document is the source of truth for Equipd visual language. All future UI work should align with it unless explicitly approved otherwise.

---

## Asset inventory

| File | Documents |
|------|-----------|
| `Example home page.png` | Homepage — utility bar, header, category links, hero, trust bar, recently added |
| `Hero banner.png` | Hero + three-column trust bar (detail) |
| `Secondary hero banner.png` | Seller marketing banner (“coat rack”) |
| `third hero banner.png` | QR collection trust banner |
| `popular categories examples.png` | “Shop our most popular” orange category grid |
| `Listing cards examples.png` | Grid listing cards — full card body hierarchy |
| `Browse equipment example.png` | Browse page — filters, horizontal listing rows |
| `Browse listings example.png` | Horizontal listing row layout (list view) |
| `Location page example.png` | Location browse — filters, sidebar, list rows |
| `Item page example.png` | Listing detail — gallery, actions, seller, trust |
| `Example delivery options.png` | Delivery options — postcode, option cards, tips |
| `Footer example.png` | Site footer — four columns, contact, legal bar |
| `QR code explain banner.png` | Four-step QR / Stripe / payout infographic |
| `How Equipd works page example.png` | How-it-works steps, trust cards, brand strip |
| `About Equipd example page.png` | About page, authenticated header, info cards |
| `Buyer protection information.png` | Buyer Protection modal — refunds, secure transactions, support |
| `Buyer protection icon.png` | Buyer Protection shield badge |
| `Confirm collection example.png` | Mobile confirm collection / release payment |
| `Full logo.png` / `Full logo 1.png` | Full wordmark lockup |
| `Equipd logo.png` / `Equipd icon.jpg` | Icon-only mark |
| `Stripe logo.png` | Official Stripe wordmark (purple) |

---

## 1. Brand identity

### Logo usage

**Full lockup (primary)**
- Orange rounded-square icon left + navy “Equipd” wordmark right, vertically centred.
- White or very light backgrounds only for full-colour lockup.
- Header, footer (inverted on dark footer), marketing surfaces.

**Wordmark**
- Spelling: **Equipd** — capital E, lowercase quipd.
- Bold geometric sans-serif; navy (never orange text).
- Dot on “i” is a small rounded square.

**Placement**
- Header: left-aligned; icon height ~32–40px matching wordmark cap height.
- Footer: white/inverted logo on charcoal footer (see Footer specification).
- Never on busy photography without scrim or card.

### Icon usage

- Orange squircle + white stylised “E” (three bars; curved left spine; middle bar shorter, pill-ended).
- Favicon, app icon, seller avatar fallback (orange circle + white E on item page), compact nav.
- Do not recolour, distort, or add gradients to the mark.

### Orange colour palette

| Token | Approx. value | Usage |
|-------|---------------|--------|
| Primary orange | `#F06428` – `#F27134` | Logo icon, CTAs, prices, trust icons, category tiles, badges, stars, slider handles |
| Orange hover | Darker orange | Button hover, emphasis |
| Light orange / peach | `#FFF4ED` range | Warning callouts (confirm collection) |
| Orange border | Mid orange | Outline buttons (“Make an Offer”, “Sign Up”), delivery tips border |

### Navy colour palette

| Token | Approx. value | Usage |
|-------|---------------|--------|
| Primary navy | `#1A1F2B` – `#1B2533` | Wordmark, headlines, titles, footer background |
| Footer charcoal | Dark charcoal/navy | Main footer; slightly darker bar for copyright row |

### Supporting colours

| Token | Usage |
|-------|--------|
| White | Page background, cards, trust bar, button text on filled buttons |
| Light grey `#F8F9FA` | Top utility bar, delivery/collection card backgrounds, condition pills |
| Warm cream `#F9F8F3` | Secondary marketing banners |
| Medium grey | Body text, labels, borders, secondary nav |
| Muted grey | Copyright / legal bar text |

### Trust / buyer-protection colours

| Token | Usage |
|-------|--------|
| Stripe blurple | Official Stripe wordmark and payment buttons only |
| Success green | Checkmarks (collection, trust lists, QR verified, “Why Buy” icon) |
| Gold / yellow | “COLLECTED!” scan status |
| Orange outline icons | Shield, padlock, prohibited circle, Buyer Protection badge |

---

## 2. Typography

### Headline style

**Marketing / hero**
- Large **serif**, bold, navy/black.
- Examples: “Same workout. Half the price.”; “No cash meetups. No risk.”; “Secure Your Sale with QR Code Collection.”

**Page / section titles**
- Bold **sans-serif**, navy/black.
- Examples: “Browse Gym Equipment”, “Used Gym Equipment in Leeds”, “Shop our most popular”, “Delivery Options”, “Buyer Protection”.

**Rule:** Serif for hero and major trust marketing; sans for app pages and section headers.

### Body text style

- Geometric sans-serif throughout UI.
- Regular weight, medium grey or navy for descriptions.
- Location pages use smaller grey intro paragraphs (SEO-style copy).

### Button text style

- Sans-serif, semibold/bold, white on orange or navy fills.
- Outline buttons: orange text on white with orange border.
- Examples: “Browse equipment”, “Buy Now”, “Make an Offer”, “Sounds good”, “Apply Filters”.

### Trust messaging style

- Trust bar: bold sans titles + regular grey descriptions.
- Buyer Protection modal: bold navy section headings + grey bullet lists.
- Warning states: orange bullets on peach background (confirm collection).
- Status: bold uppercase sans (“COLLECTED!”, “QR Code Verified”).

---

## 3. Homepage structure

Sources: `Example home page.png`, `popular categories examples.png`, `Footer example.png`, marketing banners.

### Exact section order (top → bottom)

| # | Section | Source |
|---|---------|--------|
| 1 | **Top utility bar** | Light grey. Left: padlock + “Guaranteed safe & secure checkout” + Powered by Stripe. Right: “QR Code Collection”, “Help”. |
| 2 | **Main header** | Logo left. Centred search (“Search for equipment…”) + orange Search button. Right: orange “Log In”, white bordered “Sign Up”. |
| 3 | **Category text navigation** | Horizontal links: Treadmills, Crosstrainers, Upright Bikes, Spin Bikes, Multi-gyms, Commercial Equipment, Home Equipment, Strength Equipment, Cardio Equipment. |
| 4 | **Hero** | Full-width gym photo. Serif headline + sans subhead + orange pill “Browse equipment”. |
| 5 | **Trust / payment bar** | White floating card, three columns (Stripe / no cash / release on collection). |
| 6 | **Recently added** | “Recently Added” + orange “View all >”. Grid of listing cards with “New” badges. |
| 7 | **Shop our most popular** | Heading centred; 2×4 grid of **orange square category tiles** with product photos + category name (see Category navigation). |
| 8 | **Top brands, half the price** | Section below categories (*heading visible in `popular categories examples.png`; full layout not shown*). |
| 9 | **Secondary marketing blocks** | Seller hero (`Secondary hero banner.png`), QR block (`third hero banner.png`) — placement in scroll inferred. |
| 10 | **Footer** | Four-column dark footer (`Footer example.png`). |

### Hero usage

- Real bright gym photography; text overlay with high contrast.
- One primary orange CTA per hero.
- Seller variant: cream background, serif headline, black “Sell now” CTA.

### Search placement

- **Centred in main header** on all referenced pages (home, browse, item page).
- Wide rounded input, magnifying glass left, orange Search button right.
- Separate from top utility bar (checkout trust only).

### Category navigation

**Two patterns in reference:**

1. **Text link row** (homepage header area) — flat navy links, no icons.
2. **“Shop our most popular” grid** — 2 rows × 4 columns of **solid orange rounded squares** with isolated product photo + centred category label below image inside tile. Categories: Treadmills, Spin Bikes, Rowers, Crosstrainers, Upright Bikes, Plate Loaded Machines, Pin Loaded Machines, Dumbbells.

### Recently added section

- Left: “Recently Added” (bold navy).
- Right: “View all >” (orange).
- Grid cards with orange “New” badge (top-left) and heart save (top-right).

### Trust / payment section

White card, three columns, orange outline icons, grey dividers:

1. Shield — “Secure payments with Stripe” / funds held until complete
2. Prohibited circle — “No cash or bank transfers”
3. Padlock — “Released on collection or delivery”

### Location section

- **Not a homepage block** in references — location is a **dedicated page** (`Location page example.png`): “Used Gym Equipment in Leeds” with filters, listing rows, and sidebar (“Areas included near Leeds”, “Why buy locally in Leeds?”).

### Footer

See § Footer specification (`Footer example.png`).

### Authenticated header variant

`About Equipd example page.png`: search + inbox + heart icons + Browse / Seller Hub / Buyer Hub + orange “+ Create Listing”.

---

## 4. Listing card specification

Sources: `Listing cards examples.png` (grid), `Browse listings example.png` / `Browse equipment example.png` / `Location page example.png` (row).

### Grid card (homepage, category grids)

| Element | Specification |
|---------|---------------|
| **Container** | White card, rounded corners (~8–12px), light border or subtle shadow |
| **Image ratio** | Square or slightly portrait; rounded top corners |
| **Save button** | White circle, top-right of image; grey heart outline |
| **“New” badge** | Orange rectangle, white text, top-left (*homepage only*) |
| **Title** | Bold navy sans, first below image; truncate with ellipsis |
| **Condition** | Below title; regular sans, navy/grey (e.g. “New”, “Like New”, “Used”) |
| **Price** | Below condition; **bold orange** (e.g. “£5455”) — not a pill on grid cards |
| **Location** | Bottom; grey location pin icon + city name |

**Hierarchy:** Image → Title → Condition → Price → Location (all left-aligned).

### Row card (browse, location, search results)

| Element | Specification |
|---------|---------------|
| **Layout** | Horizontal — image left, content centre/right |
| **Image** | Square-ish, rounded; heart save top-right |
| **Title** | Bold black/navy sans |
| **Condition** | Light grey **pill** badge (“Used”, “New”) |
| **Price** | **Orange pill** with **white text** (e.g. “£650”) |
| **Collection** | House icon + “Collection available” + green checkmark |
| **Location** | Pin icon + city name, grey |
| **Seller** | Bottom-right: person icon + username + vertical three-dot menu |
| **Divider** | Thin grey horizontal rule between rows |

### Delivery indicators

- Row cards: “Collection available” with house icon + green check — inline below price.
- Grid cards: not shown; delivery detail on item page.

### Favourite / save button

- Consistent: white circular button, heart outline, overlays image top-right (both grid and row).

---

## 5. Listing detail specification

Source: `Item page example.png`.

### Page container

- Large white rounded container on page background; three-column layout inside.

### Gallery placement (left column)

- **Main image:** large vertical photo; rounded corners.
- **Navigation:** left/right arrow overlays on main image.
- **Save:** heart icon top-right of main image.
- **Thumbnails:** horizontal row below main image, multiple angles.

### Information hierarchy (middle column)

| Order | Element |
|-------|---------|
| 1 | **Title** — bold black sans (e.g. “Life fitness pro 1 lat pulldown”) |
| 2 | **Price** — large **bold orange** (e.g. “£1300”) |
| 3 | **Stock / payment line** — “In stock - secure payments with **stripe**” (official Stripe logo inline) |
| 4 | **Quantity** — “Quantity Available:” with number highlighted **orange** |
| 5 | **Delivery & Collection card** — light grey box, rounded; bold title; house icon + “Collection available” + green check; “Learn more >” link |
| 6 | **Action buttons** — “Buy Now” (solid orange) + “Make an Offer” (white, orange border, orange text) |
| 7 | **Equipment Details** — section below buttons (spec table; partially visible) |

### Seller panel (right column)

- White card, rounded, soft shadow.
- **Avatar:** orange circle + white “E”.
- **Shop name:** bold (e.g. “Equipd Shop”).
- **Actions:** stacked orange buttons — “Contact Seller” (speech icon), “Equipd Shop's Store” (storefront icon).
- **Rating:** five **orange stars** + numeric score (e.g. “5”).

### Buyer protection / trust (right column, below seller)

**“Why Buy on Equipd?” card**
- Green person+shield icon + bold title.
- Five items with **green circular checkmarks:**
  - Fitness-only marketplace
  - No hidden fees
  - Secure checkout
  - UK-wide sellers
  - No fake listings!

### Offer and payment actions

- Primary: **Buy Now** (orange fill).
- Secondary: **Make an Offer** (outline orange).
- Stripe trust inline above actions via “secure payments with stripe”.

### Reviews placement

- **Not shown** on item page reference. No review block documented — add screenshot if reviews appeared on Bubble listing pages.

### Delivery / collection card

- Light grey background card in middle column (not full delivery options page).
- Links to “Learn more >” — full flow in `Example delivery options.png`.

---

## 6. Browse & location pages

### Browse page (`Browse equipment example.png`)

- Title: “Browse Gym Equipment” + grey subhead “Explore and search for new and used gym equipment.”
- **Filter row:** Sort By | All Types | All Conditions (dropdowns) + price slider (orange handles, min/max labels) + orange “Apply Filters” / “Reset Filters”.
- Section: “Available Equipment” with horizontal divider.
- Listings: **row card** layout (see §4).

### Location page (`Location page example.png`)

- Title: “Used Gym Equipment in Leeds” + grey SEO intro paragraphs.
- Same filter bar as browse.
- **Two columns:** listing rows left; sidebar right.
- **Sidebar:**
  - Map placeholder (Google Maps embed in reference).
  - “Areas included near Leeds” — orange bullet list (Bradford, Huddersfield, etc.).
  - “Why buy locally in Leeds?” — green checkmark list (inspect before purchase, QR scans, etc.).
- Listings: row cards with seller username visible.

---

## 7. Buyer protection design language

### Stripe references

- Utility bar: “Powered by stripe”.
- Trust bar, item page inline logo, how-it-works footer.
- Buyer Protection modal: “Payments are encrypted and handled by trusted providers like **Stripe**.”
- Use official purple Stripe wordmark (`Stripe logo.png`) — never recolour.

### Held funds messaging

- “Funds are held securely until the order is completed”
- “Your payment is held securely throughout the transaction”
- “Funds are only released once you confirm everything is OK”
- “Payment will be released to the seller” (confirm collection)
- “Funds released instantly after confirmation” (marketing)

### QR collection flow

Four steps (QR banner, how-it-works, third hero):

1. Buyer pays (Stripe / Apple Pay)
2. Seller shows QR
3. Buyer scans — “COLLECTED!” + green check
4. Seller payout — “Payout successful”

Confirm collection screen: QR verified → warnings → checkbox → “Confirm Collection & Release Payment”.

Buyer Protection modal adds: “Collection orders use our QR code confirmation system.”

### Trust indicators

| Asset | Usage |
|-------|--------|
| Orange shield + check | Buyer Protection badge and modal header |
| Orange padlock | Trust bar, Secure Transactions section |
| Orange prohibited circle | No cash / bank transfers |
| Green checkmarks | Collection available, Why Buy lists, safety lists |
| “Why Buy on Equipd?” card | Item page trust panel |
| Buyer Protection modal | Refunds & Returns / Secure Transactions / Support |

### Buyer Protection modal (`Buyer protection information.png`)

- Header: orange shield + “Buyer Protection” + close X.
- **Refunds & Returns:** eligibility bullets; 48-hour evidence window; 7-day seller return window; link to Refund Policy.
- **Secure Transactions:** held payment; QR confirmation; Stripe encryption.
- **Support:** contact anytime; fair review of cases.
- CTA: full-width orange **“Sounds good”** button.

---

## 8. Delivery specification

Source: `Example delivery options.png` (unchanged from prior analysis).

- Postcode card + orange “Get delivery estimate”.
- Stacked option cards: Pallet, 2-Man, Courier, Seller Delivery — icon, title, description, cost range, orange “View options”.
- Peach “Delivery Tips” box with green checkmarks.

How-it-works card: collect locally with QR | delivery after purchase | options shown upfront.

---

## 9. Footer specification

Source: `Footer example.png`.

### Main footer (charcoal/navy background)

| Column | Heading | Links / content |
|--------|---------|-----------------|
| 1 Quick Links | Browse Listings, Selling Guide, FAQs |
| 2 Equipd | About us, Privacy Policy |
| 3 Customer Support | Listing policy, Safety guidelines, Delivery options |
| 4 Contact Us | Orange “Contact Page” button; support@equipd.co.uk (orange envelope icon); Mon–Fri 9am–5pm (orange clock icon) |

- Headings: white bold sans.
- Links: white regular sans.

### Bottom bar (darker strip)

- Centred: “© 2025 Equipd” (muted grey).
- Right: “Terms & Conditions” (muted grey).

---

## 10. Mobile design principles

Sources: `Confirm collection example.png`, phone mockups in QR assets.

- Single-column stacked layouts.
- Full-width primary CTAs.
- Status-first: verified badge → title → summary → warning → checkbox → action.
- QR/collection flows designed for phone (camera scan UI).
- Buyer Protection modal: vertical sections, left-aligned, generous spacing.
- Homepage/browse mobile layouts **not fully referenced** — expect stacked search, horizontal-scroll categories, row cards full-width.

---

## 11. Card styles

| Card | Background | Border / shadow | Notes |
|------|------------|-----------------|-------|
| Trust bar | White | Soft shadow | 3 columns, overlaps hero |
| Grid listing | White | Light border | Rounded ~8–12px |
| Row listing | White | Divider between rows | Horizontal layout |
| Category tile | **Orange fill** | None | Product photo + label |
| Delivery & Collection (item) | Light grey | Rounded | Middle column |
| Seller / Why Buy | White | Soft shadow | Right column |
| Delivery option | White | Grey border | Stacked on delivery page |
| Filter dropdowns | White | Grey border | Rounded |
| Buyer Protection sections | White | None | Modal panels |

---

## 12. Button styles

| Variant | Fill | Text | Shape | Examples |
|---------|------|------|-------|----------|
| Primary orange | Orange | White | Rounded / pill | Search, Log In, Buy Now, Browse equipment, Apply Filters |
| Primary dark | Black/navy | White | Pill | Sell now |
| Secondary outline | White | Orange | Bordered | Sign Up, Make an Offer |
| Small orange | Orange | White | Rounded rect | View options, Contact Page |
| Stripe | Stripe purple | White | Rounded | Payment |
| Modal confirm | Orange | White | Full-width rounded | Sounds good, Confirm Collection |
| Text link | — | Orange | — | View all >, Learn more > |

---

## 13. About & How-it-works pages

(See prior analysis — `About Equipd example page.png`, `How Equipd works page example.png`.)

- About: hero card on photo, icon-led sections, card grids, orange checkmarks, support CTA.
- How-it-works: four step cards, peach QR banner, safety + delivery side-by-side cards, brand logo strip, Stripe footer.

---

## 14. Design rules

### Elements that must be preserved

- Orange squircle icon + white “E” + navy “Equipd” wordmark.
- Primary tagline: **“Same workout. Half the price.”**
- Serif hero headlines; sans everywhere else in UI.
- Orange + navy + white core palette; orange used for **prices** and **primary actions**.
- Top utility bar with Stripe + QR Code Collection.
- Header-centred search with orange Search button.
- Three-column trust bar (Stripe / no cash / release on collection).
- **Grid listing hierarchy:** title → condition → orange price → location.
- **Row listing pattern:** grey condition pill + **orange price pill (white text)** + collection line + seller row.
- Item page three-column layout: gallery | info+actions | seller+Why Buy.
- “Buy Now” + “Make an Offer” button pair on item page.
- “Why Buy on Equipd?” green-check list on item page.
- Orange **“Shop our most popular”** category tiles with product photography.
- Buyer Protection shield iconography and modal structure (refunds / secure / support).
- QR four-step narrative and confirm-collection warning pattern.
- Official Stripe logo and “Powered by stripe” language.
- Footer four-column structure with orange contact accents.
- Cashless positioning throughout.

### Elements that may be modernised

- Exact hex values for WCAG contrast (keep hue family).
- Category text nav → icons, scroll, or merge with tile grid on mobile.
- Row vs grid view toggle on browse (reference shows row; home shows grid).
- Map sidebar error handling and embed approach on location pages.
- Button shadow depth and card elevation.
- “Top brands, half the price” section when reference expanded.
- Delivery options progressive disclosure on mobile.
- Authenticated vs logged-out header unification.
- Buyer Protection modal → dedicated page (content preserved).
- Font files identified and loaded as webfonts (maintain serif/sans pairing).

### Elements that should never be changed (core branding)

- Orange icon mark geometry and colour family.
- “Equipd” spelling and lockup.
- “Same workout. Half the price.”
- Orange-as-price-colour on listings.
- Cashless / held-funds / QR-confirm trust positioning.
- Three trust-bar pillars copy and icon set.
- Stripe as named payment partner with official logo.

---

## Missing reference screens

Still not present in `public/design-reference/`:

| Missing | Needed for |
|---------|------------|
| Mobile homepage (full scroll) | Stacked header, category scroll, trust bar stack |
| “Top brands, half the price” section (full) | Brand strip / logo row on homepage |
| Make offer modal / flow | Offer submission UI |
| Checkout / Stripe payment screen | Payment form layout |
| Reviews on listing or seller | Star ratings beyond item page seller score |
| Seller Hub / Buyer Hub (full) | Dashboard layouts |
| Messages / inbox (full) | Thread UI |
| Login / Sign up | Auth forms |
| Listing create / edit | Seller forms |
| Saved listings / favourites page | Heart destination |
| Search results (distinct from browse) | If different from browse page |
| Order detail / buyer confirmation (desktop) | Post-purchase UI beyond mobile confirm |
| Error / empty states | Standard patterns |

---

## Future design notes

- Canonical logo files: pick one of `Full logo.png` / `Full logo 1.png`; one icon export.
- Sample exact hex from PNGs into a token table.
- Identify serif and sans font files from Bubble export.
- Reconcile marketing “QR instant payout” copy with current product flows if they diverge.
- Add item page reviews screenshot if reviews existed on Bubble listing pages.
