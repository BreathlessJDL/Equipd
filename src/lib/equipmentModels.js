import { enrichListingWithImages } from './listingImages'
import { isSupabaseConfigured, supabase } from './supabase'

const EQUIPMENT_MODEL_FIELDS = `
  id,
  brand,
  model,
  model_family,
  category,
  slug,
  known_release_year,
  known_discontinued_year,
  estimated_original_rrp,
  specs,
  maintenance,
  common_faults,
  created_at,
  updated_at
`.replace(/\s+/g, ' ').trim()

const MARKET_OBSERVATION_FIELDS = `
  id,
  equipment_model_id,
  observed_price,
  currency,
  estimated_age_years,
  condition,
  source_type,
  source_domain,
  observed_at,
  confidence_score,
  notes,
  created_at
`.replace(/\s+/g, ' ').trim()

const EQUIPMENT_MODEL_ALIAS_FIELDS = `
  id,
  equipment_model_id,
  alias,
  alias_type,
  confidence_score,
  created_at
`.replace(/\s+/g, ' ').trim()

const EQUIPMENT_MODEL_VARIANT_FIELDS = `
  id,
  equipment_model_id,
  variant_name,
  variant_code,
  variant_type,
  notes,
  created_at
`.replace(/\s+/g, ' ').trim()

const VALUATION_SOURCE_FIELDS = `
  id,
  name,
  source_type,
  source_brand,
  source_notes,
  confidence_weight,
  created_at
`.replace(/\s+/g, ' ').trim()

const SOURCE_TRADE_VALUE_FIELDS = `
  id,
  equipment_model_id,
  valuation_source_id,
  manufacture_year,
  equipment_age_years,
  trade_value,
  currency,
  condition_basis,
  value_type,
  confidence_score,
  notes,
  created_at
`.replace(/\s+/g, ' ').trim()

const SOURCE_TRADE_VALUE_WITH_SOURCE_FIELDS = `
  ${SOURCE_TRADE_VALUE_FIELDS},
  valuation_source:valuation_sources(${VALUATION_SOURCE_FIELDS})
`.replace(/\s+/g, ' ').trim()

const MATCHING_LISTING_FIELDS = `
  id,
  slug,
  title,
  brand,
  model,
  price_pence,
  condition,
  location,
  location_name,
  city,
  status,
  created_at,
  listing_images(id, storage_path, sort_order)
`.replace(/\s+/g, ' ').trim()

function notConfiguredError() {
  return new Error('Supabase is not configured.')
}

function escapeIlikePattern(value) {
  return String(value).replace(/[%_\\]/g, '\\$&')
}

/** Quote a PostgREST filter value that may contain spaces or punctuation. */
function quoteFilterValue(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`
}

export function getEquipmentModelDisplayName(model) {
  if (!model) return ''
  return [model.brand, model.model].filter(Boolean).join(' ')
}

export async function fetchEquipmentModels() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('equipment_models')
    .select(EQUIPMENT_MODEL_FIELDS)
    .order('brand', { ascending: true })
    .order('model', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchEquipmentModelBySlug(slug) {
  const trimmed = slug?.trim()
  if (!trimmed) {
    return { data: null, error: null, notFound: true }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError(), notFound: false }
  }

  const { data, error } = await supabase
    .from('equipment_models')
    .select(EQUIPMENT_MODEL_FIELDS)
    .eq('slug', trimmed)
    .maybeSingle()

  if (error) {
    return { data: null, error, notFound: false }
  }

  if (!data) {
    return { data: null, error: null, notFound: true }
  }

  return { data, error: null, notFound: false }
}

export async function fetchMarketObservationsForModel(equipmentModelId) {
  if (!equipmentModelId) {
    return { data: [], error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('market_observations')
    .select(MARKET_OBSERVATION_FIELDS)
    .eq('equipment_model_id', equipmentModelId)
    .order('observed_at', { ascending: false })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchEquipmentModelAliases(equipmentModelId) {
  if (!equipmentModelId) {
    return { data: [], error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('equipment_model_aliases')
    .select(EQUIPMENT_MODEL_ALIAS_FIELDS)
    .eq('equipment_model_id', equipmentModelId)
    .order('confidence_score', { ascending: false })
    .order('alias', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchEquipmentModelVariants(equipmentModelId) {
  if (!equipmentModelId) {
    return { data: [], error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('equipment_model_variants')
    .select(EQUIPMENT_MODEL_VARIANT_FIELDS)
    .eq('equipment_model_id', equipmentModelId)
    .order('variant_name', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchValuationSources({ sourceType = null } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  let query = supabase
    .from('valuation_sources')
    .select(VALUATION_SOURCE_FIELDS)
    .order('name', { ascending: true })

  const trimmedType = sourceType?.trim()
  if (trimmedType) {
    query = query.eq('source_type', trimmedType)
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchSourceTradeValuesForModel(equipmentModelId) {
  if (!equipmentModelId) {
    return { data: [], error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('source_trade_values')
    .select(SOURCE_TRADE_VALUE_WITH_SOURCE_FIELDS)
    .eq('equipment_model_id', equipmentModelId)
    .order('manufacture_year', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

/**
 * Fetch Intelligence layer data for a model (aliases, variants, trade values).
 * Trade value rows include nested valuation_source when available.
 */
export async function fetchEquipmentModelIntelligence(equipmentModelId) {
  if (!equipmentModelId) {
    return {
      aliases: [],
      variants: [],
      sourceTradeValues: [],
      valuationSources: [],
      errors: {},
    }
  }

  const [aliasesResult, variantsResult, tradeValuesResult, sourcesResult] =
    await Promise.all([
      fetchEquipmentModelAliases(equipmentModelId),
      fetchEquipmentModelVariants(equipmentModelId),
      fetchSourceTradeValuesForModel(equipmentModelId),
      fetchValuationSources(),
    ])

  const errors = {}
  if (aliasesResult.error) errors.aliases = aliasesResult.error
  if (variantsResult.error) errors.variants = variantsResult.error
  if (tradeValuesResult.error) errors.sourceTradeValues = tradeValuesResult.error
  if (sourcesResult.error) errors.valuationSources = sourcesResult.error

  return {
    aliases: aliasesResult.data ?? [],
    variants: variantsResult.data ?? [],
    sourceTradeValues: tradeValuesResult.data ?? [],
    valuationSources: sourcesResult.data ?? [],
    errors,
  }
}

/**
 * Best-effort match of active marketplace listings by brand/model text.
 * Uses listings_public_browse only; failures return empty data without throwing.
 */
export async function fetchActiveListingsForEquipmentModel(
  { brand, model } = {},
  { limit = 8 } = {},
) {
  const trimmedBrand = brand?.trim()
  const trimmedModel = model?.trim()

  if (!trimmedBrand || !trimmedModel) {
    return { data: [], error: null, unsupported: false }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: notConfiguredError(), unsupported: false }
  }

  const brandPattern = escapeIlikePattern(trimmedBrand)
  const modelPattern = `%${escapeIlikePattern(trimmedModel)}%`
  const modelOrFilter = [
    `model.ilike.${quoteFilterValue(modelPattern)}`,
    `title.ilike.${quoteFilterValue(modelPattern)}`,
  ].join(',')

  try {
    const { data, error } = await supabase
      .from('listings_public_browse')
      .select(MATCHING_LISTING_FIELDS)
      .eq('status', 'active')
      .ilike('brand', brandPattern)
      .or(modelOrFilter)
      .order('created_at', { ascending: false })
      .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
      .limit(1, { foreignTable: 'listing_images' })
      .limit(limit)

    if (error) {
      // Structured location columns may be missing on older envs — retry without them.
      const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
      const missingLocationColumns =
        error.code === '42703'
        && (message.includes('location_name') || message.includes('city'))

      if (!missingLocationColumns) {
        return { data: [], error, unsupported: false }
      }

      const legacyFields = MATCHING_LISTING_FIELDS
        .replace(', location_name', '')
        .replace(', city', '')

      const retry = await supabase
        .from('listings_public_browse')
        .select(legacyFields)
        .eq('status', 'active')
        .ilike('brand', brandPattern)
        .or(modelOrFilter)
        .order('created_at', { ascending: false })
        .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
        .limit(1, { foreignTable: 'listing_images' })
        .limit(limit)

      if (retry.error) {
        return { data: [], error: retry.error, unsupported: false }
      }

      return {
        data: (retry.data ?? []).map(enrichListingWithImages),
        error: null,
        unsupported: false,
      }
    }

    return {
      data: (data ?? []).map(enrichListingWithImages),
      error: null,
      unsupported: false,
    }
  } catch (error) {
    return { data: [], error, unsupported: false }
  }
}

export async function fetchEquipmentModelPageData(slug, { includeIntelligence = false } = {}) {
  const modelResult = await fetchEquipmentModelBySlug(slug)

  if (modelResult.error || modelResult.notFound || !modelResult.data) {
    return {
      model: null,
      observations: [],
      listings: [],
      aliases: [],
      variants: [],
      sourceTradeValues: [],
      valuationSources: [],
      error: modelResult.error,
      notFound: modelResult.notFound,
      listingsError: null,
      intelligenceErrors: null,
    }
  }

  const fetches = [
    fetchMarketObservationsForModel(modelResult.data.id),
    fetchActiveListingsForEquipmentModel({
      brand: modelResult.data.brand,
      model: modelResult.data.model,
    }),
  ]

  if (includeIntelligence) {
    fetches.push(fetchEquipmentModelIntelligence(modelResult.data.id))
  }

  const results = await Promise.all(fetches)
  const observationsResult = results[0]
  const listingsResult = results[1]
  const intelligenceResult = includeIntelligence ? results[2] : null

  // Observation/listing/intelligence failures are non-fatal: still render the model page.
  return {
    model: modelResult.data,
    observations: observationsResult.data ?? [],
    listings: listingsResult.data ?? [],
    aliases: intelligenceResult?.aliases ?? [],
    variants: intelligenceResult?.variants ?? [],
    sourceTradeValues: intelligenceResult?.sourceTradeValues ?? [],
    valuationSources: intelligenceResult?.valuationSources ?? [],
    error: null,
    notFound: false,
    observationsError: observationsResult.error,
    listingsError: listingsResult.error,
    intelligenceErrors: intelligenceResult?.errors ?? null,
  }
}

/**
 * Persist a valuation request. Insert-only (no select) so missing SELECT RLS
 * does not block the user from seeing results.
 */
export async function saveValuationRequest({
  equipmentModelId,
  userQuery = null,
  userCondition = null,
  userAgeYears = null,
  workingStatus = null,
  estimatedValueMin = null,
  estimatedValueMax = null,
  quickSaleMin = null,
  quickSaleMax = null,
  dealerResaleMin = null,
  dealerResaleMax = null,
  confidence = null,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: notConfiguredError() }
  }

  const { error } = await supabase.from('valuation_requests').insert({
    equipment_model_id: equipmentModelId,
    user_query: userQuery,
    user_condition: userCondition,
    user_age_years: userAgeYears,
    working_status: workingStatus,
    estimated_value_min: estimatedValueMin,
    estimated_value_max: estimatedValueMax,
    quick_sale_min: quickSaleMin,
    quick_sale_max: quickSaleMax,
    dealer_resale_min: dealerResaleMin,
    dealer_resale_max: dealerResaleMax,
    confidence,
  })

  return { error: error ?? null }
}
