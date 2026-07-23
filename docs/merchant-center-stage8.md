# Stage 8 — Google Merchant Center readiness (Equipd)

**Status:** Feed infrastructure implemented. **Do not submit to a live Merchant Center account until Stage 8 review is approved.**  
**Do not enable Shopping ads or Google Ads campaigns.**

Official sources used:
- [About marketplaces](https://support.google.com/merchants/answer/6363319)
- [Multi-seller accounts](https://support.google.com/merchants/answer/15108683)
- [External seller ID](https://support.google.com/merchants/answer/11537846)
- [Free listings](https://support.google.com/merchants/answer/13889434)
- [Price](https://support.google.com/merchants/answer/6324371)
- [Shipping](https://support.google.com/merchants/answer/6324484)
- [Product data specification](https://support.google.com/merchants/answer/7052112)
- [Identifier exists](https://support.google.com/merchants/answer/6324478)

---

## Policy answers (confirmed / likely / unresolved)

| # | Question | Verdict |
|---|---|---|
| 1 | One standard MC account for marketplace listings? | **No for long-term.** Google expects a **Marketplace MCA** for multi-seller platforms. |
| 2 | Multi-client / advanced account? | **Yes — confirmed.** Convert to advanced Marketplace MCA. |
| 3 | Separate seller sub-accounts? | **Optional.** Prefer **one multi-seller sub-account** + `external_seller_id` (simpler). Per-seller sub-accounts only if seller-name display / per-seller return policies are required. |
| 4 | Equipd as merchant of record in feed? | **Likely yes for checkout/MoR presentation** — payment is Equipd Stripe Checkout. Still a **marketplace** feed (third-party sellers), not “marketplace-owned inventory”. |
| 5 | One-off used products eligible for free listings? | **Likely yes** with `condition=used`, accurate data, and UPI handling. |
| 6 | Collection-only eligible for online free listings? | **Unresolved / high risk.** UK free listings require shipping settings. Collection-only P2P does not map cleanly to national shipping. Initial feed requires collection + BP fee in shipping attribute; confirm with Google Marketplace support before go-live. |
| 7 | Seller-delivery accurate? | **Not initially** — no priced delivery cost in DB → excluded. |
| 8 | Buyer-courier accurate? | **Not as seller shipping** → excluded from initial feed. |
| 9 | Return policy for P2P used goods? | Configure account returns to match **Buyer Protection** (24h after handover/delivery), **not** a 30-day retailer returns promise. |
| 10 | Business info on site? | Terms, privacy, refunds/returns, Buyer Protection, support (`/support`, `support@equipd.co.uk`), HTTPS — present. Registered company address may still be needed in MC business info. |

### Unresolved — ask Google Merchant / Marketplace support
1. Offer-mediated purchase (no instant buy-at-price) vs “customer can buy for submitted price”.
2. Representing Buyer Protection as `shipping` cost for collection-available items.
3. Whether free **online** listings are appropriate without ship-to-home.
4. Whether Equipd should use multi-seller vs single-seller-per-sub-account given peer sellers.

---

## Website compliance snapshot

Present: HTTPS, listing price, Buyer Protection total on listing cards/detail, fulfilment options, seller identity, checkout after accepted offer + Connect, help policies, contact.

Gaps / risks:
- Primary CTA is **Make an offer**, not Buy now.
- Offer schema / feed price = listing asking; checkout = asking (or accepted offer) + BP fee.
- Seller Stripe Connect readiness is **not** publicly queryable for feed exclusion yet.
- No manufacturer GTIN/MPN in catalogue.

---

## Buyer Protection price decision

**Implemented (not fee-changing):**
- Feed `price` = listing asking price (aligned with landing primary price + Stage 7 Offer).
- Feed `shipping` (GB) = calculated Buyer Protection fee (5%, min £5, max £250).
- Rationale: Google requires UK shipping; merchant service fees not included in price should be bundled into shipping.
- **`MERCHANT_PRICE_POLICY.doNotSubmitUntilReviewed = true`** — do not connect feed to MC until reviewed.

---

## Fulfilment decision table (initial)

| Listing options | Feed eligible? | Reason |
|---|---|---|
| Collection (alone or with others) | Yes | Truthful local collection path |
| Seller delivery only | No | No priced shipping in data |
| Buyer courier only | No | Not seller-provided shipping |
| No fulfilment flags | No | Cannot represent |

---

## Feed architecture

| Item | Choice |
|---|---|
| Format | Google RSS XML (`g:` namespace) |
| URL | `https://www.equipd.co.uk/feeds/google-merchant.xml` |
| Generator | Runtime Vercel API `api/merchant-product-feed.js` |
| Source | `listings_public_browse` via anon key only |
| Auth | Optional `MERCHANT_FEED_TOKEN` (`?token=` or header) |
| Cache | `public, max-age=900` (~15 min staleness) |
| Sold items | Omitted entirely (not `out_of_stock`) |
| Sitemap | Unchanged; not used as product feed |
| IndexNow | Feed generation does not notify IndexNow |

Diagnostics: `?format=report` JSON or `npm run report:merchant-readiness`.

---

## Manual Merchant Center setup (when authorised)

1. Create Merchant Center with Equipd business details; website `https://www.equipd.co.uk`.
2. Verify/claim website (HTML tag / DNS / Analytics — pick one Equipd already controls).
3. Request **advanced account → Marketplaces** conversion; ask for **multi-seller** sub-account.
4. Target country **United Kingdom**, language **English**.
5. Enable **Free listings** only — do **not** link paid Shopping campaigns.
6. Prepare feed with `external_seller_id` before conversion completes.
7. Add scheduled fetch to feed URL (daily or every 6–12h). If `MERCHANT_FEED_TOKEN` set, append `?token=…`.
8. Configure shipping + returns at account level to match Buyer Protection / collection reality (confirm with support).
9. Enable Automatic item updates cautiously after first approvals.
10. Start with the limited collection-eligible subset; expand after diagnostics are clean.

**Do not** create ads, spend budget, or submit the feed until Stage 8 review signs off on unresolved policy questions.
