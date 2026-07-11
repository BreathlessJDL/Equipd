import {
  buildEquipmentResearchSearchPhrase,
} from './intelligenceEquipmentResearch.ts'
import {
  buildTrustedSnippetReviewEvidence,
  buildV3TrustedDealerPriceQueries,
  buildV3TrustedSourceSummary,
  collectSnippetOnlyStructuredEvidence,
  isSourceFirstCommercialBrand,
  prioritizeTrustedDealerHits,
  quoteResearchPhrase,
  trustedDealerPriceSignalsSufficient,
} from './intelligenceEquipmentResearchSourceFirst.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const discoverCrosstrainer = {
  id: 'lf-discover-x',
  brand: 'Life Fitness',
  series: 'Discover ST Console (2019>)',
  model: 'Crosstrainer',
  slug: 'life-fitness-discover-crosstrainer',
  equipment_type: 'Cross Trainer',
  core_product_name: 'Discover Crosstrainer',
}

assert(
  buildEquipmentResearchSearchPhrase(discoverCrosstrainer) === 'Life Fitness Discover Crosstrainer',
  'generic model should use core product name in search phrase',
)

assert(isSourceFirstCommercialBrand('Life Fitness'), 'Life Fitness should use source-first strategy')

const trustedQueries = buildV3TrustedDealerPriceQueries(discoverCrosstrainer)
const quotedPhrase = quoteResearchPhrase('Life Fitness Discover Crosstrainer')

assert(
  trustedQueries.includes(`site:fitkituk.com ${quotedPhrase} RRP`),
  'should include FitKit RRP site query',
)
assert(
  trustedQueries.includes(`site:fitkituk.com ${quotedPhrase} "Life Fitness"`),
  'should include FitKit brand confirm site query',
)
assert(
  trustedQueries.includes(`site:fitshop.co.uk ${quotedPhrase}`),
  'should include Fitshop product site query',
)
assert(
  trustedQueries.includes(`site:pinnaclefitness.org.uk ${quotedPhrase}`),
  'should include Pinnacle site query',
)
assert(
  trustedQueries.includes(`site:fitness-superstore.co.uk ${quotedPhrase}`),
  'should include Fitness Superstore site query',
)
assert(
  trustedQueries.includes(`site:powerhouse-fitness.co.uk ${quotedPhrase}`),
  'should include Powerhouse site query',
)
assert(
  trustedQueries.includes(`site:amazonleisure.co.uk ${quotedPhrase}`),
  'should include Amazon Leisure site query',
)
assert(trustedQueries.length === 7, 'should build seven trusted dealer queries')

const fitkitHit = {
  intent: 'fitkit_rrp',
  query: trustedQueries[0],
  title: 'Life Fitness Discover Crosstrainer | FitKit UK',
  url: 'https://www.fitkituk.com/life-fitness-discover-crosstrainer',
  snippet: 'Life Fitness Discover Crosstrainer. RRP £8,995. Our Price £7,450.',
  position: 1,
  domain: 'fitkituk.com',
  source_type: 'dealer_catalogue' as const,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const superstoreHit = {
  ...fitkitHit,
  intent: 'fitness_superstore_list',
  query: `site:fitness-superstore.co.uk ${quotedPhrase}`,
  title: 'Life Fitness Discover Crosstrainer',
  url: 'https://www.fitness-superstore.co.uk/life-fitness-discover-crosstrainer',
  snippet: 'List Price £8,995',
  domain: 'fitness-superstore.co.uk',
  position: 1,
}

const ranked = prioritizeTrustedDealerHits(
  [
    { ...fitkitHit, combined_rank_score: 10 },
    { ...superstoreHit, combined_rank_score: 20 },
  ],
  'Life Fitness',
)

assert(
  ranked[0].domain === 'fitkituk.com' || ranked[0].domain === 'fitness-superstore.co.uk',
  'trusted priority dealers should rank ahead of generic sources',
)

const snippetEvidence = collectSnippetOnlyStructuredEvidence([fitkitHit], discoverCrosstrainer)
assert(
  snippetEvidence.some((item) => item.label === 'RRP' && item.value === 8995),
  'should extract RRP from trusted dealer snippet before page fetch',
)

assert(
  trustedDealerPriceSignalsSufficient([fitkitHit], snippetEvidence),
  'single trusted RRP snippet should be sufficient to skip broad search',
)

const reviewEvidence = buildTrustedSnippetReviewEvidence([fitkitHit], discoverCrosstrainer)
assert(reviewEvidence.length > 0, 'trusted snippet review evidence should be available for OpenAI')

const summary = buildV3TrustedSourceSummary(
  trustedQueries,
  [fitkitHit, superstoreHit],
  snippetEvidence,
  new Set([fitkitHit.url]),
)

const fitkitSummary = summary.find((entry) => entry.domain === 'fitkituk.com')
assert(fitkitSummary?.hits_returned === 1, 'FitKit summary should show returned hit')
assert(fitkitSummary?.snippet_price_signals === true, 'FitKit summary should show snippet price signals')
assert(fitkitSummary?.page_fetched === true, 'FitKit summary should show page fetched when applicable')
assert(
  (fitkitSummary?.evidence_labels.length ?? 0) > 0,
  'FitKit summary should list evidence labels',
)

console.log('equipment research source-first tests passed')
