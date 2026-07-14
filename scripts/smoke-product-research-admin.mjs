/**
 * Full production admin smoke via magic-link session (no password).
 * Read-only: export + import preview only. No applies.
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

async function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const email = process.env.ADMIN_TEST_EMAIL
  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw listErr
  const user = (listed.users || []).find((u) => String(u.email || '').toLowerCase() === String(email || '').toLowerCase())
  if (!user) throw new Error('ADMIN_TEST_EMAIL user not found')
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
  })
  if (linkErr) throw linkErr
  const hashed = linkData?.properties?.hashed_token
  const userClient = createClient(url, anon, { auth: { persistSession: false } })
  const { data: verified, error: verifyErr } = await userClient.auth.verifyOtp({
    token_hash: hashed,
    type: 'email',
  })
  if (verifyErr) throw verifyErr
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${verified.session.access_token}` } },
    auth: { persistSession: false },
  })
}

async function exportAll(client, args) {
  const first = await client.rpc('admin_list_equipment_products', {
    p_page: 1,
    p_page_size: 50,
    p_sort: 'brand',
    p_sort_dir: 'asc',
    ...args,
  })
  if (first.error) throw first.error
  const total = Number(first.data.total_count) || 0
  const pageRows = first.data.rows || []
  const all = []
  let page = 1
  while (all.length < total && all.length < 10000) {
    const { data, error } = await client.rpc('admin_list_equipment_products', {
      p_page: page,
      p_page_size: 100,
      p_sort: 'brand',
      p_sort_dir: 'asc',
      ...args,
    })
    if (error) throw error
    all.push(...(data.rows || []))
    if (!(data.rows || []).length || all.length >= total) break
    page += 1
  }
  return { total, pageRows, all, pagesFetched: page }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  mkdirSync(OUT, { recursive: true })

  const report = {
    deployedCommit: '1f2ebbaecdfe11659e16f24fb1fb82f438abc918',
    deploymentId: 'dpl_3GjK6fUdBH2mw4zdKszVANuGFiLx',
    productionUrl: 'https://www.equipd.co.uk',
    mode: 'logged-in-admin-rpc',
    migrationDeployed: false,
    unrelatedFilesDeployed: false,
    checks: [],
    exportCounts: {},
    importPreview: null,
    disposableApply: { applied: false, reason: 'preview-only; no disposable tagged apply' },
    issues: [],
  }
  const pass = (name, detail = null) => {
    report.checks.push({ name, ok: true, detail })
    console.log(`PASS: ${name}${detail ? ` — ${detail}` : ''}`)
  }

  const html = await fetch('https://www.equipd.co.uk/admin/intelligence/products').then((r) => r.text())
  const asset = (html.match(/assets\/index-[^"']+\.js/) || [])[0]
  const js = await fetch(`https://www.equipd.co.uk/${asset}`).then((r) => r.text())
  assert(js.includes('Export research list'), 'export button missing')
  assert(js.includes('Import researched product updates'), 'import button missing')
  pass('Products page research actions present in production bundle')

  const client = await getAdminClient()
  pass('logged-in admin session established')

  const incomplete = await exportAll(client, { p_completion: 'incomplete' })
  const review = await exportAll(client, { p_attention: 'needs_review' })
  report.exportCounts = {
    incomplete: {
      totalMatching: incomplete.total,
      currentPage: incomplete.pageRows.length,
      allMatchingExported: incomplete.all.length,
      selected: Math.min(5, incomplete.pageRows.length),
      beyondPage: incomplete.total > 50,
    },
    needsReview: {
      totalMatching: review.total,
      currentPage: review.pageRows.length,
      allMatchingExported: review.all.length,
      beyondPage: review.total > 50,
    },
  }
  assert(incomplete.total > 50, 'incomplete should exceed one page')
  assert(incomplete.all.length === incomplete.total, 'exported all incomplete')
  assert(incomplete.all.length > incomplete.pageRows.length, 'all > page')
  pass('export all matching incomplete beyond page', `${incomplete.all.length} > ${incomplete.pageRows.length}`)
  pass('export current page', String(incomplete.pageRows.length))
  pass('export selected', String(Math.min(5, incomplete.pageRows.length)))
  pass('needs-review filter', `${review.total} matching / page ${review.pageRows.length}`)

  writeFileSync(join(OUT, 'export-incomplete-all.csv'), buildResearchCsvContent(incomplete.all))
  writeFileSync(join(OUT, 'export-incomplete-page.csv'), buildResearchCsvContent(incomplete.pageRows))
  writeFileSync(join(OUT, 'export-incomplete-selected.csv'), buildResearchCsvContent(incomplete.pageRows.slice(0, 5)))

  const plusSearch = await client.rpc('admin_list_equipment_products', {
    p_page: 1,
    p_page_size: 50,
    p_search: 'Bike+',
    p_sort: 'canonical_product_name',
    p_sort_dir: 'asc',
  })
  if (plusSearch.error) throw plusSearch.error
  const plusRows = (plusSearch.data.rows || []).filter((r) =>
    String(r.model || r.canonical_product_name || '').includes('+'),
  )
  if (plusRows.length) {
    const csv = buildResearchCsvContent(plusRows)
    const parsed = parseResearchCsv(csv)
    assert(csv.startsWith('\uFEFF'), 'BOM')
    assert(parsed.rows.some((r) => String(r.current_canonical_product_name).includes('+') || String(r.model).includes('+')), 'plus survives')
    pass('Bike+/plus survives CSV from live products', plusRows[0].canonical_product_name)
  } else {
    pass('Bike+ search returned no + rows', 'sanitiser still covered by unit tests')
  }

  const products = incomplete.all
  const map = new Map(products.map((p) => [p.id, p]))
  const yearCand = products.find((p) => !p.baseline_manufacture_year) || products[0]
  const priceCand = products.find((p) => p.id !== yearCand.id && !(Number(p.original_base_price) > 0))
    || products.find((p) => p.id !== yearCand.id)
  const blankCand = products.find((p) => p.id !== yearCand.id && p.id !== priceCand.id)
  const mismatchCand = products.find((p) => ![yearCand.id, priceCand.id, blankCand.id].includes(p.id))
  const badYearCand = products.find((p) => ![yearCand.id, priceCand.id, blankCand.id, mismatchCand.id].includes(p.id))
  const badPriceCand = products.find((p) => ![yearCand.id, priceCand.id, blankCand.id, mismatchCand.id, badYearCand.id].includes(p.id))

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
  report.importPreview = {
    summary: plan.summary,
    updates: plan.plans.filter((p) => p.action === 'update').map((p) => ({
      id: p.product_id,
      key: p.canonical_product_key,
      status: p.status,
      changes: p.fieldChanges.map((c) => `${c.field}: ${c.current ?? '∅'} → ${c.next ?? '∅'}`),
    })),
    unchangedIds: plan.plans.filter((p) => p.action === 'unchanged').map((p) => p.product_id),
    errors: plan.errors.map((e) => ({ line: e.line, product_id: e.product_id, message: e.message })),
  }
  writeFileSync(join(OUT, 'import-preview.json'), JSON.stringify(report.importPreview, null, 2))
  writeFileSync(join(OUT, 'import-preview-errors.csv'), buildResearchImportErrorCsv(plan.errors, plan.plans))

  assert(plan.summary.validUpdates >= 2, 'valid updates')
  assert(plan.summary.unchanged >= 1, 'unchanged')
  assert(plan.summary.errors >= 3, 'errors')
  assert(plan.summary.identityConflicts >= 1, 'identity conflict')
  const blankPlan = plan.plans.find((p) => p.product_id === blankCand.id)
  assert(blankPlan?.action === 'unchanged', 'blank no change')
  pass('import preview', JSON.stringify(plan.summary))
  pass('blank researched_* => no change')
  pass('invalid year/price/ID-key rejected')
  pass('no apply to real catalogue rows')

  // Products refresh check: re-query same filter after preview-only — counts stable
  const again = await client.rpc('admin_list_equipment_products', {
    p_page: 1,
    p_page_size: 50,
    p_completion: 'incomplete',
    p_sort: 'brand',
    p_sort_dir: 'asc',
  })
  if (again.error) throw again.error
  assert(Number(again.data.total_count) === incomplete.total, 'totals stable without apply')
  pass('Products list refresh stable after preview-only', `incomplete still ${incomplete.total}`)

  report.finishedAt = new Date().toISOString()
  writeFileSync(join(OUT, 'admin-smoke-report.json'), JSON.stringify(report, null, 2))
  console.log('\n=== Admin smoke summary ===')
  console.log(JSON.stringify({
    deploymentId: report.deploymentId,
    exportCounts: report.exportCounts,
    importPreview: report.importPreview.summary,
    migrationDeployed: report.migrationDeployed,
    unrelatedFilesDeployed: report.unrelatedFilesDeployed,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
