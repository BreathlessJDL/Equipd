/**
 * Tests for Concept2 / Hammer Strength canonical onboarding helpers.
 */

import { deriveCoreProductFields } from '../src/lib/intelligenceCoreProductGrouping.js'
import {
  buildBrandOnboardReport,
  loadPlannedIntelligenceCatalogue,
  proposeIntelligenceEquipmentTypeRepairs,
} from '../src/lib/canonicalBrandOnboard.js'
import { buildCanonicalProductAuditReport } from '../src/lib/intelligenceCanonicalProducts.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const hammerRows = [
  {
    id: 'hs-1',
    brand: 'Hammer Strength',
    series: 'Plateloaded',
    model: 'Iso-Lateral Shoulder Press',
    equipment_type: 'Shoulder Press',
    slug: 'hammer-strength-iso-lateral-shoulder-press',
  },
  {
    id: 'hs-2',
    brand: 'Hammer Strength',
    series: 'Plateloaded',
    model: 'Iso-Lateral Leg Press',
    equipment_type: 'Leg Press',
    slug: 'hammer-strength-iso-lateral-leg-press',
  },
]

const shoulder = deriveCoreProductFields(hammerRows[0])
const legPress = deriveCoreProductFields(hammerRows[1])
assert(
  shoulder.core_product_key !== legPress.core_product_key,
  'Hammer Strength iso-lateral models must not collapse to the same key',
)
assert(
  shoulder.core_product_group_confidence >= 90,
  'Hammer Strength iso-lateral shoulder press should be high-confidence grouping',
)

const hammerAudit = buildCanonicalProductAuditReport(hammerRows, { brandFilter: 'Hammer Strength' })
assert(hammerAudit.products.length === 2, 'two distinct Hammer Strength canonical products')
assert(
  hammerAudit.products.every((product) => product.status !== 'needs_review'),
  'Hammer Strength iso-lateral products should not need review after grouping fix',
)

const concept2Catalogue = loadPlannedIntelligenceCatalogue('Concept2')
assert(concept2Catalogue.rows.length === 6, 'Concept2 catalogue has six products')

const concept2Report = buildBrandOnboardReport({
  brand: 'Concept2',
  intelligenceRows: concept2Catalogue.rows,
  plannedImport: true,
  catalogueSource: concept2Catalogue.source,
})
assert(concept2Report.canonical_products.count === 6, 'Concept2 generates six canonical products')
assert(concept2Report.missing_rrps.length === 0, 'Concept2 catalogue includes RRP for all products')
assert(concept2Report.missing_manufacture_years.length === 0, 'Concept2 catalogue includes years for all products')
assert(concept2Report.valuation_ready.complete === 6, 'Concept2 products are valuation-ready from catalogue data')
assert(concept2Report.missing_images.count === 6, 'new products have no images yet')

const woodwayCatalogue = loadPlannedIntelligenceCatalogue('Woodway')
assert(woodwayCatalogue.rows.length === 5, 'Woodway catalogue has five treadmills')

const wattbikeCatalogue = loadPlannedIntelligenceCatalogue('Wattbike')
assert(wattbikeCatalogue.rows.length === 5, 'Wattbike catalogue has five bikes')

const wattbikeReport = buildBrandOnboardReport({
  brand: 'Wattbike',
  intelligenceRows: wattbikeCatalogue.rows,
  plannedImport: true,
  catalogueSource: wattbikeCatalogue.source,
})
assert(wattbikeReport.canonical_products.count === 5, 'Wattbike generates five canonical products')
assert(wattbikeReport.workflow_summary.safe_approvals >= 4, 'Wattbike has safe approval candidates')

const woodwayRepairs = proposeIntelligenceEquipmentTypeRepairs([
  { id: 'w1', brand: 'Woodway', series: 'Curve', model: 'Curve', equipment_type: 'Treadmill' },
  { id: 'w2', brand: 'Woodway', series: '4Front', model: '4Front', equipment_type: 'Treadmill' },
])
assert(woodwayRepairs.length === 1, 'Woodway Curve models repair to non-motorised treadmill')
assert(woodwayRepairs[0].after === 'Non-Motorised Treadmill', 'Woodway Curve repair target')

console.log('canonical brand onboard tests passed')
