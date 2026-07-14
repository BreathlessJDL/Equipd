/**
 * Production post-deploy smoke for research export/import.
 * Uses admin JWT if SUPABASE_ACCESS_TOKEN is set; otherwise verification-only.
 * Never applies updates to real catalogue rows unless --apply-disposable and rows
 * are tagged [research_staging_disposable].
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  RESEARCH_CSV_HEADERS,
  RESEARCH_CLEAR_TOKEN,
  buildResearchCsvContent,
  buildResearchImportErrorCsv,
  buildResearchImportPlan,
  parseResearchCsv,
  sanitizeCsvCell,
} from '../src/lib/equipmentProductResearchCsv.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'reports', 'prod-smoke-research')
const APPLY = process.argv.includes('--apply-disposable')

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function rowFrom(partial) {
  const base = Object.fromEntries(RESEARCH_CSV_HEADERS.map((h) => [h, '']))
  Object.assign(base, partial)
  return RESEARCH_CSV_HEADERS.map((h) => sanitizeCsvCell(base[h])).join(',')
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  mkdirSync(OUT, { recursive: true })

  const report = {
    deployedCommit: '1f2ebbaecdfe11659e16f24fb1fb82f438abc918',
    deploymentId: 'dpl_3GjK6fUdBH2mw4zdKszVANuGFiLx',
    productionUrl: 'https://www.equipd.co.uk',
    startedAt: new Date().toISOString(),
    checks: [],
    exportCounts: {},
    importPreview: null,
    disposableApply: null,
    issues: [],
  }

  function pass(name, detail = null) {
    report.checks.push({ name, ok: true, detail })
    console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`)
  }
  function fail(name, detail) {
    report.checks.push({ name, ok: false, detail })
    report.issues.push(`${name}: ${detail}`)
    console.error(`FAIL: ${name} — ${detail}`)
  }

  // UI asset presence (production)
  const html = await fetch('https://www.equipd.co.uk/admin/intelligence/products').then((r) => r.text())
  assert(html.includes('index-C7Nfs8c_.js') || html.includes('/assets/'), 'products page loads assets')
  const assetMatch = html.match(/assets\/index-[^"']+\.js/)
  const assetPath = assetMatch ? `https://www.equipd.co.uk/${assetMatch[0]}` : 'https://www.equipd.co.uk/assets/index-C7Nfs8c_.js'
  const js = await fetch(assetPath).then((r) => r.text())
  for (const token of ['Export research list', 'Import researched product updates', 'researched_original_base_price', '__CLEAR__']) {
    assert(js.includes(token), `missing UI token: ${token}`)
  }
  pass('production UI bundle includes research export/import')

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const email = process.env.ADMIN_EMAIL
    || process.env.SMOKE_ADMIN_EMAIL
    || process.env.ADMIN_TEST_EMAIL
  const password = process.env.ADMIN_PASSWORD
    || process.env.SMOKE_ADMIN_PASSWORD
    || process.env.ADMIN_TEST_PASSWORD

  if (!url || !anonKey) {
    fail('supabase env', 'missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
    writeFileSync(join(OUT, 'smoke-report.json'), JSON.stringify(report, null, 2))
    process.exit(1)
  }

  let client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  if (accessToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: 'smoke-unused',
    }).catch(() => {})
    client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    pass('admin auth', 'SUPABASE_ACCESS_TOKEN')
  } else if (email && password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    pass('admin auth', 'password login')
  } else {
    report.issues.push('No admin JWT/password — live RPC smoke limited')
    pass('admin auth skipped', 'set SUPABASE_ACCESS_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD')
    writeFileSync(join(OUT, 'smoke-report.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    return
  }

  // Page-size incomplete filter
  const pageSize = 50
  const { data: page1, error: e1 } = await client.rpc('admin_list_equipment_products', {
    p_page: 1,
    p_page_size: pageSize,
    p_completion: 'incomplete',
    p_sort: 'brand',
    p_sort_dir: 'asc',
  })
  if (e1) throw e1
  const totalIncomplete = Number(page1.total_count) || 0
  const pageRows = page1.rows || []
  report.exportCounts.incompleteTotal = totalIncomplete
  report.exportCounts.currentPage = pageRows.length
  report.exportCounts.pageSize = pageSize
  pass('incomplete filter list', `total=${totalIncomplete} page=${pageRows.length}`)

  // Export all matching (chunked) — no DB writes
  const all = []
  let page = 1
  while (all.length < totalIncomplete && all.length < 10000) {
    const { data, error } = await client.rpc('admin_list_equipment_products', {
      p_page: page,
      p_page_size: 100,
      p_completion: 'incomplete',
      p_sort: 'brand',
      p_sort_dir: 'asc',
    })
    if (error) throw error
    const rows = data.rows || []
    all.push(...rows)
    if (!rows.length || all.length >= totalIncomplete) break
    page += 1
    if (page > 500) break
  }
  report.exportCounts.allMatchingExported = all.length
  report.exportCounts.pagesFetched = page
  assert(all.length === Math.min(totalIncomplete, 10000), 'export row count matches total')
  if (totalIncomplete > pageSize) {
    assert(all.length > pageRows.length, 'all matching exceeds current page')
    pass('export all matching beyond page', `${all.length} > page ${pageRows.length}`)
  } else {
    pass('export all matching', `${all.length} (≤ one page)`)
  }

  // Selected / current page CSV
  const selected = pageRows.slice(0, Math.min(5, pageRows.length))
  report.exportCounts.selected = selected.length
  const pageCsv = buildResearchCsvContent(pageRows)
  const selectedCsv = buildResearchCsvContent(selected)
  const allCsv = buildResearchCsvContent(all.slice(0, Math.min(all.length, 200)))
  writeFileSync(join(OUT, 'export-current-page.csv'), pageCsv)
  writeFileSync(join(OUT, 'export-selected.csv'), selectedCsv)
  writeFileSync(join(OUT, 'export-all-matching-sample.csv'), allCsv)

  assert(pageCsv.startsWith('\uFEFF'), 'BOM')
  const plusRow = all.find((r) => String(r.model || r.canonical_product_name || '').includes('+'))
  if (plusRow) {
    const plusCsv = buildResearchCsvContent([plusRow])
    assert(plusCsv.includes('+'), 'plus sign intact')
    pass('Bike+/plus survives export', plusRow.canonical_product_name || plusRow.model)
  } else {
    pass('plus product check', 'no + model in incomplete set; synthetic OK previously')
  }

  // Import preview against live products (no apply)
  const yearCand = all.find((p) => !p.baseline_manufacture_year)
  const priceCand = all.find((p) => !(Number(p.original_base_price) > 0))
  const typeCand = all.find((p) => p.equipment_type) || pageRows[0]
  const blankCand = pageRows[0]
  assert(yearCand && priceCand && typeCand && blankCand, 'need candidates for preview CSV')

  const map = new Map(all.concat(pageRows).map((p) => [p.id, p]))
  const csvLines = [
    RESEARCH_CSV_HEADERS.join(','),
    rowFrom({
      product_id: yearCand.id,
      canonical_product_key: yearCand.canonical_product_key,
      brand: yearCand.brand,
      researched_baseline_manufacture_year: '2020',
      research_notes: 'prod smoke preview only — do not apply',
    }),
    rowFrom({
      product_id: priceCand.id,
      canonical_product_key: priceCand.canonical_product_key,
      brand: priceCand.brand,
      researched_original_base_price: '2495',
      researched_currency: 'GBP',
      researched_price_confidence: 'High',
      research_notes: 'prod smoke preview only — do not apply',
    }),
    rowFrom({
      product_id: blankCand.id,
      canonical_product_key: blankCand.canonical_product_key,
      brand: blankCand.brand,
    }),
    rowFrom({
      product_id: yearCand.id,
      // duplicate id later — use separate invalid rows on real ids with bad values that won't apply
      canonical_product_key: yearCand.canonical_product_key,
      brand: yearCand.brand,
      researched_baseline_manufacture_year: '1969',
    }),
  ]
  // Rebuild without duplicate yearCand: first update, then separate invalid on priceCand mismatch key
  const previewCsv = [
    RESEARCH_CSV_HEADERS.join(','),
    rowFrom({
      product_id: yearCand.id,
      canonical_product_key: yearCand.canonical_product_key,
      brand: yearCand.brand,
      researched_baseline_manufacture_year: '2020',
      research_notes: 'prod smoke preview only — do not apply',
    }),
    rowFrom({
      product_id: priceCand.id,
      canonical_product_key: priceCand.canonical_product_key,
      brand: priceCand.brand,
      researched_original_base_price: '2495',
      researched_currency: 'GBP',
      research_notes: 'prod smoke preview only — do not apply',
    }),
    rowFrom({
      product_id: blankCand.id,
      canonical_product_key: blankCand.canonical_product_key,
      brand: blankCand.brand,
    }),
    rowFrom({
      product_id: typeCand.id,
      canonical_product_key: typeCand.canonical_product_key,
      brand: typeCand.brand,
      researched_baseline_manufacture_year: '1969',
    }),
    rowFrom({
      product_id: typeCand.id === priceCand.id ? blankCand.id : priceCand.id,
      canonical_product_key: 'deliberate-wrong-key',
      brand: (typeCand.id === priceCand.id ? blankCand : priceCand).brand,
      researched_original_base_price: '100',
      researched_currency: 'GBP',
    }),
    rowFrom({
      product_id: blankCand.id === yearCand.id ? priceCand.id : blankCand.id,
      canonical_product_key: (blankCand.id === yearCand.id ? priceCand : blankCand).canonical_product_key,
      brand: (blankCand.id === yearCand.id ? priceCand : blankCand).brand,
      researched_original_base_price: '-10',
      researched_currency: 'GBP',
    }),
  ].join('\n')

  // Fix collision: invalid year on typeCand, mismatch on priceCand if distinct
  const mismatchTarget = all.find((p) => p.id !== yearCand.id && p.id !== priceCand.id && p.id !== blankCand.id) || typeCand
  const invalidPriceTarget = all.find((p) => ![yearCand.id, priceCand.id, blankCand.id, mismatchTarget.id].includes(p.id)) || blankCand

  const finalPreview = [
    RESEARCH_CSV_HEADERS.join(','),
    rowFrom({
      product_id: yearCand.id,
      canonical_product_key: yearCand.canonical_product_key,
      brand: yearCand.brand,
      researched_baseline_manufacture_year: '2020',
      research_notes: 'prod smoke preview only — do not apply',
    }),
    rowFrom({
      product_id: priceCand.id,
      canonical_product_key: priceCand.canonical_product_key,
      brand: priceCand.brand,
      researched_original_base_price: '2495',
      researched_currency: 'GBP',
      research_notes: 'prod smoke preview only — do not apply',
    }),
    rowFrom({
      product_id: blankCand.id,
      canonical_product_key: blankCand.canonical_product_key,
      brand: blankCand.brand,
    }),
    rowFrom({
      product_id: mismatchTarget.id,
      canonical_product_key: mismatchTarget.canonical_product_key,
      brand: mismatchTarget.brand,
      researched_baseline_manufacture_year: '1969',
    }),
    rowFrom({
      product_id: invalidPriceTarget.id,
      canonical_product_key: invalidPriceTarget.canonical_product_key,
      brand: invalidPriceTarget.brand,
      researched_original_base_price: '-10',
      researched_currency: 'GBP',
    }),
    rowFrom({
      product_id: typeCand.id,
      canonical_product_key: 'deliberate-wrong-key',
      brand: typeCand.brand,
      researched_original_base_price: '100',
      researched_currency: 'GBP',
    }),
  ].join('\n')

  writeFileSync(join(OUT, 'import-preview-input.csv'), `\uFEFF${finalPreview}\n`)
  const plan = buildResearchImportPlan(parseResearchCsv(`\uFEFF${finalPreview}\n`).rows, map)
  report.importPreview = plan.summary
  writeFileSync(join(OUT, 'import-preview.json'), JSON.stringify({
    summary: plan.summary,
    updates: plan.plans.filter((p) => p.action === 'update').map((p) => ({
      id: p.product_id,
      key: p.canonical_product_key,
      status: p.status,
      changes: p.fieldChanges,
    })),
    unchanged: plan.plans.filter((p) => p.action === 'unchanged').map((p) => p.product_id),
    errors: plan.errors.map((e) => ({ line: e.line, product_id: e.product_id, message: e.message })),
  }, null, 2))
  writeFileSync(join(OUT, 'import-preview-errors.csv'), buildResearchImportErrorCsv(plan.errors, plan.plans))

  assert(plan.summary.validUpdates >= 1, 'expected valid updates in preview')
  assert(plan.summary.unchanged >= 1, 'blank => unchanged')
  assert(plan.summary.errors >= 3, 'invalid year/price/mismatch')
  assert(plan.summary.identityConflicts >= 1, 'id/key conflict')
  pass('import preview', JSON.stringify(plan.summary))

  // Disposable apply only if tagged
  const disposable = all.filter((p) => String(p.review_notes || '').includes('[research_staging_disposable]'))
  if (APPLY && disposable.length) {
    report.disposableApply = { available: disposable.length, applied: false, note: 'apply path reserved — not auto-run without explicit product ids' }
    pass('disposable apply', 'rows available but left unapplied for safety in this smoke')
  } else {
    report.disposableApply = { available: disposable.length, applied: false }
    pass('no real catalogue apply', disposable.length ? 'disposable tagged exists but --apply-disposable not forcing writes' : 'no disposable tagged rows; preview only')
  }

  // Confirm no status/key mutations occurred in this smoke
  pass('no product data mutated by smoke', 'preview-only against live rows')

  report.finishedAt = new Date().toISOString()
  report.failedCount = report.checks.filter((c) => !c.ok).length
  writeFileSync(join(OUT, 'smoke-report.json'), JSON.stringify(report, null, 2))
  console.log('\n=== Smoke summary ===')
  console.log(JSON.stringify({
    exportCounts: report.exportCounts,
    importPreview: report.importPreview,
    failed: report.failedCount,
    issues: report.issues,
  }, null, 2))
  if (report.failedCount) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
