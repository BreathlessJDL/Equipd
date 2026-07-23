/**
 * Edge helper: generate one missing product-content draft with race recheck.
 * Keeps OpenAI server-side; upserts draft only.
 */

import {
  CONTENT_USAGE_SEGMENT,
  evaluateMissingDraftGenerationEligibility,
  isHomeUseContentBrand,
  resolveProductContentUsageSegment,
} from './equipmentProductContentGenerateMissingEdge.ts'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
].join(', ')

const CONTENT_FIELDS = [
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

function normalizeWhitespace(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function buildSourcePayload(product: Record<string, unknown>, consoleOptions: unknown[] = []) {
  return {
    brand: normalizeWhitespace(product.brand) || null,
    product_family: normalizeWhitespace(product.product_family) || null,
    model: normalizeWhitespace(product.model) || null,
    equipment_type: normalizeWhitespace(product.equipment_type) || null,
    equipment_category: 'cardio',
    usage_segment: resolveProductContentUsageSegment(product),
    canonical_product_name: normalizeWhitespace(product.canonical_product_name) || null,
    canonical_product_key: normalizeWhitespace(product.canonical_product_key) || null,
    baseline_manufacture_year: product.baseline_manufacture_year ?? null,
    production_start_year: product.production_start_year ?? null,
    production_end_year: product.production_end_year ?? null,
    original_base_price: product.original_base_price ?? null,
    original_base_price_currency: product.original_base_price_currency ?? 'GBP',
    original_price_confidence: product.original_price_confidence ?? null,
    lifecycle_confidence: product.lifecycle_confidence ?? null,
    console_options: consoleOptions,
    intelligence_rows: [],
  }
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function buildSystemPrompt(sourcePayload: Record<string, unknown>) {
  const segment = String(sourcePayload.usage_segment ?? '')
  const home = segment === CONTENT_USAGE_SEGMENT.HOME
    || segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME
    || segment === 'home_use'
  return [
    'You write concise product overviews for Equipd, a UK fitness equipment valuation platform.',
    'Respond with JSON only: {"overview_text":"","seo_title":"","seo_meta_description":"","faqs":[{"question":"","answer":""}]}.',
    'Use only facts in the source JSON. Do not invent specs, pricing, apps, screens, incline, resistance, or connectivity.',
    'Preferred overview length 70–120 words (55–140 absolute).',
    'Mention original_base_price only when present. Never invent RRP.',
    home
      ? 'usage_segment is home/premium_home. Do NOT claim commercial construction, commercial gym use, health clubs, busy fitness facilities, gym-floor suitability, club use, heavy-duty commercial frames, or commercial servicing. Describe home fitness identity from known brand/model/type only.'
      : 'usage_segment is commercial/strength/light_commercial. Follow that segment: commercial club wording only when commercial; stay neutral for strength; allow studio/light commercial for light_commercial without full club exaggeration.',
  ].join('\n')
}

async function callOpenAi({
  apiKey,
  model,
  sourcePayload,
}: {
  apiKey: string
  model: string
  sourcePayload: Record<string, unknown>
}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(sourcePayload) },
        {
          role: 'user',
          content: `Write draft product content from this source JSON only:\n${JSON.stringify(sourcePayload)}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 240)}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty content')
  const parsed = JSON.parse(content)
  return {
    overview_text: String(parsed.overview_text ?? '').trim(),
    seo_title: String(parsed.seo_title ?? '').trim(),
    seo_meta_description: String(parsed.seo_meta_description ?? '').trim(),
    faq_json: Array.isArray(parsed.faqs) ? parsed.faqs : [],
    ai_model: model,
  }
}

function assertHomeUseSafe(overview: string, sourcePayload: Record<string, unknown>) {
  const segment = String(sourcePayload.usage_segment ?? '')
  const home = segment === CONTENT_USAGE_SEGMENT.HOME
    || segment === CONTENT_USAGE_SEGMENT.PREMIUM_HOME
    || segment === 'home_use'
  if (!home) return
  const banned = [
    'commercial gym',
    'commercial facility',
    'commercial use',
    'commercial-grade',
    'commercial grade',
    'health club',
    'busy gym',
    'high-traffic',
    'high traffic',
    'fitness facility',
    'commercial construction',
    'gym-floor',
    'gym floor',
    'designed for commercial fitness facilities',
    'premium commercial',
  ]
  const haystack = overview.toLowerCase()
  const hit = banned.find((phrase) => haystack.includes(phrase))
  if (hit) throw new Error(`home/premium_home commercial wording: ${hit}`)
}

export async function generateMissingDraftsForProductIds(
  admin: any,
  {
    productIds = [],
    dryRun = false,
    openAiApiKey,
    openAiModel = 'gpt-4o-mini',
  }: {
    productIds?: string[]
    dryRun?: boolean
    openAiApiKey?: string
    openAiModel?: string
  },
) {
  const ids = [...new Set((productIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (ids.length > 5) {
    throw new Error('product_ids cannot exceed 5 per step')
  }

  const results: Array<Record<string, unknown>> = []
  let created = 0
  let skipped = 0
  let failed = 0

  for (const productId of ids) {
    const { data: product, error: productError } = await admin
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .eq('id', productId)
      .maybeSingle()

    if (productError) {
      failed += 1
      results.push({ status: 'failed', product_id: productId, reason: productError.message })
      continue
    }
    if (!product) {
      failed += 1
      results.push({ status: 'failed', product_id: productId, reason: 'product_missing' })
      continue
    }

    const { data: content, error: contentError } = await admin
      .from('equipment_product_content')
      .select(CONTENT_FIELDS)
      .eq('equipment_product_id', productId)
      .maybeSingle()

    if (contentError) {
      failed += 1
      results.push({
        status: 'failed',
        product_id: productId,
        name: product.canonical_product_name,
        reason: contentError.message,
      })
      continue
    }

    const decision = evaluateMissingDraftGenerationEligibility(product, content)
    if (!decision.eligible) {
      skipped += 1
      results.push({
        status: 'skipped',
        product_id: productId,
        name: product.canonical_product_name,
        reason: decision.reason,
        product_status: product.status,
      })
      continue
    }

    if (dryRun) {
      created += 1
      results.push({
        status: 'would_create',
        product_id: productId,
        name: product.canonical_product_name,
        reason: decision.reason,
        product_status: product.status,
        usage_segment: decision.usage_segment,
      })
      continue
    }

    if (!openAiApiKey) {
      failed += 1
      results.push({
        status: 'failed',
        product_id: productId,
        name: product.canonical_product_name,
        reason: 'OPENAI_API_KEY is not configured',
      })
      continue
    }

    try {
      const { data: consoles } = await admin
        .from('product_console_options')
        .select('console_name,tier,release_year,retired_year,modifier_percent,is_active')
        .eq('product_id', productId)
        .eq('is_active', true)

      const sourcePayload = buildSourcePayload(product, consoles ?? [])
      const generated = await callOpenAi({
        apiKey: openAiApiKey,
        model: openAiModel,
        sourcePayload,
      })
      assertHomeUseSafe(generated.overview_text, sourcePayload)
      const sourceHash = await sha256Hex(JSON.stringify(sourcePayload))
      const nowIso = new Date().toISOString()
      const upsertRow = {
        equipment_product_id: productId,
        overview_text: generated.overview_text,
        seo_title: generated.seo_title,
        seo_meta_description: generated.seo_meta_description,
        faq_json: generated.faq_json,
        generation_status: 'draft',
        source_data_hash: sourceHash,
        ai_model: generated.ai_model,
        generated_at: nowIso,
        approved_at: null,
        approved_by: null,
        error_message: null,
        version: content?.version ? Number(content.version) + 1 : 1,
        updated_at: nowIso,
      }

      const { error: upsertError } = await admin
        .from('equipment_product_content')
        .upsert(upsertRow, { onConflict: 'equipment_product_id' })
      if (upsertError) throw upsertError

      created += 1
      results.push({
        status: 'created',
        product_id: productId,
        name: product.canonical_product_name,
        reason: decision.reason,
        product_status: product.status,
        home_use: isHomeUseContentBrand(product.brand),
      })
    } catch (error) {
      failed += 1
      results.push({
        status: 'failed',
        product_id: productId,
        name: product.canonical_product_name,
        reason: error instanceof Error ? error.message : String(error),
        product_status: product.status,
      })
    }
  }

  return { created, skipped, failed, results }
}
