# Account deletion and data retention

This is the Equipd schedule for user-requested account deletion. It is a **proposed operational policy** for legal review. It is **not** an automatic deletion job.

UK GDPR still requires a lawful basis for anything we keep after erasure is requested. Equipd uses **anonymisation plus selective retention**, because deleting `auth.users` / `profiles` would cascade into orders, payments and disputes.

## Principles

- Erase or minimise identity data that is not needed after closure.
- Keep records required for contract, tax, payment reconciliation, chargebacks and fraud prevention.
- Do **not** run unattended permanent wipes until this schedule is signed off.
- Cleanup that fails must be retryable and must never delete media attached to an order.

## Schedule

| Record | After user deletion | Statutory / regulatory | Proposed Equipd period | Auto-purge? |
|---|---|---|---|---|
| Auth login (email, password, sessions) | Tombstone email, ban, sessions revoked | GDPR Art. 17; keep only what is needed to prevent re-use | Keep banned Auth row while any order/payment still references the user id | No |
| OAuth identities (Google etc.) | Unlinked after Auth lock, where the Admin API allows | GDPR Art. 17 | Immediate unlink on successful deletion | No job; retry on next deletion request |
| Profile identity (name, username, location, avatar, last active) | Replaced with “Deleted account”; location/avatar cleared | GDPR Art. 17 | Immediate | No |
| Stripe Connect account id on profile | Retained | Payment Services / Stripe contract; tax | Life of related payouts + 6 years from last payout | No |
| Orders, payments, fees, payouts | Retained, linked to anonymised profile id | UK tax records typically **6 years** from end of accounting period; Stripe reconciliation | **6 years** from order completion or last payout/refund | No |
| Disputes, refunds, chargebacks, case notes | Retained | Chargeback windows; fraud; tax | **6 years** from case close, or longer if a chargeback remains open. Self-serve deletion is blocked while a Stripe dispute is open, and blocked if Stripe cannot be checked. | No |
| Order handover details (phones, addresses) | Retained on the order | Contract performance; disputes | Same as the parent order | No |
| Courier / collection evidence | Retained | Disputes and fraud | Same as the parent order | No |
| Reviews (rating + text, user UUIDs) | Retained; public name is “Deleted account” | Legitimate interest: marketplace integrity | Life of the related order, then **6 years** | No |
| Chat message bodies | Retained | Fraud / disputes | **2 years** after last message if **no** linked paid order; otherwise same as the order | No (proposed only) |
| Message image attachments | Retained (private bucket) | Evidence | Same as the conversation/order rule above | No |
| Unsold listing images (draft/archived, **no** orders) | Eligible for Storage delete on deletion retry | GDPR Art. 17 | Immediate after successful anonymisation | Retryable cleanup only; **no cron** |
| Sold / in-progress listing images | Retained | Order evidence | Same as the parent order | No |
| Wanted-request contact email | Cleared; request archived | GDPR Art. 17 | Immediate | No |
| Support tickets | Retained if tied to an order; otherwise minimise | Legal claims (often 6 years) | 6 years from close | No |
| Account deletion audit row | Retained | Accountability (Art. 5(2)) | 6 years from deletion | No |

Statutory periods above are **typical UK practice**, not legal advice. Finance should confirm the Equipd accounting year and Stripe’s own retention.

## What we deliberately do not do

- Do not `auth.admin.deleteUser()` — `profiles.id` references Auth and orders cascade.
- Do not delete Stripe PaymentIntents, charges, transfers or Connect accounts from Stripe while money movement exists.
- Do not delete message attachments or order evidence because a Storage cleanup failed.
- Do not hide historic orders from the remaining counterparty or from admin.

## Retry

If anonymisation succeeds and Auth lock or Storage cleanup fails, the user is already write-blocked (`deletion_requested_at` / `is_suspended`). They (or support) can retry. Retry:

1. Skips anonymisation when `deleted_at` is set.
2. Re-applies Auth ban, tombstone email and OAuth unlink.
3. Re-lists only **unsold, unordered** listing images plus profile images.

## Legal review still required

- Confirm 6-year financial retention vs Equipd’s actual accounting period.
- Confirm whether 2-year unused chat retention is acceptable.
- Confirm whether banned Auth rows must later be hard-deleted after all FKs expire.
