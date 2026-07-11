import {
  buildFastTrustedSourceQueries,
  FAST_TRUSTED_RESEARCH_DOMAINS,
  resolveFastCanonicalSearchName,
} from './intelligenceEquipmentResearchFast.ts'
import { freezeCanonicalProductIdentity } from './intelligenceProductIdentity.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const identity = freezeCanonicalProductIdentity({
  brand: 'Life Fitness',
  productFamily: 'Elevation',
  model: 'Crosstrainer',
  equipmentType: 'Cross Trainer',
  canonicalProductName: 'Life Fitness Elevation Crosstrainer',
})

const queries = buildFastTrustedSourceQueries(identity.canonicalProductName)

assert(queries.length === FAST_TRUSTED_RESEARCH_DOMAINS.length, 'one query per trusted domain')
assert(
  queries.every((query) => query.includes('site:') && query.includes('"Life Fitness Elevation Crosstrainer"')),
  'queries should use quoted canonical product name',
)
assert(
  queries.includes('site:fitkituk.com "Life Fitness Elevation Crosstrainer"'),
  'fitkituk query format',
)
assert(
  queries.includes('site:lifefitness.com "Life Fitness Elevation Crosstrainer"'),
  'lifefitness.com query format',
)

const resolvedName = resolveFastCanonicalSearchName(
  {
    id: 'x',
    brand: 'Life Fitness',
    series: 'Elevation - Achieve',
    model: 'Crosstrainer',
    slug: 'lf-elevation-crosstrainer',
    equipment_type: 'Cross Trainer',
  },
  identity,
)

assert(
  resolvedName === 'Life Fitness Elevation Crosstrainer',
  'fast search should use canonical product name',
)

console.log('equipment research fast tests passed')
