# Marketplace listing discovery

How Equipd marketplace listings become discoverable. This document describes crawl paths and signals — it does **not** guarantee Google indexing.

## Discovery path (active listings)

1. **Seller publishes** a listing (status becomes `active` with available stock).
2. The listing becomes **anonymously public for browse** via `listing_is_publicly_visible` / `listings_public_browse` (excludes drafts, archived, sold, test data, and image-less imports).
3. **IndexNow** submits the canonical listing URL on publish and meaningful public transitions (`notifyIndexNowForListingChange` → Edge `indexnow-submit`).
4. The listing appears in the **generated sitemap** (`public/sitemap.xml` via `scripts/generate-sitemap.mjs`) using `/listings/:slug`.
5. It may appear on the homepage **Recently Added** strip (`HomeRecentListings` → `ListingCard` anchors).
6. It appears in **marketplace browse** (`/browse`) and related filters.
7. It appears on the relevant **brand page** marketplace section when brand filtering matches.
8. When a reliable Equipment Intelligence mapping exists (`equipment_product_id` / `canonical_product_key`), it may appear on the **canonical equipment page** (“Currently for sale”).
9. **Similar-listing** cards and listing **breadcrumbs** (Home → Browse → Listing) create additional crawl paths.

## Sold listings (Stage 5)

Legitimate sold listings that were previously public remain **publicly readable** (not purchasable) via `listing_is_publicly_readable`.

Eligibility requires:

- `status = sold`
- reliable `published_at` (proof the listing was previously public)
- reliable `sold_at` (set on first transition to sold; backfilled from order inventory timestamps)
- not test data
- import image rule still applied where relevant

The active marketplace stays active-only: sold rows never enter `listings_public_browse`, home, brand marketplace strips, or recommendation candidate pools.

### Archive indexing (UTC)

Shared helper: `getSoldListingIndexingState({ soldAt, now })` — uses `sold_at` only (never `updated_at`).

| Age since `sold_at` | robots | sitemap |
| --- | --- | --- |
| &lt; 12 months (`now < sold_at + 12 months`) | `index,follow` | included |
| ≥ 12 months | `noindex,follow` | excluded |

Sold pages remain readable after the 12-month boundary.

### Sold page behaviour

- Clear sold state: “This item has now sold”
- Product schema retained; **no Offer** / no `InStock`
- Transactional CTAs hidden (buy / offer / message / save / quantity)
- Similar active listings + valuation CTA retained
- Canonical URL unchanged (`/listings/:slug`)

### IndexNow transition matrix (listings)

| Transition | Reason | Behaviour |
| --- | --- | --- |
| draft → active | `listing_published` | notify canonical URL |
| active material edit | `listing_material_update` | notify canonical URL |
| active → sold | `listing_sold` | notify canonical URL (content change; **not** removal) |
| active → archived/deleted/private | `listing_unpublished` / `listing_deleted_while_public` | notify (URL no longer publicly readable) |
| images change while active | `listing_images_changed` | notify |

One transition produces one notify decision (no duplicate ping from treating sold as both sold and unpublished).

## Canonical URLs

- Origin: `https://www.equipd.co.uk` (`EQUIPD_SITE_ORIGIN`)
- Listing path: `/listings/:slug` (unchanged)
- Sitemap `<loc>`, HTML `rel=canonical`, and IndexNow listing URLs must match that convention
- Reserved location browse routes (`/listings/{city}`) are registered before `:slug` and must not collide with listing slugs

## Sitemap

- Single `public/sitemap.xml` urlset (no priority / changefreq — same as catalogue entries)
- Includes: static pages, brands, approved equipment products, **active public listings**, and **eligible recent sold** (≤ 12 months, publicly readable)
- Active listing source: `listings_public_browse`
- Sold listing source: `listings` filtered by sold + `published_at` + `sold_at`, then JS archive helper
- Active `lastmod`: `updated_at` → `published_at` → `created_at`
- Sold `lastmod`: prefer `sold_at`, then content stamps (never build time)
- Soft split threshold: ~45k URLs or ~45MB uncompressed — prefer a sitemap index then
- Note: after new listing columns are added, `listings_public_browse` must be recreated (`select *` expands at CREATE time)

## Current limitations

- No listing HTML prerender / edge-rendered metadata yet (client-rendered SPA). Eligible sold pages render substantive client content rather than “Listing not found”; true HTTP status semantics are a separate future improvement.
- No Google Merchant Center feed
- No Google general Indexing API (by design)
- Historical listings may lack Equipment Intelligence mapping until re-saved from valuation/equipment
- IndexNow / sitemap inclusion does **not** guarantee crawl or index timing

## Related code

- Sitemap: `scripts/generate-sitemap.mjs`, `src/lib/listingSitemap.js`
- Listing SEO / canonical / sold robots: `src/lib/listingPageSeo.js`, `src/lib/listingSoldLifecycle.js`
- Visibility vs readability: `listing_is_publicly_visible`, `listing_is_publicly_readable`, `listings_public_browse`
- IndexNow: `src/lib/indexNowNotify.js`, `src/lib/indexNowCollect.js`
- Mapping: `equipment_product_id`, `canonical_product_key` on `listings`
- Migration: `supabase/migrations/20260723100000_sold_listing_public_readability.sql`
