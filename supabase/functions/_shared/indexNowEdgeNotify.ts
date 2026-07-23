/**
 * Fire-and-forget IndexNow notification from trusted Edge Functions
 * (Stripe webhook, etc.) without an HTTP hop to indexnow-submit.
 * Never throws to the caller — payment flows must remain unaffected.
 */
import {
  INDEXNOW_ORIGIN,
  buildIndexNowKeyLocation,
  buildListingIndexNowUrl,
  buildLocationIndexNowUrl,
  dedupeIndexNowUrls,
  isValidIndexNowKeyFormat,
  redactIndexNowSecrets,
  submitIndexNowUrls,
} from './indexNowCore.js'

const KNOWN_CITY_SLUGS = new Set([
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

function citySlugFromListing(listing: Record<string, unknown> | null | undefined) {
  const city = String(listing?.city ?? '').trim().toLowerCase()
  if (KNOWN_CITY_SLUGS.has(city)) return city
  return null
}

/**
 * @param {import('npm:@supabase/supabase-js@2').SupabaseClient} admin
 * @param {string} paymentId
 * @param {string} source
 */
export async function notifyIndexNowAfterPaymentCapture(admin: any, paymentId: string, source: string) {
  try {
    const key = String(Deno.env.get('INDEXNOW_KEY') ?? '').trim()
    if (!isValidIndexNowKeyFormat(key)) {
      console.log('[indexnow] skip payment notify: INDEXNOW_KEY not configured')
      return { skipped: true, reason: 'key_missing' }
    }

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select('id, listing_id')
      .eq('id', paymentId)
      .maybeSingle()

    if (paymentError || !payment?.listing_id) {
      console.log('[indexnow] skip payment notify: listing lookup failed', paymentError?.message)
      return { skipped: true, reason: 'listing_missing' }
    }

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id, slug, status, city')
      .eq('id', payment.listing_id)
      .maybeSingle()

    if (listingError || !listing?.slug) {
      console.log('[indexnow] skip payment notify: listing row missing', listingError?.message)
      return { skipped: true, reason: 'listing_row_missing' }
    }

    const urls = dedupeIndexNowUrls([
      buildListingIndexNowUrl(listing.slug),
      buildLocationIndexNowUrl(citySlugFromListing(listing)),
    ].filter((url): url is string => Boolean(url)))

    if (!urls.length) {
      return { skipped: true, reason: 'no_urls' }
    }

    const result = await submitIndexNowUrls(urls, {
      key,
      keyLocation: buildIndexNowKeyLocation(key),
      source,
      contentType: 'listing_payment_transition',
      force: true,
      logger: {
        info: (...args: unknown[]) => console.log(...args.map((arg) => redactIndexNowSecrets(arg))),
        error: (...args: unknown[]) => console.error(...args.map((arg) => redactIndexNowSecrets(arg))),
      },
    })

    console.log('[indexnow] payment transition notify', {
      source,
      origin: INDEXNOW_ORIGIN,
      urlCount: urls.length,
      ok: result.ok,
      category: result.category,
    })
    return result
  } catch (error) {
    console.error(
      '[indexnow] payment transition notify failed',
      String((error as Error)?.message || error).slice(0, 200),
    )
    return { ok: false, error: String((error as Error)?.message || error) }
  }
}
