/**
 * High-risk product image replacement tests.
 */

import {
  filterHighRiskImageReplacementProducts,
  isEligibleForHighRiskImageReplacement,
  analyzeHighRiskImageReplacement,
  rankReplacementImageCandidates,
  buildReplacementImageImportMetadata,
  buildHighRiskReplacementManualReviewMetadata,
  resolveProductImageSourceDomain,
  getHighRiskReplacementExcludedDomains,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
} from '../src/lib/equipmentProductImages.js'
import {
  isHighRiskImageSourceDomain,
  isProtectedImageSourceDomain,
} from '../src/lib/equipmentProductImageDomains.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const product = {
  id: 'prod-1',
  brand: 'Life Fitness',
  canonical_product_name: 'Life Fitness Integrity Bike',
  canonical_product_key: 'life-fitness-integrity-bike',
  original_base_price: 5200,
  baseline_manufacture_year: 2017,
  image_source_domain: 'equip4gyms.com',
  image_source_url: 'https://www.equip4gyms.com/product/bike/',
  image_url: 'https://www.equip4gyms.com/media/bike.jpg',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
}

const protectedProduct = {
  ...product,
  id: 'prod-2',
  image_source_domain: 'lifefitness.com',
  image_source_url: 'https://www.lifefitness.com/product/bike',
  image_url: 'https://www.lifefitness.com/images/bike.jpg',
  image_storage_path: 'life-fitness/integrity-bike.jpg',
}

const superstoreProduct = {
  ...product,
  id: 'prod-3',
  image_source_domain: 'fitnesssuperstore.co.uk',
  image_source_url: 'https://www.fitnesssuperstore.co.uk/bike',
  image_url: 'https://www.fitnesssuperstore.co.uk/images/bike.jpg',
  image_storage_path: 'life-fitness/superstore-bike.jpg',
}

assert(isHighRiskImageSourceDomain('equip4gyms.com'), 'equip4gyms is high-risk')
assert(isHighRiskImageSourceDomain('freedomfitnessequipment.com'), 'freedom fitness equipment is high-risk')
assert(isProtectedImageSourceDomain('technogym.com'), 'technogym is protected')
assert(isEligibleForHighRiskImageReplacement(product), 'equip4gyms product is eligible for replacement')
assert(!isEligibleForHighRiskImageReplacement(protectedProduct), 'protected manufacturer image is not replaced')
assert(!isEligibleForHighRiskImageReplacement(superstoreProduct), 'fitness superstore image is left alone')

const targets = filterHighRiskImageReplacementProducts([product, protectedProduct, superstoreProduct])
assert(targets.length === 1 && targets[0].id === 'prod-1', 'only high-risk products are selected')

const blankDomainDealerProduct = {
  ...product,
  id: 'prod-4',
  image_source_domain: null,
  image_source_url: 'https://www.freedomfitnessequipment.com/life-fitness-pro-bike',
  image_url: 'https://xyz.supabase.co/storage/v1/object/public/equipment-product-images/life-fitness/pro-bike.jpg',
  image_storage_path: 'life-fitness/pro-bike.jpg',
}
assert(isEligibleForHighRiskImageReplacement(blankDomainDealerProduct), 'dealer source URL is eligible when image_source_domain is blank')

const imageUrlDealerProduct = {
  ...product,
  id: 'prod-5',
  image_source_domain: null,
  image_source_url: null,
  image_url: 'https://www.buyandsellfitness.com/images/pro-bike.jpg',
}
assert(isEligibleForHighRiskImageReplacement(imageUrlDealerProduct), 'dealer image_url is eligible when domain metadata is missing')

const blankDomainAnalysis = analyzeHighRiskImageReplacement(blankDomainDealerProduct)
assert(blankDomainAnalysis.eligible, 'blank domain analysis finds dealer source URL')
assert(
  blankDomainAnalysis.signals.some((signal) => signal.field === 'image_source_url' && signal.type === 'high_risk_domain'),
  'dealer signal attributed to image_source_url',
)

const excludedDomains = getHighRiskReplacementExcludedDomains(blankDomainDealerProduct)
assert(excludedDomains.includes('freedomfitnessequipment.com'), 'excluded domains include detected high-risk source')

const superstoreSkip = analyzeHighRiskImageReplacement({
  ...product,
  id: 'prod-6',
  image_source_domain: 'fitnesssuperstore.com',
  image_source_url: 'https://www.fitnesssuperstore.com/products/pro-bike',
  image_url: 'https://cdn.equipd.test/pro-bike.jpg',
})
assert(superstoreSkip.skipReason === 'fitness_superstore_source', 'fitness superstore bare domain is skipped explicitly')

const protectedSkip = analyzeHighRiskImageReplacement({
  ...product,
  id: 'prod-7',
  image_source_domain: 'shop.lifefitness.com',
  image_source_url: 'https://shop.lifefitness.com/products/pro-bike',
  image_url: 'https://cdn.equipd.test/pro-bike.jpg',
})
assert(protectedSkip.skipReason === 'protected_manufacturer_source', 'shop.lifefitness bare domain is protected')

const manufacturerCandidate = {
  title: 'Life Fitness Integrity Bike',
  sourceUrl: 'https://www.lifefitness.com/product/integrity-bike',
  imageUrl: 'https://www.lifefitness.com/images/integrity-bike.jpg',
  width: 800,
  height: 600,
}
const highRiskCandidate = {
  title: 'Life Fitness Integrity Bike',
  sourceUrl: 'https://www.equip4gyms.com/product/bike/',
  imageUrl: 'https://www.equip4gyms.com/media/bike.jpg',
  width: 800,
  height: 600,
}
const fitshopCandidate = {
  title: 'Life Fitness Integrity Bike',
  sourceUrl: 'https://www.fitshop.co.uk/life-fitness-integrity-bike',
  imageUrl: 'https://www.fitshop.co.uk/images/bike.jpg',
  width: 800,
  height: 600,
}

const ranked = rankReplacementImageCandidates(
  [highRiskCandidate, fitshopCandidate, manufacturerCandidate],
  product,
  { excludedDomains: ['equip4gyms.com'] },
)
assert(ranked.length === 2, 'high-risk candidate excluded from replacement ranking')
assert(ranked[0].domain === 'lifefitness.com', 'manufacturer candidate ranked first')
assert(ranked[0].tier === 'manufacturer', 'manufacturer tier applied')

const replacementMetadata = buildReplacementImageImportMetadata({
  imageUrl: 'https://cdn.equipd.test/life-fitness/bike.jpg',
  storagePath: 'life-fitness/bike.jpg',
  sourceUrl: 'https://www.lifefitness.com/product/integrity-bike',
  confidence: 88,
})
assert(
  replacementMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  'replacement images stay suggested for manual review pipeline',
)
assert(replacementMetadata.image_source_domain === 'lifefitness.com', 'replacement domain updated')

const manualMetadata = buildHighRiskReplacementManualReviewMetadata(product)
assert(manualMetadata.image_url == null, 'manual review clears public image')
assert(manualMetadata.image_storage_path == null, 'manual review clears storage path')
assert(
  resolveProductImageSourceDomain(product) === 'equip4gyms.com',
  'previous high-risk domain preserved for audit on manual review metadata',
)
assert(
  product.original_base_price === 5200 && product.baseline_manufacture_year === 2017,
  'pricing fields unchanged in memory when building image metadata only',
)

console.log('high-risk product image replacement tests passed')
