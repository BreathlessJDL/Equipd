/**
 * Unit tests for equipment product content generation helpers.
 */

import {
  buildProductContentSourceHash,
  buildProductContentSourcePayload,
  buildProductContentUpsertRow,
  buildProductContentSystemPrompt,
  buildCategoryProductContentUserPrompt,
  EQUIPMENT_PRODUCT_CONTENT_STATUS,
  findBannedGenericPhrases,
  findHomeUseCommercialPhrases,
  findInventedMechanicsPhrases,
  findTechnogymCrossoverStrengthTerms,
  countOverviewWords,
  getEquipmentProductContentBadgeLabel,
  isConsoleFaqQuestion,
  isDraftProductContentPubliclyVisible,
  isTechnogymCrossoverCardioProduct,
  normalizeEquipmentProductFaqEntries,
  parseProductContentResponse,
  PRODUCT_CONTENT_CATEGORIES,
  resolveEquipmentProductPageContent,
  resolveProductContentCategory,
  shouldGenerateProductContent,
  TECHNOGYM_CROSSOVER_CARDIO_PROMPT_CONTEXT,
  validateConsoleFaqs,
  validateHomeUseOverviewWording,
  validateCommercialOverviewWording,
  findCommercialHomePhrases,
  validateCategoryIncompatibleTerminology,
  findCategoryIncompatibleTerms,
  findInventedProductFeaturePhrases,
  validateInventedProductFeatures,
  generateProductContentWithOpenAI,
} from '../src/lib/equipmentProductContent.js'
import {
  buildPublishDraftsConfirmationMessage,
  buildPublishEquipmentProductContentUpdate,
  buildAdminProductContentListRows,
  buildAdminProductContentListRow,
  CONTENT_PUBLISH_SCOPE,
  getEquipmentProductContentStatusLabel,
  isEligibleAdminProductContentProduct,
  isPublishableEquipmentProductContent,
  matchesAdminContentGenerationStatusFilter,
  matchesAdminContentProductStatusFilter,
  productHasIncompleteContentSourceData,
  resolveDraftContentIdsForPublish,
  summarizeEquipmentProductContentStatuses,
} from '../src/lib/equipmentProductContentAdmin.js'
import {
  applyGenerateMissingStepResult,
  buildGenerateMissingPreview,
  chunkProductIds,
  emptyGenerateMissingProgress,
  evaluateMissingDraftGenerationEligibility,
  GENERATE_MISSING_MAX_PER_STEP,
  isHomeUseContentBrand,
  resolveProductContentUsageSegment,
  summarizeGenerateMissingRun,
  previewGenerateMissingFromAdminRows,
  CONTENT_USAGE_SEGMENT,
} from '../src/lib/equipmentProductContentGenerateMissing.js'
import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const sampleProduct = {
  id: 'prod-1',
  brand: 'Life Fitness',
  product_family: 'Integrity Series',
  model: 'Treadmill',
  equipment_type: 'Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
  canonical_product_key: 'life-fitness-treadmill-integrity-series-treadmill',
  baseline_manufacture_year: 2017,
  production_start_year: 2017,
  production_end_year: null,
  original_base_price: 8500,
  original_base_price_currency: 'GBP',
  original_price_confidence: 80,
  lifecycle_confidence: 75,
}

const sampleConsoleOptions = [
  {
    console_name: 'Integrity SL',
    tier: 'base',
    release_year: 2017,
    retired_year: null,
    modifier_percent: 0,
    is_active: true,
  },
  {
    console_name: 'Discover SE4',
    tier: 'premium',
    release_year: 2022,
    retired_year: null,
    modifier_percent: 28,
    is_active: true,
  },
]

const payload = buildProductContentSourcePayload(sampleProduct, {
  consoleOptions: sampleConsoleOptions,
  intelligenceRows: [{
    brand: 'Life Fitness',
    series: 'Integrity',
    model: 'Treadmill',
    equipment_type: 'Treadmill',
    manufacture_year: 2017,
    original_rrp: 8500,
    currency: 'GBP',
  }],
})

assert(payload.brand === 'Life Fitness', 'payload includes brand')
assert(payload.equipment_category === PRODUCT_CONTENT_CATEGORIES.CARDIO, 'cardio product category')
assert(payload.console_options.length === 2, 'payload includes active console options')
assert(payload.console_options[0].console_name === 'Discover SE4', 'console options sorted by name')

const hashA = buildProductContentSourceHash(payload)
const hashB = buildProductContentSourceHash(payload)
assert(hashA === hashB, 'source hash is stable')
assert(hashA.length === 64, 'source hash is sha256 hex')

const changedPayload = buildProductContentSourcePayload({
  ...sampleProduct,
  original_base_price: 9000,
}, { consoleOptions: sampleConsoleOptions })
assert(buildProductContentSourceHash(changedPayload) !== hashA, 'price change changes hash')

const validOverview = [
  'The Life Fitness Integrity Series Treadmill is a premium commercial treadmill manufactured from around 2017.',
  'It forms part of the Integrity cardio range and was available with several console configurations,',
  'including Integrity SL and Discover SE4.',
  'The estimated original RRP was approximately £8,500.',
  'Manufacture year, condition and console configuration can all significantly affect its current used value.',
].join(' ')

const parsed = parseProductContentResponse(JSON.stringify({
  overview_text: validOverview,
  seo_title: 'Life Fitness Integrity Treadmill value guide',
  seo_meta_description: 'Life Fitness Integrity Series treadmill: RRP from £8,500, 2017 manufacture year, and used market valuation on Equipd.',
  faqs: [
    { question: 'When was the Life Fitness Integrity Series Treadmill manufactured from?', answer: 'Equipd records a manufacture start year of 2017.' },
    { question: 'What affects the used value of this treadmill?', answer: 'Model, year, condition and console configuration are the main factors.' },
    { question: '', answer: 'skip me' },
  ],
}), payload)
assert(parsed.overview_text.includes('Integrity Series'), 'parsed overview')
assert(parsed.faq_json.length === 2, 'empty FAQ entries removed')

assert(findBannedGenericPhrases('robust construction and high performance').length === 2, 'detects banned phrases')
assert(findBannedGenericPhrases('various factors and additional features').length === 2, 'detects vague valuation phrases')
assert(isConsoleFaqQuestion('Which console variants were available?'), 'detects console FAQ questions')

let rejectedVague = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: `${validOverview} Various factors and additional features may affect value.`,
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), payload)
} catch (error) {
  rejectedVague = error.message.includes('banned generic phrasing')
}
assert(rejectedVague, 'rejects vague valuation phrasing')

const cardioNoConsoleOverview = [
  'The Life Fitness Integrity Series Treadmill is a premium commercial treadmill manufactured from around 2017.',
  'It forms part of the Integrity cardio range and was intended for commercial gyms and health clubs.',
  'The estimated original RRP was approximately £8,500.',
  'Manufacture year, exact model and overall condition are the main factors affecting its current used market value.',
].join(' ')

let rejectedConsoleFaq = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: cardioNoConsoleOverview,
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Which console variants were available?', answer: 'None recorded in Equipd data.' },
      { question: 'What affects used value?', answer: 'Model, year and condition.' },
    ],
  }), buildProductContentSourcePayload(sampleProduct, { consoleOptions: [] }))
} catch (error) {
  rejectedConsoleFaq = error.message.includes('Console-variant FAQs')
}
assert(rejectedConsoleFaq, 'rejects console FAQ when no console options in source')

let rejectedConsoleValidation = false
try {
  validateConsoleFaqs(
    [{ question: 'Which console variants were available?', answer: 'Integrity SL.' }],
    buildProductContentSourcePayload(sampleProduct, { consoleOptions: [] }),
  )
} catch (error) {
  rejectedConsoleValidation = error.message.includes('Console-variant FAQs')
}
assert(rejectedConsoleValidation, 'validateConsoleFaqs rejects missing-console-data FAQ')

assert(
  !(() => {
    try {
      validateConsoleFaqs(
        [{ question: 'Which console variants were available?', answer: 'Integrity SL and Discover SE4.' }],
        payload,
      )
      return false
    } catch {
      return true
    }
  })(),
  'validateConsoleFaqs allows console FAQ when options exist',
)

let rejected = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: validOverview.replace(
      'premium commercial treadmill',
      'premium commercial treadmill with robust construction',
    ),
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), payload)
} catch (error) {
  rejected = error.message.includes('banned generic phrasing')
}
assert(rejected, 'rejects banned generic phrasing')

assert(
  findInventedMechanicsPhrases('Uses a pin-loaded mechanism for resistance.', payload).length === 1,
  'detects invented pin-loaded mechanism',
)
assert(
  findInventedMechanicsPhrases('Selectorised strength equipment from 2012.', payload).length === 0,
  'allows non-mechanics copy',
)

let rejectedMechanics = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: `${validOverview} It uses a pin-loaded mechanism.`,
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), payload)
} catch (error) {
  rejectedMechanics = error.message.includes('invented mechanics')
}
assert(rejectedMechanics, 'rejects invented mechanics in overview')

let rejectedEquipdMention = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: `${validOverview} Equipd provides valuation data.`,
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), payload)
} catch (error) {
  rejectedEquipdMention = error.message.includes('should not mention Equipd')
}
assert(rejectedEquipdMention, 'rejects Equipd mention in overview')

let rejectedSalesFiller = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: `${validOverview} It is a practical choice for commercial gyms.`,
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), payload)
} catch (error) {
  rejectedSalesFiller = error.message.includes('banned generic phrasing')
}
assert(rejectedSalesFiller, 'rejects sales filler phrases')

const strengthOverview = [
  'The Technogym Element Chest Press is a commercial selectorised strength machine from the Element range,',
  'manufactured from around 2012. It was developed for chest-focused strength training and formed part of',
  'Technogym\'s wider Element circuit. Its estimated original RRP was approximately £4,995.',
  'The manufacture year, exact model and overall condition are the main factors affecting its current used market value.',
].join(' ')

const strengthPayload = buildProductContentSourcePayload({
  brand: 'Technogym',
  product_family: 'Element',
  model: 'Chest Press',
  equipment_type: 'Chest Press',
  canonical_product_name: 'Technogym Element Chest Press',
  canonical_product_key: 'technogym-element-chest-press',
  baseline_manufacture_year: 2012,
  production_start_year: 2012,
  original_base_price: 4995,
  original_base_price_currency: 'GBP',
})

assert(
  !/\bconsole\b/i.test(strengthOverview),
  'strength example overview has no console wording',
)

parseProductContentResponse(JSON.stringify({
  overview_text: strengthOverview,
  seo_title: 'Technogym Element Chest Press used value',
  seo_meta_description: 'Technogym Element Chest Press: RRP around £4,995 and used market valuation.',
  faqs: [
    { question: 'When was it manufactured from?', answer: 'Around 2012.' },
    { question: 'What was the original RRP?', answer: 'Approximately £4,995.' },
  ],
}), strengthPayload)

let rejectedStrengthConsole = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: `${strengthOverview} Console configuration also affects value.`,
    seo_title: 'Technogym Element Chest Press used value',
    seo_meta_description: 'Technogym Element Chest Press used market valuation.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), strengthPayload)
} catch (error) {
  rejectedStrengthConsole = error.message.includes('must not mention consoles')
}
assert(rejectedStrengthConsole, 'rejects console mentions on strength products')

let rejectedContinuousProduction = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: strengthOverview.replace(
      'manufactured from around 2012',
      'in production since 2012',
    ),
    seo_title: 'Technogym Element Chest Press used value',
    seo_meta_description: 'Technogym Element Chest Press used market valuation.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), strengthPayload)
} catch (error) {
  rejectedContinuousProduction = error.message.includes('continuous production')
    || error.message.includes('in production since')
}
assert(rejectedContinuousProduction, 'rejects continuous production claims without end year')

let rejectedTooLong = false
try {
  const padded = `${validOverview} ${'extra detail '.repeat(50)}`.trim()
  parseProductContentResponse(JSON.stringify({
    overview_text: padded,
    seo_title: 'Life Fitness Integrity Treadmill value guide',
    seo_meta_description: 'Life Fitness Integrity Series treadmill overview on Equipd.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), payload)
} catch (error) {
  rejectedTooLong = error.message.includes('too long')
}
assert(rejectedTooLong, 'rejects overviews above 140 words')

assert(countOverviewWords(validOverview) <= 140, 'valid overview within max length')
assert(countOverviewWords(strengthOverview) >= 55, 'strength overview meets minimum length')

assert(
  resolveProductContentCategory({
    equipment_type: 'Chest Press',
    model: 'Chest Press',
    product_family: 'Element',
    canonical_product_name: 'Technogym Element Chest Press',
  }) === PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH,
  'chest press maps to selectorised strength',
)
assert(
  resolveProductContentCategory({
    equipment_type: 'Treadmill',
    model: 'Run',
    product_family: 'Excite',
    canonical_product_name: 'Technogym Excite Run',
  }) === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'treadmill maps to cardio',
)
assert(
  resolveProductContentCategory({
    equipment_type: 'Plate Loaded Strength',
    model: 'Leg Press',
    product_family: 'Hammer Strength Plate Loaded',
    canonical_product_name: 'Hammer Strength Plate Loaded Leg Press',
  }) === PRODUCT_CONTENT_CATEGORIES.PLATE_LOADED,
  'plate loaded maps correctly',
)
assert(
  resolveProductContentCategory({
    equipment_type: 'Functional Trainer',
    model: 'Kinesis',
    canonical_product_name: 'Technogym Kinesis',
  }) === PRODUCT_CONTENT_CATEGORIES.FUNCTIONAL,
  'functional trainer maps correctly',
)
assert(
  resolveProductContentCategory({
    equipment_type: 'Bench',
    model: 'Flat Bench',
    canonical_product_name: 'Life Fitness Flat Bench',
  }) === PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS,
  'bench maps correctly',
)

assert(
  shouldGenerateProductContent({ existingContent: null, sourceHash: hashA, missingOnly: true }).include,
  'missing-only includes products without content',
)
assert(
  !shouldGenerateProductContent({
    existingContent: { generation_status: 'draft', source_data_hash: hashA },
    sourceHash: hashA,
    missingOnly: true,
  }).include,
  'missing-only skips existing draft content',
)
assert(
  shouldGenerateProductContent({
    existingContent: { generation_status: 'approved', source_data_hash: 'old' },
    sourceHash: hashA,
    changedOnly: true,
  }).include,
  'changed-only includes stale hash',
)
assert(
  shouldGenerateProductContent({
    existingContent: { generation_status: 'approved', source_data_hash: hashA },
    sourceHash: hashA,
    regenerate: true,
  }).include,
  'regenerate forces inclusion',
)

const upsert = buildProductContentUpsertRow({
  productId: 'prod-1',
  generated: {
    overview_text: 'Overview',
    seo_title: 'Title',
    seo_meta_description: 'Meta',
    faq_json: [],
    ai_model: 'gpt-4o-mini',
  },
  sourceHash: hashA,
  existingContent: { version: 2, generation_status: 'approved' },
})
assert(upsert.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT, 'new generation is draft')
assert(upsert.version === 3, 'version increments on regenerate')
assert(upsert.approved_at === null, 'approval cleared on regenerate')

const failed = buildProductContentUpsertRow({
  productId: 'prod-1',
  existingContent: upsert,
  sourceHash: hashA,
  errorMessage: 'timeout',
})
assert(failed.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED, 'failed status on error')
assert(failed.error_message === 'timeout', 'error message stored')

const approvedContent = {
  generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED,
  overview_text: 'Approved overview copy.',
  seo_title: 'Approved SEO title',
  seo_meta_description: 'Approved SEO description',
  faq_json: [{ question: 'Approved Q?', answer: 'Approved A.' }],
}

const draftContent = {
  generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
  overview_text: 'Draft overview copy.',
  seo_title: 'Draft SEO title',
  seo_meta_description: 'Draft SEO description',
  faq_json: [{ question: 'Draft Q?', answer: 'Draft A.' }],
  version: 3,
}

const staleContent = {
  generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE,
  overview_text: 'Stale overview copy.',
  seo_title: 'Stale SEO title',
  seo_meta_description: 'Stale SEO description',
  faq_json: [{ question: 'Stale Q?', answer: 'Stale A.' }],
  version: 2,
}

const rejectedContent = {
  generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED,
  overview_text: 'Rejected overview copy.',
  seo_title: 'Rejected SEO title',
  seo_meta_description: 'Rejected SEO description',
  faq_json: [{ question: 'Rejected Q?', answer: 'Rejected A.' }],
}

const failedContent = {
  generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED,
  overview_text: 'Failed overview copy.',
  seo_title: 'Failed SEO title',
  seo_meta_description: 'Failed SEO description',
  faq_json: [],
  error_message: 'timeout',
}

assert(
  isDraftProductContentPubliclyVisible({ DEV: true, VITE_SHOW_DRAFT_PRODUCT_CONTENT: '' }),
  'draft content defaults to visible in dev when env unset',
)
assert(
  !isDraftProductContentPubliclyVisible({ DEV: false, VITE_SHOW_DRAFT_PRODUCT_CONTENT: '' }),
  'draft content defaults to hidden in production when env unset',
)
assert(
  isDraftProductContentPubliclyVisible({ DEV: false, VITE_SHOW_DRAFT_PRODUCT_CONTENT: 'true' }),
  'draft content visible when env explicitly true',
)
assert(
  !isDraftProductContentPubliclyVisible({ DEV: true, VITE_SHOW_DRAFT_PRODUCT_CONTENT: 'false' }),
  'draft content hidden when env explicitly false',
)

assert(
  getEquipmentProductContentBadgeLabel(EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT) === 'Draft content',
  'draft badge label',
)
assert(
  getEquipmentProductContentBadgeLabel(EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE) === 'Stale content',
  'stale badge label',
)
assert(
  getEquipmentProductContentBadgeLabel(EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) === null,
  'approved content has no badge',
)

const approvedPage = resolveEquipmentProductPageContent({
  contentRow: approvedContent,
  showDraftAndStale: true,
})
assert(approvedPage.content?.overview_text === 'Approved overview copy.', 'approved content displays')
assert(approvedPage.contentBadgeLabel === null, 'approved content has no badge')
assert(approvedPage.seo?.title === 'Approved SEO title', 'approved SEO used in page meta')
assert(approvedPage.seo?.description === 'Approved SEO description', 'approved SEO description used')

const draftOnlyPage = resolveEquipmentProductPageContent({
  contentRow: draftContent,
  showDraftAndStale: true,
})
assert(draftOnlyPage.content?.overview_text === 'Draft overview copy.', 'draft content displays when enabled')
assert(draftOnlyPage.contentBadgeLabel === 'Draft content', 'draft badge shown')
assert(draftOnlyPage.seo === null, 'draft SEO not applied to public metadata')

const staleOnlyPage = resolveEquipmentProductPageContent({
  contentRow: staleContent,
  showDraftAndStale: true,
})
assert(staleOnlyPage.content?.overview_text === 'Stale overview copy.', 'stale content displays when enabled')
assert(staleOnlyPage.contentBadgeLabel === 'Stale content', 'stale badge shown')
assert(staleOnlyPage.seo === null, 'stale SEO not applied to public metadata')

const draftHiddenWhenFlagOff = resolveEquipmentProductPageContent({
  contentRow: draftContent,
  showDraftAndStale: false,
})
assert(!draftHiddenWhenFlagOff.content, 'draft hidden when public draft flag is off')

const staleHiddenWhenFlagOff = resolveEquipmentProductPageContent({
  contentRow: staleContent,
  showDraftAndStale: false,
})
assert(!staleHiddenWhenFlagOff.content, 'stale hidden when public draft flag is off')

const rejectedPage = resolveEquipmentProductPageContent({
  contentRow: rejectedContent,
  showDraftAndStale: true,
})
assert(!rejectedPage.content, 'rejected content hidden from page')

const failedPage = resolveEquipmentProductPageContent({
  contentRow: failedContent,
  showDraftAndStale: true,
})
assert(!failedPage.content, 'failed content hidden from page')

const noContentPage = resolveEquipmentProductPageContent({
  contentRow: null,
  showDraftAndStale: true,
})
assert(!noContentPage.content, 'no content row returns empty page content')

const emptyDisplayablePage = resolveEquipmentProductPageContent({
  contentRow: {
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
    overview_text: '   ',
    seo_title: 'Draft SEO title',
    seo_meta_description: 'Draft SEO description',
    faq_json: [],
  },
  showDraftAndStale: true,
})
assert(!emptyDisplayablePage.content, 'blank overview and no FAQs hidden from page')

assert(
  normalizeEquipmentProductFaqEntries([
    { question: 'Q1', answer: 'A1' },
    { question: '', answer: 'skip' },
  ]).length === 1,
  'empty FAQ entries removed for display',
)

const publishRows = [
  { id: 'c1', equipment_product_id: 'p1', brand: 'Life Fitness', generation_status: 'draft' },
  { id: 'c2', equipment_product_id: 'p2', brand: 'Life Fitness', generation_status: 'approved' },
  { id: 'c3', equipment_product_id: 'p3', brand: 'Life Fitness', generation_status: 'failed' },
  { id: 'c4', equipment_product_id: 'p4', brand: 'Technogym', generation_status: 'draft' },
  { id: 'c5', equipment_product_id: 'p5', brand: 'Technogym', generation_status: 'rejected' },
]

const publishSummary = summarizeEquipmentProductContentStatuses(publishRows)
assert(publishSummary.draft === 2, 'publish summary draft count')
assert(publishSummary.published === 1, 'publish summary published maps from approved')
assert(publishSummary.failed === 1, 'publish summary failed count')

assert(getEquipmentProductContentStatusLabel('approved') === 'Published', 'approved labelled Published')
assert(getEquipmentProductContentStatusLabel('draft') === 'Draft', 'draft labelled Draft')
assert(isPublishableEquipmentProductContent({ id: 'c1', generation_status: 'draft' }), 'draft is publishable')
assert(!isPublishableEquipmentProductContent({ generation_status: 'draft' }), 'draft without content id is not publishable')
assert(!isPublishableEquipmentProductContent({ generation_status: 'failed' }), 'failed is not publishable')
assert(!isPublishableEquipmentProductContent({ generation_status: 'approved' }), 'approved is not publishable')
assert(!isPublishableEquipmentProductContent({ id: 'missing:p1', generation_status: null }), 'missing placeholder is not publishable')

assert(
  resolveDraftContentIdsForPublish({
    rows: publishRows,
    scope: CONTENT_PUBLISH_SCOPE.SELECTED,
    selectedIds: ['c1', 'c2', 'c3'],
  }).join(',') === 'c1',
  'selected publish only includes drafts',
)

assert(
  resolveDraftContentIdsForPublish({
    rows: publishRows,
    scope: CONTENT_PUBLISH_SCOPE.CURRENT_BRAND,
    brand: 'Life Fitness',
  }).join(',') === 'c1',
  'current brand publish only drafts for brand',
)

assert(
  resolveDraftContentIdsForPublish({
    rows: publishRows,
    scope: CONTENT_PUBLISH_SCOPE.ALL_DRAFTS,
  }).sort().join(',') === 'c1,c4',
  'all drafts publish ignores failed/rejected/approved',
)

assert(
  resolveDraftContentIdsForPublish({
    rows: publishRows,
    scope: CONTENT_PUBLISH_SCOPE.CURRENT_BRAND,
    brand: null,
  }).length === 0,
  'current brand without brand filter publishes nothing',
)

const publishUpdate = buildPublishEquipmentProductContentUpdate()
assert(
  Object.keys(publishUpdate).join(',') === 'generation_status',
  'publish update only changes generation_status',
)
assert(publishUpdate.generation_status === 'approved', 'publish sets approved status')

assert(
  buildPublishDraftsConfirmationMessage(187).includes('publish 187 draft descriptions'),
  'confirmation message includes count',
)
assert(
  buildPublishDraftsConfirmationMessage(187).includes('visible on public equipment pages'),
  'confirmation message warns about public visibility',
)
assert(
  buildPublishDraftsConfirmationMessage(187).includes('does not approve or publish the canonical product'),
  'confirmation message clarifies product status is unchanged',
)

// --- Admin Product Content list eligibility (pending/needs_review before approval) ---
const listProducts = [
  {
    id: 'peloton-bike',
    brand: 'Peloton',
    model: 'Bike',
    status: PRODUCT_STATUS.PENDING,
    canonical_product_name: 'Peloton Bike',
    canonical_product_key: 'peloton-bike',
    original_base_price: null,
    baseline_manufacture_year: 2014,
  },
  {
    id: 'nordic-1750',
    brand: 'NordicTrack',
    model: 'Commercial 1750',
    status: PRODUCT_STATUS.NEEDS_REVIEW,
    canonical_product_name: 'NordicTrack Commercial 1750',
    canonical_product_key: 'nordictrack-1750',
    original_base_price: 1999,
    baseline_manufacture_year: 2011,
  },
  {
    id: 'bowflex-m5',
    brand: 'BowFlex',
    model: 'M5',
    status: PRODUCT_STATUS.PENDING,
    canonical_product_name: 'BowFlex Max Trainer M5',
    canonical_product_key: 'bowflex-m5',
    original_base_price: 1499,
    baseline_manufacture_year: 2014,
  },
  {
    id: 'lf-tread',
    brand: 'Life Fitness',
    model: 'Treadmill',
    status: PRODUCT_STATUS.APPROVED,
    canonical_product_name: 'Life Fitness Integrity Series Treadmill',
    canonical_product_key: 'lf-tread',
    original_base_price: 8500,
    baseline_manufacture_year: 2017,
  },
  {
    id: 'excluded-1',
    brand: 'Peloton',
    model: 'Deprecated',
    status: PRODUCT_STATUS.EXCLUDED,
    canonical_product_name: 'Peloton Deprecated',
    canonical_product_key: 'peloton-deprecated',
    original_base_price: 100,
    baseline_manufacture_year: 2020,
  },
]

const listContent = [
  {
    id: 'content-lf',
    equipment_product_id: 'lf-tread',
    generation_status: 'draft',
    overview_text: 'Commercial treadmill overview',
  },
]

const adminContentRows = buildAdminProductContentListRows(listProducts, listContent)
assert(adminContentRows.length === 4, 'eligible products appear including pending/needs_review')
assert(
  adminContentRows.some((row) => row.brand === 'Peloton' && row.product_status === 'pending'),
  'pending Peloton product appears in Product Content',
)
assert(
  adminContentRows.some((row) => row.brand === 'NordicTrack' && row.product_status === 'needs_review'),
  'needs_review NordicTrack product appears',
)
assert(
  adminContentRows.some((row) => row.brand === 'BowFlex' && row.product_status === 'pending'),
  'pending BowFlex product appears',
)
assert(
  adminContentRows.some((row) => row.brand === 'Life Fitness' && row.generation_status === 'draft'),
  'approved commercial products still appear',
)
assert(
  !adminContentRows.some((row) => row.product_status === 'excluded'),
  'excluded products do not appear',
)
assert(
  !isEligibleAdminProductContentProduct(listProducts.find((p) => p.status === PRODUCT_STATUS.EXCLUDED)),
  'excluded products are not eligible',
)

const pelotonRow = adminContentRows.find((row) => row.equipment_product_id === 'peloton-bike')
assert(pelotonRow.generation_status == null, 'pending product without content shows Missing')
assert(pelotonRow.incomplete_source.missingPrice === true, 'missing price flagged as incomplete source')
assert(pelotonRow.incomplete_source.incomplete === true, 'incomplete source warning present')
assert(
  !productHasIncompleteContentSourceData(listProducts[1]).incomplete,
  'complete priced product has no incomplete warning',
)
assert(
  matchesAdminContentProductStatusFilter(pelotonRow, 'pending'),
  'product status filter matches pending',
)
assert(
  matchesAdminContentGenerationStatusFilter(pelotonRow, 'missing'),
  'generation filter matches missing content',
)
assert(
  !isPublishableEquipmentProductContent(pelotonRow),
  'missing content cannot be published',
)

const lfRow = adminContentRows.find((row) => row.equipment_product_id === 'lf-tread')
assert(isPublishableEquipmentProductContent(lfRow), 'draft content remains publishable')
assert(
  resolveDraftContentIdsForPublish({
    rows: adminContentRows,
    scope: CONTENT_PUBLISH_SCOPE.SELECTED,
    selectedIds: [lfRow.id, pelotonRow.id],
  }).join(',') === 'content-lf',
  'publish selection publishes draft content ids only',
)

assert(lfRow.product_status === PRODUCT_STATUS.APPROVED, 'list row preserves approved product status')
assert(pelotonRow.product_status === PRODUCT_STATUS.PENDING, 'list row preserves pending product status')
assert(
  Object.keys(buildPublishEquipmentProductContentUpdate()).join(',') === 'generation_status',
  'publish update never touches equipment_products fields',
)

// --- Technogym Crossover cardio protected handling ---

const crossoverProduct = {
  brand: 'Technogym',
  product_family: 'Excite',
  model: 'Crossover',
  equipment_type: 'Cross Trainer',
  canonical_product_name: 'Technogym Excite Crossover',
}

const crossoverMislabelled = {
  brand: 'Technogym',
  model: 'Excite Crossover',
  equipment_type: 'Functional Trainer',
  canonical_product_name: 'Technogym Excite Crossover',
}

assert(isTechnogymCrossoverCardioProduct(crossoverProduct), 'detects Technogym Excite Crossover')
assert(
  isTechnogymCrossoverCardioProduct({
    brand: 'Technogym',
    model: 'Crossover',
    canonical_product_name: 'Technogym Crossover',
  }),
  'detects Technogym Crossover',
)
assert(
  isTechnogymCrossoverCardioProduct({
    brand: 'Technogym',
    model: 'Excite Crossover',
    canonical_product_name: 'Excite Crossover',
  }),
  'detects Excite Crossover',
)
assert(
  !isTechnogymCrossoverCardioProduct({
    brand: 'Technogym',
    model: 'Cable Crossover',
    canonical_product_name: 'Technogym Cable Crossover',
  }),
  'does not treat cable crossover as cardio protected product',
)
assert(
  !isTechnogymCrossoverCardioProduct({
    brand: 'Technogym',
    model: 'CROSSOVER CABLES',
    product_family: 'Selection',
    equipment_type: 'Cross Trainer',
    canonical_product_name: 'Technogym Selection Classic Crossover',
  }),
  'does not treat Selection Crossover Cables as cardio protected product',
)
assert(
  !isTechnogymCrossoverCardioProduct({
    brand: 'Technogym',
    model: 'CROSSOVER CABLES',
    product_family: 'Element +',
    equipment_type: 'Cross Trainer',
    canonical_product_name: 'Technogym Element+ Crossover',
  }),
  'does not treat Element+ Crossover Cables as cardio protected product',
)
assert(
  !isTechnogymCrossoverCardioProduct({
    brand: 'Life Fitness',
    model: 'Cable Crossover',
    canonical_product_name: 'Life Fitness Cable Crossover',
  }),
  'does not match other-brand cable crossover',
)

assert(
  resolveProductContentCategory(crossoverProduct) === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'Crossover resolves as cardio',
)
assert(
  resolveProductContentCategory(crossoverMislabelled) === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'Crossover forced to cardio even if equipment_type is strength/functional',
)

const crossoverCableTypedPayload = buildProductContentSourcePayload({
  brand: 'Technogym',
  model: 'CROSSOVER 700',
  product_family: 'Excite',
  equipment_type: 'Cable Machine',
  canonical_product_name: 'Technogym Excite Crossover 700',
})
assert(crossoverCableTypedPayload.equipment_category === PRODUCT_CONTENT_CATEGORIES.CARDIO, 'miscategorised Excite Crossover still cardio')
assert(crossoverCableTypedPayload.equipment_type === 'Cross Trainer', 'payload overrides cable equipment_type for LLM')
assert(
  crossoverCableTypedPayload.protected_product_identity === 'technogym_crossover_cardio_cross_trainer',
  'payload includes protected identity flag',
)

const crossoverPayload = buildProductContentSourcePayload(crossoverProduct, {
  consoleOptions: [{
    console_name: 'Unity',
    tier: 'premium',
    release_year: 2017,
    retired_year: null,
    modifier_percent: 10,
    is_active: true,
  }],
})
assert(crossoverPayload.equipment_category === PRODUCT_CONTENT_CATEGORIES.CARDIO, 'payload category cardio')

const crossoverSystemPrompt = buildProductContentSystemPrompt(
  crossoverPayload.equipment_category,
  { sourcePayload: crossoverPayload },
)
assert(
  crossoverSystemPrompt.includes('NOT a cable crossover'),
  'system prompt includes protected crossover context',
)
assert(
  crossoverSystemPrompt.includes(TECHNOGYM_CROSSOVER_CARDIO_PROMPT_CONTEXT.split('\n')[0]),
  'system prompt includes protected section heading',
)

const crossoverUserPrompt = buildCategoryProductContentUserPrompt(crossoverPayload)
assert(
  crossoverUserPrompt.includes('commercial cardio cross trainer'),
  'user prompt includes protected crossover context',
)

assert(
  findTechnogymCrossoverStrengthTerms('features cables and a weight stack with dual pulley arms').join(',')
    === 'cable,pulley,weight stack,dual pulley',
  'detects strength terms for crossover validation',
)
assert(
  findTechnogymCrossoverStrengthTerms(
    'The Technogym Excite Crossover is a commercial cross trainer manufactured from around 2015.',
  ).length === 0,
  'allows cardio wording that includes product name Crossover',
)

const validCrossoverOverview = [
  'The Technogym Excite Crossover is a commercial cardio cross trainer from the Excite range,',
  'manufactured from around 2015. It was developed for elliptical-style cardio training in commercial gyms',
  'and was available with the Unity console configuration. The estimated original RRP was approximately £7,500.',
  'Manufacture year, condition and console configuration can all significantly affect its current used value.',
].join(' ')

const crossoverParsed = parseProductContentResponse(JSON.stringify({
  overview_text: validCrossoverOverview,
  seo_title: 'Technogym Excite Crossover used value guide',
  seo_meta_description: 'Technogym Excite Crossover cross trainer used value guide with manufacture year and console context.',
  faqs: [
    { question: 'What type of equipment is the Technogym Excite Crossover?', answer: 'A commercial cardio cross trainer from the Excite range.' },
    { question: 'What affects used value?', answer: 'Manufacture year, condition and console configuration.' },
  ],
}), crossoverPayload)
assert(crossoverParsed.overview_text.includes('cross trainer'), 'accepts valid crossover cardio overview')

let rejectedCrossoverStrength = false
try {
  parseProductContentResponse(JSON.stringify({
    overview_text: [
      'The Technogym Excite Crossover is a commercial cable crossover with dual pulley stations',
      'and a selectorised weight stack for chest fly and functional trainer workouts.',
      'It was manufactured from around 2015 and is suited to strength exercises in gyms.',
      'Manufacture year and overall condition affect used value for this pin-loaded machine.',
    ].join(' '),
    seo_title: 'Technogym Excite Crossover used value guide',
    seo_meta_description: 'Technogym Excite Crossover overview.',
    faqs: [
      { question: 'Q1?', answer: 'A1.' },
      { question: 'Q2?', answer: 'A2.' },
    ],
  }), crossoverPayload)
} catch (error) {
  rejectedCrossoverStrength = error.message.includes('must not describe Technogym Crossover')
}
assert(rejectedCrossoverStrength, 'rejects strength-machine terminology for Technogym Crossover')

// --- Generate missing drafts eligibility + home-use safety ---

const pendingMissing = {
  id: 'p-pending',
  brand: 'Peloton',
  model: 'Bike',
  canonical_product_name: 'Peloton Bike',
  equipment_type: 'Exercise Bike',
  status: PRODUCT_STATUS.PENDING,
  original_base_price: null,
}

assert(
  evaluateMissingDraftGenerationEligibility(pendingMissing, null).eligible === true,
  'pending product missing content is eligible',
)

assert(
  evaluateMissingDraftGenerationEligibility({
    ...pendingMissing,
    status: PRODUCT_STATUS.NEEDS_REVIEW,
  }, null).eligible === true,
  'needs_review product missing content is eligible',
)

assert(
  evaluateMissingDraftGenerationEligibility({
    ...pendingMissing,
    status: PRODUCT_STATUS.APPROVED,
  }, null).eligible === true,
  'approved product missing content is eligible',
)

assert(
  evaluateMissingDraftGenerationEligibility({
    ...pendingMissing,
    status: PRODUCT_STATUS.EXCLUDED,
  }, null).eligible === false,
  'excluded product is ineligible',
)

assert(
  evaluateMissingDraftGenerationEligibility(pendingMissing, {
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
  }).reason === 'draft_exists',
  'existing draft is skipped',
)

assert(
  evaluateMissingDraftGenerationEligibility(pendingMissing, {
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED,
  }).reason === 'approved_content_exists',
  'approved content is skipped',
)

assert(
  evaluateMissingDraftGenerationEligibility(pendingMissing, {
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED,
  }).eligible === true,
  'failed content can be retried',
)

assert(
  evaluateMissingDraftGenerationEligibility({
    ...pendingMissing,
    original_base_price: null,
  }, null).eligible === true,
  'missing price remains eligible',
)

const noPricePayload = buildProductContentSourcePayload({
  ...pendingMissing,
  status: PRODUCT_STATUS.APPROVED,
  original_base_price: null,
})
assert(noPricePayload.original_base_price == null, 'source payload does not invent price')
assert(noPricePayload.usage_segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME, 'Peloton uses premium_home segment')

const premiumHomeFixtures = [
  { brand: 'Peloton', model: 'Bike', name: 'Peloton Bike', type: 'Exercise Bike' },
  { brand: 'Peloton', model: 'Bike+', name: 'Peloton Bike+', type: 'Exercise Bike' },
  { brand: 'NordicTrack', model: 'Commercial 1750', name: 'NordicTrack Commercial 1750', type: 'Treadmill' },
  { brand: 'NordicTrack', model: 'S22i', name: 'NordicTrack S22i', type: 'Exercise Bike' },
  { brand: 'BowFlex', model: 'Max Trainer M6', name: 'BowFlex Max Trainer M6', type: 'Elliptical' },
  { brand: 'BowFlex', model: 'VeloCore 16i', name: 'BowFlex VeloCore 16i', type: 'Exercise Bike' },
]

for (const fixture of premiumHomeFixtures) {
  assert(isHomeUseContentBrand(fixture.brand), `${fixture.brand} is home-use brand`)
  const payload = buildProductContentSourcePayload({
    id: `home-${fixture.model}`,
    brand: fixture.brand,
    model: fixture.model,
    canonical_product_name: fixture.name,
    equipment_type: fixture.type,
    status: PRODUCT_STATUS.APPROVED,
    original_base_price: null,
  })
  assert(payload.usage_segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME, `${fixture.name} usage_segment premium_home`)
  assert(payload.equipment_type === fixture.type, `${fixture.name} keeps equipment type`)
  const commercialClaim = [
    `${fixture.name} is built with commercial construction for continuous club use on the gym floor.`,
  ].join(' ')
  assert(findHomeUseCommercialPhrases(commercialClaim).length > 0, `${fixture.name} detects commercial claims`)
  let rejected = false
  try {
    validateHomeUseOverviewWording(commercialClaim, payload)
  } catch {
    rejected = true
  }
  assert(rejected, `${fixture.name} rejects commercial-only overview wording`)

  const safeOverview = [
    `The ${fixture.name} is home fitness equipment in the ${fixture.type.toLowerCase()} category.`,
    'Used value depends on age, condition, and overall specification where known.',
  ].join(' ')
  validateHomeUseOverviewWording(safeOverview, payload)
}

const mainstreamHomeFixtures = [
  { brand: 'ProForm', model: 'Pro 2000', name: 'ProForm Pro 2000', type: 'Treadmill' },
  { brand: 'Sole', model: 'F85', name: 'Sole F85', type: 'Treadmill' },
  { brand: 'Horizon Fitness', model: '7.0 AT', name: 'Horizon Fitness 7.0 AT', type: 'Treadmill' },
  { brand: 'York Fitness', model: 'Barbarian', name: 'York Fitness Barbarian', type: 'Multi Gym' },
  { brand: 'Reebok', model: 'Jet 300', name: 'Reebok Jet 300', type: 'Treadmill' },
  { brand: 'Schwinn', model: 'IC4', name: 'Schwinn IC4', type: 'Exercise Bike' },
  { brand: 'WaterRower', model: 'A1', name: 'WaterRower A1', type: 'Rower' },
]

for (const fixture of mainstreamHomeFixtures) {
  assert(isHomeUseContentBrand(fixture.brand), `${fixture.brand} is home brand`)
  const segment = resolveProductContentUsageSegment({
    brand: fixture.brand,
    equipment_type: fixture.type,
    model: fixture.model,
  })
  assert(segment === CONTENT_USAGE_SEGMENT.HOME, `${fixture.name} usage_segment home`)
  const payload = buildProductContentSourcePayload({
    id: `mh-${fixture.model}`,
    brand: fixture.brand,
    model: fixture.model,
    canonical_product_name: fixture.name,
    equipment_type: fixture.type,
    status: PRODUCT_STATUS.APPROVED,
  })
  let rejectedHomeCommercial = false
  try {
    validateHomeUseOverviewWording(
      `${fixture.name} is suitable for commercial gyms and ideal for health clubs in busy fitness facilities.`,
      payload,
    )
  } catch {
    rejectedHomeCommercial = true
  }
  assert(rejectedHomeCommercial, `${fixture.name} rejects commercial gym claims`)
}

assert(
  resolveProductContentUsageSegment({ brand: 'Wattbike', equipment_type: 'Exercise Bike' })
    === CONTENT_USAGE_SEGMENT.LIGHT_COMMERCIAL,
  'Wattbike is light_commercial',
)
assert(
  resolveProductContentUsageSegment({ brand: 'Life Fitness', equipment_type: 'Chest Press' })
    === CONTENT_USAGE_SEGMENT.STRENGTH,
  'commercial brand strength stays strength-neutral',
)
assert(
  resolveProductContentUsageSegment({ brand: 'ProForm', equipment_type: 'Multi Gym' })
    === CONTENT_USAGE_SEGMENT.HOME,
  'home-brand strength stays home',
)

const commercialIntegrityPayload = buildProductContentSourcePayload({
  brand: 'Life Fitness',
  product_family: 'Integrity Series',
  model: 'Treadmill',
  equipment_type: 'Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
  status: PRODUCT_STATUS.APPROVED,
})
assert(commercialIntegrityPayload.usage_segment === CONTENT_USAGE_SEGMENT.COMMERCIAL, 'LF Integrity is commercial')
assert(
  findCommercialHomePhrases('This home treadmill is designed for home use and ideal for home gyms.').length > 0,
  'detects home wording on commercial copy',
)
let rejectedCommercialHome = false
try {
  validateCommercialOverviewWording(
    'The Life Fitness Integrity Series Treadmill is a home treadmill designed for home use.',
    commercialIntegrityPayload,
  )
} catch {
  rejectedCommercialHome = true
}
assert(rejectedCommercialHome, 'commercial brands reject home treadmill claims')

const crossoverHomePayload = buildProductContentSourcePayload({
  brand: 'BowFlex',
  model: 'Max Trainer M6',
  canonical_product_name: 'BowFlex Max Trainer M6',
  equipment_type: 'Cross Trainer',
  status: PRODUCT_STATUS.APPROVED,
})
assert(crossoverHomePayload.equipment_type === 'Cross Trainer', 'preserves cross trainer type')

const previewProducts = [
  pendingMissing,
  {
    id: 'p-draft',
    brand: 'Peloton',
    model: 'Tread',
    canonical_product_name: 'Peloton Tread',
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    id: 'p-approved-content',
    brand: 'NordicTrack',
    model: 'S22i',
    canonical_product_name: 'NordicTrack S22i',
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    id: 'p-excluded',
    brand: 'BowFlex',
    model: 'X',
    canonical_product_name: 'BowFlex X',
    status: PRODUCT_STATUS.EXCLUDED,
  },
  {
    id: 'p-lf',
    brand: 'Life Fitness',
    model: 'T5',
    canonical_product_name: 'Life Fitness T5',
    status: PRODUCT_STATUS.APPROVED,
  },
]

const previewContent = {
  'p-draft': { generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT },
  'p-approved-content': { generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED },
}

const preview = buildGenerateMissingPreview({
  products: previewProducts,
  contentByProductId: previewContent,
})
assert(preview.eligible === 2, 'preview counts eligible missing (Peloton pending + Life Fitness)')
assert(preview.skipped_draft === 1, 'preview counts existing draft')
assert(preview.skipped_approved === 1, 'preview counts approved content')
assert(preview.invalid === 1, 'preview counts excluded')
assert(preview.brands_affected.includes('Peloton'), 'preview brands include Peloton')
assert(preview.brands_affected.includes('Life Fitness'), 'preview brands include Life Fitness')

const brandFilteredPreview = buildGenerateMissingPreview({
  products: previewProducts.filter((product) => product.brand === 'Peloton'),
  contentByProductId: previewContent,
})
assert(brandFilteredPreview.eligible === 1, 'brand filter limits eligible set')
assert(brandFilteredPreview.brands_affected.join(',') === 'Peloton', 'brand filter brands')

const secondRunPreview = buildGenerateMissingPreview({
  products: [pendingMissing],
  contentByProductId: {
    'p-pending': { generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT },
  },
})
assert(secondRunPreview.eligible === 0, 'second run creates zero drafts when draft exists')

let progress = emptyGenerateMissingProgress(3)
progress = applyGenerateMissingStepResult(progress, {
  created: 1,
  skipped: 1,
  failed: 1,
  failures: [{ product_id: 'x', name: 'X', reason: 'boom' }],
})
assert(progress.completed === 3, 'step progress counts completed')
assert(progress.failed === 1, 'step progress tracks failure')
assert(progress.failures.length === 1, 'step progress keeps failure details')

const chunks = chunkProductIds(['a', 'b', 'c', 'd', 'e', 'f'], GENERATE_MISSING_MAX_PER_STEP)
assert(chunks.length === 2, 'chunkProductIds splits batches')
assert(chunks[0].length === GENERATE_MISSING_MAX_PER_STEP, 'first chunk sized to max per step')

const runSummary = summarizeGenerateMissingRun({ preview, progress })
assert(runSummary.drafts_created === 1, 'run summary drafts created')
assert(runSummary.failed === 1, 'run summary failed')

const adminPreview = previewGenerateMissingFromAdminRows({
  filteredRows: [
    buildAdminProductContentListRow(pendingMissing, null),
    buildAdminProductContentListRow({
      id: 'p-draft',
      brand: 'Peloton',
      model: 'Tread',
      canonical_product_name: 'Peloton Tread',
      status: PRODUCT_STATUS.APPROVED,
    }, {
      id: 'c1',
      generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
      overview_text: 'draft',
    }),
  ],
  selectedIds: new Set(),
  scope: 'filtered',
})
assert(adminPreview.eligible === 1, 'admin preview shares eligibility with CLI helpers')
assert(adminPreview.skipped_draft === 1, 'admin preview skips drafts')

assert(
  resolveProductContentUsageSegment({ brand: 'Life Fitness' }) === CONTENT_USAGE_SEGMENT.COMMERCIAL,
  'commercial brands stay commercial',
)

const upsertDraft = buildProductContentUpsertRow({
  productId: 'p-pending',
  generated: {
    overview_text: 'The Peloton Bike is home fitness equipment. Used value depends on age and condition.',
    seo_title: 'Peloton Bike used value',
    seo_meta_description: 'Overview of the Peloton Bike for valuation.',
    faq_json: [
      { question: 'What affects value?', answer: 'Age and condition.' },
      { question: 'Is there an RRP?', answer: 'No RRP is recorded for this draft.' },
    ],
    ai_model: 'test',
  },
  sourceHash: 'abc',
  existingContent: null,
})
assert(upsertDraft.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT, 'upserts as draft only')
assert(upsertDraft.approved_at == null, 'does not auto-publish')
assert(upsertDraft.approved_by == null, 'does not set approver')

// --- Indoor Bike routing + category incompatible terminology ---

const veloCoreProduct = {
  brand: 'BowFlex',
  product_family: 'Velocore',
  model: 'VeloCore 16i',
  equipment_type: 'Indoor Bike',
  canonical_product_name: 'BowFlex VeloCore 16i',
  status: PRODUCT_STATUS.APPROVED,
  baseline_manufacture_year: 2021,
  original_base_price: 2499,
  original_base_price_currency: 'GBP',
}

const veloPayload = buildProductContentSourcePayload(veloCoreProduct)
assert(veloPayload.equipment_category === PRODUCT_CONTENT_CATEGORIES.CARDIO, 'VeloCore routes to cardio')
assert(veloPayload.usage_segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME, 'VeloCore premium_home')
assert(
  resolveProductContentCategory({ brand: 'Peloton', equipment_type: 'Indoor Bike', model: 'Bike', canonical_product_name: 'Peloton Bike' })
    === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'Peloton Bike Indoor Bike routes to cardio',
)
assert(
  resolveProductContentCategory({
    brand: 'Test',
    equipment_type: 'Spin Bike',
    model: 'Studio',
    canonical_product_name: 'Test Spin Bike',
  }) === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'Spin Bike routes to cardio',
)
assert(
  resolveProductContentCategory({
    brand: 'NordicTrack',
    equipment_type: 'Studio Cycle',
    model: 'S22i',
    canonical_product_name: 'NordicTrack Studio Cycle S22i',
  }) === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'Studio Cycle routes to cardio',
)
assert(
  resolveProductContentCategory({
    brand: 'NordicTrack',
    equipment_type: 'Rowers',
    model: 'RW900',
    canonical_product_name: 'NordicTrack Rower RW900',
  }) === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'plural Rowers routes to cardio',
)
assert(
  resolveProductContentCategory({ brand: 'NordicTrack', equipment_type: 'Indoor Bike', model: 'S22i', canonical_product_name: 'NordicTrack Studio Cycle S22i' })
    === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'NordicTrack S22i Indoor Bike routes to cardio',
)
assert(
  buildProductContentSourcePayload({
    brand: 'Peloton',
    equipment_type: 'Indoor Bike',
    model: 'Bike+',
    canonical_product_name: 'Peloton Bike+',
  }).equipment_category === PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'Peloton Bike+ cannot route to strength prompts',
)

const invalidVeloOverview = [
  'The BowFlex VeloCore 16i is a selectorised strength indoor bike from the VeloCore family,',
  'manufactured from around 2021. Its estimated original RRP was approximately £2,499.',
  'Manufacture year and overall condition affect used value for home fitness owners.',
].join(' ')

let rejectedVeloStrength = false
try {
  validateCategoryIncompatibleTerminology(invalidVeloOverview, veloPayload)
} catch (error) {
  rejectedVeloStrength = /incompatible with indoor_bike/i.test(error.message)
    && /selectori/i.test(error.message)
}
assert(rejectedVeloStrength, 'VeloCore 16i cannot produce selectorised strength')
assert(
  findCategoryIncompatibleTerms(invalidVeloOverview, veloPayload).includes('selectorised strength'),
  'indoor bike rejects strength terminology',
)

const maxTrainerPayload = buildProductContentSourcePayload({
  brand: 'BowFlex',
  model: 'M6',
  equipment_type: 'Cross Trainer',
  canonical_product_name: 'BowFlex Max Trainer M6',
  product_family: 'Max Trainer',
})
assert(
  findCategoryIncompatibleTerms(
    'This cable crossover strength crossover with weight stack crossover selectorised crossover.',
    maxTrainerPayload,
  ).length >= 1,
  'cross trainer rejects cable-crossover interpretation',
)

const treadPayload = buildProductContentSourcePayload({
  brand: 'BowFlex',
  model: 'Treadmill 22',
  equipment_type: 'Treadmill',
  canonical_product_name: 'BowFlex Treadmill 22',
})
assert(
  findCategoryIncompatibleTerms(
    'This indoor bike and rowing machine with cycling bike features.',
    treadPayload,
  ).some((term) => /bike|rowing/i.test(term)),
  'treadmill rejects bike/rower terminology',
)

const rowerPayload = buildProductContentSourcePayload({
  brand: 'NordicTrack',
  model: 'RW900',
  equipment_type: 'Rowers',
  canonical_product_name: 'NordicTrack Rower RW900',
  original_base_price: null,
})
assert(
  findCategoryIncompatibleTerms(
    'This treadmill indoor bike cross trainer machine.',
    rowerPayload,
  ).length >= 1,
  'rowing machine rejects treadmill/bike terminology',
)

assert(rowerPayload.original_base_price == null, 'missing RRP stays null not zero')
assert(
  buildProductContentSourcePayload({
    brand: 'Peloton',
    model: 'Bike',
    equipment_type: 'Indoor Bike',
    canonical_product_name: 'Peloton Bike',
    original_base_price: null,
  }).original_base_price == null,
  'Peloton Bike missing RRP never becomes zero',
)

const pelotonHomePayload = buildProductContentSourcePayload({
  brand: 'Peloton',
  model: 'Bike',
  equipment_type: 'Indoor Bike',
  canonical_product_name: 'Peloton Bike',
})
assert(pelotonHomePayload.usage_segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME, 'Peloton Bike premium_home')
let rejectedPelotonCommercial = false
try {
  validateHomeUseOverviewWording(
    'Designed for commercial gym continuous club use on the gym floor with commercial construction.',
    pelotonHomePayload,
  )
} catch {
  rejectedPelotonCommercial = true
}
assert(rejectedPelotonCommercial, 'home-use products reject unsupported commercial claims')

assert(
  findInventedProductFeaturePhrases(
    'The bike includes a leaning mode and large touchscreen for classes.',
    veloPayload,
  ).includes('leaning mode'),
  'leaning mode rejected unless present in source data',
)
let rejectedLeaning = false
try {
  validateInventedProductFeatures(
    'The BowFlex VeloCore 16i includes a leaning mode for immersive rides and costs around £2,499.',
    veloPayload,
  )
} catch (error) {
  rejectedLeaning = /invents product features/i.test(error.message)
}
assert(rejectedLeaning, 'invented leaning mode fails validation')

let retriedInsteadOfSaving = false
const generatedWithRetry = await generateProductContentWithOpenAI({
  sourcePayload: veloPayload,
  apiKey: 'test-key',
  maxAttempts: 2,
  fetchImpl: async () => {
    retriedInsteadOfSaving = true
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              overview_text: [
                'The BowFlex VeloCore 16i is a selectorised strength indoor bike from the VeloCore family,',
                'manufactured from around 2021. Its estimated original RRP was approximately £2,499.',
                'Manufacture year and overall condition affect used market value for home buyers evaluating this machine.',
              ].join(' '),
              seo_title: 'BowFlex VeloCore 16i used value',
              seo_meta_description: 'Overview for valuation.',
              faqs: [
                { question: 'What year?', answer: 'Around 2021.' },
                { question: 'RRP?', answer: 'About £2,499.' },
              ],
            }),
          },
        }],
      }),
    }
  },
})
  .then(() => false)
  .catch((error) => /incompatible with indoor_bike|selectori/i.test(error.message))
assert(retriedInsteadOfSaving && generatedWithRetry, 'invalid drafts are retried rather than saved')

assert(
  evaluateMissingDraftGenerationEligibility(veloCoreProduct, {
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
  }).eligible === false,
  'valid existing drafts are not regenerated by missing-draft eligibility',
)

const retryUpsert = buildProductContentUpsertRow({
  productId: veloCoreProduct.id || 'velo-1',
  generated: {
    overview_text: [
      'The BowFlex VeloCore 16i is a home indoor cycling bike from the VeloCore range,',
      'manufactured from around 2021. Its estimated original RRP was approximately £2,499.',
      'Manufacture year, model identity and overall condition affect used market value.',
    ].join(' '),
    seo_title: 'BowFlex VeloCore 16i used value',
    seo_meta_description: 'Home indoor bike overview.',
    faq_json: [
      { question: 'What year?', answer: 'Around 2021.' },
      { question: 'RRP?', answer: 'About £2,499.' },
    ],
    ai_model: 'test',
  },
  sourceHash: 'hash',
  existingContent: {
    version: 1,
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
  },
})
assert(retryUpsert.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT, 'regenerated content remains draft')
assert(retryUpsert.approved_at == null, 'regeneration does not publish')

parseProductContentResponse(JSON.stringify({
  overview_text: [
    'The BowFlex VeloCore 16i is a home indoor cycling bike from the VeloCore family,',
    'manufactured from around 2021. It is designed for residential cycling workouts',
    'and sits within BowFlex connected-fitness positioning for home use. Its estimated',
    'original RRP was approximately £2,499. Manufacture year, exact model identity and',
    'overall condition are the main factors affecting its current used market value.',
  ].join(' '),
  seo_title: 'BowFlex VeloCore 16i used value guide',
  seo_meta_description: 'Overview of the BowFlex VeloCore 16i for valuation.',
  faqs: [
    { question: 'What year?', answer: 'Around 2021.' },
    { question: 'What was the RRP?', answer: 'About £2,499.' },
  ],
}), veloPayload)

console.log('equipment product content tests passed')
