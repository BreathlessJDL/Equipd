/**
 * Browser/admin fire-and-forget IndexNow notifications.
 * Never holds INDEXNOW_KEY — submission happens in the Edge Function.
 */

import { supabase, isSupabaseConfigured } from './supabase.js'
import { dedupeIndexNowUrls } from './indexNowCore.js'
import {
  collectEquipmentContentIndexNowUrls,
  collectEquipmentIndexNowUrls,
  collectListingIndexNowUrls,
  resolveListingLocationPageSlug,
} from './indexNowCollect.js'

export {
  collectEquipmentContentIndexNowUrls,
  collectEquipmentIndexNowUrls,
  collectListingIndexNowUrls,
  resolveListingLocationPageSlug,
} from './indexNowCollect.js'

/**
 * Invoke the IndexNow Edge Function. Always resolves; never throws to callers.
 *
 * @param {{
 *   urls?: string[],
 *   mode?: 'urls' | 'listing',
 *   listingId?: string | null,
 *   previousSlug?: string | null,
 *   previousCitySlug?: string | null,
 *   source?: string,
 *   contentType?: string,
 *   force?: boolean,
 * }} payload
 */
export async function invokeIndexNowSubmission(payload = {}) {
  try {
    if (!isSupabaseConfigured || !supabase) {
      return { skipped: true, reason: 'supabase_unconfigured' }
    }

    const urls = dedupeIndexNowUrls(payload.urls || [])
    if (payload.mode !== 'listing' && urls.length === 0) {
      return { skipped: true, reason: 'no_eligible_urls' }
    }

    const { data, error } = await supabase.functions.invoke('indexnow-submit', {
      body: {
        mode: payload.mode || 'urls',
        urls,
        listingId: payload.listingId || null,
        previousSlug: payload.previousSlug || null,
        previousCitySlug: payload.previousCitySlug || null,
        source: payload.source || 'app',
        contentType: payload.contentType || 'unknown',
        force: Boolean(payload.force),
      },
    })

    if (error) {
      console.info('[indexnow] invoke failed', {
        source: payload.source || 'app',
        contentType: payload.contentType || 'unknown',
        urlCount: urls.length,
        message: String(error.message || error).slice(0, 200),
      })
      return { ok: false, error }
    }

    return data ?? { ok: true }
  } catch (error) {
    console.info(
      '[indexnow] invoke exception',
      String(error?.message || error).slice(0, 200),
    )
    return { ok: false, error }
  }
}

/**
 * Non-blocking wrapper — never leaves unhandled rejections.
 */
export function queueIndexNowSubmission(payload = {}) {
  void invokeIndexNowSubmission(payload)
  return { queued: true }
}

/**
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: 'create' | 'update' | 'delete' | 'images',
 *   source?: string,
 *   awaitInvoke?: boolean,
 * }} input
 */
export function notifyIndexNowForListingChange(input = {}) {
  const collected = collectListingIndexNowUrls(input)
  if (!collected.notify || collected.urls.length === 0) {
    return { queued: false, ...collected }
  }

  const listingId = input.next?.id || input.previous?.id || null
  const payload = {
    mode: listingId ? 'listing' : 'urls',
    listingId,
    urls: collected.urls,
    previousSlug: input.previous?.slug || null,
    previousCitySlug: resolveListingLocationPageSlug(input.previous),
    source: input.source || 'listings',
    contentType: 'listing',
  }

  if (input.awaitInvoke) {
    return invokeIndexNowSubmission(payload).then((result) => ({
      queued: true,
      ...collected,
      result,
    }))
  }

  queueIndexNowSubmission(payload)
  return { queued: true, ...collected }
}

/**
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: string,
 *   includeBrandDirectory?: boolean,
 *   source?: string,
 * }} input
 */
export function notifyIndexNowForEquipmentChange(input = {}) {
  try {
    const collected = collectEquipmentIndexNowUrls(input)
    if (!collected.notify || collected.urls.length === 0) {
      return { queued: false, ...collected }
    }

    queueIndexNowSubmission({
      mode: 'urls',
      urls: collected.urls,
      source: input.source || 'equipment_products',
      contentType: 'equipment',
    })

    return { queued: true, ...collected }
  } catch (error) {
    console.info(
      '[indexnow] equipment notify failed',
      String(error?.message || error).slice(0, 200),
    )
    return { queued: false, notify: false, reason: 'notify_exception', urls: [] }
  }
}

/**
 * @param {{
 *   rows?: Array<Record<string, unknown>>,
 *   action?: string,
 *   source?: string,
 * }} input
 */
export function notifyIndexNowForEquipmentContentChange(input = {}) {
  try {
    const collected = collectEquipmentContentIndexNowUrls(input)
    if (!collected.notify || collected.urls.length === 0) {
      return { queued: false, ...collected }
    }

    queueIndexNowSubmission({
      mode: 'urls',
      urls: collected.urls,
      source: input.source || 'equipment_product_content',
      contentType: 'equipment_content',
    })

    return { queued: true, ...collected }
  } catch (error) {
    console.info(
      '[indexnow] content notify failed',
      String(error?.message || error).slice(0, 200),
    )
    return { queued: false, notify: false, reason: 'notify_exception', urls: [] }
  }
}
