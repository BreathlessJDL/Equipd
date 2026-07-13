/**
 * Sprint 3 IndexNow dry-run event report (no network submission).
 * Run: node scripts/indexnow-dry-run-report.mjs
 */
import {
  batchIndexNowUrls,
  buildBrandIndexNowUrl,
  buildEquipmentIndexNowUrl,
  dedupeIndexNowUrls,
  shouldNotifyEquipmentContentChange,
  shouldNotifyListingChange,
  summarizeIndexNowUrlFamilies,
} from '../src/lib/indexNowCore.js'
import {
  collectEquipmentContentIndexNowUrls,
  collectEquipmentIndexNowUrls,
  collectListingIndexNowUrls,
} from '../src/lib/indexNowCollect.js'

function row(event, collected) {
  const urls = collected.urls || []
  const batches = batchIndexNowUrls(urls)
  const families = collected.families || summarizeIndexNowUrlFamilies(urls)
  return {
    event,
    notify: Boolean(collected.notify && urls.length),
    reason: collected.reason,
    urlCount: urls.length,
    brandUrlCount: (families.brands || 0) + (families.brandDirectory || 0),
    cityUrlCount: families.locations || 0,
    equipmentUrlCount: families.equipment || 0,
    listingUrlCount: families.listings || 0,
    batchCount: batches.length,
    families,
    urls,
  }
}

function contentRemoval(previous, next) {
  const decision = shouldNotifyEquipmentContentChange({ previous, next, action: 'update' })
  if (!decision.notify) return { ...decision, urls: [], families: summarizeIndexNowUrlFamilies([]) }
  const urls = dedupeIndexNowUrls([
    buildEquipmentIndexNowUrl(previous.canonical_product_key || next.canonical_product_key),
    buildBrandIndexNowUrl('life-fitness'),
  ])
  return { ...decision, urls, families: summarizeIndexNowUrlFamilies(urls) }
}

const events = []

events.push(row('1. One active listing price edit', collectListingIndexNowUrls({
  previous: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', price_pence: 100000, title: 'LF Treadmill' },
  next: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', price_pence: 90000, title: 'LF Treadmill' },
})))

events.push(row('2. Listing publish', collectListingIndexNowUrls({
  previous: null,
  next: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
  action: 'create',
})))

events.push(row('3. Listing city change', collectListingIndexNowUrls({
  previous: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
  next: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Manchester', title: 'LF Treadmill' },
})))

events.push(row('4. Listing image removal', collectListingIndexNowUrls({
  previous: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
  next: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
  action: 'images',
})))

events.push(row('5. Listing sold through offer flow', collectListingIndexNowUrls({
  previous: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
  next: { id: '1', status: 'sold', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
})))

events.push(row('6. Listing deleted', collectListingIndexNowUrls({
  previous: { id: '1', status: 'active', slug: 'lf-treadmill-abc', city: 'Leeds', title: 'LF Treadmill' },
  next: null,
  action: 'delete',
})))

events.push(row('7. FAQ removed from equipment guide', contentRemoval(
  {
    generation_status: 'approved',
    canonical_product_key: 'life-fitness-integrity-series-treadmill',
    brand: 'Life Fitness',
    overview_text: 'Overview',
    faq_json: [{ question: 'Q', answer: 'A' }],
  },
  {
    generation_status: 'approved',
    canonical_product_key: 'life-fitness-integrity-series-treadmill',
    brand: 'Life Fitness',
    overview_text: 'Overview',
    faq_json: [],
  },
)))

events.push(row('8. Approved product image removed', collectEquipmentIndexNowUrls({
  previous: {
    status: 'approved',
    canonical_product_key: 'technogym-excite-run-700',
    brand: 'Technogym',
    equipment_type: 'Treadmill',
    image_status: 'approved',
    image_url: 'https://cdn.example/run700.png',
  },
  next: {
    status: 'approved',
    canonical_product_key: 'technogym-excite-run-700',
    brand: 'Technogym',
    equipment_type: 'Treadmill',
    image_status: 'rejected',
    image_url: null,
  },
  action: 'image',
})))

events.push(row('9. 50 content publications for one brand', collectEquipmentContentIndexNowUrls({
  rows: Array.from({ length: 50 }, (_, i) => ({
    id: `bulk-${i}`,
    generation_status: 'approved',
    canonical_product_key: `matrix-fitness-model-${i}`,
    brand: 'Matrix Fitness',
  })),
  action: 'publish',
})))

const brands = ['Life Fitness', 'Technogym', 'Matrix Fitness', 'Concept2', 'Precor']
events.push(row('10. 50 publications across five brands', collectEquipmentContentIndexNowUrls({
  rows: Array.from({ length: 50 }, (_, i) => ({
    id: `multi-${i}`,
    generation_status: 'approved',
    canonical_product_key: `product-${brands[i % 5].toLowerCase().replace(/\s+/g, '-')}-${i}`,
    brand: brands[i % 5],
  })),
  action: 'publish',
})))

events.push(row('11. Product exclusion', collectEquipmentIndexNowUrls({
  previous: {
    status: 'approved',
    canonical_product_key: 'cybex-eagle-chest-press',
    brand: 'Cybex',
    equipment_type: 'Chest Press',
  },
  next: {
    status: 'excluded',
    canonical_product_key: 'cybex-eagle-chest-press',
    brand: 'Cybex',
    equipment_type: 'Chest Press',
  },
  action: 'exclude',
  includeBrandDirectory: true,
})))

events.push(row('12. Canonical product key change', collectEquipmentIndexNowUrls({
  previous: {
    status: 'approved',
    canonical_product_key: 'old-key',
    brand: 'Woodway',
    equipment_type: 'Treadmill',
  },
  next: {
    status: 'approved',
    canonical_product_key: 'new-key',
    brand: 'Woodway',
    equipment_type: 'Treadmill',
  },
  action: 'key_change',
})))

events.push(row('13. Confidence-only admin update', collectEquipmentIndexNowUrls({
  previous: {
    status: 'approved',
    canonical_product_key: 'concept2-bikeerg',
    brand: 'Concept2',
    equipment_type: 'Exercise Bike',
    original_price_confidence: 40,
  },
  next: {
    status: 'approved',
    canonical_product_key: 'concept2-bikeerg',
    brand: 'Concept2',
    equipment_type: 'Exercise Bike',
    original_price_confidence: 95,
  },
  action: 'update',
})))

const favourite = shouldNotifyListingChange({
  previous: { status: 'active', slug: 'x', title: 'Bike', favourite_count: 1, views: 10 },
  next: { status: 'active', slug: 'x', title: 'Bike', favourite_count: 40, views: 500 },
})
events.push(row('14. Favourite/view change', { notify: favourite.notify, reason: favourite.reason, urls: [] }))

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), events }, null, 2))
