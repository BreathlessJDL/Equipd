import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  deleteAllEquipmentIntelligence,
  deleteEquipmentIntelligence,
  deleteEquipmentIntelligenceRecords,
  EQUIPMENT_INTELLIGENCE_PAGE_SIZE,
  fetchEquipmentIntelligenceFilterOptions,
  fetchEquipmentIntelligencePage,
  formatEquipmentIntelligenceRange,
  formatTradeInValue,
  getEquipmentIntelligenceDisplayName,
  getObservationCount,
  updateEquipmentIntelligence,
} from '../lib/equipmentIntelligence'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'

const IS_DEV = import.meta.env.DEV

function toInputValue(value) {
  if (value == null) return ''
  return String(value)
}

function buildEditForm(record) {
  return {
    brand: toInputValue(record?.brand),
    series: toInputValue(record?.series),
    model: toInputValue(record?.model),
    category: toInputValue(record?.category),
    equipment_type: toInputValue(record?.equipment_type),
    manufacture_year: toInputValue(record?.manufacture_year),
    original_rrp: toInputValue(record?.original_rrp),
    estimated_trade_in_value: toInputValue(record?.estimated_trade_in_value),
    confidence: toInputValue(record?.confidence) || 'Low',
    currency: toInputValue(record?.currency) || 'GBP',
    slug: toInputValue(record?.slug),
  }
}

function parseNullableNumber(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : null
}

function parseNullableInt(value) {
  const number = parseNullableNumber(value)
  if (number == null) return null
  return Math.trunc(number)
}

function ConfirmDeleteModal({
  title,
  body,
  confirmLabel = 'Delete',
  confirming = false,
  error = '',
  onCancel,
  onConfirm,
}) {
  return (
    <div className="admin-intelligence__modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-intelligence__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-intelligence-delete-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="admin-intelligence-delete-title" className="admin-intelligence__modal-title">
          {title}
        </h2>
        <p className="admin-intelligence__modal-lead">{body}</p>

        {error ? (
          <p className="admin-intelligence__message admin-intelligence__message--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-intelligence__actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onCancel}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--danger"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminIntelligencePage() {
  usePageTitle('Source rows — Equipment Catalogue')

  const [records, setRecords] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [brands, setBrands] = useState([])
  const [categories, setCategories] = useState([])

  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const [deleteModal, setDeleteModal] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [dangerConfirmText, setDangerConfirmText] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, brandFilter, categoryFilter])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')

    const [pageResult, filterOptionsResult] = await Promise.all([
      fetchEquipmentIntelligencePage({
        page,
        pageSize: EQUIPMENT_INTELLIGENCE_PAGE_SIZE,
        search,
        brand: brandFilter,
        category: categoryFilter,
      }),
      fetchEquipmentIntelligenceFilterOptions(),
    ])

    if (pageResult.error) {
      setRecords([])
      setTotalCount(0)
      setError(getAdminErrorMessage(pageResult.error))
      setLoading(false)
      return
    }

    setRecords(pageResult.data ?? [])
    setTotalCount(pageResult.count ?? 0)

    if (!filterOptionsResult.error) {
      setBrands(filterOptionsResult.brands ?? [])
      setCategories(filterOptionsResult.categories ?? [])
    }

    setSelectedIds(new Set())
    setLoading(false)
  }, [page, search, brandFilter, categoryFilter])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const totalPages = Math.max(1, Math.ceil(totalCount / EQUIPMENT_INTELLIGENCE_PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const recordCountLabel = formatEquipmentIntelligenceRange({
    page,
    pageSize: EQUIPMENT_INTELLIGENCE_PAGE_SIZE,
    totalCount,
    visibleCount: records.length,
  })

  const visibleIds = useMemo(
    () => records.map((record) => record.id),
    [records],
  )

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  function toggleSelectAll() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function toggleSelect(id) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function openEdit(record) {
    setEditingRecord(record)
    setEditForm(buildEditForm(record))
    setSaveError('')
    setSaveSuccess('')
  }

  function closeEdit() {
    setEditingRecord(null)
    setEditForm(null)
    setSaveError('')
  }

  function closeDeleteModal() {
    if (deleting) return
    setDeleteModal(null)
    setDeleteError('')
    setDangerConfirmText('')
  }

  async function handleSaveEdit(event) {
    event.preventDefault()
    if (!editingRecord || !editForm) return

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const updates = {
      brand: editForm.brand.trim(),
      series: editForm.series.trim() || null,
      model: editForm.model.trim(),
      category: editForm.category.trim() || null,
      equipment_type: editForm.equipment_type.trim() || null,
      manufacture_year: parseNullableInt(editForm.manufacture_year),
      original_rrp: parseNullableNumber(editForm.original_rrp),
      estimated_trade_in_value: parseNullableNumber(editForm.estimated_trade_in_value),
      confidence: editForm.confidence.trim() || 'Low',
      currency: editForm.currency.trim() || 'GBP',
      slug: editForm.slug.trim(),
    }

    if (!updates.brand || !updates.model || !updates.slug) {
      setSaveError('Brand, model and slug are required.')
      setSaving(false)
      return
    }

    const result = await updateEquipmentIntelligence(editingRecord.id, updates)

    if (result.error) {
      setSaveError(getAdminErrorMessage(result.error))
      setSaving(false)
      return
    }

    setRecords((current) =>
      current.map((record) => (record.id === editingRecord.id ? result.data : record)),
    )
    setSaveSuccess('Record updated.')
    setSaving(false)
    setEditingRecord(null)
    setEditForm(null)
  }

  async function handleConfirmDelete() {
    if (!deleteModal) return

    setDeleting(true)
    setDeleteError('')

    if (deleteModal.type === 'single') {
      const result = await deleteEquipmentIntelligence(deleteModal.record.id)
      if (result.error || !result.success) {
        setDeleteError(getAdminErrorMessage(result.error ?? new Error('Delete failed.')))
        setDeleting(false)
        return
      }
      setSaveSuccess('Record deleted.')
    } else if (deleteModal.type === 'bulk') {
      const result = await deleteEquipmentIntelligenceRecords(deleteModal.ids)
      if (result.error) {
        setDeleteError(getAdminErrorMessage(result.error))
        setDeleting(false)
        return
      }
      setSaveSuccess(
        `Deleted ${result.deletedCount} record${result.deletedCount === 1 ? '' : 's'}.`,
      )
    } else if (deleteModal.type === 'all') {
      const result = await deleteAllEquipmentIntelligence()
      if (result.error) {
        setDeleteError(getAdminErrorMessage(result.error))
        setDeleting(false)
        return
      }
      setSaveSuccess(
        `Deleted all ${result.deletedCount} intelligence record${result.deletedCount === 1 ? '' : 's'}.`,
      )
    }

    setDeleting(false)
    setDeleteModal(null)
    setDangerConfirmText('')
    await loadRecords()
  }

  const deleteModalContent = useMemo(() => {
    if (!deleteModal) return null

    if (deleteModal.type === 'single') {
      return {
        title: 'Delete equipment?',
        body: (
          <>
            This will permanently remove this equipment intelligence record.
            <br />
            This action cannot be undone.
          </>
        ),
      }
    }

    if (deleteModal.type === 'bulk') {
      const count = deleteModal.ids.length
      return {
        title: 'Delete selected equipment?',
        body: (
          <>
            This will permanently remove {count} equipment intelligence record
            {count === 1 ? '' : 's'}.
            <br />
            This action cannot be undone.
          </>
        ),
      }
    }

    return {
      title: 'Delete all equipment intelligence?',
      body: (
        <>
          This will permanently remove every equipment intelligence record.
          <br />
          This action cannot be undone.
        </>
      ),
    }
  }, [deleteModal])

  return (
    <section className="admin-intelligence">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>
        <h1 className="admin-intelligence__title">Source rows</h1>
        <p className="admin-intelligence__lead">
          Raw equipment intelligence rows used as source data for the catalogue. Prefer Products for day-to-day management.
        </p>
        <div className="admin-intelligence__actions">
          <Link
            to="/admin/intelligence/products"
            className="admin-intelligence__button admin-intelligence__button--primary"
          >
            Back to Products
          </Link>
          <Link
            to="/admin/intelligence/import"
            className="admin-intelligence__button admin-intelligence__button--secondary"
          >
            Import CSV
          </Link>
        </div>
      </header>

      <div className="admin-intelligence__controls">
        <div className="admin-intelligence__filters">
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="admin-intelligence-search">
              Search
            </label>
            <input
              id="admin-intelligence-search"
              type="search"
              className="admin-intelligence__input"
              placeholder="Brand, series, model, slug…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="admin-intelligence-brand">
              Brand
            </label>
            <select
              id="admin-intelligence-brand"
              className="admin-intelligence__select"
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
            >
              <option value="">All brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="admin-intelligence-category">
              Category
            </label>
            <select
              id="admin-intelligence-category"
              className="admin-intelligence__select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && !error ? (
          <p className="admin-intelligence__count">{recordCountLabel}</p>
        ) : null}
      </div>

      {saveSuccess ? (
        <p className="admin-intelligence__message admin-intelligence__message--success" role="status">
          {saveSuccess}
        </p>
      ) : null}

      {loading ? <LoadingState>Loading intelligence records…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {!loading && !error && records.length === 0 ? (
        <EmptyState compact>No intelligence records match your filters.</EmptyState>
      ) : null}

      {!loading && !error && records.length > 0 ? (
        <>
          <div className="admin-intelligence__bulk-bar">
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--danger"
              disabled={selectedIds.size === 0}
              onClick={() =>
                setDeleteModal({
                  type: 'bulk',
                  ids: [...selectedIds],
                })
              }
            >
              Delete Selected ({selectedIds.size})
            </button>
          </div>

          <div className="admin-intelligence__table-wrap">
            <table className="admin-intelligence__table">
              <thead>
                <tr>
                  <th scope="col" className="admin-intelligence__checkbox-cell">
                    <input
                      type="checkbox"
                      className="admin-intelligence__checkbox"
                      aria-label="Select all visible rows"
                      checked={allVisibleSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected
                      }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">Brand</th>
                  <th scope="col">Series</th>
                  <th scope="col">Model</th>
                  <th scope="col">Trade in</th>
                  <th scope="col">Observations</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="admin-intelligence__checkbox-cell">
                      <input
                        type="checkbox"
                        className="admin-intelligence__checkbox"
                        aria-label={`Select ${getEquipmentIntelligenceDisplayName(record)}`}
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelect(record.id)}
                      />
                    </td>
                    <td>{record.brand}</td>
                    <td>{record.series || '—'}</td>
                    <td>{record.model}</td>
                    <td>{formatTradeInValue(record)}</td>
                    <td>{getObservationCount(record)}</td>
                    <td>{record.confidence || '—'}</td>
                    <td>
                      <div className="admin-intelligence__row-actions">
                        <button
                          type="button"
                          className="admin-intelligence__edit-button"
                          onClick={() => openEdit(record)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-intelligence__delete-button"
                          onClick={() =>
                            setDeleteModal({ type: 'single', record })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="admin-intelligence__pagination">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="admin-intelligence__pagination-label">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {IS_DEV ? (
        <section className="admin-intelligence__danger-zone">
          <h2 className="admin-intelligence__danger-zone-title">Danger Zone</h2>
          <p className="admin-intelligence__danger-zone-lead">
            Development only. Permanently deletes every equipment intelligence record.
          </p>
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="danger-delete-confirm">
              Type DELETE to enable
            </label>
            <input
              id="danger-delete-confirm"
              type="text"
              className="admin-intelligence__input"
              value={dangerConfirmText}
              onChange={(event) => setDangerConfirmText(event.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <div className="admin-intelligence__actions">
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--danger"
              disabled={dangerConfirmText !== 'DELETE'}
              onClick={() => setDeleteModal({ type: 'all' })}
            >
              Delete ALL Equipment Intelligence
            </button>
          </div>
        </section>
      ) : null}

      {editingRecord && editForm ? (
        <div className="admin-intelligence__modal-backdrop" role="presentation" onClick={closeEdit}>
          <div
            className="admin-intelligence__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-intelligence-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="admin-intelligence-edit-title" className="admin-intelligence__modal-title">
              Edit {getEquipmentIntelligenceDisplayName(editingRecord)}
            </h2>

            <form className="admin-intelligence__form-grid" onSubmit={handleSaveEdit}>
              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-brand">Brand</label>
                <input
                  id="edit-brand"
                  className="admin-intelligence__input"
                  value={editForm.brand}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, brand: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-series">Series</label>
                <input
                  id="edit-series"
                  className="admin-intelligence__input"
                  value={editForm.series}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, series: event.target.value }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-model">Model</label>
                <input
                  id="edit-model"
                  className="admin-intelligence__input"
                  value={editForm.model}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, model: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-slug">Slug</label>
                <input
                  id="edit-slug"
                  className="admin-intelligence__input"
                  value={editForm.slug}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, slug: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-category">Category</label>
                <input
                  id="edit-category"
                  className="admin-intelligence__input"
                  value={editForm.category}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-equipment-type">
                  Equipment type
                </label>
                <input
                  id="edit-equipment-type"
                  className="admin-intelligence__input"
                  value={editForm.equipment_type}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, equipment_type: event.target.value }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-manufacture-year">
                  Manufacture year
                </label>
                <input
                  id="edit-manufacture-year"
                  type="number"
                  className="admin-intelligence__input"
                  value={editForm.manufacture_year}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, manufacture_year: event.target.value }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-original-rrp">
                  Original RRP
                </label>
                <input
                  id="edit-original-rrp"
                  type="number"
                  step="0.01"
                  className="admin-intelligence__input"
                  value={editForm.original_rrp}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, original_rrp: event.target.value }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-trade-in">
                  Estimated trade-in value
                </label>
                <input
                  id="edit-trade-in"
                  type="number"
                  step="0.01"
                  className="admin-intelligence__input"
                  value={editForm.estimated_trade_in_value}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      estimated_trade_in_value: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-confidence">
                  Confidence
                </label>
                <input
                  id="edit-confidence"
                  className="admin-intelligence__input"
                  value={editForm.confidence}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, confidence: event.target.value }))
                  }
                />
              </div>

              <div className="admin-intelligence__field">
                <label className="admin-intelligence__label" htmlFor="edit-currency">
                  Currency
                </label>
                <input
                  id="edit-currency"
                  className="admin-intelligence__input"
                  value={editForm.currency}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, currency: event.target.value }))
                  }
                />
              </div>

              {saveError ? (
                <p className="admin-intelligence__message admin-intelligence__message--error admin-intelligence__form-grid--full" role="alert">
                  {saveError}
                </p>
              ) : null}

              <div className="admin-intelligence__actions admin-intelligence__form-grid--full">
                <button
                  type="submit"
                  className="admin-intelligence__button admin-intelligence__button--primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={closeEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteModal && deleteModalContent ? (
        <ConfirmDeleteModal
          title={deleteModalContent.title}
          body={deleteModalContent.body}
          confirming={deleting}
          error={deleteError}
          onCancel={closeDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </section>
  )
}

export default AdminIntelligencePage
