# Hub attention badges — deferred

Status: **Reverted** from main Hub path (release blocker).

## What was removed

- `src/lib/hubAttentionBadges.js` (extracted badge module)
- Awaiting payment tab badge counts (`awaiting_payment: 0` restored)
- `sellerAcceptedUnpaidOffers` passed into `buildHubAttentionBadges`
- Related test scripts under `scripts/test-hub-attention-badges.mjs`

## Stable location

Badge logic lives again inline in `src/components/hub/HubSectionContent.jsx` → `buildHubAttentionBadges()`.

## Re-implement later (on this branch only)

1. Tab badge for **Awaiting payment** (buying + selling) using unpaid accepted offers count
2. Keep `buildHubAttentionBadges` in `HubSectionContent` OR extract to `hubAttentionBadges.js` only after unit tests pass
3. Use `getOfferPayment()` and null-safe array coercion before counting
4. Do not block Hub render — wrap counts in try/catch or compute defensively

## QA before merge

- All Hub sections desktop + mobile
- Real seller account with awaiting-payment offers
- `node scripts/verify-hub-production.mjs https://equipd.co.uk/`
