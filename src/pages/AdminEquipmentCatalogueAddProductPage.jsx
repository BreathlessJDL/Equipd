import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EquipmentCatalogueNav from '../components/admin/EquipmentCatalogueNav'
import { ErrorState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import { findLikelyDuplicateProducts } from '../lib/equipmentCatalogueAdmin'
import {
  fetchEquipmentProducts,
  upsertCanonicalProductFromAudit,
} from '../lib/equipmentProducts'
import {
  buildCoreProductKeyFromFields,
  buildCoreProductName,
} from '../lib/intelligenceCoreProductGrouping'
import { PRODUCT_STATUS } from '../lib/intelligenceCanonicalProducts'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import '../components/admin/EquipmentCatalogueNav.css'

const EMPTY_FORM = {
  brand: '',
  productFamily: '',
  model: '',
  equipmentType: '',
  category: '',
  canonicalProductName: '',
  originalBasePrice: '',
  baselineManufactureYear: '',
  productionEndYear: '',
}

function AdminEquipmentCatalogueAddProductPage() {
  usePageTitle('Add product — Equipment Catalogue')
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [existingProducts, setExistingProducts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [acknowledgedDuplicates, setAcknowledgedDuplicates] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const result = await fetchEquipmentProducts()
      if (cancelled) return
      if (!result.error) setExistingProducts(result.products ?? [])
    }
    load()
    return () => { cancelled = true }
  }, [])

  const previewKey = useMemo(() => {
    if (!form.brand.trim() || !form.model.trim()) return ''
    return buildCoreProductKeyFromFields({
      brand: form.brand.trim(),
      equipmentType: form.equipmentType.trim() || null,
      productFamily: form.productFamily.trim() || null,
      coreModel: form.model.trim(),
    })
  }, [form.brand, form.equipmentType, form.productFamily, form.model])

  const previewName = useMemo(() => {
    if (form.canonicalProductName.trim()) return form.canonicalProductName.trim()
    return buildCoreProductName(
      form.brand.trim(),
      form.productFamily.trim() || null,
      form.model.trim(),
    )
  }, [form.brand, form.productFamily, form.model, form.canonicalProductName])

  const duplicates = useMemo(() => findLikelyDuplicateProducts(existingProducts, {
    brand: form.brand,
    model: form.model,
    canonicalProductName: previewName,
    canonicalProductKey: previewKey,
  }), [existingProducts, form.brand, form.model, previewName, previewKey])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setAcknowledgedDuplicates(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!form.brand.trim() || !form.model.trim()) {
      setError('Brand and model are required.')
      return
    }

    if (!previewKey) {
      setError('Could not generate a canonical product key from the provided fields.')
      return
    }

    if (duplicates.length > 0 && !acknowledgedDuplicates) {
      setError(`Possible duplicates found (${duplicates.length}). Review them and confirm before saving.`)
      return
    }

    setSaving(true)
    const result = await upsertCanonicalProductFromAudit({
      canonical_product_key: previewKey,
      brand: form.brand.trim(),
      product_family: form.productFamily.trim() || null,
      model: form.model.trim(),
      equipment_type: form.equipmentType.trim() || form.category.trim() || null,
      canonical_product_name: previewName,
      source_intelligence_row_ids: [],
      status: PRODUCT_STATUS.NEEDS_REVIEW,
      baseline_manufacture_year: form.baselineManufactureYear
        ? Number(form.baselineManufactureYear)
        : null,
      production_start_year: form.baselineManufactureYear
        ? Number(form.baselineManufactureYear)
        : null,
      production_end_year: form.productionEndYear ? Number(form.productionEndYear) : null,
      original_base_price: form.originalBasePrice ? Number(form.originalBasePrice) : null,
      original_base_price_currency: 'GBP',
      original_price_confidence: form.originalBasePrice ? 50 : null,
      review_reasons: ['manually added via Equipment Catalogue'],
    })
    setSaving(false)

    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }

    navigate(`/admin/intelligence/products?edit=${encodeURIComponent(previewKey)}`)
  }

  return (
    <div className="admin-intelligence admin-products">
      <EquipmentCatalogueNav
        title="Add product"
        subtitle="Create a canonical catalogue product using the existing product identity rules."
      />

      <form className="admin-intelligence__panel" onSubmit={handleSubmit}>
        <h2 className="admin-intelligence__panel-title">Product details</h2>
        <div className="admin-products__form-grid">
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Brand *</span>
            <input className="admin-intelligence__input" value={form.brand} onChange={(e) => updateField('brand', e.target.value)} required />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Family / series</span>
            <input className="admin-intelligence__input" value={form.productFamily} onChange={(e) => updateField('productFamily', e.target.value)} />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Model *</span>
            <input className="admin-intelligence__input" value={form.model} onChange={(e) => updateField('model', e.target.value)} required />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Category</span>
            <input className="admin-intelligence__input" value={form.category} onChange={(e) => updateField('category', e.target.value)} placeholder="Optional" />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Equipment type</span>
            <input className="admin-intelligence__input" value={form.equipmentType} onChange={(e) => updateField('equipmentType', e.target.value)} placeholder="Treadmill, Chest Press…" />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Canonical product name</span>
            <input className="admin-intelligence__input" value={form.canonicalProductName} onChange={(e) => updateField('canonicalProductName', e.target.value)} placeholder={previewName || 'Auto-generated if blank'} />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Estimated original RRP</span>
            <input className="admin-intelligence__input" value={form.originalBasePrice} onChange={(e) => updateField('originalBasePrice', e.target.value)} inputMode="decimal" />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Manufactured from</span>
            <input className="admin-intelligence__input" value={form.baselineManufactureYear} onChange={(e) => updateField('baselineManufactureYear', e.target.value)} inputMode="numeric" />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Production end</span>
            <input className="admin-intelligence__input" value={form.productionEndYear} onChange={(e) => updateField('productionEndYear', e.target.value)} inputMode="numeric" />
          </label>
        </div>

        <dl className="admin-products__confirm-stats" style={{ marginTop: '1rem' }}>
          <div>
            <dt>Canonical key</dt>
            <dd><code>{previewKey || '—'}</code></dd>
          </div>
          <div>
            <dt>Display name</dt>
            <dd>{previewName || '—'}</dd>
          </div>
        </dl>

        {duplicates.length > 0 ? (
          <div className="admin-intelligence__panel" style={{ marginTop: '1rem' }}>
            <h3 className="admin-intelligence__panel-title">Possible duplicates</h3>
            <ul>
              {duplicates.slice(0, 8).map((product) => (
                <li key={product.id}>
                  {product.canonical_product_name}
                  {' '}
                  <code>{product.canonical_product_key}</code>
                  {' '}
                  ({product.status})
                </li>
              ))}
            </ul>
            <label className="admin-products__select-all">
              <input
                type="checkbox"
                checked={acknowledgedDuplicates}
                onChange={(e) => setAcknowledgedDuplicates(e.target.checked)}
              />
              I have reviewed these and still want to save
            </label>
          </div>
        ) : null}

        {error ? <ErrorState compact>{error}</ErrorState> : null}

        <div className="admin-products__modal-actions" style={{ marginTop: '1rem' }}>
          <button
            type="submit"
            className="admin-intelligence__button admin-intelligence__button--primary"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AdminEquipmentCatalogueAddProductPage
