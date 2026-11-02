#!/usr/bin/env node
/**
 * Guards that suspended sellers' listings are hidden from public discovery
 * for both anonymous and authenticated callers.
 *
 *   node scripts/test-suspended-seller-listing-visibility.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyListingDiscoveryState,
  isActivePublicListingCandidate,
  isListingEligibleForPrerender,
  isSellerHiddenFromPublicMarketplace,
  LISTING_DISCOVERY_STATES,
} from '../src/lib/listingDiscoveryEligibility.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

const migration = read(
  'supabase/migrations/20261102150000_hide_suspended_seller_listings_from_anon.sql',
)
const listings = read('src/lib/listings.js')
const shop = read('src/pages/UserShopPage.jsx')
const prerenderData = read('src/lib/listingPrerenderData.js')
const sitemap = read('scripts/generate-sitemap.mjs')

assert.match(migration, /seller_is_hidden_from_public_marketplace/)
assert.match(migration, /security definer/)
assert.match(
  migration,
  /revoke all on function public\.seller_is_hidden_from_public_marketplace\(uuid\)\s+from public, anon, authenticated/,
)
assert.match(
  migration,
  /grant execute on function public\.seller_is_hidden_from_public_marketplace\(uuid\)\s+to service_role/,
)
assert.doesNotMatch(
  migration,
  /grant execute on function public\.seller_is_hidden_from_public_marketplace\(uuid\)\s+to anon/,
)
assert.match(
  migration,
  /create or replace function public\.listing_is_publicly_visible\([\s\S]*security definer/,
)
assert.match(
  migration,
  /create or replace function public\.listing_is_publicly_readable\([\s\S]*security definer/,
)
assert.match(
  migration,
  /not public\.seller_is_hidden_from_public_marketplace\(p_listing\.seller_id\)/,
)
assert.match(migration, /Admins can read all listings/)
assert.match(migration, /or public\.is_admin\(\)/)
assert.doesNotMatch(migration, /drop policy if exists "Publicly readable listings are selectable"/)
assert.doesNotMatch(migration, /disable row level security/)

assert.match(listings, /listings_public_browse/)
assert.match(listings, /fetchSellerActiveListings/)
assert.match(shop, /fetchSellerActiveListings/)
assert.match(prerenderData, /attachSellerMarketplaceHiddenFlags/)
assert.match(sitemap, /attachSellerMarketplaceHiddenFlags/)

const active = {
  id: 'a1',
  slug: 'life-fitness-treadmill',
  status: 'active',
  quantity_available: 1,
  seller_id: 'seller-1',
}

assert.equal(isSellerHiddenFromPublicMarketplace(active), false)
assert.equal(isActivePublicListingCandidate(active), true)
assert.equal(
  classifyListingDiscoveryState(active),
  LISTING_DISCOVERY_STATES.ACTIVE_PUBLIC,
)

const suspendedActive = { ...active, seller_is_hidden_from_marketplace: true }
assert.equal(isSellerHiddenFromPublicMarketplace(suspendedActive), true)
assert.equal(isActivePublicListingCandidate(suspendedActive), false)
assert.equal(
  classifyListingDiscoveryState(suspendedActive),
  LISTING_DISCOVERY_STATES.UNREADABLE,
)
assert.equal(isListingEligibleForPrerender(suspendedActive), false)

const suspendedSold = {
  ...active,
  status: 'sold',
  published_at: '2026-07-01T00:00:00.000Z',
  sold_at: '2026-07-01T00:00:00.000Z',
  seller: { is_suspended: true },
}
assert.equal(
  classifyListingDiscoveryState(suspendedSold),
  LISTING_DISCOVERY_STATES.UNREADABLE,
)

console.log('test-suspended-seller-listing-visibility: ok')
