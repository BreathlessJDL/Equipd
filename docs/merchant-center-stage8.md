# Stage 8 — Google Merchant Center readiness (Equipd)

**Status: Approved – Merchant feed production-ready (submission deferred).**

Merchant development is **paused** until Google policy questions below are resolved.  
Next product work should focus on business growth and Equipd Intelligence — not further Merchant implementation.

---

## Safe pause rules

Do **not**:

- create or connect a Merchant Center account
- submit the product feed to Google
- enable free listings in Merchant Center
- enable Shopping ads, Performance Max, or Google Ads
- change the Buyer Protection fee model
- change Stage 5–8 architecture

The production feed endpoint remains live for **testing and inspection only**.

| Item | Value |
|---|---|
| Feed URL | https://www.equipd.co.uk/feeds/google-merchant.xml |
| Readiness report | https://www.equipd.co.uk/feeds/google-merchant.xml?format=report |
| Source | `listings_public_browse` (active only) |
| Submission | Intentionally deferred |

---

## Engineering complete vs waiting on Google

### Engineering complete

- Strict Merchant eligibility classifier (narrower than public readability; sold never included)
- Collection-first fulfilment gate
- Runtime Google XML feed + readiness report
- Stable product IDs (`listing_<uuid>`) and `external_seller_id`
- Buyer Protection price policy coded as listing `price` + BP fee in `shipping` (GB)
- Diagnostics CLI (`npm run report:merchant-readiness`)
- Automated tests (`npm run test:merchant-feed`)
- Stages 5–7 marketplace SEO / sold lifecycle / prerender / structured data preserved

### Waiting on Google policy confirmation

These are the **only remaining blockers** before Merchant submission:

1. **Buyer Protection fee modelling** — Confirm that representing the unavoidable Buyer Protection fee in the Merchant feed as currently modelled (`price` = listing asking price; `shipping` = BP fee for GB) is acceptable.
2. **Account architecture** — Confirm the correct Merchant Center structure for Equipd (Marketplace MCA / multi-seller sub-account + `external_seller_id`).
3. **Collection-only participation** — Confirm that collection-available marketplace listings can participate in the intended free-listings / Merchant programme for the UK.
4. **Future fulfilment expansion** — Review whether seller-delivery and buyer-courier listings can safely be included in a later feed without inventing shipping costs or misrepresenting buyer-arranged courier as seller shipping.

Until those confirmations exist, leave Merchant paused.

---

## Policy context (from Stage 8 audit)

Official sources used:
- [About marketplaces](https://support.google.com/merchants/answer/6363319)
- [Multi-seller accounts](https://support.google.com/merchants/answer/15108683)
- [External seller ID](https://support.google.com/merchants/answer/11537846)
- [Free listings](https://support.google.com/merchants/answer/13889434)
- [Price](https://support.google.com/merchants/answer/6324371)
- [Shipping](https://support.google.com/merchants/answer/6324484)
- [Product data specification](https://support.google.com/merchants/answer/7052112)
- [Identifier exists](https://support.google.com/merchants/answer/6324478)

| # | Question | Verdict |
|---|---|---|
| 1 | One standard MC account for marketplace listings? | **No for long-term.** Google expects a **Marketplace MCA**. |
| 2 | Multi-client / advanced account? | **Yes — confirmed guidance.** |
| 3 | Separate seller sub-accounts? | Prefer **multi-seller** + `external_seller_id` (pending Google confirmation for Equipd). |
| 4 | Equipd as merchant of record in feed? | Likely yes for checkout/MoR; still a multi-seller marketplace feed. |
| 5 | One-off used free listings? | Likely yes with `condition=used`. |
| 6 | Collection-only online listings? | **Unresolved** — confirm with Google before go-live. |
| 7 | Seller-delivery accurate? | Not initially — no priced delivery in data. |
| 8 | Buyer-courier accurate? | Not as seller shipping — excluded for now. |
| 9 | Return policy for P2P used goods? | Match **Buyer Protection** (24h), not retailer 30-day returns. |
| 10 | Business info on site? | Terms, privacy, refunds/BP, support present. |

---

## Buyer Protection price decision (frozen)

- Feed `price` = listing asking price (aligned with landing primary price + Stage 7 Offer).
- Feed `shipping` (GB) = calculated Buyer Protection fee (5%, min £5, max £250).
- Fee model itself is **not** changed.
- Submission remains deferred until Google confirms this representation.

---

## Fulfilment decision table (current feed)

| Listing options | Feed eligible? | Notes |
|---|---|---|
| Collection (alone or with others) | Yes | Initial safe subset |
| Seller delivery only | No | Future review (blocker #4) |
| Buyer courier only | No | Future review (blocker #4) |

---

## Manual Merchant Center setup (deferred)

When policy blockers are cleared and submission is explicitly authorised:

1. Create Merchant Center; claim `https://www.equipd.co.uk`.
2. Request Marketplace MCA + multi-seller conversion (per Google confirmation).
3. UK / English / **Free listings only** — no Shopping ads / PMax / Google Ads.
4. Scheduled fetch of the feed URL (optional `MERCHANT_FEED_TOKEN`).
5. Configure shipping/returns to match Buyer Protection + collection reality.
6. Start with the limited collection-eligible subset.

Until then: **do not** create accounts, submit the feed, or enable programmes.

---

## Related code

- Eligibility: `src/lib/merchantEligibility.js`
- Feed build / fetch: `src/lib/merchantFeedBuild.js`
- Endpoint: `api/merchant-product-feed.js` → `/feeds/google-merchant.xml`
- Docs / discovery: `docs/marketplace-listing-discovery.md`
