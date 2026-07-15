#!/usr/bin/env node
/**
 * Profile a single equipment research run and print a timing summary.
 * Usage: node scripts/profile-equipment-research.mjs [--equipment-id <uuid>] [--local]
 *
 * --local runs research via Deno against intelligenceEquipmentResearch.ts
 * (requires SERPAPI_API_KEY and OPENAI_API_KEY in env or .env.local).
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const args = { equipmentId: null, local: false, serpOnly: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--local') {
      args.local = true
    } else if (token === '--serp-only') {
      args.serpOnly = true
    } else if (token === '--equipment-id') {
      args.equipmentId = argv[index + 1] ?? null
      index += 1
    }
  }
  return args
}

function topUrlSignature(urls, count = 3) {
  return urls.slice(0, count).map((url) => url.trim().toLowerCase()).join('|')
}

function jaccardSimilarity(left, right) {
  const a = new Set(left.map((url) => url.trim().toLowerCase()))
  const b = new Set(right.map((url) => url.trim().toLowerCase()))
  if (a.size === 0 && b.size === 0) return 1

  let intersection = 0
  for (const value of a) {
    if (b.has(value)) intersection += 1
  }
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : intersection / union
}

function findOverlappingQueryGroups(queryAnalysis) {
  const groups = []
  const used = new Set()

  for (let index = 0; index < queryAnalysis.length; index += 1) {
    if (used.has(index)) continue

    const anchor = queryAnalysis[index]
    const group = [anchor]
    used.add(index)

    for (let other = index + 1; other < queryAnalysis.length; other += 1) {
      if (used.has(other)) continue
      const candidate = queryAnalysis[other]
      const sameTopThree = topUrlSignature(anchor.top_urls) === topUrlSignature(candidate.top_urls)
        && topUrlSignature(anchor.top_urls) !== ''
      const similarTopFive = jaccardSimilarity(anchor.top_urls.slice(0, 5), candidate.top_urls.slice(0, 5)) >= 0.6

      if (sameTopThree || similarTopFive) {
        group.push(candidate)
        used.add(other)
      }
    }

    if (group.length > 1) {
      groups.push(group)
    }
  }

  return groups
}

function formatMs(value) {
  return `${Math.round(Number(value) || 0)} ms`
}

function printSummary(result) {
  const equipment = result.equipment ?? {}
  const debug = result.debug_log ?? {}
  const timings = debug.timings ?? {}
  const serpRequests = timings.serp_requests ?? debug.serp_query_analysis ?? []
  const serpTotal = timings.serp_total_ms ?? 0
  const requestCount = serpRequests.length
  const avgSerp = requestCount > 0 ? Math.round(serpTotal / requestCount) : 0
  const stage2Used = debug.research_stage === 'stage_2'
  const serpOnly = result.profile_mode === 'serp_only'

  const equipmentLabel = [
    equipment.brand,
    equipment.series,
    equipment.model,
  ].filter(Boolean).join(' ') || debug.equipment_label || 'Unknown equipment'

  console.log('------------------------------------')
  console.log(`Equipment: ${equipmentLabel}`)
  if (serpOnly) {
    console.log('Mode: Serp-only profile (OpenAI skipped)')
  }
  console.log('')
  console.log('SerpAPI:')
  console.log(`- Requests: ${requestCount}`)
  console.log(`- Total: ${formatMs(serpTotal)}`)
  console.log(`- Average/request: ${avgSerp} ms`)
  console.log(`- Unique queries: ${debug.serp_unique_queries ?? requestCount}`)
  console.log(`- Raw URL hits: ${debug.serp_raw_url_hits ?? 'n/a'}`)
  console.log(`- Duplicate URLs removed: ${debug.serp_duplicate_urls_removed ?? 'n/a'}`)
  console.log(`- Unique URLs after dedupe: ${debug.sources_returned ?? result.deduped_result_count ?? 'n/a'}`)
  console.log('')
  console.log('Ranking:')
  console.log(formatMs(timings.ranking_ms ?? 0))
  console.log('')
  console.log('Stage 1 OpenAI:')
  console.log(serpOnly ? 'Skipped (serp-only profile)' : formatMs(timings.stage_1_openai_ms ?? 0))
  console.log('')
  console.log('Stage 2:')
  if (serpOnly) {
    console.log('Skipped (serp-only profile)')
  } else if (stage2Used) {
    console.log('Executed')
    console.log(`- Page fetch total: ${formatMs(timings.stage_2_fetch_total_ms ?? 0)}`)
    console.log(`- OpenAI: ${formatMs(timings.stage_2_openai_ms ?? 0)}`)
  } else {
    console.log('Skipped')
  }
  console.log('')
  console.log('Total:')
  console.log(formatMs(timings.total_execution_ms ?? debug.duration_ms ?? 0))
  console.log('------------------------------------')
  console.log('')

  if (serpRequests.length > 0) {
    console.log('SerpAPI request breakdown:')
    for (const entry of serpRequests) {
      console.log(`  [${entry.duration_ms ?? 0} ms] ${entry.result_count ?? 0} results — ${entry.query}`)
    }
    console.log('')
  }

  const queryAnalysis = debug.serp_query_analysis ?? []
  const overlapGroups = findOverlappingQueryGroups(queryAnalysis)

  if (queryAnalysis.length > 0) {
    console.log('Generated search queries:')
    for (const entry of queryAnalysis) {
      console.log(`  - ${entry.query} (${entry.result_count} results, ${entry.duration_ms} ms)`)
    }
    console.log('')

    if (overlapGroups.length > 0) {
      console.log('Queries with essentially the same top results:')
      for (const group of overlapGroups) {
        console.log(`  Group (${group.length} queries):`)
        for (const entry of group) {
          console.log(`    - ${entry.query}`)
        }
        console.log(`    Top URLs: ${group[0].top_urls.slice(0, 3).join(' | ') || 'none'}`)
      }
      console.log('')
    } else {
      console.log('No strongly overlapping query groups detected from top-result comparison.')
      console.log('')
    }

    console.log('Top result URL per query (for manual overlap review):')
    for (const entry of queryAnalysis) {
      const top = entry.top_urls[0] ?? 'none'
      console.log(`  - ${entry.query}`)
      console.log(`    → ${top}`)
    }
    console.log('')
  }

  const bottleneck = identifyBottleneck(timings, stage2Used)
  console.log(`Biggest bottleneck: ${bottleneck.label} (${formatMs(bottleneck.duration_ms)})`)
  console.log(bottleneck.reason)
  console.log('')

  if (bottleneck.label === 'SerpAPI') {
    printSerpReductionSuggestions(queryAnalysis, overlapGroups)
  }

  console.log('Re-profile summary:')
  console.log(`- Total searches executed: ${requestCount}`)
  console.log(`- Total unique URLs: ${debug.sources_returned ?? result.deduped_result_count ?? 'n/a'}`)
  console.log(`- Runtime: ${timings.total_execution_ms ?? debug.duration_ms ?? 0} ms`)
  console.log(`- Stage reached: ${serpOnly ? 'serp_only_profile' : debug.research_stage ?? 'unknown'}`)
  console.log('')
}

function identifyBottleneck(timings, stage2Used) {
  const candidates = [
    { label: 'SerpAPI', duration_ms: timings.serp_total_ms ?? 0 },
    { label: 'Ranking', duration_ms: timings.ranking_ms ?? 0 },
    { label: 'Stage 1 OpenAI', duration_ms: timings.stage_1_openai_ms ?? 0 },
  ]

  if (stage2Used) {
    candidates.push(
      { label: 'Stage 2 page fetch', duration_ms: timings.stage_2_fetch_total_ms ?? 0 },
      { label: 'Stage 2 OpenAI', duration_ms: timings.stage_2_openai_ms ?? 0 },
    )
  }

  const winner = candidates.reduce((best, current) => (
    current.duration_ms > best.duration_ms ? current : best
  ), candidates[0])

  const total = timings.total_execution_ms ?? 0
  const share = total > 0 ? Math.round((winner.duration_ms / total) * 100) : 0

  return {
    ...winner,
    reason: `${winner.label} accounts for ~${share}% of measured stage time (${formatMs(winner.duration_ms)} of ${formatMs(total)} total).`,
  }
}

function printSerpReductionSuggestions(queryAnalysis, overlapGroups) {
  console.log('SerpAPI reduction suggestions (analysis only — no changes applied):')

  const suffixBuckets = new Map()
  for (const entry of queryAnalysis) {
    const query = entry.query
    const suffix = query.includes('filetype:pdf')
      ? 'filetype:pdf'
      : query.split(' ').slice(2).join(' ') || 'core'
    const bucket = suffixBuckets.get(suffix) ?? []
    bucket.push(entry)
    suffixBuckets.set(suffix, bucket)
  }

  const lowValue = queryAnalysis
    .filter((entry) => entry.result_count === 0)
    .map((entry) => entry.query)

  if (lowValue.length > 0) {
    console.log(`  - Remove ${lowValue.length} zero-result queries: ${lowValue.join('; ')}`)
  }

  for (const group of overlapGroups) {
    const keep = group[0].query
    const drop = group.slice(1).map((entry) => entry.query)
    console.log(`  - Merge overlapping group: keep "${keep}", consider dropping ${drop.length} similar queries`)
    for (const query of drop) {
      console.log(`      drop candidate: ${query}`)
    }
  }

  const pdfQueries = queryAnalysis.filter((entry) => /pdf|filetype:pdf/i.test(entry.query))
  if (pdfQueries.length > 1) {
    console.log(`  - PDF intent appears in ${pdfQueries.length} queries; one combined PDF/filetype query may suffice`)
  }

  const priceQueries = queryAnalysis.filter((entry) => /msrp|rrp|original price|price list/i.test(entry.query))
  if (priceQueries.length > 1) {
    console.log(`  - Price intent appears in ${priceQueries.length} queries; one MSRP/RRP query plus brochure may cover most cases`)
  }

  const dealerQueries = queryAnalysis.filter((entry) => /dealer|distributor/i.test(entry.query))
  if (dealerQueries.length > 1) {
    console.log(`  - Dealer/distributor split may be mergeable into a single "dealer catalogue" query`)
  }

  console.log('')
  console.log('Candidate 3–5 query set to evaluate next (not applied):')
  const primary = queryAnalysis[0]?.query?.replace(/\s+(brochure|filetype:pdf|MSRP|distributor|dealer)$/i, '')
    ?? 'Life Fitness 95Ti'
  console.log(`  1. ${primary} brochure`)
  console.log(`  2. ${primary} filetype:pdf`)
  console.log(`  3. ${primary} MSRP`)
  console.log(`  4. ${primary} distributor`)
  console.log(`  5. ${primary} dealer`)
  console.log('')
}

async function findEquipmentId(adminClient, explicitId) {
  if (explicitId) return explicitId

  const { data, error } = await adminClient
    .from('equipment_intelligence')
    .select('id, brand, series, model, slug')
    .ilike('brand', '%Life Fitness%')
    .ilike('model', '%95Ti%')
    .order('model')
    .limit(20)

  if (error) throw new Error(`Equipment lookup failed: ${error.message}`)
  if (!data?.length) throw new Error('No Life Fitness 95Ti equipment row found')

  const preferred = data.find((row) => /silver/i.test(`${row.series ?? ''} ${row.model ?? ''} ${row.slug ?? ''}`))
    ?? data.find((row) => !/console|replacement|part/i.test(row.model ?? ''))
    ?? data[0]

  console.log(`Selected equipment row: ${preferred.brand} ${preferred.series ?? ''} ${preferred.model} (${preferred.id})`)
  return preferred.id
}

const DEV_PASSWORD = 'EquipdDevSeed123!'

async function signInAsUser(adminClient, authedClient, userId, fallbackPassword = DEV_PASSWORD) {
  const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId)
  if (userError || !userData?.user?.email) {
    throw new Error(`Could not resolve auth user ${userId}`)
  }

  const email = userData.user.email
  const passwordAttempt = await authedClient.auth.signInWithPassword({
    email,
    password: fallbackPassword,
  })

  if (!passwordAttempt.error) {
    return passwordAttempt.data.session.access_token
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    throw new Error(`Sign in failed for ${email}: ${passwordAttempt.error.message}`)
  }

  const { data: otpData, error: otpError } = await authedClient.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  })

  if (otpError || !otpData.session?.access_token) {
    throw new Error(`Sign in failed for ${email}: ${otpError?.message ?? 'no session'}`)
  }

  return otpData.session.access_token
}

async function signInAdmin(adminClient, supabaseUrl, anonKey, email, password) {
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const passwordAttempt = await authed.auth.signInWithPassword({
    email,
    password: password || DEV_PASSWORD,
  })

  if (!passwordAttempt.error && passwordAttempt.data.session?.access_token) {
    return passwordAttempt.data.session.access_token
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()

  if (profileError || !profile?.id) {
    throw new Error(`Admin sign in failed: ${passwordAttempt.error?.message ?? profileError?.message ?? 'no admin profile'}`)
  }

  return signInAsUser(adminClient, authed, profile.id, password || DEV_PASSWORD)
}

async function invokeEdgeResearch({ supabaseUrl, anonKey, accessToken, equipmentId, serpOnly = false }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/intelligence-equipment-research`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        equipment_id: equipmentId,
        serp_only_profile: serpOnly,
      }),
      signal: controller.signal,
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(body?.error || body?.message || `Edge function failed (${response.status})`)
    }
    return body
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Research request aborted after 180s — function likely exceeded Supabase idle timeout (150s)')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function runLocalResearch(equipmentId) {
  const scriptPath = join(ROOT, 'scripts', 'profile-equipment-research-local.ts')
  const result = spawnSync(
    'npx',
    ['--yes', 'deno', 'run', '--allow-env', '--allow-net', scriptPath, equipmentId],
    {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      shell: true,
      timeout: 180_000,
    },
  )

  if (result.status !== 0) {
    console.error(result.stdout)
    console.error(result.stderr)
    throw new Error('Local Deno research profile failed')
  }

  const marker = '__PROFILE_RESULT__'
  const line = result.stdout.split('\n').find((entry) => entry.startsWith(marker))
  if (!line) {
    console.error(result.stdout)
    throw new Error('Local profile did not return JSON marker')
  }

  return JSON.parse(line.slice(marker.length))
}

async function main() {
  loadEnvFile('.env.local')
  const args = parseArgs(process.argv.slice(2))

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase env vars in .env.local')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const equipmentId = await findEquipmentId(adminClient, args.equipmentId)
  const startedAt = Date.now()

  let result
  if (args.local) {
    if (!process.env.SERPAPI_API_KEY || !process.env.OPENAI_API_KEY) {
      throw new Error('Local mode requires SERPAPI_API_KEY and OPENAI_API_KEY in environment')
    }
    console.log('Running local Deno research profile...')
    result = runLocalResearch(equipmentId)
  } else {
    if (!adminEmail || !adminPassword) {
      throw new Error('Missing ADMIN_TEST_EMAIL / ADMIN_TEST_PASSWORD for edge invocation')
    }
    const accessToken = await signInAdmin(adminClient, supabaseUrl, anonKey, adminEmail, adminPassword)
    console.log(`Invoking intelligence-equipment-research for ${equipmentId}${args.serpOnly ? ' (serp-only profile)' : ''}...`)
    result = await invokeEdgeResearch({
      supabaseUrl,
      anonKey,
      accessToken,
      equipmentId,
      serpOnly: args.serpOnly,
    })
  }

  const elapsed = Date.now() - startedAt
  console.log(`Client-side elapsed: ${elapsed} ms`)
  console.log('')

  printSummary(result)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
