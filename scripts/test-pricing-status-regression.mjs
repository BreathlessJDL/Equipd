import assert from 'node:assert/strict'
import { shouldShowBuyerPricing, shouldShowSellerPricing } from '../src/lib/pricingViewerRole.js'
import { getStatusBadgeFromOrderLifecycleStage } from '../src/lib/orderLifecycleStatus.js'

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

testBuyerHubPricingRole()
testClosedCaseBadgeMapping()

console.log('pricing/status regression checks passed')
