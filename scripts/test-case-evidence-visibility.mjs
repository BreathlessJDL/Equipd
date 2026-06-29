#!/usr/bin/env node
/**
 * Visibility rules for Add additional evidence on order detail.
 *
 * Usage:
 *   npx vite-node scripts/test-case-evidence-visibility.mjs
 */

import {
  canParticipantUploadAdditionalEvidence,
  canShowParticipantCaseEvidenceUpload,
  getActiveOrderCase,
  isOrderParticipant,
  isParticipantViewerRole,
} from '../src/lib/caseEvidence.js'
import { DISPUTE_STATUSES } from '../src/lib/orderDisputes.js'
import { SUPPORT_REQUEST_STATUSES } from '../src/lib/supportRequests.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const order = {
  id: 'order-1',
  buyer_id: 'buyer-1',
  seller_id: 'seller-1',
}

const activeDispute = {
  id: 'dispute-1',
  status: DISPUTE_STATUSES.UNDER_REVIEW,
}

const activeSupport = {
  id: 'support-1',
  status: SUPPORT_REQUEST_STATUSES.REVIEWING,
}

const closedDispute = {
  id: 'dispute-2',
  status: DISPUTE_STATUSES.RESOLVED,
}

function testBuyerActiveDispute() {
  const activeCase = getActiveOrderCase([activeDispute], [])
  assert(
    canShowParticipantCaseEvidenceUpload(activeCase, order, 'buyer', 'buyer-1'),
    'Buyer should upload on active dispute',
  )
  logPass('Buyer with active dispute can add evidence')
}

function testSellerActiveDispute() {
  const activeCase = getActiveOrderCase([activeDispute], [])
  assert(
    canShowParticipantCaseEvidenceUpload(activeCase, order, 'seller', 'seller-1'),
    'Seller should upload on active dispute',
  )
  logPass('Seller with active dispute can add evidence')
}

function testAdminSellerActiveDispute() {
  const activeCase = getActiveOrderCase([activeDispute], [])
  assert(isOrderParticipant(order, 'seller-1'), 'Seller is order participant')
  assert(
    canShowParticipantCaseEvidenceUpload(activeCase, order, 'seller', 'seller-1'),
    'Admin-seller uses seller participant role for upload',
  )
  logPass('Admin who is also seller can add evidence as participant')
}

function testNonParticipantAdmin() {
  const activeCase = getActiveOrderCase([activeDispute], [])
  assert(
    !canShowParticipantCaseEvidenceUpload(activeCase, order, 'admin', 'admin-1'),
    'Non-participant admin should not get participant upload',
  )
  assert(!isParticipantViewerRole('admin'), 'Admin viewer role is not participant role')
  logPass('Non-participant admin does not get participant upload form')
}

function testActiveSupportCase() {
  const activeCase = getActiveOrderCase([], [activeSupport])
  assert(activeCase?.type === 'support', 'Expected active support case')
  assert(
    canShowParticipantCaseEvidenceUpload(activeCase, order, 'seller', 'seller-1'),
    'Seller should upload on active support case',
  )
  logPass('Seller with active support request can add evidence')
}

function testClosedCaseBlocksUpload() {
  const activeCase = getActiveOrderCase([closedDispute], [])
  assert(activeCase === null, 'Resolved dispute should not be active case')
  assert(
    !canParticipantUploadAdditionalEvidence(
      { type: 'dispute', record: closedDispute },
      order,
      'seller-1',
    ),
    'Closed case should block upload',
  )
  logPass('Closed case blocks additional evidence upload')
}

function main() {
  testBuyerActiveDispute()
  testSellerActiveDispute()
  testAdminSellerActiveDispute()
  testNonParticipantAdmin()
  testActiveSupportCase()
  testClosedCaseBlocksUpload()
}

try {
  main()
  console.log('\nAll case evidence visibility checks passed.')
} catch (error) {
  console.error(`\nFAIL: ${error.message}`)
  process.exit(1)
}
