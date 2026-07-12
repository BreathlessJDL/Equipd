import { isSupabaseConfigured, supabase } from './supabase'
import {
  buildEquipmentResearchRequestBody,
  EQUIPMENT_RESEARCH_ENGINE,
} from './equipmentResearchEngine.js'

export { EQUIPMENT_RESEARCH_ENGINE } from './equipmentResearchEngine.js'

const localFunctionsUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.trim().replace(/\/+$/, '') ?? ''

const supabaseProjectUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '') ?? ''

function extractErrorMessageFromBody(data) {
  if (!data) return null

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim()
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  return null
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw new Error(`Could not read auth session: ${error.message}`)
  }

  if (!session?.access_token) {
    throw new Error('You must be logged in as an admin to run market search.')
  }

  return session.access_token
}

async function invokeEdgeFunction(functionName, body, errorPrefix) {
  const accessToken = await getAccessToken()
  const baseUrl = localFunctionsUrl || `${supabaseProjectUrl}/functions/v1`
  const url = `${baseUrl}/${functionName}`
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  let response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network request failed'
    throw new Error(`Could not reach ${errorPrefix}: ${message}`)
  }

  const responseText = await response.text()
  let data = null

  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { error: responseText }
    }
  }

  if (!response.ok) {
    const message =
      extractErrorMessageFromBody(data) ||
      responseText ||
      `${errorPrefix} failed (${response.status} ${response.statusText})`

    throw new Error(message)
  }

  return data
}

async function invokeMarketSearchFunction(functionName, equipmentId, errorPrefix, requestBody = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!localFunctionsUrl && !supabaseProjectUrl) {
    return { data: null, error: new Error('Supabase project URL is not configured.') }
  }

  if (!equipmentId) {
    return { data: null, error: new Error('Equipment id is required.') }
  }

  try {
    const data = await invokeEdgeFunction(
      functionName,
      { equipment_id: equipmentId, ...requestBody },
      errorPrefix,
    )
    return { data, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : `${errorPrefix} request failed`
    return { data: null, error: new Error(message) }
  }
}

async function invokeAdminEdgeFunction(functionName, requestBody, errorPrefix) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!localFunctionsUrl && !supabaseProjectUrl) {
    return { data: null, error: new Error('Supabase project URL is not configured.') }
  }

  try {
    const data = await invokeEdgeFunction(functionName, requestBody, errorPrefix)
    return { data, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : `${errorPrefix} request failed`
    return { data: null, error: new Error(message) }
  }
}

export async function runIntelligenceMarketSearch(equipmentId) {
  const result = await invokeMarketSearchFunction(
    'intelligence-market-search',
    equipmentId,
    'market search worker',
  )

  if (result.data && !result.data.search_type) {
    return {
      data: { ...result.data, search_type: 'brave' },
      error: null,
    }
  }

  return result
}

export async function runIntelligenceEbaySoldSearch(equipmentId, customKeyword) {
  const requestBody = {}
  const trimmedKeyword = customKeyword?.trim()
  if (trimmedKeyword) {
    requestBody.custom_keyword = trimmedKeyword
  }

  return invokeMarketSearchFunction(
    'intelligence-ebay-sold-search',
    equipmentId,
    'eBay sold search worker',
    requestBody,
  )
}

export async function runEquipmentResearch(
  equipmentId,
  {
    researchMode = 'full',
    researchEngine = EQUIPMENT_RESEARCH_ENGINE.FAST,
    researchTarget = null,
    productId = null,
    canonicalIdentity = null,
  } = {},
) {
  return invokeMarketSearchFunction(
    'intelligence-equipment-research',
    equipmentId,
    'equipment research worker',
    buildEquipmentResearchRequestBody(equipmentId, {
      researchMode,
      researchEngine,
      researchTarget,
      productId,
      canonicalIdentity,
    }),
  )
}

export async function fetchPrioritySyncRanking(limit = 50) {
  return invokeAdminEdgeFunction(
    'intelligence-priority-sync',
    { limit },
    'priority sync ranking worker',
  )
}

export async function fetchSearchGroupAnalysis({ brand = null } = {}) {
  return invokeAdminEdgeFunction(
    'intelligence-search-group-analysis',
    {
      brand: brand || undefined,
    },
    'eBay search group analysis worker',
  )
}

export async function runIntelligenceEbaySoldBatchStep({
  brand = 'Life Fitness',
  maxRows = 25,
  processedCount = 0,
  cursorId = null,
  equipmentIds = null,
  searchGroupKeys = null,
  dedupeSearchGroups = false,
  dryRun = false,
  daysToScrape = 90,
  countPerModel = 10,
  minObservationsSkip = 5,
  targetObservations = 10,
  minAutoSaveConfidence = 90,
  priorRows = [],
} = {}) {
  return invokeAdminEdgeFunction(
    'intelligence-ebay-sold-batch',
    {
      brand,
      max_rows: searchGroupKeys?.length
        ? searchGroupKeys.length
        : equipmentIds?.length
          ? equipmentIds.length
          : maxRows,
      processed_count: processedCount,
      cursor_id: cursorId,
      equipment_ids: equipmentIds?.length ? equipmentIds : undefined,
      search_group_keys: searchGroupKeys?.length ? searchGroupKeys : undefined,
      dedupe_search_groups: dedupeSearchGroups,
      dry_run: dryRun,
      days_to_scrape: daysToScrape,
      count_per_model: countPerModel,
      min_observations_skip: minObservationsSkip,
      target_observations: targetObservations,
      min_auto_save_confidence: minAutoSaveConfidence,
      prior_rows: priorRows,
    },
    'eBay sold batch sync worker',
  )
}

export function formatCandidatePrice(candidate) {
  const value = Number(candidate?.price)
  if (!Number.isFinite(value)) return '—'

  const currency = candidate?.currency || 'GBP'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCandidateSoldAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
  }
  return String(value)
}

export function formatCandidateSource(candidate) {
  if (candidate?.source === 'ebay_sold') return 'eBay sold'
  return candidate?.source_domain || candidate?.source || '—'
}

export function getMarketSearchCandidateKey(candidate) {
  const source = candidate?.source || candidate?.source_domain || 'web'
  return `${source}:${candidate?.url?.trim() || `${candidate?.title}-${candidate?.price}`}`
}

export function marketSearchCandidateToObservation(candidate) {
  const price = Number(candidate?.price)
  if (!Number.isFinite(price) || price <= 0) {
    return null
  }

  const isEbaySold = candidate?.source === 'ebay_sold'

  return {
    price,
    currency: candidate?.currency || 'GBP',
    source: isEbaySold ? 'ebay_sold' : candidate?.source_domain || candidate?.source || null,
    url: candidate?.url?.trim() || null,
    confidence: Number.isFinite(Number(candidate?.confidence))
      ? Math.trunc(Number(candidate.confidence))
      : null,
    observed_at: candidate?.sold_at || new Date().toISOString(),
    sold: isEbaySold ? true : null,
    condition: candidate?.condition || null,
  }
}

export async function saveMarketSyncObservations(equipmentId, candidates = []) {
  if (!isSupabaseConfigured || !supabase) {
    return { savedCount: 0, error: new Error('Supabase is not configured.') }
  }

  if (!equipmentId) {
    return { savedCount: 0, error: new Error('Equipment id is required.') }
  }

  const observations = (candidates ?? [])
    .map((candidate) => marketSearchCandidateToObservation(candidate))
    .filter(Boolean)

  if (observations.length === 0) {
    return { savedCount: 0, error: new Error('Select at least one candidate with a valid price.') }
  }

  const { data, error } = await supabase.rpc('admin_save_market_sync_observations', {
    p_equipment_id: equipmentId,
    p_observations: observations,
  })

  if (error) {
    return { savedCount: 0, error }
  }

  return {
    savedCount: Number(data?.saved_count) || observations.length,
    error: null,
  }
}
