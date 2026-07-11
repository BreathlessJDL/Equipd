import {
  classifyOversizedDownload,
  compactStructuredEvidenceItem,
  estimateJsonBytes,
  isHeavyResearchDomain,
  resolveV3PageReadLimit,
} from './intelligenceResearchResourceGuards.ts'
import {
  buildSlimV3ResearchResult,
  RESEARCH_V3_MAX_RESPONSE_BYTES,
} from './intelligenceEquipmentResearchV3.ts'
import {
  extractKeywordWindowBodyText,
  extractPageContent,
  MAX_PAGE_BYTES,
  MAX_PDF_BYTES,
} from './intelligencePageExtract.ts'
import {
  extractStructuredPriceEvidenceFromText,
  isFinanceOrMonthlyPriceContext,
  buildStructuredProductContext,
} from './intelligenceStructuredEvidence.ts'

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label)
}

assert(
  classifyOversizedDownload(MAX_PAGE_BYTES + 1, 'html', {
    maxHtmlBytes: MAX_PAGE_BYTES,
    maxPdfBytes: MAX_PDF_BYTES,
  }) === 'too_large_html',
  'html larger than max should be classified as too_large_html',
)

assert(
  classifyOversizedDownload(MAX_PDF_BYTES + 1, 'pdf', {
    maxHtmlBytes: MAX_PAGE_BYTES,
    maxPdfBytes: MAX_PDF_BYTES,
  }) === 'too_large_pdf',
  'pdf larger than max should be classified as too_large_pdf',
)

assert(isHeavyResearchDomain('archive.org'), 'archive.org should be heavy domain')
assert(isHeavyResearchDomain('web.archive.org'), 'web.archive.org should be heavy domain')

const paddedPriceHtml = `<!DOCTYPE html><html><head><title>Test</title></head><body>${'navigation '.repeat(20_000)}<p>List Price £8,250 for Life Fitness 95Ti treadmill.</p>${'footer '.repeat(20_000)}</body></html>`
const keywordBody = extractKeywordWindowBodyText(paddedPriceHtml)
assert(keywordBody.includes('8,250'), 'keyword window extraction should keep RRP near list price marker')
assert(keywordBody.length <= 4_500, 'keyword body extraction should stay capped')

const extractedLarge = extractPageContent(paddedPriceHtml)
assert(extractedLarge.combinedText.includes('8,250'), 'truncated page should still expose list price')

assert(
  isFinanceOrMonthlyPriceContext('Finance from £159/month on selected models'),
  'monthly finance price should still be rejected',
)

const lifeFitness95Ti = buildStructuredProductContext({
  brand: 'Life Fitness',
  series: 'Integrity',
  model: '95Ti',
  equipment_type: 'Treadmill',
})

const truncatedRrpText = `${'catalogue navigation '.repeat(80)} RRP £11,800 inc VAT for Life Fitness 95Ti. ${'more text '.repeat(80)}`
const truncatedItems = extractStructuredPriceEvidenceFromText(truncatedRrpText, {
  sourceUrl: 'https://www.fitness-superstore.co.uk/life-fitness-95ti',
  sourceDomain: 'fitness-superstore.co.uk',
  sourceType: 'dealer_catalogue',
  brand: 'Life Fitness',
}, lifeFitness95Ti)
assert(
  truncatedItems.some((item) => item.label === 'RRP' && item.value === 11800),
  'valid RRP near keyword should still be extracted from truncated page text',
)

const strongSnippetHits = [
  {
    id: '1',
    title: 'Life Fitness 95Ti',
    snippet: 'RRP £11,800 from fitness superstore',
    url: 'https://www.fitness-superstore.co.uk/life-fitness-95ti',
    domain: 'fitness-superstore.co.uk',
    intent: 'price',
    query: 'q',
    position: 1,
    source_type: 'dealer_catalogue',
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
    source_fetch_status: 'snippet_only',
  },
  {
    id: '2',
    title: 'Life Fitness 95Ti MSRP',
    snippet: 'List price £11,800',
    url: 'https://www.fitkituk.com/lf-95ti',
    domain: 'fitkituk.com',
    intent: 'price',
    query: 'q2',
    position: 2,
    source_type: 'dealer_catalogue',
    page_content: null,
    page_read_status: 'snippet_only',
    page_read_error: null,
    source_fetch_status: 'snippet_only',
  },
]

assert(
  resolveV3PageReadLimit(strongSnippetHits, [], 'full', 'Life Fitness') === 3,
  'strong snippet evidence should keep default 3 page reads',
)

const weakSnippetHits = [
  {
    ...strongSnippetHits[0],
    id: '3',
    snippet: 'Commercial treadmill specifications',
    url: 'https://www.fitness-superstore.co.uk/life-fitness-95ti',
  },
  {
    ...strongSnippetHits[1],
    id: '4',
    snippet: 'Buy refurbished cardio equipment',
    url: 'https://www.fitkituk.com/lf-95ti',
  },
]

assert(
  resolveV3PageReadLimit(weakSnippetHits, [], 'full', 'Life Fitness') === 5,
  'weak snippet evidence with trusted targets should expand to 5 page reads',
)

const mockEvidence = {
  id: 'price-1',
  type: 'price' as const,
  label: 'RRP',
  value: 11800,
  currency: 'GBP',
  year: null,
  yearEnd: null,
  surroundingText: 'x'.repeat(500),
  sourceUrl: 'https://example.com',
  sourceDomain: 'example.com',
  sourceType: 'dealer_catalogue' as const,
  sourceScore: 10,
  confidence: 90,
  score: 90,
  eligibleForOriginalPrice: true,
  rejectionReason: null,
  extractionMethod: 'structured' as const,
  nearModelName: true,
  brandModelMatch: true,
  productFamilyMatch: false,
  isMarketplace: false,
  isFinancePrice: false,
}

const compact = compactStructuredEvidenceItem(mockEvidence)
assert(compact.surroundingText.length <= 120, 'compact evidence should truncate surrounding text')

const slim = buildSlimV3ResearchResult({
  equipment: {
    id: 'eq-1',
    brand: 'Life Fitness',
    series: null,
    model: '95Ti',
    slug: 'lf-95ti',
    equipment_type: 'Treadmill',
  },
  queries_run: ['q1'],
  serp_result_count: 1,
  deduped_result_count: 1,
  search_hits: [{
    ...strongSnippetHits[0],
    page_content: 'x'.repeat(20_000),
  }],
  ai_input_sources: [],
  price_input_sources: [],
  lifecycle_input_sources: [],
  recommendation: {
    original_price: 11800,
    currency: 'GBP',
    confidence: 90,
    price_sources_used: ['https://example.com'],
    production_sources_used: [],
    supporting_urls: ['https://example.com'],
    supporting_sources: [],
    price_reasoning: 'test',
    production_reasoning: '',
    confidence_reasoning: 'test',
    production_start_year: null,
    production_end_year: null,
    baseline_manufacture_year: null,
    lifecycle_confidence: null,
    original_price_source: 'https://example.com',
    original_price_confidence: 90,
    price_confidence: 90,
    production_confidence: null,
  },
  debug_log: {
    equipment_label: 'Life Fitness 95Ti',
    research_stage: 'stage_2',
    research_engine: 'v3',
    progress_log: ['v3_started'],
    timings: {
      function_started_at: new Date().toISOString(),
      offsets_from_start_ms: {
        function_start: 0,
        serp_complete: null,
        ranking_complete: null,
        stage_1_openai_start: null,
        stage_1_openai_end: null,
        stage_2_fetch_start: null,
        stage_2_fetch_end: null,
        stage_2_openai_start: null,
        stage_2_openai_end: null,
        function_end: null,
      },
      serp_requests: [],
      serp_total_ms: 0,
      ranking_ms: 0,
      stage_1_openai_ms: null,
      stage_2_page_fetches: [],
      stage_2_fetch_total_ms: 0,
      stage_2_openai_ms: 0,
      total_execution_ms: 100,
    },
    serp_query_analysis: [],
    serp_unique_queries: 1,
    serp_raw_url_hits: 1,
    serp_duplicate_urls_removed: 0,
    openai_request_payload: null,
    searches_executed: ['q1'],
    sources_returned: 1,
    sources_sent_to_ai: 1,
    sources_successfully_read: 1,
    pdf_downloads_attempted: 0,
    sources_used_by_ai: ['https://example.com'],
    openai_raw_response: { huge: 'x'.repeat(50_000) },
    duration_ms: 100,
    ranked_sources: [{
      title: 'Example',
      url: 'https://example.com',
      domain: 'example.com',
      source_type: 'dealer_catalogue',
      page_read_status: 'read',
    }],
    structured_price_evidence: [mockEvidence],
    structured_lifecycle_evidence: [],
    v3_openai_request: {
      research_engine: 'v3',
      price_evidence_count: 1,
      lifecycle_evidence_count: 0,
      prompt: 'x'.repeat(40_000),
    },
  },
}, [{ url: 'https://archive.org/item', reason: 'low_value_domain' }])

assert(slim.search_hits.length === 0, 'slim response should omit search_hits')
assert(slim.debug_log.openai_raw_response == null, 'slim response should omit openai_raw_response')
const responseBytes = estimateJsonBytes(slim)
assert(
  responseBytes <= RESEARCH_V3_MAX_RESPONSE_BYTES,
  `slim response should stay under ${RESEARCH_V3_MAX_RESPONSE_BYTES} bytes (got ${responseBytes})`,
)

console.log('research resource guard tests passed')
