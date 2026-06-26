# Equipd improvement backlog

Phased implementation plan for UX polish, mobile improvements, messaging redesign, post-transaction contact handling, and cookies compliance.

**Working rule:** Complete one phase at a time. After each phase, report:
- files changed
- what was fixed
- limitations / follow-ups
- recommended next phase

**Global constraints (all phases):**
- Do not change database schema unless required — document why before doing so.
- Do not remove marketplace message safety filters globally.
- Do not redesign unrelated pages.
- Prefer incremental, low-risk diffs.

**Design references (visual only — do not crop or embed in UI):**
- `public/design-reference/vinted mobile profile example.png`
- `public/design-reference/vinted example inbox.png`
- `public/design-reference/Equipd usable icons.png` (Hub + Notifications icon system)

---

## Phase 1 — Small fixes

**Goal:** Low-risk UX bugs and copy cleanup. No layout redesign. Estimated effort: 0.5–1 day.

### 1. Seller profile scroll position

**Problem:** Navigating from a listing detail page to a seller profile may preserve the listing page scroll position, so the profile loads mid-page.

**Likely files:**
- `src/pages/ProfilePage.jsx`
- Optionally a shared route helper (e.g. scroll-on-mount pattern used in `HelpArticlePage.jsx`, `SupportFlowPage.jsx`)

**Approach:**
1. On profile route mount (or when `userId` / slug param changes), call `window.scrollTo({ top: 0, left: 0 })` or `behavior: 'instant'` equivalent.
2. If `useHubScrollRestoration` or React Router scroll restoration interferes, scope fix to profile route only — do not change Hub behaviour here.
3. Test: listing detail → seller name/avatar link → profile loads at top on desktop and mobile.

**Risk:** Low. **Schema:** None.

---

### 2. Browse page intro removal

**Problem:** Repeated intro copy on browse/search/category browsing pages:
- “Browse gym equipment”
- “Explore and search for new and used gym equipment.”

**Likely files:**
- `src/pages/BrowsePage.jsx` — contains both strings today
- `src/pages/LocationListingsPage.jsx` — uses location-specific heading (keep); verify no duplicate generic intro
- `src/pages/HomePage.jsx` — has similar copy in the home browse section; **out of scope** unless explicitly treating home embedded browse as a “browse page” (recommend keeping home marketing copy)

**Approach:**
1. Remove the generic `<h1>` + lead paragraph from `BrowsePage.jsx`.
2. Keep `MarketplaceBrowseShell`, filters, search, active chips, and results grid unchanged.
3. Ensure page still has accessible structure (e.g. visually hidden `<h1>` with “Browse” or rely on filters landmark) if needed for a11y.
4. Confirm category/search URL flows (`/browse?...`) still render correctly without the header block.

**Risk:** Low. **Schema:** None.

---

### 3. Hub mobile settings link

**Problem:** Mobile Hub shows a redundant text link to Settings below the section `<select>`.

**Likely files:**
- `src/components/hub/HubLayout.jsx` — `hub-dashboard__mobile-settings-link`
- `src/components/hub/HubLayout.css`

**Approach:**
1. Remove the mobile-only Settings `<Link>` from `HubLayout.jsx`.
2. Keep Settings in desktop sidebar (`HUB_SECTIONS.settings` with `href: '/settings'`).
3. Keep the actual `/settings` route and settings UI untouched.
4. Users on mobile can still reach Settings via global header/account menu if present.

**Risk:** Low. **Schema:** None.

---

### 4. Hub mobile scroll restoration

**Problem:** Changing Hub section/tab on mobile keeps the previous tab’s scroll position.

**Likely files:**
- `src/hooks/useHubScrollRestoration.js` — currently saves/restores `window.scrollY` via sessionStorage
- `src/pages/HubPage.jsx` — wires `handleSectionChange` / `handleTabChange`
- `src/components/hub/HubLayout.jsx`

**Approach:**
1. On section or tab change, scroll to top of Hub content:
   - `window.scrollTo({ top: 0, left: 0 })`, and/or
   - scroll `.hub-dashboard__main` if that is the scroll container on mobile.
2. Decide interaction with existing restoration hook:
   - **Recommended:** On intentional section/tab navigation, clear saved scroll (`sessionStorage` key `equipd:hub-scroll-y`) and scroll to top.
   - Preserve restoration only when returning from an external deep link (e.g. back from order detail) if that behaviour is still desired.
3. Test mobile: long list in Buying → switch to Selling → content starts at top.

**Risk:** Low–medium (scroll container edge cases). **Schema:** None.

---

### Phase 1 completion checklist

- [ ] Profile opens at top from listing links
- [ ] `/browse` has no generic intro block; filters/results intact
- [ ] Mobile Hub has no redundant Settings text link
- [ ] Hub section/tab changes scroll to top on mobile
- [ ] No badge logic or notification logic changes
- [ ] No DB migrations

---

## Phase 2 — Mobile polish

**Goal:** Mobile-first layout improvements for Hub and public profiles. Estimated effort: 2–4 days.

### 5. My Hub mobile optimisation

**Reference:** Existing Hub dashboard + Equipd icon system (`EquipdTypeIcon`, `EquipdTypeIcon.css`).

**Likely files:**
- `src/components/hub/HubLayout.jsx` / `HubLayout.css`
- `src/components/hub/HubSectionContent.jsx`
- `src/pages/HubPage.jsx`
- `src/components/Hub.css` (if shared hub-page styles remain)

**Tasks:**
1. **Summary cards:** Verify single-column stack on narrow viewports; adjust grid breakpoints if cards feel cramped (currently 2-col tablet, 1-col ≤520px).
2. **Navigation:** Improve mobile section `<select>` styling/spacing; consider sticky sub-tab row for section tabs inside main content.
3. **Badges:** Align mobile `<option>` count suffix with sidebar pill badges (`hub-nav__badge` / attention orange pills).
4. **Icons:** Continue using `EquipdTypeIcon` — no new icon system.
5. **Tap targets:** Ensure attention action buttons and summary cards meet ~44px min touch height.
6. **Needs attention rows:** Confirm mobile grid (icon + content / full-width action) still reads well after Phase 1 button `min-width`.

**Risk:** Medium (CSS-only but broad). **Schema:** None.

---

### 6. User profile mobile redesign

**Reference:** `public/design-reference/vinted mobile profile example.png`  
**Ignore:** Follow button, bundle buttons.

**Likely files:**
- `src/pages/ProfilePage.jsx`
- New or updated `ProfilePage.css` (or co-located styles)
- `src/lib/profiles.js` (read-only for display helpers)

**Priorities:**
1. Mobile-first header: avatar, display name/username, member since if available.
2. Rating / reviews summary (link to reviews if data exists).
3. Completed sales count if available from existing profile/listing queries.
4. Listings grid: full-width cards, consistent gutters, sensible empty state.
5. Generous vertical rhythm; avoid desktop two-column cramping on small screens.

**Data:** Use existing profile + listings fetches only. Do not add schema unless a metric (e.g. completed sales) is not available from current API — document gap before migrating.

**Risk:** Medium. **Schema:** Unlikely for v1.

---

### Phase 2 completion checklist

- [ ] Hub usable on 375px width without horizontal scroll
- [ ] Profile page matches Vinted-like mobile hierarchy (minus follow/bundle)
- [ ] Icon system unchanged and consistent
- [ ] Desktop layouts not regressed

---

## Phase 3 — Messaging redesign

**Goal:** Cleaner conversation list + Vinted-like mobile inbox. Desktop inbox can stay structurally similar with card polish. Estimated effort: 3–5 days.

### 7. Conversation list cards (desktop + mobile)

**Likely files:**
- `src/pages/MessagesPage.jsx` — role label “Buyer enquiry” / “Seller conversation” (~line 304)
- `src/components/Messages.css`
- `src/lib/messages.js` — conversation shape, `listing_images`, last message preview

**Card content:**
| Element | Source |
|--------|--------|
| Item thumbnail | Listing image from conversation/listing join (existing data) |
| Item title | Listing title |
| Latest updated time | `updated_at` / last message timestamp |
| Message preview | Last message body (truncate) |
| Unread state | Existing `conversation_reads.unread_count` |

**Remove:** “Buyer enquiry” / generic role labels unless needed for accessibility (use visually hidden text if required).

**Risk:** Low–medium. **Schema:** None if preview fields already loaded.

---

### 8. Mobile inbox (Vinted-style)

**Reference:** `public/design-reference/vinted example inbox.png`

**Likely files:**
- `src/pages/MessagesPage.jsx`
- `src/components/Messages.css`
- Possibly `src/components/layout/AppShell.jsx` — hide chrome on mobile thread view

**Mobile behaviour:**
1. Inbox list: full viewport width, edge-to-edge rows, no “card in a card” padding.
2. Thread view: dedicated mobile header with back to inbox; thread fills screen.
3. Desktop: keep current split-pane or layout unless minor card styling overlaps.

**Implementation notes:**
- Use CSS breakpoints (`max-width: 768px` or project standard).
- Route/state: `/messages` vs `/messages/:conversationId` — ensure back navigation restores list without losing scroll unduly.
- Do not change message send/receive logic or unread counts.

**Risk:** Medium–high (layout state). **Schema:** None.

---

### 9. Message image attachments (Phase 3C) — **planning only; do not implement yet**

**Prerequisite:** Phase 3B mobile thread must be stable before starting this work.

**Decision:** Equipd should support image uploads in messages. Buyers often need extra photos of condition, serial plates, damage, measurements, consoles, cables, upholstery, loading access, etc. Attachments must be **limited and safe** — not a general file-sharing channel.

**Proposed v1 scope:**

| Rule | Detail |
|------|--------|
| File types | Images only: **JPG, PNG, WebP** |
| Disallowed | PDFs, documents, ZIPs, videos, arbitrary files |
| Count limit | Max **4 images per message** |
| Size limit | Max **5–8 MB per image** |
| Processing | Compress/resize before upload if existing utilities support it |
| Storage | Supabase Storage — **private** `message-attachments` bucket |
| Access | Attachments visible only to participants in that conversation |
| UI | Thumbnails in chat bubbles; tap/click opens larger preview/lightbox |
| Text validation | **Keep existing** `marketplaceMessageValidation.js` rules unchanged |
| Empty text | Sending image(s) without text **allowed** |
| Mixed send | Text + images together **allowed** |

**Security / trust notes (v1):**

- Do **not** relax off-platform contact rules because images exist.
- Users may still screenshot contact details; OCR/moderation is **future work**, not required for v1.
- Consider report/block integration later (existing `ReportTrigger` patterns).
- Uploads must be **authenticated** and tied to **conversation membership** (RLS + storage policies).

**Likely files (when implemented):**

- `supabase/message-attachments.sql` — table, RLS, storage bucket policies
- `src/lib/messageAttachments.js` — upload, signed URLs, validation
- `src/pages/MessagesPage.jsx` — composer attachment picker, thread rendering
- `src/components/messages/MessageAttachmentPreview.jsx` (or similar)
- Reuse listing image compression utilities if applicable (`ListingImageUpload`, etc.)

**Schema recommendation:**

Prefer a separate **`message_attachments`** table (not JSONB on `messages`) for cleaner permissions, future moderation, and multiple images per message:

| Column | Type / notes |
|--------|----------------|
| `id` | uuid PK |
| `message_id` | uuid FK → `messages` |
| `conversation_id` | uuid FK → `conversations` (denormalised for RLS) |
| `uploader_id` | uuid FK → `profiles` |
| `storage_path` | text |
| `mime_type` | text |
| `size_bytes` | integer |
| `width` | integer (nullable) |
| `height` | integer (nullable) |
| `created_at` | timestamptz |

**Alternative (not recommended for v1):** `attachments` JSONB on `messages` — simpler migration but weaker for permissions and moderation.

**Risk:** Medium–high (storage, RLS, abuse surface). **Schema:** **Yes** — `message_attachments` table + storage bucket required.

**Estimated effort:** 3–5 days (schema, upload pipeline, thread UI, mobile composer, signed URL lifecycle).

---

### Phase 3 completion checklist

- [x] Phase 3A — Conversation rows show thumbnail, title, time, preview
- [x] Phase 3A — Role labels removed from visible UI
- [x] Phase 3B — Mobile inbox list full-width; thread header + composer
- [x] Phase 3B — Footer hidden only when thread open (`/messages/:conversationId`)
- [ ] Phase 3C — Image attachments (blocked until 3B stable)
- [ ] Desktop layout acceptable
- [ ] Message validation unchanged (must remain true through 3C)

---

## Phase 4 — Post-transaction contact details

**Goal:** Allow fulfilment information sharing safely after a paid order exists — **without** opening general chat filters.

> **Status (Fulfilment architecture Phase 5):** Per-order `order_handover_details` UI was removed. Seller collection details use `listing_fulfilment_private`; buyer delivery address uses `order_delivery_details`; Order Detail uses `OrderFulfilmentDetailsCard`. DB table/RPCs may remain until a later teardown migration.

**Recommendation:** **Option A first** (structured order handover details on order page). Option B only if Option A proves insufficient.

### 9. Contact / address sharing after transaction

**Current safety layer:**
- `src/lib/marketplaceMessageValidation.js` — strict pre-transaction messaging
- `src/lib/offerMessaging.js` — uses validation on offers

**Option A — Structured Order Handover Details (preferred)**

**Concept:** Order-scoped fields visible only to buyer and seller on that order.

| Field | Example |
|-------|---------|
| Collection address | Seller-provided |
| Phone number | Either party |
| Delivery notes | Courier / collection instructions |
| Courier details | Tracking, provider |
| Preferred collection time | Text or time window |

**Likely surfaces:**
- `src/pages/OrderDetailPage.jsx` — new “Handover details” section
- New component e.g. `OrderHandoverDetails.jsx`
- Server: Supabase RPC or `orders` JSON column / child table — **schema change required if no suitable field exists**

**Schema decision (document before implementing):**
- Check whether `orders` already has notes/metadata columns.
- If not, prefer a small `order_handover_details` table or `orders.handover_details jsonb` with RLS limiting to buyer/seller on that order.
- Migration + RLS policies required — treat as sub-phase 4a (schema) then 4b (UI).

**Option B — Relaxed chat validation for paid orders (fallback)**

- In `marketplaceMessageValidation.js`, accept messages only when conversation is linked to an active/paid order between the same parties.
- Still block obvious off-platform payment patterns.
- Harder to audit; easier to abuse than structured fields.

**Do not:**
- Remove global message filters for pre-order chats.
- Expose phone/address on listing detail or public profile.

**Risk:** High (trust & safety). **Schema:** Likely required for Option A.

---

### Phase 4 suggested sub-phases

| Sub-phase | Scope |
|-----------|--------|
| 4a | Audit existing order fields; design handover schema + RLS |
| 4b | Order page UI (read/write handover details) |
| 4c | Notifications when handover details updated (optional) |
| 4d | Evaluate Option B only if structured fields are insufficient |

---

## Phase 5 — Cookies (UK)

**Goal:** Real cookie policy, settings UI, and footer links suitable for UK users. No fake categories.

### 10. Cookie policy and settings

**Current state:**
- `src/components/layout/SiteFooter.jsx` — “Cookie Policy” links to `/help/privacy-policy`; “Cookie Settings” button is non-functional
- `src/data/helpArticles.js` — privacy policy mentions cookies in prose

**Deliverables:**
1. **Cookie Policy page** — dedicated help article or route (e.g. `/help/cookie-policy`)
2. **Cookie settings modal or `/settings/cookies` page**
3. **Footer links** — Cookie Policy → new page; Cookie Settings → opens modal or settings page
4. **Preference controls:**
   - Necessary: always on (disabled toggle)
   - Analytics: optional — only if analytics scripts exist (audit first)
   - Marketing: optional — only if used

**Likely files:**
- `src/data/helpArticles.js` or new static page
- New `CookieSettingsModal.jsx` / `CookiePreferences.jsx`
- `src/components/layout/SiteFooter.jsx`
- `localStorage` or `document.cookie` for consent snapshot (no DB required for v1)

**Audit before build:**
- List actual third-party scripts (analytics, Stripe, Supabase auth cookies, etc.).
- Do not expose toggles for tracking that does not exist.

**Risk:** Low–medium (legal copy review recommended). **Schema:** None for v1 (client-side consent storage).

---

## Phase dependency graph

```
Phase 1 (fixes) ──► Phase 2 (Hub + profile mobile)
                 └──► Phase 3A/3B (messaging UI) ──► Phase 3C (image attachments, after 3B stable)

Phase 4 (handover) ──► independent; requires schema decision

Phase 5 (cookies)  ──► independent; can run after Phase 1
```

**Suggested order:** 1 → 2 → 3 → 5 → 4  
(Rationale: cookies are self-contained; handover needs design + schema review.)

---

## Quick reference — key files by area

| Area | Files |
|------|--------|
| Profile scroll | `src/pages/ProfilePage.jsx` |
| Browse intro | `src/pages/BrowsePage.jsx`, `MarketplaceBrowseShell.jsx` |
| Hub mobile | `src/components/hub/HubLayout.jsx`, `HubLayout.css`, `useHubScrollRestoration.js` |
| Hub icons | `src/components/icons/EquipdTypeIcon.jsx`, `equipdIconVariants.js` |
| Messages | `src/pages/MessagesPage.jsx`, `Messages.css`, `lib/messages.js` |
| Message attachments (3C) | `lib/messageAttachments.js`, `supabase/message-attachments.sql` (planned) |
| Message safety | `lib/marketplaceMessageValidation.js` |
| Orders | `src/pages/OrderDetailPage.jsx`, `lib/orders.js` |
| Cookies | `SiteFooter.jsx`, `helpArticles.js` |

---

## Next action

**Start with Phase 1 only.** When complete, update this doc with a short “Phase 1 done” note (date + PR link) and proceed to Phase 2.
