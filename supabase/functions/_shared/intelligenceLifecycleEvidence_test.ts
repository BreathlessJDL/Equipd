import {
  buildTrustedDealerLifecycleEvidence,
  buildV3TargetedLifecycleQueries,
  extractLifecycleEvidenceFromText,
  finalizeV3LifecycleRecommendation,
  mergeLifecycleEvidence,
  resolveBaselineFromLifecycleEvidence,
} from './intelligenceLifecycleEvidence.ts'
import { buildStructuredProductContext } from './intelligenceStructuredEvidence.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const discoverCrosstrainer = buildStructuredProductContext({
  brand: 'Life Fitness',
  series: 'Discover ST Console (2019>)',
  model: 'Crosstrainer',
  equipment_type: 'Cross Trainer',
  product_family: 'Discover',
  core_product_name: 'Discover Crosstrainer',
})

const fitkitSource = {
  sourceUrl: 'https://www.fitkituk.com/life-fitness-discover-crosstrainer',
  sourceDomain: 'fitkituk.com',
  sourceType: 'dealer_catalogue' as const,
  brand: 'Life Fitness',
}

const launch2012Text = 'Life Fitness Discover Crosstrainer timeline. Initial launch of Discover SE and SI consoles in 2012.'
const launchItems = extractLifecycleEvidenceFromText(launch2012Text, fitkitSource, discoverCrosstrainer)
assert(
  launchItems.some((item) => item.year === 2012 && item.affectsBaseline),
  'should extract 2012 from initial launch of Discover SE and SI consoles',
)

const consoleUpgradeText = 'Introduction of upgraded Discover SE3 and SE3HD consoles 2016-2019 for the Discover Crosstrainer line.'
const consoleItems = extractLifecycleEvidenceFromText(consoleUpgradeText, fitkitSource, discoverCrosstrainer)
assert(
  consoleItems.some((item) => item.year === 2016 && item.yearEnd === 2019),
  'should extract 2016-2019 console upgrade period',
)
const consoleUpgrade = consoleItems.find((item) => item.year === 2016 && item.yearEnd === 2019)
assert(
  consoleUpgrade?.affectsBaseline === false,
  'console upgrade period should not affect baseline year directly',
)

const combined = mergeLifecycleEvidence(launchItems, consoleItems)
const resolved = resolveBaselineFromLifecycleEvidence(combined)
assert(
  resolved.baselineManufactureYear === 2012,
  'baseline should use 2012 platform launch, not 2016 console upgrade',
)
assert(
  resolved.productionEndYear == null,
  'should not set production_end_year from console upgrade period',
)
assert(
  resolved.lifecycleNotes.includes('Console timeline'),
  'lifecycle notes should mention console timeline evidence',
)

const dealerSnippetHit = {
  intent: 'fitkit_rrp',
  query: 'site:fitkituk.com "Life Fitness Discover Crosstrainer"',
  title: 'Life Fitness Discover Crosstrainer | FitKit UK',
  url: 'https://www.fitkituk.com/life-fitness-discover-crosstrainer',
  snippet: 'Discover platform launched in 2012. Latest Discover SE3 consoles introduced 2016-2019.',
  position: 1,
  domain: 'fitkituk.com',
  source_type: 'dealer_catalogue' as const,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const dealerLifecycle = buildTrustedDealerLifecycleEvidence([dealerSnippetHit], {
  id: 'lf-discover',
  brand: 'Life Fitness',
  series: 'Discover ST Console (2019>)',
  model: 'Crosstrainer',
  slug: 'life-fitness-discover-crosstrainer',
  equipment_type: 'Cross Trainer',
  product_family: 'Discover',
  core_product_name: 'Discover Crosstrainer',
})
assert(
  dealerLifecycle.some((item) => item.year === 2012),
  'should use trusted dealer snippet lifecycle evidence when official evidence unavailable',
)

const presentText = 'Life Fitness Discover Crosstrainer remains the latest iteration of the Discover cardio line (2019>).'
const presentItems = extractLifecycleEvidenceFromText(presentText, fitkitSource, discoverCrosstrainer)
const presentResolved = resolveBaselineFromLifecycleEvidence(
  mergeLifecycleEvidence(launchItems, presentItems),
)
assert(
  presentResolved.productionEndYear == null,
  'present/latest iteration wording should not imply production end year',
)

const targetedQueries = buildV3TargetedLifecycleQueries({
  id: 'lf-discover',
  brand: 'Life Fitness',
  series: 'Discover ST Console (2019>)',
  model: 'Crosstrainer',
  slug: 'life-fitness-discover-crosstrainer',
  equipment_type: 'Cross Trainer',
  core_product_name: 'Discover Crosstrainer',
})
assert(
  targetedQueries.includes('"Life Fitness Discover Crosstrainer" "2012"'),
  'should include targeted 2012 lifecycle query',
)
assert(
  targetedQueries.some((query) => query.includes('site:fitkituk.com') && query.includes('SE3HD')),
  'should include targeted FitKit SE3HD lifecycle query',
)

const inventedOpenAi = finalizeV3LifecycleRecommendation({
  original_new_price: 8995,
  currency: 'GBP',
  price_confidence: 90,
  price_reasoning: 'test',
  price_sources_used: [],
  production_start_year: 2019,
  production_end_year: null,
  production_confidence: 0,
  production_reasoning: 'guessed from series',
  production_sources_used: [],
  baseline_manufacture_year: 2019,
  lifecycle_confidence: 0,
  lifecycle_notes: null,
  confidence: 90,
  confidence_reasoning: 'test',
  reasoning: 'test',
  supporting_urls: [],
  supporting_sources: [],
}, [])

assert(
  inventedOpenAi.baseline_manufacture_year == null,
  'should not keep OpenAI-invented baseline when structured lifecycle evidence is empty',
)
assert(
  inventedOpenAi.production_start_year == null,
  'should clear production_start_year when no structured lifecycle evidence',
)

const withEvidence = finalizeV3LifecycleRecommendation(inventedOpenAi, combined)
assert(
  withEvidence.baseline_manufacture_year === 2012,
  'should set baseline from structured lifecycle evidence when credible items exist',
)

console.log('lifecycle evidence tests passed')
