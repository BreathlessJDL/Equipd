export const EQUIPMENT_RESEARCH_ENGINE = {
  FAST: 'fast',
  V3: 'v3',
  V2: 'v2',
}

/** Client-side engine resolution — always defaults to fast. */
export function resolveClientResearchEngine(explicitEngine, researchEngineMode) {
  const candidate = explicitEngine ?? researchEngineMode
  if (candidate === EQUIPMENT_RESEARCH_ENGINE.V3) return EQUIPMENT_RESEARCH_ENGINE.V3
  if (candidate === EQUIPMENT_RESEARCH_ENGINE.V2) return EQUIPMENT_RESEARCH_ENGINE.V2
  return EQUIPMENT_RESEARCH_ENGINE.FAST
}

export function buildEquipmentResearchRequestBody(
  equipmentId,
  {
    researchMode = 'full',
    researchEngine = EQUIPMENT_RESEARCH_ENGINE.FAST,
    researchTarget = null,
    productId = null,
    canonicalIdentity = null,
  } = {},
) {
  const engine = resolveClientResearchEngine(researchEngine)

  return {
    equipment_id: equipmentId,
    research_mode: researchMode,
    research_engine: engine,
    research_target: researchTarget,
    product_id: productId ?? researchTarget?.product_id ?? null,
    canonical_identity: canonicalIdentity ?? researchTarget?.canonical_identity ?? null,
  }
}

export function formatResearchEngineLabel(engine) {
  switch (engine) {
    case EQUIPMENT_RESEARCH_ENGINE.FAST:
      return 'Fast trusted-source research'
    case EQUIPMENT_RESEARCH_ENGINE.V3:
      return 'Deep V3 research'
    case EQUIPMENT_RESEARCH_ENGINE.V2:
      return 'Legacy V2 research'
    default:
      return 'Fast trusted-source research'
  }
}

/** Attach batch-selected engine to each queued row. */
export function attachResearchEngineToBatchQueue(queue, researchEngine) {
  const engine = resolveClientResearchEngine(researchEngine)
  return (queue ?? []).map((entry) => ({
    ...entry,
    researchEngine: engine,
  }))
}

export function buildGoogleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(String(query ?? '').trim())}`
}

export function buildCanonicalGoogleSearchUrls(canonicalProductName) {
  const name = String(canonicalProductName ?? '').trim()
  return {
    rrp: buildGoogleSearchUrl(`${name} RRP`),
    year: buildGoogleSearchUrl(`${name} launch year manufacture year`),
  }
}
