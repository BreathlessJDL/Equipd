#!/usr/bin/env node
/**
 * Equipd PNG icon asset checks.
 * Run: node scripts/test-equipd-icon-assets.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { EQUIPD_ICON_ASSETS } from '../src/lib/equipdIconAssets.js'
import {
  EQUIPD_ICON_VARIANT,
  HUB_ATTENTION_ICON_VARIANT,
  HUB_SUMMARY_ICON_VARIANT,
} from '../src/lib/equipdIconVariants.js'

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

for (const assetPath of Object.values(EQUIPD_ICON_ASSETS)) {
  const filePath = path.join(root, 'public', assetPath.replace(/^\//, ''))
  assert(fs.existsSync(filePath), `asset exists: ${assetPath}`)
}

assert(
  HUB_SUMMARY_ICON_VARIANT.buying === EQUIPD_ICON_VARIANT.BUYING_BAG,
  'Hub buying maps to buying variant',
)
assert(
  HUB_SUMMARY_ICON_VARIANT.selling === EQUIPD_ICON_VARIANT.SELLING_STALL,
  'Hub selling maps to selling variant',
)
assert(
  HUB_SUMMARY_ICON_VARIANT['orders-in-progress'] === EQUIPD_ICON_VARIANT.ORDERS_IN_PROGRESS,
  'Hub orders in progress maps to orders-in-progress variant',
)
assert(
  HUB_ATTENTION_ICON_VARIANT['buyer-pay'] === EQUIPD_ICON_VARIANT.BUYER_PAYMENT_RECEIVED,
  'Hub buyer-pay attention uses buyer payment variant',
)
assert(
  HUB_ATTENTION_ICON_VARIANT['buyer-collection'] === EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
  'Hub buyer-collection attention uses collection confirmed variant',
)

console.log(`\n${passed}/${passed + failed} checks passed`)

if (failed > 0) {
  process.exit(1)
}
