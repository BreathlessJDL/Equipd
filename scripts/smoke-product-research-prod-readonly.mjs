/**
 * Live production data smoke via service-role read + admin_list if JWT available.
 * Prefer ADMIN_TEST_* password login; else service-role SELECT for export counts.
 * Never writes product rows.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  RESEARCH_CSV_HEADERS,
  buildResearchCsvContent,
  buildResearchImportErrorCsv,
  buildResearchImportPlan,
  parseResearchCsv,
  sanitizeCsvCell,
} from '../src/lib/equipmentProductResearchCsv.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'reports', 'prod-smoke-research')

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

function rowFrom(partial) {
  const base = Object.fromEntries(RESEARCH_CSV_HEADERS.map((h) => [h, '']))
  Object.assign(base, partial)
  return RESEARCH_CSV_HEADERS.map((h) => sanitizeCsvCell(base[h])).join(',')
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function fetchIncompleteViaTable(client, max = 5000) {
  const products = []
  let from = 0
  const pageSize = 500
  while (products.length < max) {
    const to = from + pageSize - 1
    const { data, error } = await client
      .from('equipment_products')
      .select('id,brand,product_family,model,equipment_type,canonical_product_name,canonical_product_key,baseline_manufacture_year,production_start_year,production_end_year,original_base_price,original_base_price_currency,original_price_confidence,status,review_notes,image_status,image_url,source_intelligence_row_ids')
      .or('original_base_price.is.null,original_base_price.eq.0,baseline_manufacture_year.is.null,status.eq.needs_review')
      .order('brand')
      .order('canonical_product_name')
      .range(from, to)
    if (error) throw error
    const rows = data || []
    products.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return products.slice(0, max)
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  mkdirSync(OUT, { recursive: true })

  const report = {
    deployedCommit: '1f2ebbaecdfe11659e16f24fb1fb82f438abc918',
    deploymentId: 'dpl_3GjK6fUdBH2mw4zdKszVANuGFiLx',
    mode: null,
    checks: [],
    exportCounts: {},
    importPreview: null,
    issues: [],
  }
  const pass = (name, detail = null) => {
    report.checks.push({ name, ok: true, detail })
    console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`)
  }

  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.ADMIN_TEST_EMAIL
  const password = process.env.ADMIN_TEST_PASSWORD

  // UI
  const html = await fetch('https://www.equipd.co.uk/admin/intelligence/products').then((r) => r.text())
  const asset = (html.match(/assets\/index-[^"']+\.js/) || ['assets/index-C7Nfs8c_.js'])[0]
  const js = await fetch(`https://www.equipd.co.uk/${asset}`).then((r) => r.text())
  assert(js.includes('Export research list'), 'UI missing export')
  assert(js.includes('Import researched product updates'), 'UI missing import')
  pass('production Products UI exposes research actions')

  let products = []
  let pageSize = 50
  let usedRpc = false

  // Try admin password login for RPC parity with UI
  if (email && password && anon) {
    const userClient = createClient(url, anon, { auth: { persistSession: false } })
    const { data, error } = await userClient.auth.signInWithPassword({ email, password })
    if (!error && data?.session?.access_token) {
      const adminClient = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
        auth: { persistSession: false },
      })
      const { data: page1, error: listErr } = await adminClient.rpc('admin_list_equipment_products', {
        p_page: 1,
        p_page_size: pageSize,
        p_completion: 'incomplete',
        p_sort: 'brand',
        p_sort_dir: 'asc',
      })
      if (!listErr) {
        usedRpc = true
        report.mode = 'admin-jwt-rpc'
        const total = Number(page1.total_count) || 0
        const pageRows = page1.rows || []
        report.exportCounts.incompleteTotal = total
        report.exportCounts.currentPage = pageRows.length
        // fetch all matching
        let page = 1
        while (products.length < total && products.length < 10000) {
          const { data: chunk, error: chunkErr } = await adminClient.rpc('admin_list_equipment_products', {
            p_page: page,
            p_page_size: 100,
            p_completion: 'incomplete',
            p_sort: 'brand',
            p_sort_dir: 'asc',
          })
          if (chunkErr) throw chunkErr
          products.push(...(chunk.rows || []))
          if (!(chunk.rows || []).length || products.length >= total) break
          page += 1
        }
        pass('admin RPC incomplete export', `total=${total} exported=${products.length} page=${pageRows.length}`)
      } else {
        report.issues.push(`admin RPC failed: ${listErr.message}`)
      }
    } else {
      report.issues.push(`ADMIN_TEST login failed: ${error?.message || 'no session'}`)
    }
  }

  if (!products.length) {
    assert(service, 'need service role for fallback read')
    report.mode = 'service-role-read-only'
    const svc = createClient(url, service, { auth: { persistSession: false } })
    products = await fetchIncompleteViaTable(svc)
    report.exportCounts.incompleteTotal = products.length
    report.exportCounts.currentPage = Math.min(pageSize, products.length)
    report.exportCounts.note = 'Approximate incomplete set via table filter (admin login unavailable); UI uses admin_list RPC'
    pass('service-role read incomplete products', String(products.length))
  }

  const pageRows = products.slice(0, pageSize)
  const selected = pageRows.slice(0, Math.min(5, pageRows.length))
  report.exportCounts.allMatchingExported = products.length
  report.exportCounts.selected = selected.length
  report.exportCounts.currentPage = pageRows.length

  if (products.length > pageSize) {
    assert(products.length > pageRows.length, 'all matching > page')
    pass('all matching exceeds current page', `${products.length} > ${pageRows.length}`)
  } else {
    pass('all matching within one page', String(products.length))
  }

  const allCsv = buildResearchCsvContent(products)
  const pageCsv = buildResearchCsvContent(pageRows)
  const selCsv = buildResearchCsvContent(selected)
  writeFileSync(join(OUT, 'export-all-matching.csv'), allCsv)
  writeFileSync(join(OUT, 'export-current-page.csv'), pageCsv)
  writeFileSync(join(OUT, 'export-selected.csv'), selCsv)
  assert(allCsv.startsWith('\uFEFF'), 'BOM')
  const plus = products.find((p) => String(p.model || p.canonical_product_name || '').includes('+'))
  if (plus) {
    const c = buildResearchCsvContent([plus])
    assert(c.includes('+'), 'plus intact')
    const parsed = parseResearchCsv(c)
    assert(parsed.rows[0].current_canonical_product_name.includes('+') || parsed.rows[0].model.includes('+'), 'plus parse')
    pass('plus/punctuation survives CSV', plus.canonical_product_name || plus.model)
  } else {
    const synthetic = buildResearchCsvContent([{
      id: 'syn', brand: 'Peloton', model: "Bike+", canonical_product_name: "Peloton Bike+",
      canonical_product_key: 'peloton-exercise-bike-bike-plus', status: 'pending',
      review_notes: "O'Brien, \"quoted\"",
    }])
    assert(synthetic.includes('Bike+') && synthetic.includes("O'Brien"), 'synthetic plus/apostrophe')
    pass('UTF-8/plus sanitiser (no live + product in set)')
  }

  const map = new Map(products.map((p) => [p.id, p]))
  const yearCand = products.find((p) => !p.baseline_manufacture_year) || products[0]
  const priceCand = products.find((p) =>
    p.id !== yearCand.id && !(Number(p.original_base_price) > 0),
  ) || products.find((p) => p.id !== yearCand.id) || products[0]
  const blankCand = products.find((p) =>
    p.id !== yearCand.id && p.id !== priceCand.id,
  ) || products[0]
  const mismatchCand = products.find((p) =>
    ![yearCand.id, priceCand.id, blankCand.id].includes(p.id),
  ) || products[0]
  const badYearCand = products.find((p) =>
    ![yearCand.id, priceCand.id, blankCand.id, mismatchCand.id].includes(p.id),
  ) || mismatchCand
  const badPriceCand = products.find((p) =>
    ![yearCand.id, priceCand.id, blankCand.id, mismatchCand.id, badYearCand.id].includes(p.id),
  ) || blankCand

  assert(new Set([yearCand.id, priceCand.id, blankCand.id]).size === 3, 'need 3 distinct preview targets')

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
      product_id: badYearCand.id,
      canonical_product_key: badYearCand.canonical_product_key,
      brand: badYearCand.brand,
      researched_baseline_manufacture_year: '1969',
    }),
    rowFrom({
      product_id: badPriceCand.id,
      canonical_product_key: badPriceCand.canonical_product_key,
      brand: badPriceCand.brand,
      researched_original_base_price: '-10',
      researched_currency: 'GBP',
    }),
    rowFrom({
      product_id: mismatchCand.id,
      canonical_product_key: 'deliberate-wrong-key',
      brand: mismatchCand.brand,
      researched_original_base_price: '100',
      researched_currency: 'GBP',
    }),
  ].join('\n')

  writeFileSync(join(OUT, 'import-preview-input.csv'), `\uFEFF${previewCsv}\n`)
  const plan = buildResearchImportPlan(parseResearchCsv(`\uFEFF${previewCsv}\n`).rows, map)
  report.importPreview = plan.summary
  writeFileSync(join(OUT, 'import-preview.json'), JSON.stringify({
    summary: plan.summary,
    updates: plan.plans.filter((p) => p.action === 'update').map((p) => ({
      id: p.product_id, key: p.canonical_product_key, status: p.status, changes: p.fieldChanges,
    })),
    unchanged: plan.plans.filter((p) => p.action === 'unchanged').map((p) => p.product_id),
    errors: plan.errors.map((e) => ({ line: e.line, product_id: e.product_id, message: e.message })),
  }, null, 2))
  writeFileSync(join(OUT, 'import-preview-errors.csv'), buildResearchImportErrorCsv(plan.errors, plan.plans))

  assert(plan.summary.validUpdates >= 1, 'valid updates')
  assert(plan.summary.unchanged >= 1, 'blank unchanged')
  assert(plan.summary.errors >= 2, 'errors present')
  assert(plan.summary.identityConflicts >= 1, 'id/key conflict')
  pass('import preview separations', JSON.stringify(plan.summary))

  // Confirm blank means no fieldChanges for blankCand when it's not also a year/price candidate with changes
  const blankPlan = plan.plans.find((p) => p.product_id === blankCand.id)
  if (blankCand.id !== yearCand.id && blankCand.id !== priceCand.id) {
    assert(blankPlan?.action === 'unchanged', 'blank row unchanged')
    pass('blank researched_* => no change')
  } else {
    pass('blank researched_* checked via dedicated unchanged count', String(plan.summary.unchanged))
  }

  const disposable = products.filter((p) => String(p.review_notes || '').includes('[research_staging_disposable]'))
  report.disposableApply = { available: disposable.length, applied: false }
  pass('no catalogue writes', 'preview only; disposable apply not run')
  pass('rpc mode', usedRpc ? 'admin_list RPC' : 'service-role table read fallback')

  report.finishedAt = new Date().toISOString()
  writeFileSync(join(OUT, 'smoke-report.json'), JSON.stringify(report, null, 2))
  console.log('\n=== Summary ===')
  console.log(JSON.stringify({
    mode: report.mode,
    exportCounts: report.exportCounts,
    importPreview: report.importPreview,
    issues: report.issues,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
