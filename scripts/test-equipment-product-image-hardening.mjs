/**
 * Hardened image matching gates: collisions, blocked domains, generic pages,
 * pending eligibility, Hammer Strength exact-model rules.
 * Run: node scripts/test-equipment-product-image-hardening.mjs
 */

import {
  collectSharedImageCollisions,
  evaluateHardenedImageCandidate,
  filterRowsForSharedImageCollisions,
  normalizeSharedImageKey,
  rejectGenericOrUnsuitableImageCandidate,
} from '../src/lib/equipmentProductImageHardening.js'
import {
  buildHammerStrengthImageSearchQueries,
  isHammerStrengthBrand,
  scoreHammerStrengthImageCandidate,
} from '../src/lib/hammerStrengthProductImageSearch.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const hammerBelt = {
  id: 'h1',
  brand: 'Hammer Strength',
  product_family: 'Plateloaded',
  model: 'Belt Squat',
  canonical_product_name: 'Hammer Strength Plateloaded Belt Squat',
  equipment_type: 'Leg Press',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING,
}

assert(isHammerStrengthBrand('Hammer Strength'), 'Hammer brand detected')
assert(!isHammerStrengthBrand('Technogym'), 'Technogym is not Hammer')

{
  const queries = buildHammerStrengthImageSearchQueries(hammerBelt)
  assert(queries.some((q) => /lifefitness\.com/i.test(q)), 'Hammer queries include manufacturer site')
  assert(queries.some((q) => /Belt Squat/i.test(q)), 'Hammer queries include model')
}

{
  const exactFitkit = {
    title: 'Hammer Strength Plate Loaded Belt Squat',
    sourceUrl: 'https://www.fitkituk.com/strength-c2/hammer-strength-plate-loaded-belt-squat-p3738',
    imageUrl: 'https://www.fitkituk.com/images/products/1633527712-94643300.jpg',
  }
  const gate = evaluateHardenedImageCandidate(hammerBelt, exactFitkit, { hammerMode: true })
  assert(gate.eligible, `Exact FitKit Hammer candidate eligible (${gate.reason})`)
  assert(gate.pendingEligible, `Exact FitKit Hammer pending-eligible (${gate.reason})`)
  assert(gate.identityEvidence?.evidenceLevel === 'exact', 'Exact evidence required')
  assert(gate.autoApprove !== true, 'Hardening never auto-approves')

  const scored = scoreHammerStrengthImageCandidate(exactFitkit, hammerBelt)
  assert(scored.pendingEligible, 'Hammer scorer pending-eligible for exact dealer hit')
  assert(scored.autoApprove !== true, 'Hammer scorer never auto-approves')
}

{
  const category = {
    title: 'Hammer Strength plate loaded range',
    sourceUrl: 'https://www.powerhouse-fitness.co.uk/strength-equipment/',
    imageUrl: 'https://www.powerhouse-fitness.co.uk/images/category/hammer.jpg',
  }
  const reject = rejectGenericOrUnsuitableImageCandidate(category)
  assert(reject.reject, 'Generic / category dealer URL rejected')
}

{
  const blocked = {
    title: 'Hammer Strength Belt Squat',
    sourceUrl: 'https://www.instagram.com/p/abc/',
    imageUrl: 'https://lookaside.instagram.com/seo/google_widget/crawler/',
  }
  const gate = evaluateHardenedImageCandidate(hammerBelt, blocked, { hammerMode: true })
  assert(!gate.pendingEligible, 'Blocked social domain must not be pending-eligible')
}

{
  const selectionPro = {
    brand: 'Technogym',
    product_family: 'Selection Pro',
    model: 'Pulldown',
    canonical_product_name: 'Technogym Selection Pro Pulldown',
    equipment_type: 'Lat Pulldown',
  }
  const pure = {
    title: 'Technogym Pure Strength Pulldown',
    sourceUrl: 'https://www.technogym.com/gb/product/pure-strength-pulldown/',
    imageUrl: 'https://www.technogym.com/media/pure-strength-pulldown.jpg',
  }
  const gate = evaluateHardenedImageCandidate(selectionPro, pure)
  assert(!gate.eligible, 'Selection Pro vs Pure Strength hardened reject')
  assert(!gate.pendingEligible, 'Family conflict never pending-eligible')
}

{
  const key = normalizeSharedImageKey('https://cdn.example.com/photo.jpg?v=2')
  assert(key === 'https://cdn.example.com/photo.jpg', 'Shared image key strips query')
  const rows = [
    {
      product_id: 'a',
      canonical_product_name: 'Product A',
      brand: 'Technogym',
      candidate_image_url: 'https://cdn.example.com/photo.jpg?x=1',
      confidence_bucket: 'high',
    },
    {
      product_id: 'b',
      canonical_product_name: 'Product B',
      brand: 'Technogym',
      candidate_image_url: 'https://cdn.example.com/photo.jpg?y=2',
      confidence_bucket: 'high',
    },
  ]
  const collisions = collectSharedImageCollisions(rows)
  assert(collisions.length === 1, 'Shared URL forms one collision group')
  assert(collisions[0].count === 2, 'Collision group has two products')
  const filtered = filterRowsForSharedImageCollisions(rows)
  assert(filtered.accepted.length === 0, 'Colliding highs removed from accepted set')
  assert(filtered.rejected.length === 2, 'Both rows marked rejected')
}

console.log('equipment-product-image-hardening: ok')
