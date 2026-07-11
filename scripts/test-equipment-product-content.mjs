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
} from '../src/lib/equipmentProductContent.js'
import {
  buildPublishDraftsConfirmationMessage,
  buildPublishEquipmentProductContentUpdate,
  CONTENT_PUBLISH_SCOPE,
  getEquipmentProductContentStatusLabel,
  isPublishableEquipmentProductContent,
  resolveDraftContentIdsForPublish,
  summarizeEquipmentProductContentStatuses,
} from '../src/lib/equipmentProductContentAdmin.js'

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
assert(isPublishableEquipmentProductContent({ generation_status: 'draft' }), 'draft is publishable')
assert(!isPublishableEquipmentProductContent({ generation_status: 'failed' }), 'failed is not publishable')
assert(!isPublishableEquipmentProductContent({ generation_status: 'approved' }), 'approved is not publishable')

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

console.log('equipment product content tests passed')
