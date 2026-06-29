#!/usr/bin/env node
/**
 * Notification PNG icon mapping checks.
 * Run: node scripts/test-notification-png-icons.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  getNotificationIconType,
  NOTIFICATION_ICON_TYPES,
} from '../src/lib/notificationPresentation.js'
import { NOTIFICATION_PNG_ICONS } from '../src/lib/notificationPngIcons.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    passed += 1
    console.log(`PASS ${label}`)
    return
  }

  failed += 1
  console.error(`FAIL ${label}`)
}

for (const assetPath of Object.values(NOTIFICATION_PNG_ICONS)) {
  const filePath = path.join(root, 'public', assetPath.replace(/^\//, ''))
  assert(fs.existsSync(filePath), `asset exists: ${assetPath}`)
}

assert(
  getNotificationIconType({
    type: 'buyer_payment_received',
    title: 'Buyer payment received',
  }) === NOTIFICATION_ICON_TYPES.BUYER_PAYMENT_RECEIVED,
  'buyer payment notification maps to buyer payment icon type',
)

assert(
  getNotificationIconType({
    type: 'collection_confirmed',
    title: 'Collection confirmed',
  }) === NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED,
  'collection confirmed notification maps to collection icon type',
)

assert(
  getNotificationIconType({
    type: 'order_update',
    title: 'Handover confirmed',
  }) === NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED,
  'handover confirmed title maps to collection icon type',
)

assert(
  getNotificationIconType({
    type: 'new_offer',
    title: 'New offer',
  }) === NOTIFICATION_ICON_TYPES.NEW_OFFER,
  'unrelated notifications remain on existing icon types',
)

console.log(`\n${passed}/${passed + failed} checks passed`)

if (failed > 0) {
  process.exit(1)
}
