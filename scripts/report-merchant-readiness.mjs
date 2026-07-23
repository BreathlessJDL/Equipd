#!/usr/bin/env node
/**
 * CLI Merchant readiness report (active browse candidates only).
 * Usage: node scripts/report-merchant-readiness.mjs
 */
import { createClient } from '@supabase/supabase-js'
import {
  buildMerchantFeedFromListings,
  buildMerchantReadinessReport,
  fetchMerchantCandidateListings,
} from '../src/lib/merchantFeedBuild.js'
import { fetchApprovedEquipmentProductsForListings } from '../src/lib/listingPrerenderData.js'
import { getSupabaseEnv, loadLocalEnv } from './lib/loadLocalEnv.mjs'

async function main() {
  loadLocalEnv()
  const { url, key } = getSupabaseEnv()
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const listings = await fetchMerchantCandidateListings(supabase, { supabaseUrl: url })
  const equipment = await fetchApprovedEquipmentProductsForListings(supabase, listings)
  const feed = buildMerchantFeedFromListings(listings, { equipmentById: equipment.byId })
  const report = buildMerchantReadinessReport({ listings, feedResult: feed })

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nSample eligible IDs (up to 5):`)
  for (const item of feed.items.slice(0, 5)) {
    console.log(`- ${item.id} → ${item.link}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
