import { createClient } from 'npm:@supabase/supabase-js@2'
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
} from '../_shared/equipmentProductImageDomains.js'
import {
  buildTechnogymImageSearchQueries,
  isTechnogymBrand,
  rankTechnogymImageCandidates,
} from '../_shared/technogymProductImageSearch.js'
import {
  buildMatrixImageSearchQueries,
  isMatrixBrand,
  rankMatrixImageCandidates,
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

type JobStepRequest = {
  job_id?: string
  max_items?: number
}

function normalizeDomain(url: string | null | undefined) {
  return extractDomainFromUrl(url ?? '')
}

function normalizeImageUrl(url: string | null | undefined) {
  const raw = String(url ?? '').trim().toLowerCase()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    parsed.hash = ''
    ;['utm_source', 'utm_medium', 'utm_campaign', 'v', 'ver', 'version'].forEach((key) => {
      parsed.searchParams.delete(key)
    })
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return raw.replace(/\/$/, '')
  }
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

  const brand = String(product.brand ?? '').trim()
  const series = String(product.product_family ?? '').trim()
  const model = String(product.model ?? '').trim()
  const equipmentType = String(product.equipment_type ?? '').trim()
  const canonical = String(product.canonical_product_name ?? '').trim()

  const queries = [
    [brand, series, model, equipmentType, 'official product image'].filter(Boolean).join(' '),
    canonical,
    [brand, model, equipmentType].filter(Boolean).join(' '),
  ].filter(Boolean)

  return [...new Set(queries)]
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

  for (const query of queries.slice(0, 3)) {
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
      score += Math.max(0, scoreImageSourceDomain(domain))

      return { candidate, score, domain, sourceQuality: scoreImageSourceDomain(domain) }
    })
    .filter((entry): entry is {
      candidate: Record<string, unknown>
      score: number
      domain: string
      sourceQuality: number
    } => Boolean(entry))
    .sort((left, right) => right.score - left.score)
}

async function downloadImage(imageUrl: string) {
  const response = await fetch(imageUrl, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'EquipdEquipmentImageSearchJob/1.0',
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

function getUserClient(authHeader: string) {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) {
    throw new Error('Supabase auth credentials are not configured')
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

async function recountJob(admin: ReturnType<typeof getSupabaseAdmin>, jobId: string) {
  const { data: items } = await admin
    .from('equipment_product_image_search_job_items')
    .select('status')
    .eq('job_id', jobId)

  const counts = {
    total_queued: 0,
    total_searching: 0,
    total_candidate_found: 0,
    total_no_result: 0,
    total_failed: 0,
    total_skipped: 0,
    total_completed: 0,
  }

  for (const item of items ?? []) {
    if (item.status === 'queued') counts.total_queued += 1
    else if (item.status === 'searching') counts.total_searching += 1
    else if (item.status === 'candidate_found') {
      counts.total_candidate_found += 1
      counts.total_completed += 1
    } else if (item.status === 'no_result') {
      counts.total_no_result += 1
      counts.total_completed += 1
    } else if (item.status === 'failed') {
      counts.total_failed += 1
      counts.total_completed += 1
    } else if (item.status === 'skipped_approved' || item.status === 'cancelled') {
      counts.total_skipped += 1
      counts.total_completed += 1
    }
  }

  const remaining = counts.total_queued + counts.total_searching
  const patch: Record<string, unknown> = {
    ...counts,
    updated_at: new Date().toISOString(),
  }
  if (remaining === 0) {
    patch.status = 'completed'
    patch.completed_at = new Date().toISOString()
  } else {
    patch.status = 'running'
    patch.started_at = new Date().toISOString()
  }

  const { data: job } = await admin
    .from('equipment_product_image_search_jobs')
    .update(patch)
    .eq('id', jobId)
    .select('*')
    .single()

  return job
}

async function processItem(
  admin: ReturnType<typeof getSupabaseAdmin>,
  item: Record<string, unknown>,
  serpApiKey: string,
) {
  const productId = String(item.product_id)
  const jobId = String(item.job_id)
  const itemId = String(item.id)

  const { data: product, error: productError } = await admin
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  if (productError || !product) {
    throw new Error(productError?.message || 'product_not_found')
  }

  const hasApproved = product.image_status === 'approved' && String(product.image_url ?? '').trim()

  const { queries, candidates } = await searchCandidatesForProduct(product, serpApiKey)
  const ranked = rankCandidates(candidates, product)

  if (!ranked.length) {
    await admin
      .from('equipment_product_image_search_job_items')
      .update({
        status: 'no_result',
        search_queries: queries,
        candidates_saved: 0,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: 'no_allowlisted_image_candidate',
      })
      .eq('id', itemId)

    if (!hasApproved) {
      await admin
        .from('equipment_products')
        .update({
          image_status: 'no_result',
          image_failure_reason: 'no_allowlisted_image_candidate',
          image_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
    }

    return { status: 'no_result', candidatesSaved: 0 }
  }

  const { data: existingCandidates } = await admin
    .from('equipment_product_image_candidates')
    .select('image_url, image_url_normalized')
    .eq('product_id', productId)

  let candidatesSaved = 0
  let selectedDownloaded: {
    buffer: Uint8Array
    contentType: string
    extension: string
    entry: (typeof ranked)[number]
  } | null = null

  for (const entry of ranked.slice(0, 8)) {
    const imageUrl = String(entry.candidate.imageUrl ?? '')
    const normalized = normalizeImageUrl(imageUrl)
    if (!normalized) continue

    const duplicate = (existingCandidates ?? []).some((row) => (
      normalizeImageUrl(row.image_url_normalized || row.image_url) === normalized
    ))

    const sourceUrl = String(entry.candidate.sourceUrl ?? imageUrl)
    const candidateRow = {
      product_id: productId,
      job_id: jobId,
      job_item_id: itemId,
      status: duplicate ? 'duplicate' : 'pending',
      source_page_url: sourceUrl,
      image_url: imageUrl,
      image_url_normalized: normalized,
      source_domain: entry.domain,
      source_type: 'image_search',
      search_query: String(entry.candidate.searchQuery ?? queries[0] ?? ''),
      identity_score: entry.score,
      source_quality_score: entry.sourceQuality ?? scoreImageSourceDomain(entry.domain),
      overall_score: entry.score,
      rejection_reason: duplicate ? 'duplicate_image_url' : null,
      searched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (!duplicate) {
      const { error: insertError } = await admin
        .from('equipment_product_image_candidates')
        .insert(candidateRow)
      if (!insertError) {
        candidatesSaved += 1
        existingCandidates?.push({ image_url: imageUrl, image_url_normalized: normalized })
      } else if (!/duplicate|unique/i.test(insertError.message)) {
        console.error('candidate insert failed', insertError.message)
      }
    }

    if (!selectedDownloaded && !duplicate) {
      try {
        const downloaded = await downloadImage(imageUrl)
        selectedDownloaded = { ...downloaded, entry }
      } catch {
        // try next
      }
    }
  }

  if (!selectedDownloaded) {
    await admin
      .from('equipment_product_image_search_job_items')
      .update({
        status: candidatesSaved > 0 ? 'candidate_found' : 'failed',
        search_queries: queries,
        candidates_saved: candidatesSaved,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: candidatesSaved > 0 ? null : 'download_failed',
      })
      .eq('id', itemId)

    if (!hasApproved) {
      await admin
        .from('equipment_products')
        .update({
          image_status: candidatesSaved > 0 ? 'suggested' : 'failed',
          image_failure_reason: candidatesSaved > 0 ? null : 'download_failed',
          image_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
    }

    return {
      status: candidatesSaved > 0 ? 'candidate_found' : 'failed',
      candidatesSaved,
    }
  }

  const storagePath = buildStoragePath(product, selectedDownloaded.extension)

  // Never overwrite approved product hero images.
  if (!hasApproved) {
    const { error: uploadError } = await admin.storage
      .from('equipment-product-images')
      .upload(storagePath, selectedDownloaded.buffer, {
        contentType: selectedDownloaded.contentType,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data: publicData } = admin.storage
      .from('equipment-product-images')
      .getPublicUrl(storagePath)

    const sourceUrl = String(
      selectedDownloaded.entry.candidate.sourceUrl
      ?? selectedDownloaded.entry.candidate.imageUrl
      ?? '',
    )

    await admin
      .from('equipment_products')
      .update({
        image_url: publicData.publicUrl,
        image_storage_path: storagePath,
        image_source_url: sourceUrl,
        image_source_domain: selectedDownloaded.entry.domain,
        image_confidence: Math.min(100, Math.max(0, Number(selectedDownloaded.entry.score) || 0)),
        image_status: 'suggested',
        image_failure_reason: null,
        image_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
  }

  await admin
    .from('equipment_product_image_search_job_items')
    .update({
      status: 'candidate_found',
      search_queries: queries,
      candidates_saved: Math.max(candidatesSaved, 1),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', itemId)

  return { status: 'candidate_found', candidatesSaved: Math.max(candidatesSaved, 1) }
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
    const body = (await req.json()) as JobStepRequest
    const jobId = body.job_id?.trim()
    const maxItems = Math.min(Math.max(Number(body.max_items) || 3, 1), 5)
    if (!jobId) {
      return errorResponse('job_id is required', 400)
    }

    const admin = getSupabaseAdmin()
    const userClient = getUserClient(adminResult.authHeader)

    const { data: job, error: jobError } = await admin
      .from('equipment_product_image_search_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) return errorResponse(jobError.message, 500)
    if (!job) return errorResponse('Job not found', 404)
    if (job.status === 'cancelled') {
      return jsonResponse({ job, processed: [], done: true })
    }

    // Prefer RPC claim when caller JWT is available; fall back to direct claim.
    let items: Array<Record<string, unknown>> = []
    const { data: claimed, error: claimError } = await userClient.rpc(
      'admin_claim_equipment_product_image_search_items',
      { p_job_id: jobId, p_limit: maxItems },
    )

    if (!claimError && claimed?.items) {
      items = Array.isArray(claimed.items) ? claimed.items : []
    } else {
      const { data: queued } = await admin
        .from('equipment_product_image_search_job_items')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(maxItems)

      items = queued ?? []
      for (const item of items) {
        await admin
          .from('equipment_product_image_search_job_items')
          .update({
            status: 'searching',
            started_at: new Date().toISOString(),
            attempt_count: Number(item.attempt_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        await admin
          .from('equipment_products')
          .update({ image_status: 'searching', updated_at: new Date().toISOString() })
          .eq('id', item.product_id)
          .neq('image_status', 'approved')
      }
    }

    const processed: Array<Record<string, unknown>> = []

    for (const item of items) {
      try {
        const result = await processItem(admin, item, serpApiKey)
        processed.push({ product_id: item.product_id, ...result })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await admin
          .from('equipment_product_image_search_job_items')
          .update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        const { data: product } = await admin
          .from('equipment_products')
          .select('image_status, image_url')
          .eq('id', item.product_id)
          .maybeSingle()

        if (product?.image_status !== 'approved') {
          await admin
            .from('equipment_products')
            .update({
              image_status: 'failed',
              image_failure_reason: message,
              image_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.product_id)
        }

        processed.push({ product_id: item.product_id, status: 'failed', error: message })
      }
    }

    const updatedJob = await recountJob(admin, jobId)
    const remaining = Number(updatedJob?.total_queued || 0) + Number(updatedJob?.total_searching || 0)

    return jsonResponse({
      job: updatedJob,
      processed,
      remaining,
      done: remaining === 0,
    })
  } catch (error) {
    console.error('equipment-product-image-search-job failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Image search job step failed',
      500,
    )
  }
})
