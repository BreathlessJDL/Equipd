import {
  rankEquipmentByPriority,
  rankSearchGroupsByPriority,
  type PriorityEquipmentInput,
} from './intelligencePrioritySync.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const lifeFitness95Ti: PriorityEquipmentInput = {
  id: 'lf-95ti',
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti',
  equipment_type: 'Treadmill',
}

const lf95TiScore = rankEquipmentByPriority([lifeFitness95Ti], 1)[0]
assert(lf95TiScore.popularity_score >= 80, `95Ti treadmill should rank highly, got ${lf95TiScore.popularity_score}`)
assert(lf95TiScore.reason.includes('Life Fitness'), 'reason should mention brand')
assert(lf95TiScore.reason.includes('95Ti') || lf95TiScore.reason.includes('treadmill'), 'reason should mention model or equipment')

const concept2ModelD: PriorityEquipmentInput = {
  id: 'c2-d',
  brand: 'Concept2',
  series: 'Indoor Rower',
  model: 'Model D',
  equipment_type: 'Rower',
}

const c2Score = rankEquipmentByPriority([concept2ModelD], 1)[0]
assert(c2Score.popularity_score >= 70, `Concept2 Model D should rank highly, got ${c2Score.popularity_score}`)

const partsListing: PriorityEquipmentInput = {
  id: 'parts',
  brand: 'Life Fitness',
  series: 'Console',
  model: '95Ti Console Only Replacement',
  equipment_type: 'Treadmill',
}

const partsScore = rankEquipmentByPriority([partsListing], 1)[0]
assert(
  partsScore.popularity_score < lf95TiScore.popularity_score,
  'parts/console variant row should score lower than complete 95Ti',
)

const obscureBrand: PriorityEquipmentInput = {
  id: 'obscure',
  brand: 'Unknown Brand',
  series: null,
  model: 'Generic Trainer',
  equipment_type: 'Multi Gym',
}

const obscureScore = rankEquipmentByPriority([obscureBrand], 1)[0]
assert(obscureScore.popularity_score < 30, `obscure row should score low, got ${obscureScore.popularity_score}`)

const ranked = rankEquipmentByPriority(
  [obscureBrand, partsListing, concept2ModelD, lifeFitness95Ti],
  3,
)
assert(ranked.length === 3, 'limit should cap results')
assert(ranked[0].rank === 1 && ranked[0].equipment_id === 'lf-95ti', '95Ti should be top ranked')

const duplicate95TiRows: PriorityEquipmentInput[] = [
  {
    id: 'lf-95ti-1',
    brand: 'Life Fitness',
    series: 'Integrity',
    model: '95Ti',
    equipment_type: 'Treadmill',
    slug: 'life-fitness-95ti-1',
  },
  {
    id: 'lf-95ti-2',
    brand: 'Life Fitness',
    series: 'Integrity',
    model: '95Ti (2015-2018)',
    equipment_type: 'Treadmill',
    slug: 'life-fitness-95ti-2',
  },
  {
    id: 'c2-d',
    brand: 'Concept2',
    series: 'Indoor Rower',
    model: 'Model D',
    equipment_type: 'Rower',
    slug: 'concept2-model-d',
  },
]

const grouped = rankSearchGroupsByPriority(duplicate95TiRows, 10)
assert(grouped.length === 2, 'duplicate 95Ti rows should collapse to two search groups')
assert(grouped[0].member_count === 2, 'top 95Ti group should include both duplicate rows')
assert(grouped[0].equipment_ids.length === 2, 'group should expose both equipment ids')
assert(grouped[0].primary_keyword.toLowerCase().includes('95ti'), 'group keyword should include 95Ti')

console.log('intelligencePrioritySync tests passed')
