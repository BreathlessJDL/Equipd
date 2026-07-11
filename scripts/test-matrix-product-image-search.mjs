/**
 * Matrix Fitness product image search ranking tests.
 */

import {
  buildMatrixImageSearchQueries,
  detectMatrixProductFamily,
  productMatchesMatrixLineFilter,
  rankMatrixImageCandidates,
  resolveMatrixImageImportMetadata,
  scoreMatrixImageCandidate,
} from '../src/lib/matrixProductImageSearch.js'
import { buildEquipmentProductImageSearchQueries } from '../src/lib/equipmentProductImages.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const ultraProduct = {
  brand: 'Matrix Fitness',
  product_family: 'G7 Strength (ultra)',
  model: 'Leg Press',
  canonical_product_name: 'Matrix Fitness G7 Strength (ultra) Leg Press',
  equipment_type: 'Leg Press',
}

const auraProduct = {
  brand: 'Matrix Fitness',
  product_family: 'G3 Strength (aura)',
  model: 'Chest Press',
  canonical_product_name: 'Matrix Fitness G3 Strength (aura) Chest Press',
  equipment_type: 'Chest Press',
}

const treadmillProduct = {
  brand: 'Matrix Fitness',
  product_family: 'T7x',
  model: 'Treadmill',
  canonical_product_name: 'Matrix Fitness T7x Treadmill',
  equipment_type: 'Treadmill',
}

const climbmillProduct = {
  brand: 'Matrix Fitness',
  product_family: 'C7x',
  model: 'Climbmill',
  canonical_product_name: 'Matrix Fitness C7x Climbmill',
  equipment_type: 'Stepper/Stair Climber',
}

assert(detectMatrixProductFamily(ultraProduct) === 'ultra_series', 'Ultra family detected')
assert(detectMatrixProductFamily(auraProduct) === 'aura_series', 'Aura family detected')
assert(detectMatrixProductFamily(treadmillProduct) === 'treadmill', 'Treadmill family detected')
assert(detectMatrixProductFamily(climbmillProduct) === 'climbmill', 'ClimbMill family detected')

assert(
  buildMatrixImageSearchQueries(ultraProduct)[0].includes('Ultra Series'),
  'Ultra search query includes family label',
)
assert(
  buildMatrixImageSearchQueries(treadmillProduct)[0].includes('T7x'),
  'Treadmill search query includes model code',
)
assert(
  !buildMatrixImageSearchQueries(ultraProduct)[0].includes('gym equipment product'),
  'Matrix query avoids broad gym equipment suffix',
)

const ultraCandidate = {
  title: 'Matrix Ultra Series Leg Press',
  sourceUrl: 'https://www.matrixfitness.com/ultra-leg-press',
  imageUrl: 'https://www.matrixfitness.com/images/ultra-leg-press.jpg',
  width: 900,
  height: 700,
}

const auraWrongFamilyCandidate = {
  title: 'Matrix Aura Series Chest Press',
  sourceUrl: 'https://www.matrixfitness.com/aura-chest-press',
  imageUrl: 'https://www.matrixfitness.com/images/aura-chest-press.jpg',
  width: 900,
  height: 700,
}

const ultraRanked = rankMatrixImageCandidates([auraWrongFamilyCandidate, ultraCandidate], ultraProduct)
assert(
  ultraRanked[0].candidate.title.includes('Ultra'),
  'Ultra product prefers Ultra family image',
)

const consoleCandidate = {
  title: 'Matrix T7x XR console touchscreen close-up',
  sourceUrl: 'https://www.matrixfitness.com/t7x-xr-console',
  imageUrl: 'https://www.matrixfitness.com/images/t7x-console.jpg',
  width: 500,
  height: 500,
}

const consoleScored = scoreMatrixImageCandidate(consoleCandidate, treadmillProduct)
assert(
  consoleScored.warnings.includes('console_only_or_close_up'),
  'Console-only Matrix image penalized',
)

const peopleCandidate = {
  title: 'Woman exercising on Matrix T7x treadmill in gym',
  sourceUrl: 'https://www.matrixfitness.com/t7x-gym',
  imageUrl: 'https://www.matrixfitness.com/images/t7x-gym.jpg',
  width: 900,
  height: 700,
}

const peopleScored = scoreMatrixImageCandidate(peopleCandidate, treadmillProduct)
assert(peopleScored.warnings.includes('contains_people'), 'People in Matrix image flagged')

const wrongModelCandidate = {
  title: 'Matrix A7xe Ascent Trainer',
  sourceUrl: 'https://www.fitnesssuperstore.com/matrix-a7xe-ascent',
  imageUrl: 'https://www.fitnesssuperstore.com/matrix-a7xe-ascent.jpg',
  width: 900,
  height: 700,
}

const ascentProduct = {
  brand: 'Matrix Fitness',
  product_family: 'A1x',
  model: 'Ascent',
  canonical_product_name: 'Matrix Fitness A1x Ascent',
  equipment_type: null,
}

const wrongModelScored = scoreMatrixImageCandidate(wrongModelCandidate, ascentProduct)
assert(wrongModelScored.score === 0, 'A1x vs A7xe score is 0')
assert(wrongModelScored.rejection?.reject, 'A1x product rejects A7xe model image')
assert(
  wrongModelScored.rejection?.reason === 'conflicting_product_identity'
    || wrongModelScored.warnings.some((warning) => warning.includes('A7xe')),
  'A1x product rejects A7xe via identity conflict',
)

const matrixMetadata = resolveMatrixImageImportMetadata({
  imageUrl: 'https://cdn.example/matrix/t7x.jpg',
  storagePath: 'matrix-fitness/t7x.jpg',
  sourceUrl: 'https://www.matrixfitness.com/t7x-treadmill',
  scoreResult: scoreMatrixImageCandidate(ultraCandidate, ultraProduct),
})
assert(
  matrixMetadata.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  'Matrix images are suggested not auto-approved',
)

assert(
  productMatchesMatrixLineFilter(ultraProduct, 'Ultra Series'),
  'Ultra Series line filter matches ultra products',
)
assert(
  productMatchesMatrixLineFilter(treadmillProduct, '7x'),
  '7x line filter matches T7x treadmill',
)
assert(
  !productMatchesMatrixLineFilter(ultraProduct, '7x'),
  '7x line filter excludes G7 ultra strength',
)

assert(
  buildEquipmentProductImageSearchQueries(climbmillProduct)[0].includes('C7x'),
  'Shared query builder uses Matrix rules and retains model code',
)

console.log('matrix product image search tests passed')
