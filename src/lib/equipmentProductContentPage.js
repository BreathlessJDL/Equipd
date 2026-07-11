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

export const PUBLIC_DRAFT_CONTENT_ENV = 'VITE_SHOW_DRAFT_PRODUCT_CONTENT'

export const PUBLIC_DRAFT_CONTENT_STATUS_PRIORITY = [
  EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED,
  EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
  EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE,
]

export const BLOCKED_PUBLIC_CONTENT_STATUSES = new Set([
  EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED,
  EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED,
])

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function isDraftProductContentPubliclyVisible(env = import.meta.env) {
  const raw = String(env?.[PUBLIC_DRAFT_CONTENT_ENV] ?? '').trim().toLowerCase()
  if (raw === 'true') return true
  if (raw === 'false') return false
  return Boolean(env?.DEV)
}

export function getEquipmentProductContentBadgeLabel(status) {
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT) return 'Draft content'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE) return 'Stale content'
  return null
}

export function normalizeEquipmentProductFaqEntries(faqJson = []) {
  if (!Array.isArray(faqJson)) return []

  return faqJson
    .map((entry) => ({
      question: normalizeWhitespace(entry?.question),
      answer: normalizeWhitespace(entry?.answer),
    }))
    .filter((entry) => entry.question && entry.answer)
}

export function hasDisplayableEquipmentProductContent(content) {
  if (!content) return false

  const overviewText = normalizeWhitespace(content.overview_text)
  if (overviewText) return true

  return normalizeEquipmentProductFaqEntries(content.faq_json).length > 0
}

function buildEmptyPageContent() {
  return {
    content: null,
    faqs: [],
    contentBadgeLabel: null,
    seo: null,
  }
}

export function resolveEquipmentProductPageContent({
  contentRow = null,
  showDraftAndStale = isDraftProductContentPubliclyVisible(),
} = {}) {
  if (!contentRow || BLOCKED_PUBLIC_CONTENT_STATUSES.has(contentRow.generation_status)) {
    return buildEmptyPageContent()
  }

  if (!hasDisplayableEquipmentProductContent(contentRow)) {
    return buildEmptyPageContent()
  }

  const status = contentRow.generation_status

  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) {
    return {
      content: contentRow,
      faqs: normalizeEquipmentProductFaqEntries(contentRow.faq_json),
      contentBadgeLabel: null,
      seo: {
        title: normalizeWhitespace(contentRow.seo_title) || null,
        description: normalizeWhitespace(contentRow.seo_meta_description) || null,
      },
    }
  }

  if (!showDraftAndStale) {
    return buildEmptyPageContent()
  }

  if (
    status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT
    || status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE
  ) {
    return {
      content: contentRow,
      faqs: normalizeEquipmentProductFaqEntries(contentRow.faq_json),
      contentBadgeLabel: getEquipmentProductContentBadgeLabel(status),
      seo: null,
    }
  }

  return buildEmptyPageContent()
}

async function resolveSupabaseClient(supabaseClient) {
  if (supabaseClient) {
    return { client: supabaseClient, configured: true }
  }

  const { isSupabaseConfigured, supabase } = await import('./supabase.js')
  return {
    client: supabase,
    configured: isSupabaseConfigured,
  }
}

export async function fetchEquipmentProductContentRow(productId, {
  supabaseClient = null,
} = {}) {
  const id = String(productId ?? '').trim()
  const { client, configured } = await resolveSupabaseClient(supabaseClient)

  if (!id || !configured || !client) {
    return { content: null, error: null }
  }

  const { data, error } = await client
    .from('equipment_product_content')
    .select(EQUIPMENT_PRODUCT_CONTENT_FIELDS)
    .eq('equipment_product_id', id)
    .maybeSingle()

  return { content: data ?? null, error }
}

export async function fetchApprovedEquipmentProductContent(productId, {
  supabaseClient = null,
} = {}) {
  const id = String(productId ?? '').trim()
  const { client, configured } = await resolveSupabaseClient(supabaseClient)

  if (!id || !configured || !client) {
    return { content: null, error: null }
  }

  const { data, error } = await client
    .from('equipment_product_content')
    .select(EQUIPMENT_PRODUCT_CONTENT_FIELDS)
    .eq('equipment_product_id', id)
    .eq('generation_status', EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED)
    .maybeSingle()

  return { content: data ?? null, error }
}

export async function fetchEquipmentProductPageContent(productId, {
  showDraftAndStale = isDraftProductContentPubliclyVisible(),
  supabaseClient = null,
} = {}) {
  if (showDraftAndStale) {
    return fetchEquipmentProductContentRow(productId, { supabaseClient })
  }

  return fetchApprovedEquipmentProductContent(productId, { supabaseClient })
}
