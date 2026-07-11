import {
  analyzeEquipmentSearchGroups,
  buildSearchGroupDescriptor,
  normalizeEquipmentForSearchGroup,
} from './intelligenceEbaySearchGroups.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const technogymSkillMillRows = [
  {
    id: 'tg-1',
    brand: 'Technogym',
    series: null,
    model: 'SkillMill Connect',
    equipment_type: 'Treadmill',
    slug: 'technogym-skillmill-connect-2018',
    manufacture_year: 2018,
  },
  {
    id: 'tg-2',
    brand: 'Technogym',
    series: null,
    model: 'SkillMill Connect',
    equipment_type: 'Treadmill',
    slug: 'technogym-skillmill-connect-2019',
    manufacture_year: 2019,
  },
  {
    id: 'tg-3',
    brand: 'Technogym',
    series: null,
    model: 'SkillMill Connect (2017-2019)',
    equipment_type: 'Treadmill',
    slug: 'technogym-skillmill-connect-range',
    manufacture_year: 2017,
  },
]

const technogymAnalysis = analyzeEquipmentSearchGroups(technogymSkillMillRows)
assert(
  technogymAnalysis.unique_descriptor_groups === 1,
  'year variants should collapse to one descriptor group',
)
assert(
  technogymAnalysis.unique_primary_keywords === 1,
  'year variants should share one primary keyword',
)
assert(
  technogymAnalysis.largest_descriptor_groups[0].member_count === 3,
  'descriptor group should include all three rows',
)

const lifeFitnessRows = [
  {
    id: 'lf-1',
    brand: 'Life Fitness',
    series: 'Integrity',
    model: '95Ti',
    equipment_type: 'Treadmill',
    slug: 'life-fitness-95ti-treadmill',
  },
  {
    id: 'lf-2',
    brand: 'Life Fitness',
    series: 'Integrity',
    model: '95Ti',
    equipment_type: 'Treadmill',
    slug: 'life-fitness-95ti-console',
  },
]

const lifeFitnessDescriptor = buildSearchGroupDescriptor(lifeFitnessRows[0])
assert(
  lifeFitnessDescriptor.primary_keyword.includes('Life Fitness'),
  'primary keyword should include brand',
)
assert(
  lifeFitnessDescriptor.primary_keyword.includes('95Ti'),
  'primary keyword should include model',
)

const lifeFitnessAnalysis = analyzeEquipmentSearchGroups(lifeFitnessRows)
assert(
  lifeFitnessAnalysis.unique_primary_keywords === 1,
  'identical keyword rows should dedupe to one search',
)

const differentTypeRows = [
  {
    id: 'mx-1',
    brand: 'Matrix',
    series: 'Ultimate',
    model: 'T7xi',
    equipment_type: 'Treadmill',
    slug: 'matrix-t7xi-treadmill',
  },
  {
    id: 'mx-2',
    brand: 'Matrix',
    series: 'Ultimate',
    model: 'T7xi',
    equipment_type: 'Elliptical',
    slug: 'matrix-t7xi-elliptical',
  },
]

const differentTypeAnalysis = analyzeEquipmentSearchGroups(differentTypeRows)
assert(
  differentTypeAnalysis.unique_descriptor_groups === 2,
  'different equipment types should remain separate descriptor groups',
)
assert(
  differentTypeAnalysis.unique_primary_keywords === 1,
  'same brand/series/model keyword should still dedupe Apify searches',
)

const normalized = normalizeEquipmentForSearchGroup({
  id: 'year-range',
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti (2015-2018)',
  equipment_type: 'Treadmill',
  slug: 'life-fitness-95ti-range',
  manufacture_year: 2016,
})
assert(
  normalized.model === '95Ti',
  'year range in model should be stripped for grouping',
)

const savingsAnalysis = analyzeEquipmentSearchGroups([
  ...technogymSkillMillRows,
  ...lifeFitnessRows,
  ...differentTypeRows,
])
assert(
  savingsAnalysis.current_apify_searches_required === 7,
  'current search count should equal row count',
)
assert(
  savingsAnalysis.deduped_apify_searches_required === 3,
  'deduped search count should equal unique keywords',
)
assert(
  savingsAnalysis.apify_search_savings === 4,
  'savings should be rows minus unique keywords',
)

console.log('intelligenceEbaySearchGroups tests passed')
