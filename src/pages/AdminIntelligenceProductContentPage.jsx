import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  buildPublishDraftsConfirmationMessage,
  CONTENT_PUBLISH_SCOPE,
  CONTENT_PUBLISH_SCOPE_LABELS,
  fetchEquipmentProductContentAdminRows,
  getEquipmentProductContentStatusLabel,
  isPublishableEquipmentProductContent,
  publishEquipmentProductContentDrafts,
  resolveDraftContentIdsForPublish,
  summarizeEquipmentProductContentStatuses,
} from '../lib/equipmentProductContentAdmin'
import { EQUIPMENT_PRODUCT_CONTENT_STATUS } from '../lib/equipmentProductContentPage'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceProductContentPage.css'

const ALL_FILTER = ''

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function overviewPreview(text, max = 140) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '—'
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

function PublishConfirmModal({
  count,
  scopeLabel,
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
        aria-labelledby="publish-content-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="publish-content-title" className="admin-intelligence__modal-title">
          Publish drafts
        </h2>
        <p className="admin-intelligence__modal-lead admin-content__confirm-lead">
          {buildPublishDraftsConfirmationMessage(count)}
        </p>
        <p className="admin-content__confirm-scope">
          Scope: <strong>{scopeLabel}</strong>
        </p>

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
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={onConfirm}
            disabled={confirming || count < 1}
          >
            {confirming ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminIntelligenceProductContentPage() {
  usePageTitle('Equipment Product Content')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [brandFilter, setBrandFilter] = useState(ALL_FILTER)
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [searchInput, setSearchInput] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [publishScope, setPublishScope] = useState(CONTENT_PUBLISH_SCOPE.CURRENT_BRAND)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await fetchEquipmentProductContentAdminRows()
    if (result.error) {
      setError(getAdminErrorMessage(result.error, 'Could not load product content.'))
      setRows([])
    } else {
      setRows(result.rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const brands = useMemo(() => (
    [...new Set(rows.map((row) => row.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  ), [rows])

  const statusCounts = useMemo(
    () => summarizeEquipmentProductContentStatuses(rows),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const query = searchInput.trim().toLowerCase()
    return rows.filter((row) => {
      if (brandFilter && row.brand !== brandFilter) return false
      if (statusFilter && row.generation_status !== statusFilter) return false
      if (!query) return true
      const haystack = [
        row.brand,
        row.canonical_product_name,
        row.canonical_product_key,
        row.seo_title,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [rows, brandFilter, statusFilter, searchInput])

  const pendingPublishIds = useMemo(() => (
    resolveDraftContentIdsForPublish({
      rows,
      scope: publishScope,
      selectedIds,
      brand: brandFilter || null,
    })
  ), [rows, publishScope, selectedIds, brandFilter])

  const allFilteredSelected = filteredRows.length > 0
    && filteredRows.every((row) => selectedIds.has(row.id))

  function toggleSelectAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allFilteredSelected) {
        for (const row of filteredRows) next.delete(row.id)
      } else {
        for (const row of filteredRows) next.add(row.id)
      }
      return next
    })
  }

  function toggleRow(id) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openPublishConfirm() {
    setPublishError('')
    setSuccess('')
    if (!pendingPublishIds.length) {
      if (publishScope === CONTENT_PUBLISH_SCOPE.SELECTED) {
        setError('Select one or more draft products to publish.')
      } else if (publishScope === CONTENT_PUBLISH_SCOPE.CURRENT_BRAND && !brandFilter) {
        setError('Choose a brand filter before publishing the current brand.')
      } else {
        setError('No draft descriptions match this publish scope.')
      }
      return
    }
    setError('')
    setConfirmOpen(true)
  }

  async function handlePublishConfirm() {
    setPublishing(true)
    setPublishError('')
    const result = await publishEquipmentProductContentDrafts(pendingPublishIds)
    setPublishing(false)

    if (result.error) {
      setPublishError(getAdminErrorMessage(result.error, 'Publish failed.'))
      return
    }

    setConfirmOpen(false)
    setSelectedIds(new Set())
    setSuccess(`Published ${result.publishedCount} draft description${result.publishedCount === 1 ? '' : 's'}.`)
    await loadRows()
  }

  return (
    <section className="admin-intelligence admin-content">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Intelligence</Link>
        </p>
        <h1 className="admin-intelligence__title">Equipment Product Content</h1>
        <p className="admin-intelligence__lead">
          Review AI-generated overviews, then publish drafts to public product pages.
          Publishing only changes status from Draft to Published (`approved`).
        </p>
      </header>

      <div className="admin-content__counts" aria-label="Content status counts">
        <div className="admin-content__count-card">
          <span className="admin-content__count-label">Draft</span>
          <strong className="admin-content__count-value">{statusCounts.draft}</strong>
        </div>
        <div className="admin-content__count-card admin-content__count-card--published">
          <span className="admin-content__count-label">Published</span>
          <strong className="admin-content__count-value">{statusCounts.published}</strong>
        </div>
        <div className="admin-content__count-card admin-content__count-card--failed">
          <span className="admin-content__count-label">Failed</span>
          <strong className="admin-content__count-value">{statusCounts.failed}</strong>
        </div>
      </div>

      <div className="admin-content__toolbar">
        <div className="admin-intelligence__filters admin-content__filters">
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="content-search">
              Search
            </label>
            <input
              id="content-search"
              type="search"
              className="admin-intelligence__input"
              placeholder="Brand or product…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="content-brand">
              Brand
            </label>
            <select
              id="content-brand"
              className="admin-intelligence__select"
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
            >
              <option value={ALL_FILTER}>All brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="content-status">
              Status
            </label>
            <select
              id="content-status"
              className="admin-intelligence__select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value={ALL_FILTER}>All statuses</option>
              <option value={EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT}>Draft</option>
              <option value={EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED}>Published</option>
              <option value={EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED}>Failed</option>
              <option value={EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED}>Rejected</option>
              <option value={EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE}>Stale</option>
            </select>
          </div>
        </div>

        <div className="admin-content__publish">
          <label className="admin-intelligence__label" htmlFor="content-publish-scope">
            Publish Drafts
          </label>
          <div className="admin-content__publish-controls">
            <select
              id="content-publish-scope"
              className="admin-intelligence__select"
              value={publishScope}
              onChange={(event) => setPublishScope(event.target.value)}
            >
              {Object.entries(CONTENT_PUBLISH_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--primary"
              onClick={openPublishConfirm}
              disabled={publishing || loading}
            >
              Publish Drafts
              {pendingPublishIds.length ? ` (${pendingPublishIds.length})` : ''}
            </button>
          </div>
        </div>
      </div>

      {success ? (
        <p className="admin-intelligence__message admin-intelligence__message--success" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="admin-intelligence__message admin-intelligence__message--error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <LoadingState label="Loading product content…" /> : null}
      {!loading && error && !rows.length ? <ErrorState message={error} /> : null}
      {!loading && !error && !filteredRows.length ? (
        <EmptyState title="No content rows" body="Generate drafts first, or adjust filters." />
      ) : null}

      {!loading && filteredRows.length ? (
        <div className="admin-intelligence__table-wrap admin-content__table-wrap">
          <table className="admin-intelligence__table">
            <thead>
              <tr>
                <th scope="col" className="admin-content__col-select">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all filtered rows"
                  />
                </th>
                <th scope="col">Product</th>
                <th scope="col">Brand</th>
                <th scope="col">Status</th>
                <th scope="col">Generated</th>
                <th scope="col">Overview</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      disabled={!isPublishableEquipmentProductContent(row)}
                      aria-label={`Select ${row.canonical_product_name ?? row.id}`}
                    />
                  </td>
                  <td>
                    <div className="admin-content__product-name">
                      {row.canonical_product_name ?? '—'}
                    </div>
                    {row.canonical_product_key ? (
                      <div className="admin-content__product-key">{row.canonical_product_key}</div>
                    ) : null}
                  </td>
                  <td>{row.brand ?? '—'}</td>
                  <td>
                    <span className={`admin-content__status admin-content__status--${row.generation_status}`}>
                      {getEquipmentProductContentStatusLabel(row.generation_status)}
                    </span>
                  </td>
                  <td>{formatDate(row.generated_at)}</td>
                  <td className="admin-content__overview">{overviewPreview(row.overview_text)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {confirmOpen ? (
        <PublishConfirmModal
          count={pendingPublishIds.length}
          scopeLabel={CONTENT_PUBLISH_SCOPE_LABELS[publishScope]}
          confirming={publishing}
          error={publishError}
          onCancel={() => {
            if (!publishing) setConfirmOpen(false)
          }}
          onConfirm={handlePublishConfirm}
        />
      ) : null}
    </section>
  )
}

export default AdminIntelligenceProductContentPage
