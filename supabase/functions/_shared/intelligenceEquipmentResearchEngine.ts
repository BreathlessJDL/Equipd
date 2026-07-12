export type ResearchEngine = 'fast' | 'v3' | 'v2'

/** Resolve research engine from request body. Missing/unknown values default to fast. */
export function resolveResearchEngine(requestEngine?: string | null): ResearchEngine {
  const normalized = String(requestEngine ?? '').trim().toLowerCase()
  if (normalized === 'fast') return 'fast'
  if (normalized === 'v3') return 'v3'
  if (normalized === 'v2') return 'v2'
  return 'fast'
}

export function formatResearchEngineLabel(engine: ResearchEngine): string {
  switch (engine) {
    case 'fast':
      return 'Fast trusted-source research'
    case 'v3':
      return 'Deep V3 research'
    default:
      return 'Legacy V2 research'
  }
}
