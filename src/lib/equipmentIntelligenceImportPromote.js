/**
 * CSV import + automatic canonical promotion orchestration (browser / admin session).
 */

import { isSupabaseConfigured, supabase } from './supabase.js'
import {
  applyCanonicalProductsForBrands,
  brandsFromValidatedImportRows,
  buildProductsPathForImportedBrands,
  upsertCanonicalProductViaAuditRpc,
} from './applyCanonicalProductsByBrand.js'
import { upsertCanonicalProductFromAudit } from './equipmentProducts.js'
import { importEquipmentIntelligenceRows } from './equipmentIntelligence.js'

export {
  brandsFromValidatedImportRows,
  buildProductsPathForImportedBrands,
}

/**
 * Stage 1: upsert intelligence rows.
 * Stage 2: promote distinct affected brands into equipment_products.
 *
 * Promotion never auto-approves (approveSafe is always forced off).
 */
export async function importEquipmentIntelligenceAndPromote(validatedRows, {
  onProgress = null,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      stage: 'import',
      importResult: null,
      promotion: null,
      brands: [],
      productsPath: '/admin/intelligence/products',
      error: new Error('Supabase is not configured.'),
    }
  }

  const brands = brandsFromValidatedImportRows(validatedRows)
  onProgress?.({ stage: 'import', brands })

  const importResult = await importEquipmentIntelligenceRows(validatedRows)
  if (importResult.error) {
    return {
      ok: false,
      stage: 'import',
      importResult,
      promotion: null,
      brands,
      productsPath: buildProductsPathForImportedBrands(brands),
      error: importResult.error,
    }
  }

  onProgress?.({ stage: 'promote', brands, importResult })

  try {
    const promotion = await applyCanonicalProductsForBrands({
      brands,
      supabase,
      apply: true,
      allowManufactureYearAsBaseline: false,
      upsertProduct: (product) => upsertCanonicalProductViaAuditRpc(supabase, product, {
        upsertRpc: upsertCanonicalProductFromAudit,
      }),
      onProgress: (event) => onProgress?.({ stage: 'promote', brands, ...event }),
    })

    const ok = Boolean(promotion?.ok)
    return {
      ok,
      stage: ok ? 'complete' : 'promote',
      importResult,
      promotion,
      brands,
      productsPath: buildProductsPathForImportedBrands(brands),
      error: ok
        ? null
        : new Error(
          promotion.errors?.[0]?.message
            || 'Source import succeeded but canonical promotion failed.',
        ),
    }
  } catch (error) {
    return {
      ok: false,
      stage: 'promote',
      importResult,
      promotion: null,
      brands,
      productsPath: buildProductsPathForImportedBrands(brands),
      error,
    }
  }
}

/** Retry promotion only (no CSV re-import). */
export async function retryCanonicalPromotionForBrands(brands = [], {
  onProgress = null,
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      promotion: null,
      brands,
      productsPath: buildProductsPathForImportedBrands(brands),
      error: new Error('Supabase is not configured.'),
    }
  }

  try {
    const promotion = await applyCanonicalProductsForBrands({
      brands,
      supabase,
      apply: true,
      allowManufactureYearAsBaseline: false,
      upsertProduct: (product) => upsertCanonicalProductViaAuditRpc(supabase, product, {
        upsertRpc: upsertCanonicalProductFromAudit,
      }),
      onProgress,
    })

    return {
      ok: Boolean(promotion?.ok),
      promotion,
      brands: promotion.brands ?? brands,
      productsPath: buildProductsPathForImportedBrands(promotion.brands ?? brands),
      error: promotion?.ok
        ? null
        : new Error(promotion.errors?.[0]?.message || 'Canonical promotion failed.'),
    }
  } catch (error) {
    return {
      ok: false,
      promotion: null,
      brands,
      productsPath: buildProductsPathForImportedBrands(brands),
      error,
    }
  }
}
