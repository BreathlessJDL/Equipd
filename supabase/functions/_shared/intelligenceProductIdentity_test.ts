import {
  freezeCanonicalProductIdentity,
  IDENTITY_MATCH_LEVEL,
  isIdentityStrongEnoughForExtraction,
  scoreProductIdentity,
} from './intelligenceProductIdentity.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const elevationCrosstrainer = freezeCanonicalProductIdentity({
  brand: 'Life Fitness',
  productFamily: 'Elevation',
  model: 'Crosstrainer',
  equipmentType: 'Crosstrainer',
  canonicalProductName: 'Life Fitness Elevation Crosstrainer',
})

const exact = scoreProductIdentity(
  'Life Fitness Elevation Crosstrainer RRP £10,995',
  elevationCrosstrainer,
)
assert(exact.level === IDENTITY_MATCH_LEVEL.EXACT, 'exact canonical product name should be exact match')
assert(isIdentityStrongEnoughForExtraction(exact), 'exact match should be extractable')

for (const [variant, haystack] of [
  ['Achieve', 'Life Fitness Elevation Achieve Crosstrainer RRP £10,995'],
  ['Engage', 'Life Fitness Elevation Engage Crosstrainer list price £8,500'],
  ['Inspire', 'Life Fitness Elevation Inspire Crosstrainer brochure'],
] as const) {
  const scored = scoreProductIdentity(haystack, elevationCrosstrainer)
  assert(
    isIdentityStrongEnoughForExtraction(scored),
    `${variant} console source should be extractable for Elevation Crosstrainer`,
  )
  assert(
    scored.level === IDENTITY_MATCH_LEVEL.EXACT
      || scored.level === IDENTITY_MATCH_LEVEL.POSSIBLY_RELATED,
    `${variant} console source should score as exact or possibly related`,
  )
}

const possiblyRelated = scoreProductIdentity(
  'Life Fitness Elevation Crosstrainer list price £8,500',
  elevationCrosstrainer,
)
assert(
  possiblyRelated.level === IDENTITY_MATCH_LEVEL.POSSIBLY_RELATED
  || possiblyRelated.level === IDENTITY_MATCH_LEVEL.EXACT,
  'elevation crosstrainer without console variant should be possibly related or exact',
)
assert(
  possiblyRelated.score >= 65,
  'missing console variant should still score as related',
)

const weakDiscover = scoreProductIdentity(
  'Life Fitness Discover Crosstrainer RRP £7,500',
  elevationCrosstrainer,
)
assert(
  weakDiscover.level === IDENTITY_MATCH_LEVEL.WEAK
  || weakDiscover.level === IDENTITY_MATCH_LEVEL.REJECT,
  'discover crosstrainer should be weak or reject for elevation crosstrainer',
)
assert(
  !isIdentityStrongEnoughForExtraction(weakDiscover),
  'discover family evidence must not be extracted for elevation crosstrainer',
)

const reject95xs = scoreProductIdentity(
  'Life Fitness 95XS Discover SI Crosstrainer',
  elevationCrosstrainer,
)
assert(
  reject95xs.level === IDENTITY_MATCH_LEVEL.REJECT
  || reject95xs.level === IDENTITY_MATCH_LEVEL.WEAK,
  '95XS discover SI should be rejected or weak',
)
assert(
  !isIdentityStrongEnoughForExtraction(reject95xs),
  'alien model family page must not be extracted',
)

const brandOnly = scoreProductIdentity(
  'Life Fitness commercial cardio catalogue 2024',
  elevationCrosstrainer,
)
assert(
  brandOnly.score < 65,
  'brand-only pages should not pass identity threshold',
)

console.log('product identity tests passed')
