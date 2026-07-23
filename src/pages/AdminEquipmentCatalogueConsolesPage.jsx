import { useEffect, useMemo, useState } from 'react'
import EquipmentCatalogueNav from '../components/admin/EquipmentCatalogueNav'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  buildConsoleAdminAttention,
  fetchEquipmentConsolesAdmin,
  fetchProductConsoleCompatAdmin,
  upsertEquipmentConsole,
} from '../lib/equipmentConsoleAdmin'
import {
  resolveEquipmentConsoleImageUrl,
  validateEquipmentConsoleImagePath,
} from '../lib/equipmentConsoleImages'
import { fetchEquipmentProducts } from '../lib/equipmentProducts'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import '../components/admin/EquipmentCatalogueNav.css'
import './AdminEquipmentCatalogueConsolesPage.css'

const BRAND_FILTERS = [
  'All',
  'Concept2',
  'Wattbike',
  'Woodway',
  'Cybex',
  'Matrix Fitness',
  'Life Fitness',
  'Technogym',
]

const EMPTY_CONSOLE_FORM = {
  brand: 'Concept2',
  console_key: '',
  console_name: '',
  start_year: '',
  end_year: '',
  display_order: 0,
  active: true,
  is_current: false,
  confidence: 'medium',
  source_url: '',
  notes: '',
  image_url: '',
}

function AdminEquipmentCatalogueConsolesPage() {
  usePageTitle('Consoles — Equipment Catalogue')
  const [brand, setBrand] = useState('Concept2')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [consoles, setConsoles] = useState([])
  const [compatRows, setCompatRows] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY_CONSOLE_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [attentionFilter, setAttentionFilter] = useState('all')

  async function reload() {
    setLoading(true)
    setError('')
    const brandFilter = brand === 'All' ? null : brand
    const [consolesResult, compatResult, productsResult] = await Promise.all([
      fetchEquipmentConsolesAdmin({ brand: brandFilter }),
      fetchProductConsoleCompatAdmin({ brand: brandFilter }),
      fetchEquipmentProducts(),
    ])

    if (consolesResult.error || compatResult.error || productsResult.error) {
      setError(getAdminErrorMessage(
        consolesResult.error || compatResult.error || productsResult.error,
      ))
      setLoading(false)
      return
    }

    setConsoles(consolesResult.consoles ?? [])
    setCompatRows(compatResult.rows ?? [])
    setProducts(productsResult.products ?? [])
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [brand])

  const attention = useMemo(
    () => buildConsoleAdminAttention({
      products,
      compatRows,
      brand: brand === 'All' ? null : brand,
    }),
    [products, compatRows, brand],
  )

  const imagePathValidation = useMemo(
    () => validateEquipmentConsoleImagePath(form.image_url),
    [form.image_url],
  )
  const previewImageUrl = imagePathValidation.resolvedUrl
    || resolveEquipmentConsoleImageUrl(form.image_url)

  const filteredCompat = useMemo(() => {
    if (attentionFilter === 'low') {
      return compatRows.filter((row) => row.confidence === 'low')
    }
    if (attentionFilter === 'retrofit') {
      return compatRows.filter((row) => row.compatibility_type === 'retrofit')
    }
    return compatRows
  }, [compatRows, attentionFilter])

  async function handleSaveConsole(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const validation = validateEquipmentConsoleImagePath(form.image_url)
    if (!validation.ok) {
      setSaving(false)
      setError(validation.error)
      return
    }

    const payload = {
      ...form,
      image_url: validation.resolvedUrl || (form.image_url ? String(form.image_url).trim() : ''),
      start_year: form.start_year === '' ? null : Number(form.start_year),
      end_year: form.end_year === '' ? null : Number(form.end_year),
      display_order: Number(form.display_order ?? 0),
      console_key: String(form.console_key).trim().toLowerCase().replace(/\s+/g, '_'),
    }
    const result = await upsertEquipmentConsole(payload)
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    setMessage(`Saved console ${result.console?.console_name}`)
    setForm({ ...EMPTY_CONSOLE_FORM, brand: form.brand })
    await reload()
  }

  function startEdit(consoleRow) {
    setForm({
      brand: consoleRow.brand,
      console_key: consoleRow.console_key,
      console_name: consoleRow.console_name,
      start_year: consoleRow.start_year ?? '',
      end_year: consoleRow.end_year ?? '',
      display_order: consoleRow.display_order ?? 0,
      active: consoleRow.active !== false,
      is_current: Boolean(consoleRow.is_current),
      confidence: consoleRow.confidence ?? 'medium',
      source_url: consoleRow.source_url ?? '',
      notes: consoleRow.notes ?? '',
      image_url: consoleRow.image_url ?? '',
    })
  }

  return (
    <div className="admin-intelligence admin-products admin-consoles">
      <EquipmentCatalogueNav
        title="Consoles"
        subtitle="Master console catalogue and product/year compatibility. Public pages show factory and optional only."
      />

      <div className="admin-consoles__toolbar">
        <label>
          Brand
          <select value={brand} onChange={(event) => setBrand(event.target.value)}>
            {BRAND_FILTERS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <div className="admin-consoles__stats">
          <span>{consoles.length} consoles</span>
          <span>{attention.mappedProductCount}/{attention.cardioProductCount} cardio mapped</span>
          <span>{attention.missingMappings.length} missing</span>
          <span>{attention.lowConfidence.length} low confidence</span>
          <span>{attention.overlaps.length} overlaps</span>
        </div>
      </div>

      {loading ? <LoadingState compact>Loading consoles…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}
      {message ? <p className="admin-consoles__message">{message}</p> : null}

      {!loading && !error ? (
        <>
          <section className="admin-consoles__section">
            <h2>Consoles</h2>
            {consoles.length === 0 ? (
              <EmptyState compact>No consoles for this brand yet.</EmptyState>
            ) : (
              <div className="admin-consoles__table-wrap">
                <table className="admin-consoles__table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Key</th>
                      <th>Years</th>
                      <th>Confidence</th>
                      <th>Active</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {consoles.map((row) => {
                      const thumbUrl = resolveEquipmentConsoleImageUrl(row)
                      return (
                      <tr key={row.id}>
                        <td>
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt=""
                              className="admin-consoles__thumb"
                            />
                          ) : (
                            <span className="admin-consoles__muted">—</span>
                          )}
                        </td>
                        <td>{row.console_name}</td>
                        <td><code>{row.console_key}</code></td>
                        <td>{row.start_year ?? '?'}–{row.end_year ?? 'present'}</td>
                        <td>{row.confidence}</td>
                        <td>{row.active ? 'yes' : 'no'}</td>
                        <td>
                          <button type="button" className="admin-consoles__link" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-consoles__section">
            <h2>{form.console_key ? `Edit ${form.console_name || form.console_key}` : 'Add console'}</h2>
            <form className="admin-consoles__form" onSubmit={handleSaveConsole}>
              <label>
                Brand
                <input
                  value={form.brand}
                  onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                  required
                />
              </label>
              <label>
                Console key
                <input
                  value={form.console_key}
                  onChange={(event) => setForm((prev) => ({ ...prev, console_key: event.target.value }))}
                  required
                />
              </label>
              <label>
                Console name
                <input
                  value={form.console_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, console_name: event.target.value }))}
                  required
                />
              </label>
              <label>
                Start year
                <input
                  type="number"
                  value={form.start_year}
                  onChange={(event) => setForm((prev) => ({ ...prev, start_year: event.target.value }))}
                />
              </label>
              <label>
                End year
                <input
                  type="number"
                  value={form.end_year}
                  onChange={(event) => setForm((prev) => ({ ...prev, end_year: event.target.value }))}
                />
              </label>
              <label>
                Confidence
                <select
                  value={form.confidence}
                  onChange={(event) => setForm((prev) => ({ ...prev, confidence: event.target.value }))}
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
              <label>
                Image URL
                <input
                  value={form.image_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
                  placeholder="/equipment-console-images/{brand}/normalized/{filename}"
                />
              </label>
              {form.image_url ? (
                <div className="admin-consoles__image-preview">
                  {imagePathValidation.ok && previewImageUrl ? (
                    <img src={previewImageUrl} alt="" className="admin-consoles__thumb" />
                  ) : null}
                  {imagePathValidation.error ? (
                    <p className="admin-consoles__image-error">{imagePathValidation.error}</p>
                  ) : previewImageUrl ? (
                    <p className="admin-consoles__muted"><code>{previewImageUrl}</code></p>
                  ) : null}
                </div>
              ) : null}
              <label className="admin-consoles__form-wide">
                Source URL
                <input
                  value={form.source_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))}
                />
              </label>
              <label className="admin-consoles__form-wide">
                Notes
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                />
              </label>
              <div className="admin-consoles__form-actions">
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save console'}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...EMPTY_CONSOLE_FORM, brand: brand === 'All' ? 'Concept2' : brand })}
                >
                  Reset
                </button>
              </div>
            </form>
          </section>

          <section className="admin-consoles__section">
            <div className="admin-consoles__section-head">
              <h2>Product assignments</h2>
              <label>
                Filter
                <select value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value)}>
                  <option value="all">All mappings</option>
                  <option value="low">Low confidence</option>
                  <option value="retrofit">Retrofit only</option>
                </select>
              </label>
            </div>

            {attention.missingMappings.length ? (
              <div className="admin-consoles__alert">
                <strong>Missing mappings ({attention.missingMappings.length})</strong>
                <ul>
                  {attention.missingMappings.slice(0, 20).map((product) => (
                    <li key={product.id}>
                      {product.canonical_product_name}
                      {' '}
                      <code>{product.canonical_product_key}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {attention.overlaps.length ? (
              <div className="admin-consoles__alert">
                <strong>Overlapping year ranges ({attention.overlaps.length} products)</strong>
              </div>
            ) : null}

            {filteredCompat.length === 0 ? (
              <EmptyState compact>No compatibility rows for this filter.</EmptyState>
            ) : (
              <div className="admin-consoles__table-wrap">
                <table className="admin-consoles__table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Console</th>
                      <th>Type</th>
                      <th>Years</th>
                      <th>Default</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompat.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.product?.canonical_product_name || row.product_id}
                          <div className="admin-consoles__muted">
                            <code>{row.product?.canonical_product_key}</code>
                          </div>
                        </td>
                        <td>{row.console_name}</td>
                        <td>{row.compatibility_type}</td>
                        <td>
                          {row.available_from_year}–{row.available_to_year ?? 'open'}
                          {(row.from_year_approximate || row.to_year_approximate) ? ' ≈' : ''}
                        </td>
                        <td>{row.is_default ? 'yes' : ''}</td>
                        <td>{row.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

export default AdminEquipmentCatalogueConsolesPage
