/**
 * Runtime Google Merchant product feed (XML).
 * Uses anon Supabase + listings_public_browse only — no service role.
 *
 * Optional: set MERCHANT_FEED_TOKEN and require ?token= for fetch.
 * Do not submit this feed to a live Merchant Center account until Stage 8 review.
 */

import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../scripts/lib/loadLocalEnv.mjs'
import {
  buildMerchantFeedFromListings,
  fetchMerchantCandidateListings,
  buildMerchantReadinessReport,
} from '../src/lib/merchantFeedBuild.js'
import { fetchApprovedEquipmentProductsForListings } from '../src/lib/listingPrerenderData.js'

function getAnonSupabaseEnv() {
  const env = globalThis.process?.env ?? {}
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing public Supabase env for merchant feed.')
  }
  return { url, key }
}

function isAuthorized(req) {
  const expected = String(globalThis.process?.env?.MERCHANT_FEED_TOKEN || '').trim()
  if (!expected) return true
  const provided = String(req.query?.token || req.headers?.['x-merchant-feed-token'] || '').trim()
  return provided === expected
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).setHeader('Allow', 'GET, HEAD')
    res.send('Method Not Allowed')
    return
  }

  if (!isAuthorized(req)) {
    res.status(401).setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send('Unauthorized')
    return
  }

  const format = String(req.query?.format || 'xml').toLowerCase()

  try {
    loadLocalEnv()
    const { url, key } = getAnonSupabaseEnv()
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const listings = await fetchMerchantCandidateListings(supabase, { supabaseUrl: url })
    const equipment = await fetchApprovedEquipmentProductsForListings(supabase, listings)

    const feed = buildMerchantFeedFromListings(listings, {
      equipmentById: equipment.byId,
      generatedAt: new Date(),
    })

    res.setHeader('Cache-Control', 'public, max-age=900, s-maxage=900')
    res.setHeader('X-Equipd-Merchant-Items', String(feed.summary.itemCount))
    res.setHeader('X-Equipd-Merchant-Generated-At', feed.summary.generatedAt)
    res.setHeader('X-Equipd-Merchant-Submission', 'not_submitted_awaiting_review')

    if (format === 'report' || format === 'json') {
      const report = buildMerchantReadinessReport({ listings, feedResult: feed })
      res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8')
      res.send(JSON.stringify(report, null, 2))
      return
    }

    res.status(200).setHeader('Content-Type', 'application/xml; charset=utf-8')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.send(feed.xml)
  } catch (error) {
    console.error('[merchant-feed]', error)
    res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send('Merchant feed generation failed')
  }
}
