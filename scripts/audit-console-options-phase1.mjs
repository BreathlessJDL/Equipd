/**
 * Phase 1 audit: console options coverage by brand (read-only).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { isCardioEquipmentProduct } from '../src/lib/equipmentCardio.js'
import { classifyCommercialCardioConsoleGroup } from '../src/lib/commercialCardioConsoleCompat.js'

const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of text.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const TARGET = [
  'Cybex',
  'Wattbike',
  'Concept2',
  'Woodway',
  'Matrix',
  'Matrix Fitness',
  'Life Fitness',
  'Technogym',
]

async function fetchAll(table, select, filterFn) {
  const pageSize = 1000
  let from = 0
  const rows = []
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1)
    if (filterFn) q = filterFn(q)
    const { data, error } = await q
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
    from += pageSize
  }
  return rows
}

const products = await fetchAll(
  'equipment_products',
  'id, brand, canonical_product_name, canonical_product_key, equipment_type, product_family, model, status, baseline_manufacture_year, production_start_year, production_end_year',
  (q) => q.eq('status', 'approved').in('brand', TARGET),
)

const options = await fetchAll(
  'product_console_options',
  'id, product_id, console_key, console_name, release_year, retired_year, tier, modifier_percent, image_url, sort_order, is_active',
)

const availability = await fetchAll(
  'equipment_console_availability',
  'id, brand, console_name, release_year, retired_year, console_tier, modifier_percent, compatible_series, compatible_equipment_types',
)

const modifiers = await fetchAll(
  'equipment_console_modifiers',
  'id, brand, console_name, console_tier, modifier_value',
)

const optionsByProduct = new Map()
for (const opt of options) {
  if (!optionsByProduct.has(opt.product_id)) optionsByProduct.set(opt.product_id, [])
  optionsByProduct.get(opt.product_id).push(opt)
}

const uniqueConsolesByBrand = new Map()
for (const opt of options) {
  const product = products.find((p) => p.id === opt.product_id)
  const brand = product?.brand || 'unknown'
  if (!uniqueConsolesByBrand.has(brand)) uniqueConsolesByBrand.set(brand, new Map())
  const map = uniqueConsolesByBrand.get(brand)
  const key = opt.console_key || opt.console_name
  if (!map.has(key)) {
    map.set(key, {
      console_name: opt.console_name,
      console_key: opt.console_key,
      release_year: opt.release_year,
      retired_year: opt.retired_year,
      with_image: Boolean(opt.image_url),
      product_count: 0,
    })
  }
  const entry = map.get(key)
  entry.product_count += 1
  if (opt.image_url) entry.with_image = true
}

function listImageFiles(brandFolder) {
  const root = join(process.cwd(), 'public', 'equipment-console-images', brandFolder)
  if (!existsSync(root)) return { raw: [], normalized: [] }
  const raw = readdirSync(root).filter((f) => !f.startsWith('.') && f !== 'normalized')
  const normDir = join(root, 'normalized')
  const normalized = existsSync(normDir)
    ? readdirSync(normDir).filter((f) => !f.startsWith('.'))
    : []
  return { raw, normalized }
}

const imageFolders = {
  'Life Fitness': listImageFiles('life-fitness'),
  Technogym: listImageFiles('technogym'),
  Matrix: listImageFiles('matrix-fitness'),
  'Matrix Fitness': listImageFiles('matrix-fitness'),
  Cybex: listImageFiles('cybex'),
  Wattbike: listImageFiles('wattbike'),
  Concept2: listImageFiles('concept2'),
  Woodway: listImageFiles('woodway'),
}

const report = {
  totals: {
    product_console_options_rows: options.length,
    equipment_console_availability_rows: availability.length,
    equipment_console_modifiers_rows: modifiers.length,
  },
  availability_by_brand: Object.fromEntries(
    [...new Set(availability.map((r) => r.brand))].sort().map((brand) => [
      brand,
      availability.filter((r) => r.brand === brand).map((r) => ({
        console_name: r.console_name,
        release_year: r.release_year,
        retired_year: r.retired_year,
        series: r.compatible_series,
        types: r.compatible_equipment_types,
      })),
    ]),
  ),
  modifiers_by_brand: Object.fromEntries(
    [...new Set(modifiers.map((r) => r.brand))].sort().map((brand) => [
      brand,
      modifiers.filter((r) => r.brand === brand).map((r) => r.console_name),
    ]),
  ),
  brands: TARGET.map((brand) => {
    const all = products.filter((p) => p.brand === brand)
    const cardio = all.filter((p) => isCardioEquipmentProduct(p))
    const withOpts = cardio.filter((p) => (optionsByProduct.get(p.id) || []).some((o) => o.is_active !== false))
    const without = cardio.filter((p) => !(optionsByProduct.get(p.id) || []).some((o) => o.is_active !== false))
    const brandWideRisk = without.filter((p) => (
      availability.some((a) => a.brand === brand)
      || modifiers.some((m) => m.brand === brand)
    ))
    const classified = cardio.map((p) => ({
      name: p.canonical_product_name,
      key: p.canonical_product_key,
      group: classifyCommercialCardioConsoleGroup(p),
      years: [p.baseline_manufacture_year, p.production_start_year, p.production_end_year],
      option_count: (optionsByProduct.get(p.id) || []).filter((o) => o.is_active !== false).length,
      option_names: (optionsByProduct.get(p.id) || []).filter((o) => o.is_active !== false).map((o) => o.console_name),
    }))
    const unique = uniqueConsolesByBrand.get(brand)
    return {
      brand,
      approved_total: all.length,
      approved_cardio: cardio.length,
      cardio_with_product_console_options: withOpts.length,
      cardio_without_product_console_options: without.length,
      unique_console_keys_on_products: unique?.size ?? 0,
      unique_consoles: unique ? [...unique.values()] : [],
      image_files: imageFolders[brand] || null,
      brand_level_availability_consoles: availability.filter((a) => a.brand === brand).length,
      brand_level_modifier_consoles: modifiers.filter((m) => m.brand === brand).length,
      products_at_risk_of_brand_wide_fallback: brandWideRisk.length,
      cardio_products: classified.sort((a, b) => a.name.localeCompare(b.name)),
    }
  }),
}

mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
const outPath = join(process.cwd(), 'reports', 'console-options-phase1-audit.json')
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Wrote ${outPath}`)
for (const b of report.brands) {
  console.log(
    `${b.brand}: cardio=${b.approved_cardio} withOpts=${b.cardio_with_product_console_options} without=${b.cardio_without_product_console_options} brandRisk=${b.products_at_risk_of_brand_wide_fallback} uniqueConsoles=${b.unique_console_keys_on_products}`,
  )
}
