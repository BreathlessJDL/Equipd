/**
 * Build validation report for a research CSV against live products (read-only).
 * Usage: node scripts/report-research-import-classifications.mjs [path-to-csv]
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'
import {
  buildResearchImportPlan,
  parseResearchCsv,
} from '../src/lib/equipmentProductResearchCsv.js'
import {
  classifyResearchImportPlanRows,
} from '../src/lib/equipmentProductResearchImportReport.js'

const PRODUCT_SELECT = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_source',
  'original_price_source_url',
  'baseline_source',
  'original_price_confidence',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
  'review_notes',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'image_updated_at',
  'created_at',
  'updated_at',
].join(', ')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'reports', 'research-import-validation')

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

async function fetchProductsByIds(client, ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map()
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80)
    const { data, error } = await client
      .from('equipment_products')
      .select(PRODUCT_SELECT)
      .in('id', chunk)
    if (error) throw error
    for (const row of data ?? []) map.set(String(row.id), row)
  }
  return map
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
  const userClient = createClient(url, anon, { auth: { persistSession: false } })
  const { data: verified, error: verifyErr } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  })
  if (verifyErr) throw verifyErr
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${verified.session.access_token}` } },
    auth: { persistSession: false },
  })
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  mkdirSync(OUT, { recursive: true })

  const csvPath = process.argv[2]
    || join(process.env.USERPROFILE || '', 'Downloads', 'equipd-product-research-completed-2026-07-14.csv')
  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const text = readFileSync(csvPath, 'utf8')
  const parsed = parseResearchCsv(text)
  if (parsed.error) throw parsed.error

  // Prefer service-role read for presence check (same IDs the importer loads via admin client)
  const service = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const ids = parsed.rows.map((r) => String(r.product_id || '').trim()).filter(Boolean)
  const map = await fetchProductsByIds(service, ids)

  const plan = buildResearchImportPlan(parsed.rows, map)
  const report = classifyResearchImportPlanRows(parsed.rows, plan)

  const stamp = new Date().toISOString().slice(0, 10)
  const base = basename(csvPath).replace(/\.csv$/i, '')
  writeFileSync(join(OUT, `${base}-validation-${stamp}.txt`), `${report.classificationSummary.text}\n`)
  writeFileSync(join(OUT, `${base}-rejections-${stamp}.csv`), report.rejectionCsv)
  writeFileSync(join(OUT, `${base}-classifications-${stamp}.json`), JSON.stringify({
    sourceCsv: csvPath,
    importerSummary: plan.summary,
    classificationSummary: report.classificationSummary,
    classifications: report.classifications.map(({ rawRow, ...rest }) => rest),
  }, null, 2))

  console.log(`Source: ${csvPath}`)
  console.log(`Products found: ${map.size} / ${ids.length} unique ids`)
  console.log('')
  console.log(report.classificationSummary.text)
  console.log('')
  console.log(`Importer validUpdates (unchanged): ${plan.summary.validUpdates} (${plan.summary.unchanged})`)
  console.log(`Artifacts: ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
