import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  buildIndexNowKeyLocation,
  buildListingIndexNowUrl,
  buildLocationIndexNowUrl,
  dedupeIndexNowUrls,
  isEligiblePublicUrl,
  isValidIndexNowKeyFormat,
  redactIndexNowSecrets,
  submitIndexNowUrls,
} from '../_shared/indexNowCore.js'

const MAX_URLS_PER_INVOKE = 500
const recentSubmissions = new Map<string, number>()

type SubmitBody = {
  mode?: 'urls' | 'listing'
  urls?: string[]
  listingId?: string | null
  previousSlug?: string | null
  previousCitySlug?: string | null
  source?: string
  contentType?: string
  force?: boolean
}

function getIndexNowKey() {
  return String(Deno.env.get('INDEXNOW_KEY') ?? '').trim()
}

function timingSafeEqualString(left: string, right: string) {
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}

function hasInternalSecret(req: Request) {
  const expected = String(Deno.env.get('INDEXNOW_INTERNAL_SECRET') ?? '').trim()
  if (!expected) return false
  const provided = String(req.headers.get('x-indexnow-internal-secret') ?? '').trim()
  return Boolean(provided) && timingSafeEqualString(provided, expected)
}

async function isAdminUser(req: Request, userId: string) {
  const adminResult = await requireAdmin(req)
  if (adminResult instanceof Response) return false
  return adminResult.user.id === userId
}

function resolveListingCitySlug(listing: Record<string, unknown> | null | undefined) {
  const city = String(listing?.city ?? '').trim().toLowerCase()
  if (!city) return null
  // Edge keeps this intentionally simple; client may also pass previousCitySlug.
  const known = new Set([
    'leeds',
    'manchester',
    'birmingham',
    'london',
    'sheffield',
    'bristol',
    'liverpool',
    'newcastle',
    'glasgow',
    'cardiff',
  ])
  if (known.has(city)) return city
  return null
}

async function authorize(req: Request): Promise<
  | { kind: 'admin' | 'internal' | 'user'; userId?: string }
  | Response
> {
  if (hasInternalSecret(req)) {
    return { kind: 'internal' }
  }

  const user = await getAuthenticatedUser(req)
  if (!user) {
    return errorResponse('Unauthorized', 401)
  }

  if (await isAdminUser(req, user.id)) {
    return { kind: 'admin', userId: user.id }
  }

  return { kind: 'user', userId: user.id }
}

async function urlsForOwnedListing(
  auth: { kind: string; userId?: string },
  body: SubmitBody,
): Promise<string[] | Response> {
  if (!body.listingId) {
    return errorResponse('listingId is required for listing mode', 400)
  }

  const admin = getSupabaseAdmin()
  const { data: listing, error } = await admin
    .from('listings')
    .select('id, seller_id, slug, status, city, location_name, location')
    .eq('id', body.listingId)
    .maybeSingle()

  if (error) {
    console.error('[indexnow-submit] listing lookup failed', error.message)
    return errorResponse('Could not verify listing', 500)
  }

  if (listing) {
    if (auth.kind === 'user' && listing.seller_id !== auth.userId) {
      return errorResponse('Forbidden', 403)
    }
  } else if (!body.previousSlug) {
    return errorResponse('Listing not found', 404)
  }

  const urls: string[] = []
  if (listing?.slug) urls.push(buildListingIndexNowUrl(listing.slug)!)
  if (body.previousSlug && body.previousSlug !== listing?.slug) {
    urls.push(buildListingIndexNowUrl(body.previousSlug)!)
  }

  const citySlug = resolveListingCitySlug(listing) || body.previousCitySlug || null
  if (citySlug) urls.push(buildLocationIndexNowUrl(citySlug)!)
  if (body.previousCitySlug && body.previousCitySlug !== citySlug) {
    urls.push(buildLocationIndexNowUrl(body.previousCitySlug)!)
  }

  // Intersection with client-provided URLs when present (extra safety).
  const requested = dedupeIndexNowUrls(body.urls || [])
  if (requested.length) {
    const allowed = new Set(dedupeIndexNowUrls(urls))
    return requested.filter((url) => allowed.has(url))
  }

  return dedupeIndexNowUrls(urls)
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const auth = await authorize(req)
  if (auth instanceof Response) return auth

  let body: SubmitBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const key = getIndexNowKey()
  if (!isValidIndexNowKeyFormat(key)) {
    console.error('[indexnow-submit] INDEXNOW_KEY missing or invalid format')
    return errorResponse('IndexNow is not configured', 503)
  }

  const mode = body.mode === 'listing' ? 'listing' : 'urls'
  let urls: string[] = []

  if (mode === 'listing') {
    if (auth.kind === 'user' || auth.kind === 'admin' || auth.kind === 'internal') {
      const listingUrls = await urlsForOwnedListing(auth, body)
      if (listingUrls instanceof Response) return listingUrls
      urls = listingUrls
    }
  } else {
    if (auth.kind === 'user') {
      return errorResponse('Admin or internal authentication required for arbitrary URL submission', 403)
    }
    urls = dedupeIndexNowUrls(body.urls || [])
  }

  urls = urls.filter((url) => isEligiblePublicUrl(url))

  if (urls.length > MAX_URLS_PER_INVOKE) {
    return errorResponse(`URL list exceeds limit of ${MAX_URLS_PER_INVOKE}`, 400)
  }

  if (!urls.length) {
    return jsonResponse({
      ok: true,
      category: 'noop',
      urlCount: 0,
      host: INDEXNOW_HOST,
      endpoint: INDEXNOW_ENDPOINT,
    })
  }

  const result = await submitIndexNowUrls(urls, {
    key,
    keyLocation: buildIndexNowKeyLocation(key),
    source: body.source || 'indexnow-submit',
    contentType: body.contentType || mode,
    force: Boolean(body.force),
    recentSubmissions,
    logger: {
      info: (...args: unknown[]) => console.log(...args.map((arg) => redactIndexNowSecrets(arg))),
      error: (...args: unknown[]) => console.error(...args.map((arg) => redactIndexNowSecrets(arg))),
    },
  })

  return jsonResponse({
    ok: result.ok,
    category: result.category,
    urlCount: result.submitted.length,
    batchCount: result.batches.length,
    batches: result.batches,
    skippedDebounced: Boolean(result.skippedDebounced),
    host: INDEXNOW_HOST,
    endpoint: INDEXNOW_ENDPOINT,
    // Never return the key or keyLocation with the secret embedded beyond host confirmation.
    keyConfigured: true,
  })
})
