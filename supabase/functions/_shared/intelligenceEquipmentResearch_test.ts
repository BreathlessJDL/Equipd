import {
  buildEquipmentResearchPhrases,
  buildEquipmentResearchQueries,
  buildEquipmentLifecycleResearchQueries,
  buildEquipmentSpecialistSupportResearchQueries,
  buildEquipmentResearchSearchPhrase,
  buildAiResearchPrompt,
  classifyResearchSourceType,
  classifyLifecycleResearchSourceType,
  collectEquipmentResearchEvidence,
  compareLifecycleResearchStrategies,
  dedupeSerpResearchHits,
  MAX_RESEARCH_SEARCH_QUERIES,
  MAX_LIFECYCLE_SEARCH_QUERIES,
  MAX_SPECIALIST_SUPPORT_SEARCH_QUERIES,
  isSpecialistSupportDomain,
  parseEquipmentResearchRecommendation,
  rankResearchHits,
  rankLifecycleResearchHits,
  RESEARCH_STAGE1_AI_SOURCES,
  RESEARCH_STAGE1_CONFIDENCE_THRESHOLD,
  scorePriceRelevance,
  scoreProductionRelevance,
  scoreResearchHitCombinedRank,
  selectDiverseResearchHitsForAi,
  selectOriginalPriceResearchHitsForAi,
  selectLifecycleResearchHitsForAi,
  isResalePricingSource,
  filterOriginalPriceResearchHits,
  extractHistoricalPriceEvidence,
  extractPriceCandidates,
  buildPriceCandidateDebug,
  isTrustedCommercialFitnessRetailerDomain,
  isTrustedRetailerHistoricalReference,
  scorePriceSourceHierarchy,
  enrichResearchHitHistoricalEvidence,
  isUsedRefurbDealerDomain,
  hasHistoricalRrpSignals,
  hasHistoricalLifecycleSignals,
  isMarketplaceResaleDomain,
  isMarketplaceResalePriceSource,
  buildPriceSourceClassificationDebug,
  hasCatalogueOriginalPriceSignals,
  shouldRunStage2Enrichment,
  stripTrailingEquipmentType,
  hitsToResearchSupportingSources,
  buildOpenAiRequestPayload,
  buildSerpPartialWarning,
  collectSerpResearchHits,
  SERPAPI_REQUEST_TIMEOUT_MS,
  OPENAI_REQUEST_TIMEOUT_MS,
  OPENAI_PROMPT_TRIM_CHAR_THRESHOLD,
  EXTERNAL_REQUEST_TIMEOUT_MS,
  formatOpenAiTimeoutError,
  estimateEquipmentResearchOpenAiPromptChars,
  trimLifecycleHitsForOpenAiPrompt,
  buildOpenAiPromptSizeLog,
  analyzePriceCurrencyEvidence,
  finalizeResearchPriceRecommendation,
  NON_GBP_VERIFIED_CONFIDENCE_CAP,
  USD_ONLY_RESEARCH_CONFIDENCE_CAP,
  isOfficialManufacturerPriceSource,
  isDealerSalePriceOnly,
  buildOfficialPriceCurrencyFields,
  applyServerSidePriceCurrencyConversion,
  convertUsdToGbpResearch,
  USD_TO_GBP_RESEARCH_EXCHANGE_RATE,
} from './intelligenceEquipmentResearch.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

const sampleEquipment = {
  id: 'lf-95ti',
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti',
  slug: 'life-fitness-95ti',
  equipment_type: 'Treadmill',
}

const phrases = buildEquipmentResearchPhrases(sampleEquipment)
assert(phrases.primary === 'Life Fitness 95Ti', 'primary phrase should be brand + model')
assert(phrases.withSeries === 'Life Fitness Integrity 95Ti', 'series phrase should include series')

assert(
  stripTrailingEquipmentType('95Ti Treadmill', 'Treadmill') === '95Ti',
  'should strip trailing equipment type from model',
)
assert(
  buildEquipmentResearchSearchPhrase({
    ...sampleEquipment,
    model: '95Ti Treadmill',
    series: 'Silver Line',
  }) === 'Life Fitness 95Ti',
  'search phrase should use brand + model without equipment type',
)

const queries = buildEquipmentResearchQueries(sampleEquipment)
assert(queries.length === MAX_RESEARCH_SEARCH_QUERIES, 'should build eight price research queries')
assert(
  queries.includes('site:fitkituk.com Life Fitness 95Ti RRP'),
  'should include FitKit UK site RRP query',
)
assert(
  queries.includes('site:fitshop.co.uk Life Fitness 95Ti RRP'),
  'should include Fitshop site RRP query',
)
assert(
  queries.includes('site:fitness-superstore.co.uk Life Fitness 95Ti "List Price"'),
  'should include Fitness Superstore list price site query',
)
assert(
  queries.includes('site:pinnaclefitness.org.uk Life Fitness 95Ti RRP'),
  'should include Pinnacle Fitness site RRP query',
)
assert(
  queries.includes('site:amazonleisure.co.uk Life Fitness 95Ti RRP'),
  'should include Amazon Leisure site RRP query',
)
assert(
  queries.includes('site:powerhouse-fitness.co.uk Life Fitness 95Ti RRP'),
  'should include Powerhouse Fitness site RRP query',
)
assert(queries.includes('Life Fitness 95Ti MSRP'), 'should include MSRP query')
assert(queries.includes('Life Fitness 95Ti dealer RRP'), 'should include dealer RRP query')
assert(!queries.some((query) => query.includes('brochure')), 'price queries should not include brochure')
assert(!queries.some((query) => query.includes('filetype:pdf')), 'price queries should not include PDF filetype')
assert(!queries.some((query) => query.includes('Silver Line')), 'should not include series variants')

const lifecycleQueries = buildEquipmentLifecycleResearchQueries(sampleEquipment)
assert(lifecycleQueries.length === MAX_LIFECYCLE_SEARCH_QUERIES, 'should build five lifecycle queries')
assert(lifecycleQueries.includes('Life Fitness 95Ti production years'), 'should include production years query')
assert(lifecycleQueries.includes('Life Fitness 95Ti service manual'), 'should include service manual query')
assert(!lifecycleQueries.some((query) => query.includes('MSRP')), 'lifecycle queries should not include MSRP')

const specialistQueries = buildEquipmentSpecialistSupportResearchQueries(sampleEquipment)
assert(specialistQueries.length === MAX_SPECIALIST_SUPPORT_SEARCH_QUERIES, 'should build eight specialist support queries')
assert(specialistQueries.includes('Life Fitness 95Ti model history'), 'should include model history query')
assert(specialistQueries.includes('Life Fitness 95Ti timeline'), 'should include timeline query')
assert(specialistQueries.includes('Life Fitness 95Ti serial number'), 'should include serial number query')

assert(isSpecialistSupportDomain('sportsmith.com'), 'sportsmith.com should be specialist support domain')
assert(isSpecialistSupportDomain('www.sportsmith.com'), 'www.sportsmith.com should be specialist support domain')

const deduped = dedupeSerpResearchHits([
  {
    intent: 'brochure',
    query: 'q1',
    title: 'A',
    url: 'https://example.com/a',
    snippet: 'one',
    position: 1,
    domain: 'example.com',
    source_type: 'other',
    source_rank: 6,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'pdf',
    query: 'q2',
    title: 'A duplicate',
    url: 'https://example.com/a',
    snippet: 'two',
    position: 2,
    domain: 'example.com',
    source_type: 'other',
    source_rank: 6,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
])
assert(deduped.length === 1, 'duplicate URLs should be removed')

const ranked = rankResearchHits([
  {
    intent: 'dealer',
    query: 'q',
    title: 'Dealer listing',
    url: 'https://dealer.example.com/item',
    snippet: 'dealer',
    position: 2,
    domain: 'dealer.example.com',
    source_type: 'other',
    source_rank: 6,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'pdf',
    query: 'q',
    title: 'Official brochure',
    url: 'https://lifefitness.com/brochure.pdf',
    snippet: 'pdf',
    position: 1,
    domain: 'lifefitness.com',
    source_type: 'other',
    source_rank: 6,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
], 'Life Fitness')

const pdfClassified = ranked.find((hit) => hit.url.includes('brochure.pdf'))
assert(pdfClassified?.source_type === 'manufacturer_pdf', 'manufacturer brochure PDF should still classify correctly')

const maintenanceManual = {
  intent: 'pdf',
  query: 'Life Fitness 95Ti filetype:pdf',
  title: 'Life Fitness 95Ti Operation Manual',
  url: 'https://lifefitness.com/95ti-operation-manual.pdf',
  snippet: 'operation manual preventive maintenance',
  position: 1,
  domain: 'lifefitness.com',
  source_type: 'other' as const,
  source_rank: 6,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const dealerProductPage = {
  intent: 'dealer',
  query: 'Life Fitness 95Ti dealer',
  title: 'Life Fitness 95Ti Commercial Treadmill - Buy',
  url: 'https://fitness-superstore.co.uk/life-fitness-95ti-commercial-treadmill.html',
  snippet: 'retail pricing dealer buy now',
  position: 2,
  domain: 'fitness-superstore.co.uk',
  source_type: 'other' as const,
  source_rank: 6,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const maintenanceScores = scoreResearchHitCombinedRank(maintenanceManual, 'manufacturer_pdf')
assert(maintenanceScores.authority_score === 2, 'manufacturer PDF without price should have low authority for price research')
assert(maintenanceScores.price_relevance_score <= -4, 'maintenance manual should penalise price relevance')
assert(
  maintenanceScores.combined_rank_score < scoreResearchHitCombinedRank(dealerProductPage, 'dealer_catalogue').combined_rank_score,
  'dealer product page should outrank manufacturer maintenance manual',
)

const relevanceRanked = rankResearchHits([maintenanceManual, dealerProductPage], 'Life Fitness')
assert(
  relevanceRanked[0].url.includes('fitness-superstore.co.uk'),
  'dealer product page should rank above maintenance manual',
)
assert(
  (relevanceRanked[0].combined_rank_score ?? 0) > (relevanceRanked[1].combined_rank_score ?? 0),
  'combined relevance score should prefer dealer product page',
)

const diverseHits = selectDiverseResearchHitsForAi([
  {
    intent: 'brochure',
    query: 'q',
    title: 'Superstore page A',
    url: 'https://www.fitness-superstore.co.uk/life-fitness-95ti-a',
    snippet: 'buy retail pricing dealer',
    position: 1,
    domain: 'fitness-superstore.co.uk',
    source_type: 'dealer_catalogue',
    source_rank: 4,
    combined_rank_score: 18,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'msrp',
    query: 'q',
    title: 'Superstore page B',
    url: 'https://www.fitness-superstore.co.uk/life-fitness-95ti-b',
    snippet: 'msrp',
    position: 2,
    domain: 'fitness-superstore.co.uk',
    source_type: 'dealer_catalogue',
    source_rank: 4,
    combined_rank_score: 12,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'pdf',
    query: 'q',
    title: 'Manual PDF',
    url: 'https://coloradocardio.com/manual.pdf',
    snippet: 'operation manual',
    position: 1,
    domain: 'coloradocardio.com',
    source_type: 'dealer_catalogue',
    source_rank: 4,
    combined_rank_score: 14,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'distributor',
    query: 'q',
    title: 'Distributor',
    url: 'https://www.lifefitness.com/en-gb/find-a-distributor',
    snippet: 'distributor',
    position: 1,
    domain: 'lifefitness.com',
    source_type: 'manufacturer_website',
    source_rank: 2,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'dealer',
    query: 'q',
    title: 'eBay listing',
    url: 'https://www.ebay.co.uk/itm/123',
    snippet: 'dealer',
    position: 1,
    domain: 'ebay.co.uk',
    source_type: 'dealer_catalogue',
    source_rank: 4,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
  {
    intent: 'archive',
    query: 'q',
    title: 'Archive',
    url: 'https://web.archive.org/example',
    snippet: 'archive',
    position: 1,
    domain: 'web.archive.org',
    source_type: 'archived_website',
    source_rank: 5,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
])
assert(diverseHits.length === 5, 'should cap diverse AI sources at five')
assert(
  diverseHits.filter((hit) => hit.domain === 'fitness-superstore.co.uk').length === 1,
  'should keep only one result per domain',
)
assert(
  diverseHits[0].url.includes('fitness-superstore.co.uk/life-fitness-95ti-a'),
  'should keep highest-ranked result within a domain',
)

const usedDealerListing = {
  intent: 'dealer',
  query: 'Life Fitness 95Ti dealer',
  title: 'Used Life Fitness 95Ti Treadmill - Refurbished',
  url: 'https://fitness-superstore.co.uk/used-life-fitness-95ti',
  snippet: 'pre-owned second hand resale price',
  position: 1,
  domain: 'fitness-superstore.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 4,
  combined_rank_score: 20,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const newMsrpListing = {
  intent: 'msrp',
  query: 'Life Fitness 95Ti MSRP',
  title: 'Life Fitness 95Ti MSRP and list price',
  url: 'https://lifefitness.com/95ti-msrp',
  snippet: 'original price new price retail catalogue',
  position: 2,
  domain: 'lifefitness.com',
  source_type: 'manufacturer_website' as const,
  source_rank: 2,
  combined_rank_score: 18,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

assert(isResalePricingSource(usedDealerListing), 'used/refurbished listing should be resale pricing source')
assert(!isResalePricingSource(newMsrpListing), 'MSRP listing should not be resale pricing source')
assert(
  filterOriginalPriceResearchHits([usedDealerListing, newMsrpListing]).length === 1,
  'filter should remove resale pricing sources',
)

const originalPriceAiHits = selectOriginalPriceResearchHitsForAi([
  usedDealerListing,
  newMsrpListing,
  {
    intent: 'dealer',
    query: 'q',
    title: 'eBay auction listing',
    url: 'https://www.ebay.co.uk/itm/used-95ti',
    snippet: 'auction reconditioned',
    position: 3,
    domain: 'ebay.co.uk',
    source_type: 'dealer_catalogue',
    source_rank: 4,
    combined_rank_score: 16,
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
  },
])
assert(originalPriceAiHits.length === 1, 'original price AI selection should exclude resale sources')
assert(
  originalPriceAiHits[0].url.includes('lifefitness.com'),
  'original price AI selection should keep MSRP source',
)

const equip4gymsClearance = {
  intent: 'dealer',
  query: 'Life Fitness 95Ti dealer',
  title: 'Life Fitness 95TI Treadmill',
  url: 'https://www.equip4gyms.com/product/life-fitness-95ti-treadmill-5/',
  snippet: '£350.00 Current price is: £350.00. Life Fitness 95TI Treadmill. Price £1,399.00 £419.70 Current price is: £419.70.',
  position: 4,
  domain: 'equip4gyms.com',
  source_type: 'other' as const,
  source_rank: 6,
  combined_rank_score: 12,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

assert(isResalePricingSource(equip4gymsClearance), 'clearance/current-price dealer snippet should be rejected')
assert(
  filterOriginalPriceResearchHits([equip4gymsClearance, newMsrpListing]).length === 1,
  'clearance dealer listing should be filtered from original price research',
)

const aiInputSources = hitsToResearchSupportingSources(diverseHits)
assert(aiInputSources.length === 5, 'should map diverse hits to AI input sources')
assert(aiInputSources[0].title === 'Superstore page A', 'AI input source should preserve title')

const openAiPayload = buildOpenAiRequestPayload(sampleEquipment, {
  priceHits: diverseHits.slice(0, 2),
  lifecycleHits: diverseHits.slice(2, 4),
}, 'snippet')
assert(openAiPayload.price_source_count === 2, 'OpenAI payload should include two price sources')
assert(openAiPayload.lifecycle_source_count === 2, 'OpenAI payload should include two lifecycle sources')
assert(openAiPayload.source_count === 4, 'OpenAI payload should include four sources total')

const splitPrompt = buildAiResearchPrompt(sampleEquipment, {
  priceHits: [dealerProductPage],
  lifecycleHits: [maintenanceManual],
}, 'snippet')
assert(splitPrompt.includes('=== ORIGINAL PRICE EVIDENCE ==='), 'prompt should label price evidence')
assert(splitPrompt.includes('=== PRODUCTION / LIFECYCLE EVIDENCE ==='), 'prompt should label lifecycle evidence')
assert(splitPrompt.includes('Use these sources ONLY for original_price'), 'prompt should scope price evidence')
assert(splitPrompt.includes('Use these sources ONLY for production_start_year'), 'prompt should scope lifecycle evidence')
assert(splitPrompt.includes('timeline pages'), 'prompt should prefer timeline pages for production')

const lifecycleManual = {
  intent: 'service_manual',
  query: 'Life Fitness 95Ti service manual',
  title: 'Life Fitness 95Ti Operation Manual',
  url: 'https://lifefitness.com/95ti-operation-manual.pdf',
  snippet: 'Manufactured 2004 and discontinued in 2012 operation manual',
  position: 1,
  domain: 'lifefitness.com',
  source_type: 'other' as const,
  source_rank: 6,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const lifecycleRanked = rankLifecycleResearchHits([maintenanceManual, lifecycleManual], 'Life Fitness')
assert(
  lifecycleRanked[0].url.includes('lifefitness.com/95ti-operation-manual.pdf'),
  'lifecycle ranking should prefer explicit production/discontinued manual evidence',
)

const sportsmithTimeline = {
  intent: 'timeline',
  query: 'Life Fitness IC7 timeline',
  title: 'ICG Bikes Models History Timeline - Sportsmith Support',
  url: 'https://sportsmith.com/support/guides/icg-bikes-models-history-timeline/',
  snippet: 'IC7 introduced around 2014 model history timeline legacy support guide compatibility',
  position: 1,
  domain: 'sportsmith.com',
  source_type: 'other' as const,
  source_rank: 6,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const ic7DealerPage = {
  intent: 'dealer',
  query: 'Life Fitness IC7 dealer',
  title: 'Life Fitness IC7 - Buy Now Sale Price',
  url: 'https://fitness-superstore.co.uk/life-fitness-ic7',
  snippet: 'buy sale price our price clearance finance delivery',
  position: 2,
  domain: 'fitness-superstore.co.uk',
  source_type: 'other' as const,
  source_rank: 6,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const specialistRanked = rankLifecycleResearchHits([ic7DealerPage, sportsmithTimeline], 'Life Fitness')
assert(specialistRanked[0].domain === 'sportsmith.com', 'specialist timeline should outrank dealer pricing page')
assert(specialistRanked[0].source_type === 'specialist_support', 'sportsmith timeline should classify as specialist_support')

const sportsmithType = classifyLifecycleResearchSourceType({
  intent: 'timeline',
  title: sportsmithTimeline.title,
  snippet: sportsmithTimeline.snippet,
  url: sportsmithTimeline.url,
  domain: 'sportsmith.com',
  query: sportsmithTimeline.query,
}, 'Life Fitness')
assert(sportsmithType === 'specialist_support', 'sportsmith URL should classify as specialist support')

assert(
  scoreProductionRelevance(ic7DealerPage) < scoreProductionRelevance(sportsmithTimeline),
  'pricing dealer page should score lower than specialist timeline for lifecycle',
)

const lifecycleCollected = await collectEquipmentResearchEvidence(sampleEquipment, 'fake-key', {
  fetchSerpResults: async (query) => {
    if (query.includes('MSRP')) {
      return { ok: false, error: 'SerpAPI request timed out (15s)', timed_out: true }
    }
    if (query.includes('service manual')) {
      return {
        ok: true,
        results: [{
          title: 'Life Fitness 95Ti Operation Manual',
          url: 'https://lifefitness.com/95ti-operation-manual.pdf',
          snippet: 'Manufactured from 2004 and discontinued in 2012.',
          position: 1,
        }],
      }
    }
    return {
      ok: true,
      results: [{
        title: 'Life Fitness 95Ti Dealer listing',
        url: 'https://fitness-superstore.co.uk/life-fitness-95ti-commercial-treadmill.html',
        snippet: 'List Price £7,544 Our Price £6,550.01',
        position: 1,
      }],
    }
  },
})

assert(lifecycleCollected.price_hits.length > 0, 'should collect price evidence')
assert(lifecycleCollected.lifecycle_hits.length > 0, 'should collect lifecycle evidence')
assert(
  lifecycleCollected.specialist_support_queries_run.length === MAX_SPECIALIST_SUPPORT_SEARCH_QUERIES,
  'should run specialist support queries',
)
assert(
  selectLifecycleResearchHitsForAi(lifecycleCollected.lifecycle_hits)[0].snippet.includes('2004'),
  'lifecycle AI selection should include production period evidence',
)

const comparison = await compareLifecycleResearchStrategies(sampleEquipment, 'fake-key', {
  fetchSerpResults: async (query) => {
    if (query.includes('timeline') || query.includes('model history')) {
      return {
        ok: true,
        results: [{
          title: 'ICG Bikes Models History Timeline',
          url: 'https://sportsmith.com/support/guides/icg-bikes-models-history-timeline/',
          snippet: '95Ti manufactured 2004 discontinued 2012 timeline support guide',
          position: 1,
        }],
      }
    }
    if (query.includes('service manual')) {
      return {
        ok: true,
        results: [{
          title: 'Life Fitness 95Ti Operation Manual',
          url: 'https://lifefitness.com/95ti-operation-manual.pdf',
          snippet: 'Manufactured from 2004 and discontinued in 2012.',
          position: 1,
        }],
      }
    }
    return { ok: true, results: [] }
  },
})
assert(comparison.legacy_only.sources_returned >= 0, 'legacy comparison should return legacy pool')
assert(
  comparison.legacy_plus_specialist.top_domains.includes('sportsmith.com'),
  'combined strategy should surface sportsmith specialist domain',
)

const pdfType = classifyResearchSourceType({
  intent: 'pdf',
  title: '95Ti brochure',
  snippet: 'pdf',
  url: 'https://lifefitness.com/95ti.pdf',
  domain: 'lifefitness.com',
}, 'Life Fitness')
assert(pdfType === 'manufacturer_pdf', 'brand-domain PDF should classify as manufacturer PDF')

const parsed = parseEquipmentResearchRecommendation({
  original_new_price: 9995,
  currency: 'gbp',
  price_confidence: 96,
  price_reasoning: 'Found in official dealer catalogue.',
  price_sources_used: ['https://lifefitness.com/catalogue.pdf'],
  production_start_year: 2004,
  production_end_year: 2012,
  production_confidence: 94,
  production_reasoning: 'Confirmed by service manual.',
  production_sources_used: ['https://lifefitness.com/manual.pdf'],
  confidence: 98,
  confidence_reasoning: 'Three independent high-quality sources agreed.',
  supporting_urls: ['https://lifefitness.com/catalogue.pdf', 'not-a-url'],
}, ranked)

assert(parsed.original_new_price === 9995, 'price should parse')
assert(parsed.currency === 'GBP', 'currency should normalize to uppercase')
assert(parsed.price_confidence === 96, 'price confidence should parse')
assert(parsed.production_confidence === 94, 'production confidence should parse')
assert(parsed.confidence === 98, 'overall confidence should parse')
assert(parsed.supporting_sources.length === 1, 'supporting sources should be built from valid URLs')

assert(RESEARCH_STAGE1_AI_SOURCES === 5, 'stage 1 should send up to five diverse sources to AI')
assert(
  shouldRunStage2Enrichment(RESEARCH_STAGE1_CONFIDENCE_THRESHOLD - 1),
  'confidence below threshold should trigger stage 2',
)
assert(
  !shouldRunStage2Enrichment(RESEARCH_STAGE1_CONFIDENCE_THRESHOLD),
  'confidence at threshold should skip stage 2',
)
assert(
  !shouldRunStage2Enrichment(RESEARCH_STAGE1_CONFIDENCE_THRESHOLD + 5),
  'high confidence should skip stage 2',
)

assert(SERPAPI_REQUEST_TIMEOUT_MS === 15_000, 'SerpAPI timeout should be 15 seconds')
assert(EXTERNAL_REQUEST_TIMEOUT_MS === 10_000, 'default external timeout should stay 10 seconds for page fetch')
assert(OPENAI_REQUEST_TIMEOUT_MS === 60_000, 'OpenAI timeout should be 60 seconds')
assert(
  formatOpenAiTimeoutError(OPENAI_REQUEST_TIMEOUT_MS) === 'OpenAI timed out after 60s — retry this model.',
  'OpenAI timeout error should be retryable and include duration',
)

const partialWarning = buildSerpPartialWarning([
  {
    query: 'Life Fitness 95Ti MSRP',
    error: 'SerpAPI request timed out (15s)',
    timed_out: true,
    duration_ms: 15_000,
  },
], MAX_RESEARCH_SEARCH_QUERIES)
assert(
  partialWarning === '1 of 8 searches timed out; continuing with available results.',
  'should build partial serp warning for one timeout',
)

const partialCollected = await collectSerpResearchHits(sampleEquipment, 'fake-key', {
  fetchSerpResults: async (query) => {
    if (query.includes('MSRP')) {
      return { ok: false, error: 'SerpAPI request timed out (15s)', timed_out: true }
    }
    return {
      ok: true,
      results: [{
        title: 'Life Fitness 95Ti Dealer listing',
        url: 'https://fitness-superstore.co.uk/life-fitness-95ti-commercial-treadmill.html',
        snippet: 'List Price £7,544 Our Price £6,550.01',
        position: 1,
      }],
    }
  },
})

assert(partialCollected.hits.length > 0, 'research should proceed when one SerpAPI query times out')
assert(partialCollected.serp_errors.length === 1, 'should record one serp error')
assert(partialCollected.serp_errors[0].timed_out === true, 'failed serp query should be marked timed out')
assert(
  partialCollected.serp_warning === '1 of 8 searches timed out; continuing with available results.',
  'should include partial serp warning',
)

let allSerpFailed = false
try {
  await collectSerpResearchHits(sampleEquipment, 'fake-key', {
    fetchSerpResults: async () => ({
      ok: false,
      error: 'SerpAPI request timed out (15s)',
      timed_out: true,
    }),
  })
} catch (error) {
  allSerpFailed = error instanceof Error && error.message === 'All SerpAPI searches failed'
}
assert(allSerpFailed, 'should fail when all SerpAPI queries fail')

const gbpPriceHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ti dealer',
  title: 'Life Fitness 95Ti Commercial Treadmill',
  url: 'https://fitness-superstore.co.uk/life-fitness-95ti-commercial-treadmill.html',
  snippet: 'List Price £7,544 Our Price £6,550.01',
  position: 1,
  domain: 'fitness-superstore.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const usdPriceHit = {
  intent: 'msrp',
  query: 'Life Fitness 95Ti MSRP',
  title: 'Life Fitness 95Ti MSRP',
  url: 'https://fitnesssuperstore.com/life-fitness-95ti.html',
  snippet: 'MSRP $9,995 list price',
  position: 2,
  domain: 'fitnesssuperstore.com',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const oversizedLifecycleHit = (index: number, pageContent: string) => ({
  intent: 'timeline',
  query: `Life Fitness 95Ti timeline ${index}`,
  title: `Life Fitness 95Ti timeline source ${index}`,
  url: `https://example.com/lf-95ti-timeline-${index}`,
  snippet: 'Production timeline details.',
  position: index,
  domain: 'example.com',
  source_type: 'other' as const,
  source_rank: 7,
  page_content: pageContent,
  page_read_status: 'read' as const,
  page_read_error: null,
})

const largePageBlob = 'x'.repeat(12_000)
const trimInput = {
  priceHits: [gbpPriceHit],
  lifecycleHits: [
    oversizedLifecycleHit(1, largePageBlob),
    oversizedLifecycleHit(2, largePageBlob),
    oversizedLifecycleHit(3, largePageBlob),
    oversizedLifecycleHit(4, largePageBlob),
    oversizedLifecycleHit(5, largePageBlob),
  ],
}
const trimmedPrompt = trimLifecycleHitsForOpenAiPrompt(
  sampleEquipment,
  trimInput,
  'enriched',
  OPENAI_PROMPT_TRIM_CHAR_THRESHOLD,
)
assert(
  trimmedPrompt.trimmed_lifecycle_sources > 0,
  'very large prompts should trim lower-priority lifecycle sources',
)
assert(
  trimmedPrompt.input.lifecycleHits.length < trimInput.lifecycleHits.length,
  'trimmed prompt should keep fewer lifecycle sources',
)
assert(
  estimateEquipmentResearchOpenAiPromptChars(
    sampleEquipment,
    trimmedPrompt.input,
    'enriched',
  ) <= OPENAI_PROMPT_TRIM_CHAR_THRESHOLD,
  'trimmed prompt should be within the character threshold',
)

const promptSizeLog = buildOpenAiPromptSizeLog(sampleEquipment, trimInput, 'snippet', {
  researchMode: 'full',
  trimmedLifecycleSources: 2,
})
assert(promptSizeLog.research_mode === 'full', 'prompt size log should include research_mode')
assert(promptSizeLog.stage === 'snippet', 'prompt size log should include stage')
assert(promptSizeLog.total_source_count === 6, 'prompt size log should count all sources')
assert(promptSizeLog.approximate_total_chars > 0, 'prompt size log should include approximate character count')
assert(promptSizeLog.trimmed_lifecycle_sources === 2, 'prompt size log should include trimmed lifecycle count')

const mixedCurrencyRanked = rankResearchHits([usdPriceHit, gbpPriceHit], 'Life Fitness')
assert(
  mixedCurrencyRanked[0]?.url.includes('.co.uk'),
  'UK GBP source should rank above USD source when both exist',
)

const mixedCurrencyAnalysis = analyzePriceCurrencyEvidence([gbpPriceHit, usdPriceHit])
assert(mixedCurrencyAnalysis.gbp_source_count >= 1, 'should count GBP source')
assert(mixedCurrencyAnalysis.non_gbp_source_count >= 1, 'should count non-GBP source')
assert(mixedCurrencyAnalysis.detected_currencies.includes('GBP'), 'should detect GBP')
assert(mixedCurrencyAnalysis.detected_currencies.includes('USD'), 'should detect USD')

const mixedCurrencyRecommendation = finalizeResearchPriceRecommendation({
  original_new_price: 7544,
  currency: 'GBP',
  price_confidence: 95,
  price_reasoning: 'UK dealer list price in GBP.',
  price_sources_used: [gbpPriceHit.url],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: 'No production evidence.',
  production_sources_used: [],
  confidence: 95,
  confidence_reasoning: 'Strong GBP evidence.',
  reasoning: 'UK dealer list price in GBP.',
  supporting_urls: [gbpPriceHit.url],
  supporting_sources: [],
}, [gbpPriceHit, usdPriceHit])

assert(
  mixedCurrencyRecommendation.recommendation.currency === 'GBP',
  'GBP source + USD source should keep GBP selection',
)
assert(
  mixedCurrencyRecommendation.price_currency_debug.selected_currency === 'GBP',
  'currency debug should record GBP as selected',
)

const usdOnlyRecommendation = finalizeResearchPriceRecommendation({
  original_new_price: 9995,
  currency: 'USD',
  price_confidence: 95,
  price_reasoning: 'US dealer MSRP only.',
  price_sources_used: [usdPriceHit.url],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: 'No production evidence.',
  production_sources_used: [],
  confidence: 95,
  confidence_reasoning: 'Only USD evidence.',
  reasoning: 'US dealer MSRP only.',
  supporting_urls: [usdPriceHit.url],
  supporting_sources: [],
}, [usdPriceHit])

assert(
  usdOnlyRecommendation.recommendation.currency === 'USD',
  'USD-only source should return USD',
)
assert(
  (usdOnlyRecommendation.recommendation.price_confidence ?? 0) <= NON_GBP_VERIFIED_CONFIDENCE_CAP,
  'USD-only source should cap confidence below verified threshold',
)
assert(
  usdOnlyRecommendation.recommendation.currency !== 'GBP',
  'USD price must never be stored as GBP',
)

assert(
  buildAiResearchPrompt(sampleEquipment, { priceHits: [gbpPriceHit], lifecycleHits: [] }).includes('UK-based'),
  'prompt should mention Equipd is UK-based',
)

const ebayPriceHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Life Fitness 95Ri Recumbent Bike | eBay UK',
  url: 'https://www.ebay.co.uk/itm/life-fitness-95ri-recumbent-bike/123456789',
  snippet: 'Buy Life Fitness 95Ri. Price £1,295.00. Free delivery.',
  position: 1,
  domain: 'ebay.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const lifeFitness95RiSuperstoreHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Life Fitness 95Ri Recumbent Bike',
  url: 'https://www.fitness-superstore.co.uk/life-fitness-95ri-recumbent-bike.html',
  snippet: 'List Price £4,995 Our Price £3,995. RRP shown for reference.',
  position: 2,
  domain: 'fitness-superstore.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

assert(
  classifyResearchSourceType({
    intent: 'dealer',
    title: ebayPriceHit.title,
    snippet: ebayPriceHit.snippet,
    url: ebayPriceHit.url,
    domain: 'ebay.co.uk',
  }, 'Life Fitness') === 'marketplace_resale',
  'eBay should classify as marketplace_resale, not dealer catalogue',
)
assert(isMarketplaceResaleDomain('ebay.co.uk', ebayPriceHit.url), 'eBay domain should be marketplace resale')
assert(isMarketplaceResalePriceSource(ebayPriceHit), 'eBay hit should be marketplace resale price source')

const ebayExcludedFromOriginalPrice = selectOriginalPriceResearchHitsForAi(
  rankResearchHits([ebayPriceHit, lifeFitness95RiSuperstoreHit], 'Life Fitness'),
)
assert(
  !ebayExcludedFromOriginalPrice.some((hit) => hit.url.includes('ebay.co.uk')),
  'eBay result with price should be excluded from original price sources',
)
assert(
  ebayExcludedFromOriginalPrice.some((hit) => hit.url.includes('fitness-superstore.co.uk')),
  'Fitness Superstore result with price should be included in original price sources',
)

const marketplaceVsSuperstoreRanked = rankResearchHits(
  [ebayPriceHit, lifeFitness95RiSuperstoreHit],
  'Life Fitness',
)
assert(
  marketplaceVsSuperstoreRanked[0]?.url.includes('fitness-superstore.co.uk'),
  'Fitness Superstore should rank above eBay when both have price evidence',
)
assert(
  hasCatalogueOriginalPriceSignals(lifeFitness95RiSuperstoreHit),
  'Fitness Superstore hit should have catalogue original price signals',
)

const priceSourceDebug = buildPriceSourceClassificationDebug(
  rankResearchHits([ebayPriceHit, lifeFitness95RiSuperstoreHit], 'Life Fitness'),
  'Life Fitness',
)
assert(
  priceSourceDebug.excluded_marketplace_price_sources.length === 1,
  'debug should list one excluded marketplace price source',
)
assert(
  priceSourceDebug.excluded_marketplace_price_sources[0]?.source_type === 'marketplace_resale',
  'excluded marketplace source should be marketplace_resale',
)
assert(
  priceSourceDebug.price_source_classification.length === 2,
  'debug should classify all price hits',
)

const marketplaceOnlyRecommendation = finalizeResearchPriceRecommendation({
  original_new_price: 1295,
  currency: 'GBP',
  price_confidence: 95,
  price_reasoning: 'Found on eBay listing.',
  price_sources_used: [ebayPriceHit.url],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: 'No production evidence.',
  production_sources_used: [],
  confidence: 95,
  confidence_reasoning: 'eBay listing had a price.',
  reasoning: 'eBay listing had a price.',
  supporting_urls: [ebayPriceHit.url],
  supporting_sources: [],
}, [ebayPriceHit])

assert(
  marketplaceOnlyRecommendation.recommendation.original_new_price == null,
  'marketplace price must not produce an original new price',
)
assert(
  marketplaceOnlyRecommendation.recommendation.price_confidence == null,
  'marketplace price must not produce verified-level price confidence',
)

assert(
  buildAiResearchPrompt(sampleEquipment, { priceHits: [gbpPriceHit], lifecycleHits: [] }).includes('Never use eBay'),
  'prompt should forbid eBay for original new price',
)

const manufacturerUsdHit = {
  intent: 'msrp',
  query: 'Life Fitness 95Ri MSRP',
  title: 'Life Fitness 95Ri Recumbent Bike',
  url: 'https://www.lifefitness.com/en-us/products/95ri-recumbent-bike',
  snippet: 'MSRP $4,995 official list price from Life Fitness.',
  position: 1,
  domain: 'lifefitness.com',
  source_type: 'manufacturer_website' as const,
  source_rank: 2,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const weakDealerGbpHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Life Fitness 95Ri | UK Dealer',
  url: 'https://random-gym-dealer.co.uk/life-fitness-95ri',
  snippet: 'Our Price £3,200. Buy now with free delivery.',
  position: 2,
  domain: 'random-gym-dealer.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

assert(
  isOfficialManufacturerPriceSource('manufacturer_website'),
  'manufacturer website should count as official manufacturer price source',
)
assert(
  isDealerSalePriceOnly(weakDealerGbpHit),
  'dealer our-price-only listing should be classified as dealer sale price',
)

const officialVsDealerRanked = rankResearchHits(
  [weakDealerGbpHit, manufacturerUsdHit],
  'Life Fitness',
)
assert(
  officialVsDealerRanked[0]?.url.includes('lifefitness.com'),
  'official manufacturer USD should rank above weak GBP dealer sale price',
)

const officialUsdRecommendation = finalizeResearchPriceRecommendation({
  original_new_price: 4995,
  currency: 'USD',
  price_confidence: 96,
  price_reasoning: 'Official Life Fitness MSRP in USD.',
  price_sources_used: [manufacturerUsdHit.url],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: 'No production evidence.',
  production_sources_used: [],
  confidence: 96,
  confidence_reasoning: 'Official manufacturer source.',
  reasoning: 'Official Life Fitness MSRP in USD.',
  supporting_urls: [manufacturerUsdHit.url],
  supporting_sources: [],
}, [manufacturerUsdHit, weakDealerGbpHit])

assert(
  officialUsdRecommendation.recommendation.currency === 'USD',
  'official manufacturer USD should remain USD even when weak GBP dealer exists',
)
assert(
  officialUsdRecommendation.recommendation.source_original_currency === 'USD',
  'source_original_currency should preserve USD',
)
assert(
  officialUsdRecommendation.recommendation.converted_original_price_gbp
    === convertUsdToGbpResearch(4995),
  'should include server-side GBP conversion for review',
)
assert(
  officialUsdRecommendation.recommendation.price_review_status === 'converted',
  'official USD price should be marked converted',
)
assert(
  officialUsdRecommendation.recommendation.exchange_rate_used === USD_TO_GBP_RESEARCH_EXCHANGE_RATE,
  'USD conversion should record exchange rate used',
)
assert(
  (officialUsdRecommendation.recommendation.price_confidence ?? 0) <= USD_ONLY_RESEARCH_CONFIDENCE_CAP,
  'official USD price should not be auto-verified',
)
assert(
  !(officialUsdRecommendation.recommendation.currency === 'GBP'
    && officialUsdRecommendation.recommendation.original_new_price === 4995),
  '$4995 USD must never be stored as GBP',
)

const currencyFields = applyServerSidePriceCurrencyConversion({
  original_new_price: 4995,
  currency: 'USD',
})
assert(
  currencyFields.conversion_method === 'server_usd_gbp_exchange_rate',
  'USD conversion should record server exchange-rate method',
)
assert(
  currencyFields.converted_original_price_gbp === Math.round(4995 * USD_TO_GBP_RESEARCH_EXCHANGE_RATE),
  'USD conversion should use server exchange rate',
)

const usd4367Fields = applyServerSidePriceCurrencyConversion({
  original_new_price: 4367,
  currency: 'USD',
})
assert(
  usd4367Fields.source_original_currency === 'USD',
  '4367 source currency should remain USD',
)
assert(
  usd4367Fields.converted_original_price_gbp === convertUsdToGbpResearch(4367),
  '4367 USD should convert to GBP valuation amount',
)
assert(
  usd4367Fields.converted_original_price_gbp !== 4367,
  '$4367 USD must never be stored as £4367 GBP',
)
assert(
  usd4367Fields.currency === 'USD',
  '4367 USD must never be relabelled as GBP',
)

const parsedOriginalPriceKeys = parseEquipmentResearchRecommendation({
  original_price: 4367,
  original_currency: 'USD',
  price_confidence: 95,
  price_reasoning: 'Official USD MSRP.',
  price_sources_used: [],
  production_start_year: null,
  production_end_year: null,
  production_confidence: null,
  production_reasoning: 'No production evidence.',
  production_sources_used: [],
  confidence: 95,
  confidence_reasoning: 'Official source.',
  supporting_urls: [],
  converted_original_price_gbp: 4367,
  source_original_currency: 'GBP',
})
assert(
  parsedOriginalPriceKeys.original_new_price === 4367,
  'parse should read original_price from OpenAI',
)
assert(
  parsedOriginalPriceKeys.currency === 'USD',
  'parse should read original_currency from OpenAI',
)
assert(
  parsedOriginalPriceKeys.converted_original_price_gbp == null,
  'parse should ignore AI-provided conversion fields',
)

const fitKitRrpAndSaleHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Life Fitness 95Ri Recumbent Bike | FitKitUK',
  url: 'https://www.fitkituk.com/life-fitness-95ri-recumbent-bike',
  snippet: 'Refurbished Life Fitness 95Ri. RRP £2,999. Now £849.',
  position: 1,
  domain: 'fitkituk.com',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const fitKitUsedOnlyHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Used Life Fitness 95Ri',
  url: 'https://www.fitkituk.com/used-life-fitness-95ri',
  snippet: 'Refurbished unit in excellent condition. Now £849.',
  position: 2,
  domain: 'fitkituk.com',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const fitKitLifecycleHit = {
  intent: 'discontinued',
  query: 'Life Fitness 95Ri discontinued',
  title: 'Life Fitness 95Ri | FitKitUK',
  url: 'https://www.fitkituk.com/life-fitness-95ri-history',
  snippet: 'Launched in 2012 and discontinued in 2018. Full specs listed.',
  position: 3,
  domain: 'fitkituk.com',
  source_type: 'other' as const,
  source_rank: 7,
  page_content: null,
  page_read_status: 'failed' as const,
  page_read_error: 'HTTP 404',
  source_fetch_status: 'failed' as const,
}

assert(isUsedRefurbDealerDomain('fitkituk.com'), 'FitKitUK should be a used/refurb dealer domain')
assert(!isResalePricingSource(fitKitRrpAndSaleHit), 'FitKitUK RRP page should not be treated as pure resale pricing')
assert(isResalePricingSource(fitKitUsedOnlyHit), 'FitKitUK used-only page should remain resale pricing')

const fitKitPriceEvidence = extractHistoricalPriceEvidence(fitKitRrpAndSaleHit)
assert(fitKitPriceEvidence.rrp_price === 2999, 'should extract historical RRP from FitKitUK page')
assert(
  fitKitPriceEvidence.used_prices.includes(849),
  'should extract used/refurbished sale price separately',
)

const enrichedFitKitRrp = enrichResearchHitHistoricalEvidence(fitKitRrpAndSaleHit)
assert(
  enrichedFitKitRrp.source_type === 'dealer_historical_reference',
  'FitKitUK RRP page should classify as dealer historical reference',
)
assert(
  enrichedFitKitRrp.price_evidence_kind === 'rrp_evidence',
  'FitKitUK RRP page should be RRP evidence',
)

const fitKitFiltered = filterOriginalPriceResearchHits([fitKitRrpAndSaleHit, fitKitUsedOnlyHit])
assert(
  fitKitFiltered.some((hit) => hit.url.includes('95ri-recumbent-bike')),
  'FitKitUK RRP page should remain in original price candidates',
)
assert(
  !fitKitFiltered.some((hit) => hit.url.includes('used-life-fitness-95ri')),
  'FitKitUK used-only page should be excluded from original price candidates',
)

const enrichedFitKitLifecycle = enrichResearchHitHistoricalEvidence(fitKitLifecycleHit)
assert(
  enrichedFitKitLifecycle.lifecycle_evidence_kind === 'lifecycle_evidence',
  'FitKitUK lifecycle page should be lifecycle evidence candidate',
)
assert(hasHistoricalLifecycleSignals(fitKitLifecycleHit), 'FitKitUK lifecycle snippet should match lifecycle signals')

const fitKitLifecycleRanked = rankLifecycleResearchHits([fitKitLifecycleHit], 'Life Fitness')
assert(
  fitKitLifecycleRanked[0]?.source_type === 'dealer_historical_reference',
  'FitKitUK lifecycle page should classify for lifecycle ranking',
)

const fitnessSuperstoreHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Life Fitness 95Ri | Fitness Superstore',
  url: 'https://www.fitness-superstore.co.uk/life-fitness-95ri',
  snippet: 'List Price £4,995. Our Price £3,499.',
  position: 1,
  domain: 'fitness-superstore.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const obscureDealerHit = {
  intent: 'dealer',
  query: 'Life Fitness 95Ri dealer',
  title: 'Cheap gym gear 95Ri',
  url: 'https://random-gym-deals.example/95ri',
  snippet: 'Our Price £3,499. Limited stock.',
  position: 2,
  domain: 'random-gym-deals.example',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

assert(
  isTrustedCommercialFitnessRetailerDomain('fitness-superstore.co.uk'),
  'Fitness Superstore should be a trusted commercial fitness retailer',
)
assert(
  isTrustedCommercialFitnessRetailerDomain('fitshop.co.uk'),
  'Fitshop should be a trusted commercial fitness retailer',
)

const fitKitCandidates = extractPriceCandidates(fitKitRrpAndSaleHit)
assert(
  fitKitCandidates.some((candidate) => candidate.evidence_type === 'dealer_list_price' || candidate.evidence_type === 'dealer_rrp'),
  'FitKitUK page should extract list/RRP candidate',
)
assert(
  fitKitCandidates.some((candidate) => candidate.evidence_type === 'dealer_sale_price'),
  'FitKitUK page should extract sale price candidate separately',
)
assert(
  fitKitCandidates.find((candidate) => candidate.evidence_type === 'dealer_rrp')?.eligible_for_original_price === true,
  'RRP candidate should be eligible for original price',
)
assert(
  fitKitCandidates.find((candidate) => candidate.evidence_type === 'dealer_sale_price')?.eligible_for_original_price === false,
  'sale price candidate should be ineligible for original price',
)

const trustedVsObscureRanked = rankResearchHits(
  [obscureDealerHit, fitnessSuperstoreHit],
  'Life Fitness',
)
assert(
  trustedVsObscureRanked[0]?.domain.includes('fitness-superstore'),
  'trusted retailer with list price should rank above obscure dealer sale page',
)

const candidateDebug = buildPriceCandidateDebug([fitKitRrpAndSaleHit], 'Life Fitness')
assert(
  candidateDebug.some((entry) => entry.selected && entry.extracted_price === 2999),
  'price candidate debug should mark selected RRP candidate',
)
assert(
  candidateDebug.some((entry) => entry.rejection_reason === 'ineligible_sale_or_used_price_label'),
  'price candidate debug should explain rejected sale price',
)
assert(
  candidateDebug.some((entry) => entry.eligible_for_original_price === true && entry.selected),
  'price candidate debug should expose eligible_for_original_price on selected candidate',
)

const fitKit7544Hit = {
  intent: 'fitkit_rrp',
  query: 'site:fitkituk.com Life Fitness 95Ri RRP',
  title: 'Life Fitness 95Ri | FitKitUK',
  url: 'https://www.fitkituk.com/life-fitness-95ri',
  snippet: 'RRP £7,544. Our Price £1,399.',
  position: 1,
  domain: 'fitkituk.com',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const fitKit7544Candidates = extractPriceCandidates(fitKit7544Hit)
assert(
  fitKit7544Candidates.find((candidate) => candidate.evidence_type === 'dealer_rrp')?.extracted_price === 7544,
  'FitKit UK RRP £7,544 should be extracted as original RRP candidate',
)
assert(
  fitKit7544Candidates.find((candidate) => candidate.evidence_type === 'dealer_our_price')?.eligible_for_original_price === false,
  'FitKit UK Our Price £1,399 should be ineligible for original RRP',
)

const fitKit7544Debug = buildPriceCandidateDebug([fitKit7544Hit], 'Life Fitness')
assert(
  fitKit7544Debug.some((entry) => entry.selected && entry.extracted_price === 7544),
  'FitKit UK debug should select £7,544 as original RRP',
)

const manufacturerPdfNoPriceHit = {
  intent: 'pdf',
  query: 'Life Fitness 95Ri filetype:pdf',
  title: 'Life Fitness 95Ri Brochure',
  url: 'https://lifefitness.com/95ri-brochure.pdf',
  snippet: 'Specifications and dimensions for the 95Ri recumbent bike.',
  position: 1,
  domain: 'lifefitness.com',
  source_type: 'manufacturer_pdf' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const fitshopRrpHit = {
  intent: 'fitshop_rrp',
  query: 'site:fitshop.co.uk Life Fitness 95Ri RRP',
  title: 'Life Fitness 95Ri | Fitshop',
  url: 'https://www.fitshop.co.uk/life-fitness-95ri',
  snippet: 'RRP £4,995. Our Price £3,499.',
  position: 1,
  domain: 'fitshop.co.uk',
  source_type: 'dealer_catalogue' as const,
  source_rank: 5,
  page_content: null,
  page_read_status: 'snippet_only' as const,
  page_read_error: null,
}

const fitshopVsPdfRanked = rankResearchHits(
  [manufacturerPdfNoPriceHit, fitshopRrpHit],
  'Life Fitness',
)
assert(
  fitshopVsPdfRanked[0]?.domain.includes('fitshop'),
  'Fitshop RRP page should rank above manufacturer PDF without price',
)
assert(
  scorePriceSourceHierarchy(fitshopRrpHit, 'dealer_catalogue')
    > scorePriceSourceHierarchy(manufacturerPdfNoPriceHit, 'manufacturer_pdf'),
  'Fitshop explicit RRP hierarchy score should beat manufacturer PDF without price',
)

const ebayFiltered = filterOriginalPriceResearchHits([ebayPriceHit, fitnessSuperstoreHit])
assert(
  !ebayFiltered.some((hit) => hit.domain.includes('ebay')),
  'eBay marketplace price should never be eligible for original RRP',
)
assert(
  ebayFiltered[0]?.domain.includes('fitness-superstore'),
  'Fitness Superstore list price should remain when eBay is filtered out',
)

console.log('intelligenceEquipmentResearch tests passed')
