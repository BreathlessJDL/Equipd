#!/usr/bin/env node
/**
 * Unit checks for local marketplace hub config + 40-mile radius wiring.
 *
 *   node scripts/test-location-hub-radius.mjs
 */
import assert from 'node:assert/strict'
import { buildBrowseQueryOptions } from '../src/lib/browseFilters.js'
import {
  LOCATION_HUB_RADIUS_METRES,
  LOCATION_HUB_RADIUS_MILES,
  LOCATION_PAGES,
  LOCATION_SLUGS,
  getLocationHubQueryAreas,
  getLocationHubSearch,
  resolveLocationView,
} from '../src/lib/locations.js'

assert.equal(LOCATION_HUB_RADIUS_MILES, 40)
assert.equal(LOCATION_HUB_RADIUS_METRES, 64373.76)

for (const slug of LOCATION_SLUGS) {
  const region = LOCATION_PAGES[slug]
  assert.ok(region, `missing region ${slug}`)
  const hub = getLocationHubSearch(region)
  assert.equal(hub.radiusMiles, 40)
  assert.ok(Number.isFinite(hub.latitude), `${slug} latitude`)
  assert.ok(Number.isFinite(hub.longitude), `${slug} longitude`)
  assert.ok(hub.latitude >= 49 && hub.latitude <= 61, `${slug} lat in UK range`)
  assert.ok(hub.longitude >= -9 && hub.longitude <= 2, `${slug} lng in UK range`)

  const view = resolveLocationView(region)
  assert.deepEqual(view.filterAreas, [])
  assert.equal(view.hubRadiusMiles, 40)
  assert.equal(view.centre.latitude, hub.latitude)
  assert.ok(view.metaDescription.includes('40 miles'), `${slug} meta mentions 40 miles`)
  assert.ok(view.seoBody.includes('within 40 miles'), `${slug} seoBody radius wording`)

  const narrowed = resolveLocationView(region, region.areas[1] ?? null)
  if (region.areas[1]) {
    assert.deepEqual(getLocationHubQueryAreas(region, region.areas[1]), [region.areas[1]])
    assert.deepEqual(narrowed.filterAreas, [region.areas[1]])
  }
}

assert.throws(
  () => getLocationHubSearch({ slug: 'broken', name: 'Broken', centre: null }),
  /Missing centre coordinates/,
)

const leeds = LOCATION_PAGES.leeds
const hub = getLocationHubSearch(leeds)
const query = buildBrowseQueryOptions(
  {
    search: '',
    sort: 'newest',
    radiusMiles: 'uk',
    radiusMilesValue: null,
  },
  {
    locationAreas: [],
    profileCoordinates: { latitude: 51.5, longitude: -0.12 },
    hubSearch: hub,
  },
)

assert.equal(query.buyerLatitude, hub.latitude)
assert.equal(query.buyerLongitude, hub.longitude)
assert.equal(query.radiusMiles, 40)
assert.notEqual(query.buyerLatitude, 51.5, 'hub must override profile coordinates')

console.log(
  JSON.stringify(
    {
      hubs: LOCATION_SLUGS.length,
      radiusMiles: LOCATION_HUB_RADIUS_MILES,
      radiusMetres: LOCATION_HUB_RADIUS_METRES,
      centres: Object.fromEntries(
        LOCATION_SLUGS.map((slug) => [
          slug,
          {
            lat: LOCATION_PAGES[slug].centre.latitude,
            lng: LOCATION_PAGES[slug].centre.longitude,
          },
        ]),
      ),
    },
    null,
    2,
  ),
)
console.log('PASS: location hub radius config')
