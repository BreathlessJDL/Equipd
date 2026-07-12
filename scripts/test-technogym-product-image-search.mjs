/**
 * Technogym product image search ranking tests.
 */

import {
  buildTechnogymImageSearchQueries,
  detectTechnogymProductLine,
  rankTechnogymImageCandidates,
  resolveTechnogymImageImportMetadata,
  scoreTechnogymImageCandidate,
} from '../src/lib/technogymProductImageSearch.js'
import { buildEquipmentProductImageSearchQueries } from '../src/lib/equipmentProductImages.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const elementProduct = {
  brand: 'Technogym',
  product_family: 'Element',
  model: 'Leg Press',
  canonical_product_name: 'Technogym Element Leg Press',
  equipment_type: 'Leg Press',
}

const selectionProduct = {
  brand: 'Technogym',
  product_family: 'Selection',
  model: 'Chest Press',
  canonical_product_name: 'Technogym Selection Chest Press',
  equipment_type: 'Chest Press',
}

const exciteProduct = {
  brand: 'Technogym',
  product_family: 'Excite',
  model: 'Run 700',
  canonical_product_name: 'Technogym Excite Run 700',
  equipment_type: 'Treadmill',
}

assert(
  detectTechnogymProductLine(elementProduct) === 'element',
  'Element product line detected',
)
assert(
  buildTechnogymImageSearchQueries(elementProduct)[0].includes('Element'),
  'Element search query includes product line',
)
assert(
  !buildTechnogymImageSearchQueries(elementProduct)[0].includes('gym equipment product'),
  'Technogym query avoids broad gym equipment suffix',
)

const selectionCandidate = {
  title: 'Technogym Selection Chest Press',
  sourceUrl: 'https://www.fitkituk.com/technogym-selection-chest-press',
  imageUrl: 'https://www.fitkituk.com/images/selection-chest-press.jpg',
  width: 800,
  height: 600,
}

const elementWrongLineCandidate = {
  title: 'Technogym Selection Leg Press',
  sourceUrl: 'https://www.fitkituk.com/technogym-selection-leg-press',
  imageUrl: 'https://www.fitkituk.com/images/selection-leg-press.jpg',
  width: 800,
  height: 600,
}

const elementRanked = rankTechnogymImageCandidates([elementWrongLineCandidate, selectionCandidate], elementProduct)
assert(elementRanked.length === 0 || elementRanked[0].warnings.some((w) => w.startsWith('conflicting_product_line')), 'Element product rejects Selection line image')

const exciteFitkitCandidate = {
  title: 'Technogym Excite Run 700 Treadmill',
  sourceUrl: 'https://www.fitkituk.com/technogym-excite-run-700',
  imageUrl: 'https://www.fitkituk.com/images/excite-run-700.jpg',
  width: 900,
  height: 700,
}

const exciteScored = scoreTechnogymImageCandidate(exciteFitkitCandidate, exciteProduct)
assert(exciteScored.score >= 70, 'Excite FitKit candidate scores well')
assert(exciteScored.confidenceBand !== 'rejected', 'Excite FitKit candidate not rejected')

const consoleCandidate = {
  title: 'Technogym Unity console close-up touchscreen',
  sourceUrl: 'https://www.fitnesssuperstore.co.uk/unity-console',
  imageUrl: 'https://www.fitnesssuperstore.co.uk/images/unity-console.jpg',
  width: 500,
  height: 500,
}

const consoleScored = scoreTechnogymImageCandidate(consoleCandidate, exciteProduct)
assert(consoleScored.score === 0 || consoleScored.warnings.includes('console_only_or_close_up'), 'Console-only image penalized')

const peopleCandidate = {
  title: 'Woman exercising on Technogym Excite Run treadmill in gym',
  sourceUrl: 'https://www.fitnesssuperstore.co.uk/excite-run-gym',
  imageUrl: 'https://www.fitnesssuperstore.co.uk/images/excite-run-gym.jpg',
  width: 900,
  height: 700,
}

const peopleScored = scoreTechnogymImageCandidate(peopleCandidate, exciteProduct)
assert(peopleScored.warnings.includes('contains_people'), 'People in image flagged')

const technogymMetadata = resolveTechnogymImageImportMetadata({
  imageUrl: 'https://cdn.example/technogym/excite.jpg',
  storagePath: 'technogym/excite.jpg',
  sourceUrl: 'https://www.fitkituk.com/excite-run-700',
  scoreResult: exciteScored,
})
assert(
  technogymMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  'Technogym images are suggested not auto-approved',
)

assert(
  buildEquipmentProductImageSearchQueries(elementProduct)[0].includes('Technogym'),
  'Shared query builder uses Technogym rules',
)

console.log('technogym product image search tests passed')
