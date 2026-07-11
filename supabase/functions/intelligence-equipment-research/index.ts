import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { profileSerpResearchCollection, researchEquipmentIntelligence } from '../_shared/intelligenceEquipmentResearch.ts'
import { researchEquipmentIntelligenceFast } from '../_shared/intelligenceEquipmentResearchFast.ts'
import { researchEquipmentIntelligenceV3 } from '../_shared/intelligenceEquipmentResearchV3.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  freezeCanonicalProductIdentity,
  type CanonicalProductIdentity,
} from '../_shared/intelligenceProductIdentity.ts'
import { resolveResearchEngine } from '../_shared/intelligenceEquipmentResearchEngine.ts'

type EquipmentResearchRequest = {
  equipment_id?: string
  product_id?: string | null
  canonical_identity?: CanonicalProductIdentity | null
  serp_only_profile?: boolean
  research_mode?: 'full' | 'price_only' | 'lifecycle_only'
  research_engine?: 'v2' | 'v3' | 'fast'
  research_target?: {
    dedupe_eligible?: boolean
    core_product_key?: string | null
    product_id?: string | null
    member_count?: number
    price_scope?: 'base_machine' | 'variant_specific'
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const adminResult = await requireAdmin(req)
  if (adminResult instanceof Response) {
    return adminResult
  }

  const serpApiKey = Deno.env.get('SERPAPI_API_KEY')?.trim()
  if (!serpApiKey) {
    return errorResponse('SERPAPI_API_KEY is not configured', 500)
  }

  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim()

  try {
    const body = (await req.json()) as EquipmentResearchRequest
    const equipmentId = body.equipment_id?.trim()
    const serpOnlyProfile = body.serp_only_profile === true
    const researchMode = body.research_mode === 'price_only'
      || body.research_mode === 'lifecycle_only'
      ? body.research_mode
      : 'full'
    const researchEngine = resolveResearchEngine(body.research_engine)

    console.info('intelligence-equipment-research start', {
      equipment_id: equipmentId,
      research_engine_requested: body.research_engine ?? null,
      research_engine_resolved: researchEngine,
      research_mode: researchMode,
    })

    if (!equipmentId) {
      return errorResponse('equipment_id is required', 400)
    }

    if (!serpOnlyProfile && researchEngine !== 'fast' && !openAiApiKey) {
      return errorResponse('OPENAI_API_KEY is not configured', 500)
    }

    const admin = getSupabaseAdmin()
    const { data: equipment, error: equipmentError } = await admin
      .from('equipment_intelligence')
      .select('id, brand, series, model, slug, equipment_type, category, original_rrp, product_family, core_product_name, core_product_key, variant_name, is_base_product')
      .eq('id', equipmentId)
      .maybeSingle()

    if (equipmentError) {
      return errorResponse(equipmentError.message, 500)
    }

    if (!equipment) {
      return errorResponse('Equipment intelligence record not found', 404)
    }

    let canonicalIdentity: CanonicalProductIdentity | null = null
    if (body.canonical_identity?.brand && body.canonical_identity?.model) {
      canonicalIdentity = freezeCanonicalProductIdentity({
        brand: body.canonical_identity.brand,
        productFamily: body.canonical_identity.product_family
          ?? body.canonical_identity.productFamily
          ?? null,
        model: body.canonical_identity.model,
        equipmentType: body.canonical_identity.equipment_type
          ?? body.canonical_identity.equipmentType
          ?? null,
        canonicalProductName: body.canonical_identity.canonical_product_name
          ?? body.canonical_identity.canonicalProductName
          ?? `${body.canonical_identity.brand} ${body.canonical_identity.model}`,
      })
    }

    const productId = body.product_id?.trim() || body.research_target?.product_id?.trim() || null
    if (!canonicalIdentity && productId) {
      const { data: product, error: productError } = await admin
        .from('equipment_products')
        .select('brand, product_family, model, equipment_type, canonical_product_name')
        .eq('id', productId)
        .maybeSingle()

      if (productError) {
        return errorResponse(productError.message, 500)
      }

      if (product) {
        canonicalIdentity = freezeCanonicalProductIdentity({
          brand: product.brand,
          productFamily: product.product_family,
          model: product.model,
          equipmentType: product.equipment_type,
          canonicalProductName: product.canonical_product_name,
        })
      }
    }

    if (serpOnlyProfile) {
      const profile = await profileSerpResearchCollection(equipment, serpApiKey)
      return jsonResponse({
        search_type: 'equipment_research_serp_profile',
        ...profile,
      })
    }

    if (researchEngine === 'fast') {
      const result = await researchEquipmentIntelligenceFast(equipment, {
        serpApiKey,
        canonicalIdentity,
      })

      return jsonResponse({
        search_type: 'equipment_research',
        research_mode: researchMode,
        research_engine: 'fast',
        ...result,
      })
    }

    const researchOptions = {
      serpApiKey,
      openAiApiKey: openAiApiKey!,
      openAiModel: Deno.env.get('OPENAI_MODEL')?.trim() || undefined,
      researchMode,
    }

    const result = researchEngine === 'v3'
      ? await researchEquipmentIntelligenceV3(equipment, {
        ...researchOptions,
        canonicalIdentity,
        target: body.research_target ? {
          dedupeEligible: body.research_target.dedupe_eligible === true,
          coreProductKey: body.research_target.core_product_key ?? null,
          memberCount: body.research_target.member_count,
          priceScope: body.research_target.price_scope,
        } : undefined,
      })
      : await researchEquipmentIntelligence(equipment, researchOptions)

    return jsonResponse({
      search_type: 'equipment_research',
      research_mode: researchMode,
      research_engine: researchEngine === 'v3' ? 'v3' : 'v2',
      ...result,
    })
  } catch (error) {
    const memory = Deno.memoryUsage()
    console.error('intelligence-equipment-research failed', {
      error: error instanceof Error ? error.message : String(error),
      heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
      rss_mb: Math.round(memory.rss / 1024 / 1024),
    })
    return errorResponse(
      error instanceof Error ? error.message : 'Equipment research failed',
      500,
    )
  }
})
