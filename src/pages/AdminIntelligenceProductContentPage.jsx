import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  buildPublishDraftsConfirmationMessage,
  CONTENT_GENERATION_STATUS_FILTER,
  CONTENT_PRODUCT_STATUS_FILTER,
  CONTENT_PRODUCT_STATUS_FILTER_LABELS,
  CONTENT_PUBLISH_SCOPE,
  CONTENT_PUBLISH_SCOPE_LABELS,
  fetchEquipmentProductContentAdminRows,
  getEquipmentProductContentStatusLabel,
  matchesAdminContentGenerationStatusFilter,
  matchesAdminContentProductStatusFilter,
  publishEquipmentProductContentDrafts,
  resolveDraftContentIdsForPublish,
  summarizeEquipmentProductContentStatuses,
} from '../lib/equipmentProductContentAdmin'
import {
  buildGenerateMissingConfirmationSummary,
  GENERATE_MISSING_SCOPE,
  GENERATE_MISSING_SCOPE_LABELS,
  previewGenerateMissingFromAdminRows,
  runGenerateMissingDraftsBatch,
  summarizeGenerateMissingRun,
} from '../lib/equipmentProductContentGenerateAdmin'
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

function GenerateMissingConfirmModal({
  preview,
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
        aria-labelledby="generate-missing-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="generate-missing-title" className="admin-intelligence__modal-title">
          Generate missing drafts
        </h2>
        <p className="admin-intelligence__modal-lead admin-content__confirm-lead">
          {buildGenerateMissingConfirmationSummary(preview)}
        </p>
        <p className="admin-content__confirm-scope">
          Scope: <strong>{scopeLabel}</strong>
        </p>
        <p className="admin-content__confirm-scope">
          Existing drafts and approved content will not be overwritten. Products stay unpublished.
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
            disabled={confirming || !preview?.eligible}
          >
            {confirming ? 'Starting…' : `Generate ${preview?.eligible ?? 0} drafts`}
          </button>
        </div>
      </div>
    </div>
  )
}

function GenerateMissingProgressPanel({
  progress,
  summary,
  cancelling,
  onCancel,
  onRetryFailed,
  onViewDrafts,
  onClose,
}) {
  const [failuresOpen, setFailuresOpen] = useState(false)
  const running = progress
    && !progress.cancelled
    && progress.completed < progress.total
  const done = progress && (progress.cancelled || progress.completed >= progress.total)

  return (
    <div className="admin-content__generate-panel" role="status" aria-live="polite">
      <h2 className="admin-content__generate-title">Generating missing drafts</h2>
      <p className="admin-content__generate-stats">
        Completed: {progress?.completed ?? 0} / {progress?.total ?? 0}
        {' · '}
        Created: {progress?.created ?? 0}
        {' · '}
        Skipped: {progress?.skipped ?? 0}
        {' · '}
        Failed: {progress?.failed ?? 0}
        {progress?.processing ? ` · Processing: ${progress.processing}` : ''}
        {progress?.queued != null ? ` · Queued: ${progress.queued}` : ''}
      </p>

      {done && summary ? (
        <ul className="admin-content__generate-summary">
          <li>Products considered: {summary.products_considered}</li>
          <li>Drafts created: {summary.drafts_created}</li>
          <li>Skipped (draft exists): {summary.skipped_draft_exists}</li>
          <li>Skipped (approved content): {summary.skipped_approved_exists}</li>
          <li>Invalid / ineligible: {summary.invalid_ineligible}</li>
          <li>Failed: {summary.failed}</li>
          <li>
            Brands processed:{' '}
            {(summary.brands_processed || []).join(', ') || '—'}
          </li>
        </ul>
      ) : null}

      {(progress?.failures?.length || 0) > 0 ? (
        <div className="admin-content__generate-failures">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={() => setFailuresOpen((open) => !open)}
          >
            {failuresOpen ? 'Hide failures' : `Show failures (${progress.failures.length})`}
          </button>
          {failuresOpen ? (
            <ul className="admin-content__generate-failure-list">
              {progress.failures.map((failure) => (
                <li key={`${failure.product_id}:${failure.reason}`}>
                  <strong>{failure.name || failure.product_id}</strong>
                  {': '}
                  {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="admin-content__generate-actions">
        {running ? (
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Stopping…' : 'Stop new batches'}
          </button>
        ) : null}
        {done && (progress?.failures?.length || 0) > 0 ? (
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={onRetryFailed}
          >
            Retry failed
          </button>
        ) : null}
        {done ? (
          <>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={onViewDrafts}
            >
              View generated drafts
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={onViewDrafts}
            >
              Review drafts
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={onClose}
            >
              Close
            </button>
          </>
        ) : null}
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
  const [productStatusFilter, setProductStatusFilter] = useState(CONTENT_PRODUCT_STATUS_FILTER.ALL)
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [searchInput, setSearchInput] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [publishScope, setPublishScope] = useState(CONTENT_PUBLISH_SCOPE.CURRENT_BRAND)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

  const [generateScope, setGenerateScope] = useState(GENERATE_MISSING_SCOPE.FILTERED)
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false)
  const [generateConfirmError, setGenerateConfirmError] = useState('')
  const [generatePreview, setGeneratePreview] = useState(null)
  const [generateProgress, setGenerateProgress] = useState(null)
  const [generateSummary, setGenerateSummary] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [generateCancelling, setGenerateCancelling] = useState(false)
  const cancelGenerateRef = useRef(false)

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
      if (!matchesAdminContentProductStatusFilter(row, productStatusFilter)) return false
      if (!matchesAdminContentGenerationStatusFilter(row, statusFilter)) return false
      if (!query) return true
      const haystack = [
        row.brand,
        row.canonical_product_name,
        row.canonical_product_key,
        row.seo_title,
        row.product_status,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [rows, brandFilter, productStatusFilter, statusFilter, searchInput])

  const pendingPublishIds = useMemo(() => (
    resolveDraftContentIdsForPublish({
      rows,
      scope: publishScope,
      selectedIds,
      brand: brandFilter || null,
    })
  ), [rows, publishScope, selectedIds, brandFilter])

  const activeGeneratePreview = useMemo(() => (
    previewGenerateMissingFromAdminRows({
      filteredRows,
      selectedIds,
      scope: generateScope,
    })
  ), [filteredRows, selectedIds, generateScope])

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

  function openGenerateConfirm() {
    setGenerateConfirmError('')
    setSuccess('')
    setError('')

    if (generateScope === GENERATE_MISSING_SCOPE.SELECTED && selectedIds.size < 1) {
      setError('Select one or more products, or use “All matching filtered products”.')
      return
    }

    if (!activeGeneratePreview.eligible) {
      setError('No eligible products missing drafts match this scope.')
      return
    }

    setGeneratePreview(activeGeneratePreview)
    setGenerateConfirmOpen(true)
  }

  async function runGeneration(productIds, preview) {
    cancelGenerateRef.current = false
    setGenerateCancelling(false)
    setGenerating(true)
    setGenerateConfirmOpen(false)
    setGenerateSummary(null)
    setGenerateProgress({
      total: productIds.length,
      queued: productIds.length,
      processing: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      created: 0,
      failures: [],
    })

    const progress = await runGenerateMissingDraftsBatch({
      productIds,
      dryRun: false,
      shouldCancel: () => cancelGenerateRef.current,
      onProgress: setGenerateProgress,
    })

    setGenerateProgress(progress)
    setGenerateSummary(summarizeGenerateMissingRun({ preview, progress }))
    setGenerating(false)
    await loadRows()

    if (progress.created > 0) {
      setSuccess(
        `Created ${progress.created} draft${progress.created === 1 ? '' : 's'}`
        + (progress.failed ? ` (${progress.failed} failed)` : '')
        + (progress.skipped ? `; ${progress.skipped} skipped` : '')
        + '.',
      )
    } else if (progress.failed > 0) {
      setError(`Generation finished with ${progress.failed} failure${progress.failed === 1 ? '' : 's'}.`)
    } else {
      setSuccess('No new drafts created (all eligible products were skipped on recheck).')
    }
  }

  async function handleGenerateConfirm() {
    const preview = generatePreview || activeGeneratePreview
    if (!preview?.eligible_product_ids?.length) {
      setGenerateConfirmError('No eligible products to generate.')
      return
    }
    await runGeneration(preview.eligible_product_ids, preview)
  }

  async function handleRetryFailed() {
    const failedIds = (generateProgress?.failures || [])
      .map((failure) => failure.product_id)
      .filter(Boolean)
    if (!failedIds.length) return
    const preview = {
      ...(generatePreview || activeGeneratePreview),
      considered: failedIds.length,
      eligible: failedIds.length,
      eligible_product_ids: failedIds,
      skipped_draft: 0,
      skipped_approved: 0,
      invalid: 0,
      brands_affected: generatePreview?.brands_affected || [],
      estimated_batches: Math.ceil(failedIds.length / 5),
    }
    await runGeneration(failedIds, preview)
  }

  function viewGeneratedDrafts() {
    setStatusFilter(CONTENT_GENERATION_STATUS_FILTER.DRAFT)
    setGenerateProgress(null)
    setGenerateSummary(null)
  }

  return (
    <section className="admin-intelligence admin-content">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Intelligence</Link>
        </p>
        <h1 className="admin-intelligence__title">Equipment Product Content</h1>
        <p className="admin-intelligence__lead">
          Prepare and review AI-generated overviews for pending, needs_review, and approved
          products. Missing descriptions appear here before generation. Publishing only changes
          content status from Draft to Published — it does not approve the canonical product.
        </p>
      </header>

      <div className="admin-content__counts" aria-label="Content status counts">
        <div className="admin-content__count-card">
          <span className="admin-content__count-label">Missing</span>
          <strong className="admin-content__count-value">{statusCounts.missing}</strong>
        </div>
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
            <label className="admin-intelligence__label" htmlFor="content-product-status">
              Product status
            </label>
            <select
              id="content-product-status"
              className="admin-intelligence__select"
              value={productStatusFilter}
              onChange={(event) => setProductStatusFilter(event.target.value)}
            >
              {Object.entries(CONTENT_PRODUCT_STATUS_FILTER_LABELS).map(([value, label]) => (
                <option key={label} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="admin-intelligence__field">
            <label className="admin-intelligence__label" htmlFor="content-status">
              Content status
            </label>
            <select
              id="content-status"
              className="admin-intelligence__select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value={CONTENT_GENERATION_STATUS_FILTER.ALL}>All content statuses</option>
              <option value={CONTENT_GENERATION_STATUS_FILTER.MISSING}>Missing</option>
              <option value={CONTENT_GENERATION_STATUS_FILTER.DRAFT}>Draft</option>
              <option value={CONTENT_GENERATION_STATUS_FILTER.APPROVED}>Published</option>
              <option value={CONTENT_GENERATION_STATUS_FILTER.FAILED}>Failed</option>
              <option value={CONTENT_GENERATION_STATUS_FILTER.REJECTED}>Rejected</option>
              <option value={CONTENT_GENERATION_STATUS_FILTER.STALE}>Stale</option>
            </select>
          </div>
        </div>

        <div className="admin-content__actions-row">
          <div className="admin-content__publish">
            <label className="admin-intelligence__label" htmlFor="content-generate-scope">
              Generate missing drafts
            </label>
            <div className="admin-content__publish-controls">
              <select
                id="content-generate-scope"
                className="admin-intelligence__select"
                value={generateScope}
                onChange={(event) => setGenerateScope(event.target.value)}
                disabled={generating}
              >
                {Object.entries(GENERATE_MISSING_SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={openGenerateConfirm}
                disabled={publishing || loading || generating}
              >
                Generate missing drafts
                {activeGeneratePreview.eligible
                  ? ` (${activeGeneratePreview.eligible})`
                  : ''}
              </button>
            </div>
            <p className="admin-content__scope-hint">
              Default scope is the current filter set
              {brandFilter ? ` (${brandFilter})` : ' (all brands visible)'}
              — not the full catalogue when filters are active.
            </p>
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
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={openPublishConfirm}
                disabled={publishing || loading || generating}
              >
                Publish Drafts
                {pendingPublishIds.length ? ` (${pendingPublishIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>

      {generateProgress ? (
        <GenerateMissingProgressPanel
          progress={generateProgress}
          summary={generateSummary}
          cancelling={generateCancelling}
          onCancel={() => {
            cancelGenerateRef.current = true
            setGenerateCancelling(true)
          }}
          onRetryFailed={handleRetryFailed}
          onViewDrafts={viewGeneratedDrafts}
          onClose={() => {
            setGenerateProgress(null)
            setGenerateSummary(null)
          }}
        />
      ) : null}

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
        <EmptyState
          title="No products match"
          body="Adjust filters, or confirm eligible products exist (pending, needs_review, or approved)."
        />
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
                <th scope="col">Product status</th>
                <th scope="col">Content</th>
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
                    {row.incomplete_source?.incomplete ? (
                      <div className="admin-content__source-warning">
                        Incomplete source data: {row.incomplete_source.warning}. Description can still
                        be prepared; do not invent pricing.
                      </div>
                    ) : null}
                  </td>
                  <td>{row.brand ?? '—'}</td>
                  <td>{row.product_status ?? '—'}</td>
                  <td>
                    <span className={`admin-content__status admin-content__status--${row.generation_status || 'missing'}`}>
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

      {generateConfirmOpen ? (
        <GenerateMissingConfirmModal
          preview={generatePreview}
          scopeLabel={GENERATE_MISSING_SCOPE_LABELS[generateScope]}
          confirming={generating}
          error={generateConfirmError}
          onCancel={() => {
            if (!generating) setGenerateConfirmOpen(false)
          }}
          onConfirm={handleGenerateConfirm}
        />
      ) : null}
    </section>
  )
}

export default AdminIntelligenceProductContentPage
