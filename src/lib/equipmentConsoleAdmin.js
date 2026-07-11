/**
 * Admin helpers for equipment console catalogue management.
 */

import { isSupabaseConfigured, supabase } from './supabase.js'
import { isCardioEquipmentProduct } from './equipmentCardio.js'
import { findOverlappingCompatMappings, normalizeConsoleCompatOption } from './consoleCompatibility.js'
import { PRODUCT_STATUS } from './intelligenceCanonicalProducts.js'

export async function fetchEquipmentConsolesAdmin({ brand = null } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { consoles: [], error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('equipment_consoles')
    .select('*')
    .order('brand')
    .order('display_order')
    .order('console_name')

  if (brand) query = query.eq('brand', brand)

  const { data, error } = await query
  return { consoles: data ?? [], error }
}

export async function upsertEquipmentConsole(payload) {
  if (!isSupabaseConfigured || !supabase) {
    return { console: null, error: new Error('Supabase is not configured.') }
  }

  const row = {
    ...payload,
    alternative_names: payload.alternative_names ?? [],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('equipment_consoles')
    .upsert(row, { onConflict: 'brand,console_key' })
    .select('*')
    .single()

  return { console: data, error }
}

export async function fetchProductConsoleCompatAdmin({ brand = null, productId = null } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { rows: [], error: new Error('Supabase is not configured.') }
  }

  let query = supabase
    .from('product_console_compat')
    .select(`
      *,
      equipment_consoles (*),
      equipment_products (
        id,
        brand,
        canonical_product_key,
        canonical_product_name,
        equipment_type,
        status,
        baseline_manufacture_year,
        production_start_year,
        production_end_year
      )
    `)
    .order('display_order')

  if (productId) query = query.eq('product_id', productId)

  const { data, error } = await query
  if (error) return { rows: [], error }

  let rows = (data ?? []).map((row) => ({
    ...normalizeConsoleCompatOption({
      ...row,
      console_key: row.equipment_consoles?.console_key,
      console_name: row.equipment_consoles?.console_name,
      image_url: row.equipment_consoles?.image_url,
      brand: row.equipment_consoles?.brand ?? row.equipment_products?.brand,
    }),
    product: row.equipment_products,
    console: row.equipment_consoles,
  }))

  if (brand) {
    rows = rows.filter((row) => String(row.brand ?? '').toLowerCase() === String(brand).toLowerCase())
  }

  return { rows, error: null }
}

export async function upsertProductConsoleCompat(payload) {
  if (!isSupabaseConfigured || !supabase) {
    return { row: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('product_console_compat')
    .upsert(payload)
    .select('*')
    .single()

  return { row: data, error }
}

export async function deleteProductConsoleCompat(id) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') }
  }
  const { error } = await supabase.from('product_console_compat').delete().eq('id', id)
  return { error }
}

export function buildConsoleAdminAttention({
  products = [],
  compatRows = [],
  brand = null,
}) {
  const filteredProducts = products.filter((product) => {
    if (product.status !== PRODUCT_STATUS.APPROVED) return false
    if (!isCardioEquipmentProduct(product)) return false
    if (brand && String(product.brand).toLowerCase() !== String(brand).toLowerCase()) return false
    return true
  })

  const byProduct = new Map()
  for (const row of compatRows) {
    const productId = row.product_id
    if (!byProduct.has(productId)) byProduct.set(productId, [])
    byProduct.get(productId).push(row)
  }

  const missingMappings = []
  const lowConfidence = []
  const overlaps = []

  for (const product of filteredProducts) {
    const rows = byProduct.get(product.id) ?? []
    if (!rows.length) {
      missingMappings.push(product)
      continue
    }
    if (rows.some((row) => row.confidence === 'low')) {
      lowConfidence.push({ product, rows: rows.filter((row) => row.confidence === 'low') })
    }
    const productOverlaps = findOverlappingCompatMappings(rows)
    if (productOverlaps.length) {
      overlaps.push({ product, overlaps: productOverlaps })
    }
  }

  return {
    missingMappings,
    lowConfidence,
    overlaps,
    cardioProductCount: filteredProducts.length,
    mappedProductCount: filteredProducts.length - missingMappings.length,
  }
}
