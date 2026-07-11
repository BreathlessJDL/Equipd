import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  domainMatchesList,
  extractDomainFromUrl,
  getImageSourceDomainFromCandidate,
  scoreImageSourceDomain,
  BLOCKED_IMAGE_SOURCE_DOMAINS,
  BLOCKED_IMAGE_SOURCE_DOMAIN_PATTERNS,
  AUTO_APPROVE_IMAGE_SOURCE_DOMAINS,
} from '../_shared/equipmentProductImageDomains.js'
import {
  buildTechnogymImageSearchQueries,
  isTechnogymBrand,
  rankTechnogymImageCandidates,
  resolveTechnogymImageImportMetadata,
} from '../_shared/technogymProductImageSearch.js'
import {
  buildMatrixImageSearchQueries,
  isMatrixBrand,
  rankMatrixImageCandidates,
  resolveMatrixImageImportMetadata,
} from '../_shared/matrixProductImageSearch.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
].join(', ')

type SuggestRequest = {
  product_id?: string
}

function normalizeDomain(url: string | null | undefined) {
  return extractDomainFromUrl(url ?? '')
}

function isBlockedDomain(domain: string | null) {
  if (!domain) return true
  if (domainMatchesList(domain, BLOCKED_IMAGE_SOURCE_DOMAINS)) return true
  return BLOCKED_IMAGE_SOURCE_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain))
}

function isAllowedImageDomain(domain: string | null) {
  if (!domain || isBlockedDomain(domain)) return false
  return scoreImageSourceDomain(domain) >= 0
}

function buildSearchQueries(product: Record<string, unknown>) {
  if (isTechnogymBrand(String(product.brand ?? ''))) {
    return buildTechnogymImageSearchQueries(product)
  }
  if (isMatrixBrand(String(product.brand ?? ''))) {
    return buildMatrixImageSearchQueries(product)
  }

  const name = String(product.canonical_product_name ?? '').trim()
  if (name) return [name]
  return [[product.brand, product.model].filter(Boolean).join(' ').trim()].filter(Boolean)
}

function buildStoragePath(product: Record<string, unknown>, extension: string) {
  const key = String(product.canonical_product_key ?? product.id ?? 'unknown-product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const brand = String(product.brand ?? 'unknown-brand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${brand}/${key}.${extension}`
}

async function searchCandidates(query: string, serpApiKey: string) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_images')
  url.searchParams.set('q', query)
  url.searchParams.set('ijn', '0')
  url.searchParams.set('api_key', serpApiKey)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`SerpAPI image search failed (${response.status})`)
  }

  const payload = await response.json()
  return (payload.images_results ?? []).map((result: Record<string, unknown>) => ({
    title: result.title,
    sourceUrl: result.link,
    imageUrl: result.original,
    source: result.source,
    width: result.original_width,
    height: result.original_height,
  }))
}

async function searchCandidatesForProduct(product: Record<string, unknown>, serpApiKey: string) {
  const queries = buildSearchQueries(product)
  const byImageUrl = new Map<string, Record<string, unknown>>()

  for (const query of queries) {
    const candidates = await searchCandidates(query, serpApiKey)
    for (const candidate of candidates) {
      const key = String(candidate.imageUrl ?? candidate.sourceUrl ?? '')
      if (!key || byImageUrl.has(key)) continue
      byImageUrl.set(key, { ...candidate, searchQuery: query })
    }
  }

  return { queries, candidates: [...byImageUrl.values()] }
}

function rankCandidates(candidates: Array<Record<string, unknown>>, product: Record<string, unknown>) {
  if (isTechnogymBrand(String(product.brand ?? ''))) {
    return rankTechnogymImageCandidates(candidates, product)
  }
  if (isMatrixBrand(String(product.brand ?? ''))) {
    return rankMatrixImageCandidates(candidates, product)
  }

  const query = buildSearchQueries(product)[0]?.toLowerCase() ?? ''
  return candidates
    .map((candidate) => {
      const domain = getImageSourceDomainFromCandidate(candidate)
      if (!domain || !isAllowedImageDomain(domain)) return null

      const haystack = [
        candidate.title,
        candidate.sourceUrl,
        candidate.imageUrl,
      ].filter(Boolean).join(' ').toLowerCase()

      let score = 20
      for (const token of query.split(/\s+/)) {
        if (token.length >= 2 && haystack.includes(token)) score += 8
      }
      if (domainMatchesList(domain, AUTO_APPROVE_IMAGE_SOURCE_DOMAINS)) score += 80

      return { candidate, score, domain }
    })
    .filter((entry): entry is { candidate: Record<string, unknown>; score: number; domain: string } => Boolean(entry))
    .sort((left, right) => right.score - left.score)
}

function resolveBrandSpecificImageMetadata(
  product: Record<string, unknown>,
  {
    publicUrl,
    storagePath,
    sourceUrl,
    selected,
    sourceDomain,
  }: {
    publicUrl: string
    storagePath: string
    sourceUrl: string
    selected: Record<string, unknown>
    sourceDomain: string | null
  },
) {
  if (isTechnogymBrand(String(product.brand ?? ''))) {
    return resolveTechnogymImageImportMetadata({
      imageUrl: publicUrl,
      storagePath,
      sourceUrl,
      scoreResult: selected,
    })
  }

  if (isMatrixBrand(String(product.brand ?? ''))) {
    return resolveMatrixImageImportMetadata({
      imageUrl: publicUrl,
      storagePath,
      sourceUrl,
      scoreResult: selected,
    })
  }

  const imageStatus = resolveNonTechnogymImageStatus(sourceDomain)
  const blocked = imageStatus === 'rejected'
  return {
    image_url: blocked ? null : publicUrl,
    image_storage_path: blocked ? null : storagePath,
    image_source_url: sourceUrl,
    image_source_domain: sourceDomain,
    image_confidence: selected.score,
    image_status: imageStatus,
    image_failure_reason: blocked ? 'blocked dealer/watermarked source' : null,
    image_updated_at: new Date().toISOString(),
  }
}

function resolveNonTechnogymImageStatus(domain: string | null) {
  if (!domain || isBlockedDomain(domain)) return 'rejected'
  if (domainMatchesList(domain, AUTO_APPROVE_IMAGE_SOURCE_DOMAINS)) return 'approved'
  return 'suggested'
}

async function downloadImage(imageUrl: string) {
  const response = await fetch(imageUrl, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'EquipdEquipmentImageSuggest/1.0',
    },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`image_download_failed_${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.length < 8000) {
    throw new Error('image_too_small')
  }
  const extension = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg'
  return { buffer, contentType, extension }
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
    return errorResponse('SERPAPI_API_KEY is not configured for image search.', 500)
  }

  try {
    const body = (await req.json()) as SuggestRequest
    const productId = body.product_id?.trim()
    if (!productId) {
      return errorResponse('product_id is required', 400)
    }

    const admin = getSupabaseAdmin()
    const { data: product, error: productError } = await admin
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .eq('id', productId)
      .maybeSingle()

    if (productError) {
      return errorResponse(productError.message, 500)
    }
    if (!product) {
      return errorResponse('Equipment product not found', 404)
    }

    const { queries, candidates } = await searchCandidatesForProduct(product, serpApiKey)
    const ranked = rankCandidates(candidates, product)

    if (!ranked.length) {
      const { error: updateError } = await admin
        .from('equipment_products')
        .update({
          image_status: 'failed',
          image_failure_reason: 'no_allowlisted_image_candidate',
          image_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)

      if (updateError) {
        return errorResponse(updateError.message, 500)
      }

      return jsonResponse({
        status: 'failed',
        reason: 'no_allowlisted_image_candidate',
        searchQueries: queries,
      })
    }

    let selected = ranked[0]
    let downloaded = null
    let lastError = 'download_failed'

    for (const entry of ranked.slice(0, 5)) {
      try {
        downloaded = await downloadImage(String(entry.candidate.imageUrl ?? ''))
        selected = entry
        break
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'download_failed'
      }
    }

    if (!downloaded) {
      const { error: updateError } = await admin
        .from('equipment_products')
        .update({
          image_status: 'failed',
          image_failure_reason: lastError,
          image_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)

      if (updateError) {
        return errorResponse(updateError.message, 500)
      }

      return jsonResponse({ status: 'failed', reason: lastError })
    }

    const storagePath = buildStoragePath(product, downloaded.extension)
    const { error: uploadError } = await admin.storage
      .from('equipment-product-images')
      .upload(storagePath, downloaded.buffer, {
        contentType: downloaded.contentType,
        upsert: true,
      })

    if (uploadError) {
      return errorResponse(uploadError.message, 500)
    }

    const { data: publicData } = admin.storage
      .from('equipment-product-images')
      .getPublicUrl(storagePath)

    const sourceUrl = String(selected.candidate.sourceUrl ?? selected.candidate.imageUrl ?? '')
    const sourceDomain = normalizeDomain(sourceUrl)

    const imageUpdate = resolveBrandSpecificImageMetadata(product, {
      publicUrl: publicData.publicUrl,
      storagePath,
      sourceUrl,
      selected,
      sourceDomain,
    })

    const { data: updated, error: updateError } = await admin
      .from('equipment_products')
      .update({
        ...imageUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select(PRODUCT_FIELDS)
      .single()

    if (updateError) {
      return errorResponse(updateError.message, 500)
    }

    return jsonResponse({
      status: imageUpdate.image_status,
      product: updated,
      candidate: {
        domain: selected.domain,
        score: selected.score,
        sourceUrl,
        confidenceBand: 'confidenceBand' in selected ? selected.confidenceBand : null,
        warnings: 'warnings' in selected ? selected.warnings : [],
        reasons: 'reasons' in selected ? selected.reasons : [],
      },
      searchQueries: queries,
    })
  } catch (error) {
    console.error('equipment-product-image-suggest failed', error)
    return errorResponse(error instanceof Error ? error.message : 'Image search failed', 500)
  }
})
