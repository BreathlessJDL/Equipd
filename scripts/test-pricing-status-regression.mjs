import assert from 'node:assert/strict'
import { shouldShowBuyerPricing, shouldShowSellerPricing } from '../src/lib/pricingViewerRole.js'
import { getStatusBadgeFromOrderLifecycleStage } from '../src/lib/orderLifecycleStatus.js'

function formatLastActiveLabel(lastActiveAt) {
  if (!lastActiveAt) return null

  const then = new Date(lastActiveAt)
  if (Number.isNaN(then.getTime())) return null

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const dayDiff = Math.floor((startOfToday - startOfThen) / (24 * 60 * 60 * 1000))

  if (dayDiff <= 0) return 'Last active today'
  if (dayDiff === 1) return 'Last active yesterday'
  if (dayDiff <= 30) return `Last active ${dayDiff} days ago`
  return 'Last active over 30 days ago'
}

function testBuyerHubPricingRole() {
  const offer = { buyer_id: 'buyer-1', seller_id: 'seller-1', amount_pence: 10000 }

  assert.equal(
    shouldShowBuyerPricing({ orderStatusRole: 'buyer', offer }),
    true,
    'buyer hub role must use buyer pricing',
  )
  assert.equal(
    shouldShowSellerPricing({ orderStatusRole: 'buyer', offer }),
    false,
    'buyer hub role must not use seller pricing',
  )
  assert.equal(
    shouldShowSellerPricing({ userId: 'buyer-1', offer }),
    false,
    'buyer user id alone must not use seller pricing',
  )
  assert.equal(
    shouldShowSellerPricing({ orderStatusRole: 'seller', offer }),
    true,
    'seller hub role must use seller pricing',
  )
}

function testClosedCaseBadgeMapping() {
  const badge = getStatusBadgeFromOrderLifecycleStage(
    { key: 'case_closed', label: 'Case closed' },
    { viewerRole: 'buyer' },
  )

  assert.equal(badge.label, 'Case closed', 'closed case must not show Dispute Open in hub')
  assert.notEqual(badge.label, 'Dispute Open')

  const disputedBadge = getStatusBadgeFromOrderLifecycleStage(
    { key: 'disputed', label: 'Under review' },
    { viewerRole: 'buyer' },
  )
  assert.equal(disputedBadge.label, 'Dispute Open')
}

function testLastActiveLabels() {
  const today = new Date()
  assert.equal(formatLastActiveLabel(today.toISOString()), 'Last active today')

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  assert.equal(formatLastActiveLabel(yesterday.toISOString()), 'Last active yesterday')

  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  assert.equal(formatLastActiveLabel(threeDaysAgo.toISOString()), 'Last active 3 days ago')

  const old = new Date(today)
  old.setDate(old.getDate() - 45)
  assert.equal(formatLastActiveLabel(old.toISOString()), 'Last active over 30 days ago')

  assert.equal(formatLastActiveLabel(null), null)
}

testBuyerHubPricingRole()
testClosedCaseBadgeMapping()
testLastActiveLabels()

console.log('pricing/status regression checks passed')
