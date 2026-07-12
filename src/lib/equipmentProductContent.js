import { createHash } from 'node:crypto'
import {
  buildProductContentSystemPrompt,
  buildProductContentUserPrompt as buildCategoryProductContentUserPrompt,
  isTechnogymCrossoverCardioProduct,
  OVERVIEW_WORD_MAX,
  OVERVIEW_WORD_MIN,
  resolveProductContentCategory,
  sourceAllowsConsoleMentions,
} from './equipmentProductContentPrompts.js'

export const EQUIPMENT_PRODUCT_CONTENT_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
  STALE: 'stale',
}

export const EQUIPMENT_PRODUCT_CONTENT_FIELDS = [
  'id',
  'equipment_product_id',
  'overview_text',
  'seo_title',
  'seo_meta_description',
  'faq_json',
  'generation_status',
  'source_data_hash',
  'ai_model',
  'generated_at',
  'approved_at',
  'approved_by',
  'error_message',
  'version',
  'created_at',
  'updated_at',
].join(', ')

export const DEFAULT_CONTENT_AI_MODEL = 'gpt-4o-mini'
export const CONTENT_OPENAI_TIMEOUT_MS = 60_000

export const BANNED_GENERIC_PHRASES = [
  'robust construction',
  'high performance',
  'high-quality',
  'high quality',
  'designed for comfort',
  'ideal for gyms',
  'suitable for a wide range',
  'suitable for all fitness levels',
  'excellent addition',
  'built to withstand',
  'reliable and durable',
  'innovative',
  'cutting-edge',
  'cutting edge',
  'state-of-the-art',
  'state of the art',
  'popular choice',
  'diverse user base',
  'high-traffic',
  'high traffic',
  'designed for high',
  'additional features',
  'features that may be present',
  'various factors',
  'typically utilized',
  'industry-leading',
  'industry leading',
  'world-class',
  'world class',
  'best-in-class',
  'best in class',
  'revolutionary',
  'game-changing',
  'game changing',
  'award-winning',
  'award winning',
  'unmatched',
  'unrivalled',
  'unrivaled',
  'unparalleled',
  'user comfort',
  'solid construction',
  'quality and performance',
  'versatile addition',
  'well-established option',
  'reliable and effective',
  'fitness enthusiasts',
  'wide range of users',
  'straightforward and effective',
  'enhance their strength',
  'strength training offerings',
  'robust design',
  'effective workout experience',
  'informed decisions',
  'valuable insights',
  'expand their cardio equipment offerings',
  'supports regular use',
  'practical choice',
  'reliable option',
  'suitable for commercial fitness settings',
  'commitment to quality',
  'suitable choice',
  'straightforward weight',
  'weight adjustments',
  'comprehensive workout',
  'effective running experience',
  'distinct functionalities',
  'stable and effective',
  'dedicated solution',
  'valuable addition',
  'consistent option',
  'regular use',
  'reliable choice',
  'reliable platform',
  'user-friendly',
  'reliability and performance',
  'user engagement',
  'ease of operation',
  'targeted solution',
  'focusing on functionality',
  'effective workouts',
  'effective workout',
  'accommodate various users',
  'diverse needs of users',
  'meet the demands',
  'known for its reliability',
  'known for its performance',
  'commercial setting',
  'ensuring that',
  'understanding these elements is essential',
  'collectively contribute',
  'make informed evaluations',
  'informed evaluations',
  "assessing the machine's worth",
  'potential buyers can evaluate',
  'based on its specifications and condition',
  'in production since',
  'has been in production since',
  'manufactured since',
  'known for its quality',
  'quality and durability',
  'robust solution',
  'effectively target',
  'well-suited for',
  'fitness environments',
  'designed for durability',
  'frequent use',
  'variety of workout',
  'solid choice',
  'suitable for various',
  'cardio workouts in fitness',
  'potential buyers',
  'seeking reliable',
  'factors essential',
  'reliable cardio equipment',
  'robust platform',
  'reliable performance',
  'maintenance history',
  'demand reliable',
  'tailored for fitness',
  'premium fitness facilities',
]

export const CONTINUOUS_PRODUCTION_PATTERNS = [
  /\bin production since\b/i,
  /\bhas been in production since\b/i,
  /\bmanufactured since\b/i,
  /\bproduction since\b/i,
]

export const INVENTED_MECHANICS_PHRASES = [
  'pin-loaded mechanism',
  'pin loaded mechanism',
  'running surface',
  'resistance system',
  'adjustable weights',
  'adjustable weight',
  'biomechanics',
  'movement path',
  'selectorised design',
  'weight stack',
]

/** Strength-machine terms that must never appear for Technogym Crossover cardio. */
export const TECHNOGYM_CROSSOVER_STRENGTH_TERMS = [
  { label: 'cable', pattern: /\bcables?\b/i },
  { label: 'pulley', pattern: /\bpulleys?\b/i },
  { label: 'weight stack', pattern: /\bweight\s+stacks?\b/i },
  { label: 'selectorised', pattern: /\bselectori[sz]ed\b/i },
  { label: 'pin-loaded', pattern: /\bpin[-\s]?loaded\b/i },
  { label: 'functional trainer', pattern: /\bfunctional\s+trainers?\b/i },
  { label: 'adjustable pulley', pattern: /\badjustable\s+pulleys?\b/i },
  { label: 'chest fly', pattern: /\bchest\s+fl(?:y|ies)\b/i },
  { label: 'crossover exercise', pattern: /\bcrossover\s+exercises?\b/i },
  { label: 'resistance arm', pattern: /\bresistance\s+arms?\b/i },
  { label: 'dual pulley', pattern: /\bdual\s+pulleys?\b/i },
]

export const CONSOLE_FAQ_QUESTION_PATTERN = /console\s+variant/i

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeNullableNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeConsoleOptions(consoleOptions = []) {
  return [...consoleOptions]
    .filter((option) => option?.is_active !== false)
    .map((option) => ({
      console_name: normalizeWhitespace(option.console_name),
      tier: normalizeWhitespace(option.tier) || 'base',
      release_year: normalizeNullableNumber(option.release_year),
      retired_year: normalizeNullableNumber(option.retired_year),
      modifier_percent: normalizeNullableNumber(option.modifier_percent) ?? 0,
    }))
    .filter((option) => option.console_name)
    .sort((left, right) => left.console_name.localeCompare(right.console_name))
}

function normalizeIntelligenceRows(intelligenceRows = []) {
  return [...intelligenceRows]
    .map((row) => ({
      brand: normalizeWhitespace(row.brand),
      series: normalizeWhitespace(row.series) || null,
      model: normalizeWhitespace(row.model),
      equipment_type: normalizeWhitespace(row.equipment_type) || null,
      category: normalizeWhitespace(row.category) || null,
      manufacture_year: normalizeNullableNumber(row.manufacture_year),
      original_rrp: normalizeNullableNumber(row.original_rrp),
      currency: normalizeWhitespace(row.currency) || 'GBP',
    }))
    .sort((left, right) => `${left.brand}:${left.model}`.localeCompare(`${right.brand}:${right.model}`))
}

export function buildProductContentSourcePayload(product, {
  consoleOptions = [],
  intelligenceRows = [],
} = {}) {
  const protectedCrossover = isTechnogymCrossoverCardioProduct(product)
  const equipmentCategory = resolveProductContentCategory(product, { intelligenceRows })

  return {
    brand: normalizeWhitespace(product?.brand),
    product_family: normalizeWhitespace(product?.product_family) || null,
    model: normalizeWhitespace(product?.model),
    // For protected Technogym Crossover cardio, never send a strength/cable equipment_type
    // to the LLM even if the catalogue row is miscategorised.
    equipment_type: protectedCrossover
      ? 'Cross Trainer'
      : (normalizeWhitespace(product?.equipment_type) || null),
    equipment_category: equipmentCategory,
    ...(protectedCrossover
      ? {
          protected_product_identity: 'technogym_crossover_cardio_cross_trainer',
          protected_product_note:
            'Commercial cardio cross trainer (elliptical). Not a cable crossover or strength machine.',
        }
      : {}),
    canonical_product_name: normalizeWhitespace(product?.canonical_product_name),
    canonical_product_key: normalizeWhitespace(product?.canonical_product_key),
    baseline_manufacture_year: normalizeNullableNumber(product?.baseline_manufacture_year),
    production_start_year: normalizeNullableNumber(product?.production_start_year),
    production_end_year: normalizeNullableNumber(product?.production_end_year),
    original_base_price: normalizeNullableNumber(product?.original_base_price),
    original_base_price_currency: normalizeWhitespace(product?.original_base_price_currency) || 'GBP',
    original_price_confidence: normalizeNullableNumber(product?.original_price_confidence),
    lifecycle_confidence: normalizeNullableNumber(product?.lifecycle_confidence),
    console_options: normalizeConsoleOptions(consoleOptions),
    intelligence_rows: normalizeIntelligenceRows(intelligenceRows),
  }
}

export function buildProductContentSourceHash(sourcePayload) {
  const stable = JSON.stringify(sourcePayload)
  return createHash('sha256').update(stable).digest('hex')
}

export function buildProductContentUserPrompt(sourcePayload) {
  return buildCategoryProductContentUserPrompt(sourcePayload)
}

export function findBannedGenericPhrases(text) {
  const haystack = String(text ?? '').toLowerCase()
  return BANNED_GENERIC_PHRASES.filter((phrase) => haystack.includes(phrase.toLowerCase()))
}

export function buildSourceDataHaystack(sourcePayload = null) {
  if (!sourcePayload) return ''
  return JSON.stringify(sourcePayload).toLowerCase()
}

export function findInventedMechanicsPhrases(text, sourcePayload = null) {
  const haystack = String(text ?? '').toLowerCase()
  const sourceHaystack = buildSourceDataHaystack(sourcePayload)

  return INVENTED_MECHANICS_PHRASES.filter((phrase) => {
    const normalizedPhrase = phrase.toLowerCase()
    if (!haystack.includes(normalizedPhrase)) return false
    return !sourceHaystack.includes(normalizedPhrase)
  })
}

export function validateInventedMechanics(overviewText, sourcePayload = null) {
  const violations = findInventedMechanicsPhrases(overviewText, sourcePayload)
  if (!violations.length) return

  throw new Error(
    `overview_text contains invented mechanics not in source data: ${violations.map((phrase) => `"${phrase}"`).join(', ')}`,
  )
}

export function validateOverviewEquipdMention(overviewText) {
  if (/\bequipd\b/i.test(String(overviewText ?? ''))) {
    throw new Error(
      'overview_text should not mention Equipd; describe valuation factors naturally instead',
    )
  }
}

export function countOverviewWords(overviewText) {
  return normalizeWhitespace(overviewText).split(/\s+/).filter(Boolean).length
}

export function validateOverviewWordCount(overviewText) {
  const wordCount = countOverviewWords(overviewText)
  if (wordCount < OVERVIEW_WORD_MIN) {
    throw new Error(
      `overview_text too short (${wordCount} words; preferred 70–120, minimum ${OVERVIEW_WORD_MIN})`,
    )
  }
  if (wordCount > OVERVIEW_WORD_MAX) {
    throw new Error(
      `overview_text too long (${wordCount} words; preferred 70–120, maximum ${OVERVIEW_WORD_MAX})`,
    )
  }
}

export function validateOverviewConsoleMentions(overviewText, sourcePayload = null) {
  if (sourceAllowsConsoleMentions(sourcePayload)) return
  if (/\bconsole\b/i.test(String(overviewText ?? ''))) {
    const category = sourcePayload?.equipment_category || 'unknown'
    throw new Error(
      `overview_text must not mention consoles for ${category} products without cardio console_options`,
    )
  }
}

export function validateContinuousProductionClaims(overviewText, sourcePayload = null) {
  const text = String(overviewText ?? '')
  const hasEndYear = Number.isFinite(Number(sourcePayload?.production_end_year))
  if (hasEndYear) return

  const matches = CONTINUOUS_PRODUCTION_PATTERNS.filter((pattern) => pattern.test(text))
  if (!matches.length) return

  throw new Error(
    'overview_text must not claim continuous production; prefer "manufactured from around {year}"',
  )
}

export function findTechnogymCrossoverStrengthTerms(text) {
  const haystack = String(text ?? '')
  return TECHNOGYM_CROSSOVER_STRENGTH_TERMS
    .filter((term) => term.pattern.test(haystack))
    .map((term) => term.label)
}

export function validateTechnogymCrossoverCardioContent(overviewText, sourcePayload = null) {
  if (!isTechnogymCrossoverCardioProduct(sourcePayload ?? {})) return

  const violations = findTechnogymCrossoverStrengthTerms(overviewText)
  if (!violations.length) return

  throw new Error(
    `overview_text must not describe Technogym Crossover as a strength/cable machine; remove: ${violations.map((term) => `"${term}"`).join(', ')}. It is a commercial cardio cross trainer (elliptical).`,
  )
}

export function isConsoleFaqQuestion(question) {
  return CONSOLE_FAQ_QUESTION_PATTERN.test(String(question ?? ''))
}

export function validateConsoleFaqs(faqJson = [], sourcePayload = null) {
  const consoleOptions = sourcePayload?.console_options ?? []
  if (consoleOptions.length) return

  const violations = faqJson
    .filter((entry) => isConsoleFaqQuestion(entry?.question))
    .map((entry) => entry.question)

  if (violations.length) {
    throw new Error(
      'Console-variant FAQs must not be generated when no console_options are in source data',
    )
  }
}

export function validateProductContent({
  overview_text: overviewText,
  seo_title: seoTitle,
  seo_meta_description: seoMetaDescription,
  faq_json: faqJson = [],
}, { sourcePayload = null } = {}) {
  const fields = [
    ['overview_text', overviewText],
    ['seo_title', seoTitle],
    ['seo_meta_description', seoMetaDescription],
  ]

  const violations = []
  for (const [field, value] of fields) {
    const matches = findBannedGenericPhrases(value)
    for (const phrase of matches) {
      violations.push({ field, phrase })
    }
  }

  for (const entry of faqJson) {
    for (const phrase of findBannedGenericPhrases(entry?.answer)) {
      violations.push({ field: 'faq answer', phrase, question: entry?.question })
    }
  }

  if (violations.length) {
    const summary = violations
      .map((item) => `${item.field}: "${item.phrase}"`)
      .join('; ')
    throw new Error(`Content contains banned generic phrasing: ${summary}`)
  }

  validateTechnogymCrossoverCardioContent(overviewText, sourcePayload)
  validateInventedMechanics(overviewText, sourcePayload)
  validateOverviewEquipdMention(overviewText)
  validateOverviewConsoleMentions(overviewText, sourcePayload)
  validateContinuousProductionClaims(overviewText, sourcePayload)
  validateOverviewWordCount(overviewText)

  validateConsoleFaqs(faqJson, sourcePayload)

  if (faqJson.length < 2) {
    throw new Error(`At least 2 FAQs required; received ${faqJson.length}`)
  }
}

export function parseProductContentResponse(raw, sourcePayload = null) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  const overviewText = normalizeWhitespace(parsed?.overview_text)
  const seoTitle = normalizeWhitespace(parsed?.seo_title)
  const seoMetaDescription = normalizeWhitespace(parsed?.seo_meta_description)
  const faqSource = Array.isArray(parsed?.faqs) ? parsed.faqs : parsed?.faq
  const faq = Array.isArray(faqSource)
    ? faqSource
      .map((entry) => ({
        question: normalizeWhitespace(entry?.question),
        answer: normalizeWhitespace(entry?.answer),
      }))
      .filter((entry) => entry.question && entry.answer)
    : []

  if (!overviewText) {
    throw new Error('OpenAI response missing overview_text')
  }
  if (!seoTitle) {
    throw new Error('OpenAI response missing seo_title')
  }
  if (!seoMetaDescription) {
    throw new Error('OpenAI response missing seo_meta_description')
  }

  const result = {
    overview_text: overviewText,
    seo_title: seoTitle,
    seo_meta_description: seoMetaDescription,
    faq_json: faq,
  }

  validateProductContent(result, { sourcePayload })

  return result
}

export async function generateProductContentWithOpenAI({
  apiKey,
  model = DEFAULT_CONTENT_AI_MODEL,
  sourcePayload,
  fetchImpl = fetch,
  timeoutMs = CONTENT_OPENAI_TIMEOUT_MS,
  maxAttempts = 5,
}) {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for content generation')
  }

  const category = sourcePayload?.equipment_category
    ?? resolveProductContentCategory(sourcePayload)
  const systemPrompt = buildProductContentSystemPrompt(category, { sourcePayload })
  const protectedCrossover = isTechnogymCrossoverCardioProduct(sourcePayload ?? {})

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildProductContentUserPrompt(sourcePayload) },
  ]

  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error?.message || `OpenAI request failed (${response.status})`)
      }

      const content = body?.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('OpenAI returned no content')
      }

      try {
        return {
          ...parseProductContentResponse(content, sourcePayload),
          ai_model: model,
        }
      } catch (validationError) {
        lastError = validationError

        const canRetry = attempt < maxAttempts
          && validationError instanceof Error
          && (
            validationError.message.includes('banned generic phrasing')
            || validationError.message.includes('invented mechanics')
            || validationError.message.includes('should not mention Equipd')
            || validationError.message.includes('must not mention consoles')
            || validationError.message.includes('continuous production')
            || validationError.message.includes('too short')
            || validationError.message.includes('too long')
            || validationError.message.includes('Console-variant FAQs')
            || validationError.message.includes('At least 2 FAQs')
            || validationError.message.includes('must not describe Technogym Crossover')
          )

        if (!canRetry) {
          throw validationError
        }

        messages.push({ role: 'assistant', content })
        messages.push({
          role: 'user',
          content: [
            `Revision required (attempt ${attempt}/${maxAttempts}): ${validationError.message}`,
            validationError.message.includes('too short')
              ? 'Expand overview_text to about 80–100 words using only known source facts: brand, model, family, commercial positioning, manufacture year wording, RRP if known, and valuation factors. Do not invent features.'
              : 'Rewrite the full JSON response. Keep overview_text to 70–120 words (max 140). No filler.',
            'Remove banned phrases and invented mechanics. Do not mention Equipd.',
            'Prefer "manufactured from around {year}". Do not claim continuous production.',
            sourceAllowsConsoleMentions(sourcePayload)
              ? 'Consoles may be mentioned for this cardio product.'
              : 'Do not mention consoles or console configuration.',
            ...(protectedCrossover
              ? [
                  'This product is a commercial cardio cross trainer (elliptical). It is NOT a cable crossover, functional trainer or strength machine.',
                  'Never describe pulleys, cables, weight stacks, selectorised resistance, pin-loaded mechanisms or strength exercises.',
                ]
              : []),
            'Keep family-consistent catalogue tone grounded in source data only.',
            'Include 2–4 FAQs in the faqs array with question and answer strings.',
          ].join('\n'),
        })
        continue
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        lastError = new Error(`OpenAI request timed out after ${timeoutMs}ms`)
        throw lastError
      }

      if (error instanceof Error && (
        error.message.includes('banned generic phrasing')
        || error.message.includes('invented mechanics')
        || error.message.includes('should not mention Equipd')
        || error.message.includes('must not mention consoles')
        || error.message.includes('continuous production')
        || error.message.includes('too short')
        || error.message.includes('too long')
        || error.message.includes('Console-variant FAQs')
        || error.message.includes('At least 2 FAQs')
        || error.message.includes('must not describe Technogym Crossover')
      )) {
        continue
      }

      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError || new Error('Content generation failed')
}

export function isProductContentMissing(existingContent) {
  return !existingContent
    || existingContent.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED
}

export function isProductContentStale(existingContent, sourceHash) {
  if (!existingContent?.source_data_hash || !sourceHash) return false
  return existingContent.source_data_hash !== sourceHash
}

export function shouldGenerateProductContent({
  existingContent,
  sourceHash,
  missingOnly = false,
  changedOnly = false,
  regenerate = false,
}) {
  if (regenerate) {
    return { include: true, reason: 'regenerate' }
  }

  if (changedOnly) {
    if (!existingContent) {
      return { include: false, reason: 'no_existing_content' }
    }
    if (isProductContentStale(existingContent, sourceHash)) {
      return { include: true, reason: 'source_changed' }
    }
    return { include: false, reason: 'unchanged' }
  }

  if (missingOnly) {
    if (isProductContentMissing(existingContent)) {
      return { include: true, reason: 'missing' }
    }
    return { include: false, reason: 'already_generated' }
  }

  if (isProductContentMissing(existingContent)) {
    return { include: true, reason: 'missing_default' }
  }

  if (isProductContentStale(existingContent, sourceHash)) {
    return { include: true, reason: 'stale_default' }
  }

  return { include: false, reason: 'up_to_date' }
}

export function buildProductContentUpsertRow({
  productId,
  generated,
  sourceHash,
  existingContent,
  errorMessage = null,
}) {
  const nowIso = new Date().toISOString()
  const nextVersion = existingContent?.version ? Number(existingContent.version) + 1 : 1

  if (errorMessage) {
    return {
      equipment_product_id: productId,
      overview_text: existingContent?.overview_text ?? null,
      seo_title: existingContent?.seo_title ?? null,
      seo_meta_description: existingContent?.seo_meta_description ?? null,
      faq_json: existingContent?.faq_json ?? [],
      generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED,
      source_data_hash: existingContent?.source_data_hash ?? sourceHash ?? null,
      ai_model: existingContent?.ai_model ?? null,
      generated_at: existingContent?.generated_at ?? null,
      approved_at: null,
      approved_by: null,
      error_message: errorMessage,
      version: existingContent?.version ?? 1,
      updated_at: nowIso,
    }
  }

  return {
    equipment_product_id: productId,
    overview_text: generated.overview_text,
    seo_title: generated.seo_title,
    seo_meta_description: generated.seo_meta_description,
    faq_json: generated.faq_json,
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
    source_data_hash: sourceHash,
    ai_model: generated.ai_model,
    generated_at: nowIso,
    approved_at: null,
    approved_by: null,
    error_message: null,
    version: existingContent ? nextVersion : 1,
    updated_at: nowIso,
  }
}

export function summarizeProductContentPlan(entries = []) {
  const summary = {
    total: entries.length,
    byReason: {},
    samples: [],
  }

  for (const entry of entries) {
    summary.byReason[entry.reason] = (summary.byReason[entry.reason] ?? 0) + 1
    if (summary.samples.length < 8) {
      summary.samples.push({
        product: entry.product.canonical_product_name,
        reason: entry.reason,
        status: entry.existingContent?.generation_status ?? 'none',
        hashChanged: entry.sourceHash !== entry.existingContent?.source_data_hash,
      })
    }
  }

  return summary
}

export {
  buildProductContentSystemPrompt,
  buildProductContentUserPrompt as buildCategoryProductContentUserPrompt,
  isTechnogymCrossoverCardioProduct,
  TECHNOGYM_CROSSOVER_CARDIO_PROMPT_CONTEXT,
  resolveProductContentCategory,
  sourceAllowsConsoleMentions,
  PRODUCT_CONTENT_CATEGORIES,
  OVERVIEW_WORD_MIN,
  OVERVIEW_WORD_MAX,
  OVERVIEW_WORD_PREFERRED_MIN,
  OVERVIEW_WORD_PREFERRED_MAX,
} from './equipmentProductContentPrompts.js'

export {
  getEquipmentProductContentBadgeLabel,
  isDraftProductContentPubliclyVisible,
  normalizeEquipmentProductFaqEntries,
  hasDisplayableEquipmentProductContent,
  resolveEquipmentProductPageContent,
  fetchEquipmentProductContentRow,
  fetchApprovedEquipmentProductContent,
  fetchEquipmentProductPageContent,
  PUBLIC_DRAFT_CONTENT_ENV,
  PUBLIC_DRAFT_CONTENT_STATUS_PRIORITY,
} from './equipmentProductContentPage.js'
