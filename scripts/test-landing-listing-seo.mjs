#!/usr/bin/env node
/**
 * Buyer landing prerender includes matching public listings only.
 *
 *   node scripts/test-landing-listing-seo.mjs
 */
import assert from 'node:assert/strict'
import { buildCategoryLandingSeoDocument } from '../src/lib/categoryLandingSeo.js'
import { getEquipmentLandingContent } from '../src/lib/equipmentLandingPages.js'
import { COMMERCIAL_STRENGTH_CONTENT } from '../src/lib/commercialStrengthEquipmentPage.js'
import { selectPublicLandingListings } from '../src/lib/landingListingSeo.js'

const listings = [
  {
    status: 'active',
    slug: 'commercial-treadmill-1',
    title: 'Life Fitness Commercial Treadmill',
    price_pence: 250000,
    city: 'Leeds',
    rating: 'full_commercial',
    category: { slug: 'treadmill' },
    published_at: '2026-09-01T00:00:00.000Z',
    quantity_available: 1,
    primary_image_url: 'https://example.supabase.co/storage/v1/object/public/listing-images/a.jpg',
  },
  {
    status: 'active',
    slug: 'home-treadmill-1',
    title: 'NordicTrack Home Treadmill',
    price_pence: 80000,
    city: 'Bristol',
    rating: 'home_use',
    category: { slug: 'treadmill' },
    published_at: '2026-09-02T00:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'commercial-rower-1',
    title: 'Concept2 RowErg',
    price_pence: 90000,
    rating: 'full_commercial',
    category: { slug: 'rowers' },
    published_at: '2026-09-03T00:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'pin-loaded-1',
    title: 'Life Fitness Pin Loaded Chest Press',
    price_pence: 110000,
    rating: 'full_commercial',
    category: { slug: 'pin-loaded-machine' },
    published_at: '2026-09-04T00:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'smith-machine-1',
    title: 'Used Smith Machine',
    price_pence: 70000,
    rating: 'full_commercial',
    category: { slug: 'squat-rack' },
    published_at: '2026-09-05T00:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'power-rack-not-smith',
    title: 'Commercial Power Rack',
    price_pence: 65000,
    rating: 'full_commercial',
    category: { slug: 'squat-rack' },
    published_at: '2026-09-06T00:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'kinesis-one-1',
    title: 'Technogym Kinesis One Functional Trainer',
    price_pence: 400000,
    rating: 'full_commercial',
    category: { slug: 'functional' },
    published_at: '2026-09-06T06:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'plyo-boxes-1',
    title: 'Technogym Plyo Plyometric Wooden Boxes',
    price_pence: 25000,
    rating: 'full_commercial',
    category: { slug: 'functional' },
    published_at: '2026-09-06T12:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'draft',
    slug: 'draft-treadmill',
    title: 'Draft Commercial Treadmill',
    rating: 'full_commercial',
    category: { slug: 'treadmill' },
    published_at: '2026-09-07T00:00:00.000Z',
    quantity_available: 1,
  },
  {
    status: 'active',
    slug: 'suspended-treadmill',
    title: 'Suspended Commercial Treadmill',
    rating: 'full_commercial',
    category: { slug: 'treadmill' },
    seller_is_hidden_from_marketplace: true,
    published_at: '2026-09-08T00:00:00.000Z',
    quantity_available: 1,
  },
]

const treadmill = getEquipmentLandingContent('used-commercial-treadmills')
assert.ok(treadmill, 'treadmill landing content')
assert.equal(treadmill.secondaryCta.label, 'How buying works')
assert.equal(treadmill.secondaryCta.to, '/buy-used-gym-equipment')
assert.equal(treadmill.valuationCta.to, '/valuation')
assert.doesNotMatch(treadmill.primaryCta.label, /Value Your Equipment/)

const treadmillDoc = buildCategoryLandingSeoDocument(treadmill, { listings })
assert.equal(treadmillDoc.canonicalPath, '/used-commercial-treadmills')
assert.ok(treadmillDoc.bodyHtml.includes('/listings/commercial-treadmill-1'))
assert.ok(treadmillDoc.bodyHtml.includes('£2,500'))
assert.ok(treadmillDoc.bodyHtml.includes('Leeds'))
assert.ok(treadmillDoc.bodyHtml.includes('storage/v1/render/image/public/'))
assert.ok(!treadmillDoc.bodyHtml.includes('/listings/home-treadmill-1'), 'home treadmill excluded from commercial')
assert.ok(!treadmillDoc.bodyHtml.includes('/listings/commercial-rower-1'), 'rower excluded from treadmill')
assert.ok(!treadmillDoc.bodyHtml.includes('/listings/draft-treadmill'))
assert.ok(!treadmillDoc.bodyHtml.includes('/listings/suspended-treadmill'))
assert.ok(!treadmillDoc.bodyHtml.includes('Value Your Equipment'))
assert.ok(treadmillDoc.bodyHtml.includes('Get a free valuation') || treadmillDoc.bodyHtml.includes('Get a Free Valuation'))
assert.ok(!treadmillDoc.jsonLd.some((node) => node['@type'] === 'Product'))
const treadmillList = treadmillDoc.jsonLd.find((node) => node['@type'] === 'CollectionPage')
assert.ok(
  JSON.stringify(treadmillList).includes('/listings/commercial-treadmill-1'),
  'collection schema lists the matching listing',
)

const homeTreadmill = getEquipmentLandingContent('home-treadmills')
const homeDoc = buildCategoryLandingSeoDocument(homeTreadmill, { listings })
assert.ok(homeDoc.bodyHtml.includes('/listings/home-treadmill-1'))
assert.ok(!homeDoc.bodyHtml.includes('/listings/commercial-treadmill-1'))

const bikes = getEquipmentLandingContent('used-commercial-exercise-bikes')
const bikeDoc = buildCategoryLandingSeoDocument(bikes, { listings })
assert.ok(bikeDoc.bodyHtml.includes('No matching listings are live right now') || bikeDoc.bodyHtml.includes('Few listings match'))
assert.ok(!bikeDoc.bodyHtml.includes('/listings/commercial-treadmill-1'), 'empty bike page does not show treadmills')

const rowers = getEquipmentLandingContent('used-commercial-rowing-machines')
const rowerDoc = buildCategoryLandingSeoDocument(rowers, { listings })
assert.ok(rowerDoc.bodyHtml.includes('/listings/commercial-rower-1'))
assert.ok(!rowerDoc.bodyHtml.includes('/listings/commercial-treadmill-1'))

const smith = getEquipmentLandingContent('used-smith-machines')
const smithSelected = selectPublicLandingListings(listings, smith.listingFilter)
assert.deepEqual(
  smithSelected.map((row) => row.slug),
  ['smith-machine-1'],
)
const smithDoc = buildCategoryLandingSeoDocument(smith, { listings })
assert.ok(smithDoc.bodyHtml.includes('/listings/smith-machine-1'))
assert.ok(!smithDoc.bodyHtml.includes('/listings/power-rack-not-smith'))

const functional = getEquipmentLandingContent('used-functional-trainers')
const functionalDoc = buildCategoryLandingSeoDocument(functional, { listings })
assert.ok(functionalDoc.bodyHtml.includes('/listings/kinesis-one-1'))
assert.ok(
  !functionalDoc.bodyHtml.includes('/listings/plyo-boxes-1'),
  'plyo boxes are not functional trainers',
)

const strengthDoc = buildCategoryLandingSeoDocument(COMMERCIAL_STRENGTH_CONTENT, { listings })
assert.ok(strengthDoc.bodyHtml.includes('/listings/pin-loaded-1'))
assert.ok(strengthDoc.bodyHtml.includes('/listings/smith-machine-1'))
assert.ok(!strengthDoc.bodyHtml.includes('/listings/commercial-treadmill-1'), 'cardio excluded from strength hub')
assert.equal(COMMERCIAL_STRENGTH_CONTENT.secondaryCta.label, 'How buying works')

console.log('test-landing-listing-seo: ok')
