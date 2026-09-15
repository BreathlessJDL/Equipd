#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADMIN_OFFER_STATUSES,
  adminOfferWasMadeBy,
  adminOfferWasReceivedBy,
  buildAdminOfferStatusBreakdown,
  deriveAdminActivityClass,
  formatAdminActivityClass,
  parseAdminMarketplaceActivityStatistics,
  parseAdminUserMarketplaceActivity,
} from '../src/lib/adminMarketplaceActivity.js'

const root = process.cwd()
const read = (rel) => readFileSync(join(root, rel), 'utf8')

assert.deepEqual(ADMIN_OFFER_STATUSES, [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'countered',
  'cancelled',
])

assert.equal(formatAdminActivityClass('buyer_seller'), 'Buyer + Seller')
assert.equal(formatAdminActivityClass('buyer'), 'Buyer activity')
assert.equal(formatAdminActivityClass('seller'), 'Seller')
assert.equal(formatAdminActivityClass('none'), 'No marketplace activity')

assert.equal(deriveAdminActivityClass({ listingCount: 0, savedCount: 0, offersMadeCount: 0 }), 'none')
assert.equal(deriveAdminActivityClass({ listingCount: 2 }), 'seller')
assert.equal(deriveAdminActivityClass({ savedCount: 1 }), 'buyer')
assert.equal(deriveAdminActivityClass({ offersMadeCount: 1 }), 'buyer')
assert.equal(deriveAdminActivityClass({ buyerConversationCount: 1 }), 'buyer')
assert.equal(
  deriveAdminActivityClass({ listingCount: 1, conversationCount: 5, buyerConversationCount: 0 }),
  'seller',
  'seller-side conversations alone must not count as buyer activity',
)
assert.equal(deriveAdminActivityClass({ listingCount: 1, savedCount: 1 }), 'buyer_seller')

const buyerOffer = {
  buyer_id: 'b1',
  seller_id: 's1',
  direction: 'buyer_to_seller',
}
const sellerCounter = {
  buyer_id: 'b1',
  seller_id: 's1',
  direction: 'seller_to_buyer',
}
assert.equal(adminOfferWasMadeBy(buyerOffer, 'b1'), true)
assert.equal(adminOfferWasReceivedBy(buyerOffer, 's1'), true)
assert.equal(adminOfferWasMadeBy(sellerCounter, 's1'), true)
assert.equal(adminOfferWasReceivedBy(sellerCounter, 'b1'), true)
assert.equal(adminOfferWasMadeBy(sellerCounter, 'b1'), false)
assert.equal(adminOfferWasReceivedBy(sellerCounter, 's1'), false)

const zeros = buildAdminOfferStatusBreakdown({})
assert.equal(zeros.length, 6)
assert.ok(zeros.every((row) => row.count === 0))
assert.deepEqual(
  buildAdminOfferStatusBreakdown({ pending: 2, accepted: 1 }).map((r) => r.count),
  [2, 1, 0, 0, 0, 0],
)

const detail = parseAdminUserMarketplaceActivity({
  user: {
    id: 'u1',
    username: 'rower-sellpoint',
    displayName: 'siobhan.oleary81',
    email: 'hidden@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    isAdmin: false,
  },
  summary: {
    listingCount: 4,
    savedCount: 2,
    conversationCount: 1,
    offersMadeCount: 0,
    offersReceivedCount: 1,
    purchaseCount: 0,
    saleCount: 1,
    activityClass: 'buyer_seller',
  },
  offersMadeByStatus: {},
  offersReceivedByStatus: { pending: 1 },
  offersMade: [],
  offersReceived: [
    {
      id: 'o1',
      listingTitle: 'Rower',
      listingSlug: 'rower',
      amountPence: 10000,
      status: 'pending',
      createdAt: '2026-01-02T00:00:00Z',
      otherParticipant: { id: 'b2', username: 'buyer-one', displayName: null },
    },
  ],
  savedListings: [],
  conversations: [],
})

assert.equal(detail.summary.offersMadeCount, 0)
assert.equal(detail.summary.offersReceivedCount, 1)
assert.equal(detail.offersMadeByStatus.find((r) => r.status === 'pending').count, 0)
assert.equal(detail.offersReceivedByStatus.find((r) => r.status === 'pending').count, 1)
assert.equal(detail.offersReceived[0].otherParticipant.label, 'buyer-one')
assert.equal(detail.summary.activityLabel, 'Buyer + Seller')

const stats = parseAdminMarketplaceActivityStatistics({
  savedListings: { total: 42, last7Days: 8 },
  offers: { total: 8, last7Days: 2, byStatus: { pending: 3, accepted: 2 } },
  conversations: { total: 5, last7Days: 1 },
})
assert.equal(stats.savedListings.total, 42)
assert.equal(stats.offers.pending, 3)
assert.equal(stats.offers.accepted, 2)
assert.equal(stats.conversations.last7Days, 1)

const migration = read('supabase/migrations/20260915120000_admin_user_marketplace_activity.sql')
assert.match(migration, /admin_search_users/)
assert.match(migration, /admin_user_marketplace_activity/)
assert.match(migration, /admin_marketplace_activity_statistics/)
assert.match(migration, /saved_listings/)
assert.match(migration, /is_admin\(\)/)
assert.match(migration, /security definer/i)
assert.match(migration, /seller_to_buyer/)
assert.match(migration, /buyer_conversation_count/)
assert.doesNotMatch(migration, /update public\.offers/i)
assert.doesNotMatch(migration, /delete from public\.saved_listings/i)

const fixMigration = read(
  'supabase/migrations/20260915130000_fix_admin_user_marketplace_activity_listing_status.sql',
)
assert.match(fixMigration, /unavailable/)
assert.match(fixMigration, /status::text as listing_status/)
assert.doesNotMatch(fixMigration, /coalesce\(r\.listing_status, 'deleted'\)/)

const usersPage = read('src/pages/AdminUsersPage.jsx')
assert.match(usersPage, /Offers made/)
assert.match(usersPage, /Offers received/)
assert.match(usersPage, /savedCount/)
assert.match(usersPage, /\/admin\/users\/\$\{row\.id\}/)
assert.match(usersPage, /formatAdminActivityClass/)

const detailPage = read('src/pages/AdminUserDetailPage.jsx')
assert.match(detailPage, /Offers made/)
assert.match(detailPage, /Offers received/)
assert.match(detailPage, /Saved listings/)
assert.match(detailPage, /\/admin\/messages\/\$\{row\.id\}/)
assert.match(detailPage, /purchaseCount/)
assert.match(detailPage, /No offers made/)
assert.match(detailPage, /No saved listings/)
assert.match(detailPage, /No conversations/)

const dashboard = read('src/pages/AdminDashboardPage.jsx')
assert.match(dashboard, /Marketplace activity/)
assert.match(dashboard, /fetchAdminMarketplaceActivityStatistics/)
assert.match(dashboard, /last 7 days/)

const app = read('src/App.jsx')
assert.match(app, /AdminUserDetailPage/)
assert.match(app, /users\/:userId/)

assert.ok(existsSync(join(root, 'src/lib/adminMarketplaceActivity.js')))
assert.ok(existsSync(join(root, 'src/lib/adminUserActivity.js')))
assert.ok(existsSync(join(root, 'src/pages/AdminUserDetailPage.css')))

console.log('test-admin-user-marketplace-activity: ok')
