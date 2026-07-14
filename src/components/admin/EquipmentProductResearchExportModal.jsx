/**
 * Export research list modal — scope confirmation + summary + download.
 */

import { useMemo, useState } from 'react'
import {
  RESEARCH_EXPORT_MAX_ROWS,
  RESEARCH_EXPORT_SCOPE,
  buildResearchCsvContent,
  buildResearchCsvFilename,
  downloadResearchCsv,
  formatResearchFilterSummary,
  summarizeResearchExport,
} from '../../lib/equipmentProductResearchCsv.js'
import {
  fetchAdminEquipmentProductsByIds,
  fetchAdminEquipmentProductsForExport,
} from '../../lib/equipmentProductsAdminList.js'
import { getAdminErrorMessage } from '../../lib/admin'

export default function EquipmentProductResearchExportModal({
  open,
  onClose,
  filters,
  totalMatching = 0,
  selectedIds = [],
  currentPageProducts = [],
  onExportComplete = null,
}) {
  const [scope, setScope] = useState(RESEARCH_EXPORT_SCOPE.ALL_MATCHING)
  const [phase, setPhase] = useState('confirm') // confirm | working | done | error
  const [workingMessage, setWorkingMessage] = useState('')
  const [error, setError] = useState('')
  const [exportResult, setExportResult] = useState(null)
  const [csvContent, setCsvContent] = useState('')
  const [filename, setFilename] = useState('')

  const selectedCount = selectedIds.length
  const pageCount = currentPageProducts.length

  const filterSummary = useMemo(() => formatResearchFilterSummary({
    ...filters,
    scope,
    totalMatching,
    selectedCount,
    pageCount,
  }), [filters, scope, totalMatching, selectedCount, pageCount])

  if (!open) return null

  function resetAndClose() {
    setScope(RESEARCH_EXPORT_SCOPE.ALL_MATCHING)
    setPhase('confirm')
    setWorkingMessage('')
    setError('')
    setExportResult(null)
    setCsvContent('')
    setFilename('')
    onClose?.()
  }

  async function handleGenerate() {
    setPhase('working')
    setError('')
    setWorkingMessage('Fetching products…')
    try {
      let products = []
      let truncated = false

      if (scope === RESEARCH_EXPORT_SCOPE.SELECTED) {
        if (!selectedCount) throw new Error('Select at least one product on this page first.')
        const result = await fetchAdminEquipmentProductsByIds(selectedIds, {
          maxRows: RESEARCH_EXPORT_MAX_ROWS,
        })
        if (result.error) throw result.error
        products = result.products
        truncated = result.truncated
      } else if (scope === RESEARCH_EXPORT_SCOPE.CURRENT_PAGE) {
        if (!pageCount) throw new Error('Current page has no products.')
        const ids = currentPageProducts.map((p) => p.id)
        const result = await fetchAdminEquipmentProductsByIds(ids, {
          maxRows: RESEARCH_EXPORT_MAX_ROWS,
        })
        if (result.error) throw result.error
        products = result.products.length ? result.products : currentPageProducts
      } else {
        setWorkingMessage('Fetching all matching filtered products (server-side)…')
        const result = await fetchAdminEquipmentProductsForExport({
          brand: filters.brand || '',
          equipmentType: filters.equipmentType || '',
          completion: filters.completion || '',
          status: filters.status || '',
          search: filters.search || '',
          attention: filters.attention || 'all',
          imageFilter: filters.imageFilter || '',
          sort: filters.sort || 'brand',
          sortDir: filters.sortDir || 'asc',
          pageSize: 100,
          maxRows: RESEARCH_EXPORT_MAX_ROWS,
        })
        if (result.error) throw result.error
        products = result.products
        truncated = result.truncated
      }

      if (!products.length) {
        throw new Error('No products matched this export scope.')
      }

      setWorkingMessage('Building CSV…')
      const content = buildResearchCsvContent(products)
      const name = buildResearchCsvFilename({
        scope,
        brand: scope === RESEARCH_EXPORT_SCOPE.ALL_MATCHING ? (filters.brand || '') : '',
      })
      const summary = summarizeResearchExport(products)
      setCsvContent(content)
      setFilename(name)
      setExportResult({ summary, truncated })
      setPhase('done')
      onExportComplete?.({ summary, filename: name, scope })
    } catch (err) {
      setError(getAdminErrorMessage(err))
      setPhase('error')
    }
  }

  function handleDownload() {
    if (!csvContent || !filename) return
    downloadResearchCsv(csvContent, filename)
  }

  async function handleCopyFilterSummary() {
    try {
      await navigator.clipboard.writeText(filterSummary)
    } catch {
      // ignore
    }
  }

  return (
    <div className="admin-products__modal-backdrop" role="presentation" onClick={resetAndClose}>
      <div
        className="admin-products__modal admin-products__modal--confirm admin-products__modal--research"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-export-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-products__modal-header">
          <h2 id="research-export-title">Export research list</h2>
          <button type="button" className="admin-intelligence__button" onClick={resetAndClose}>
            Close
          </button>
        </header>

        <div className="admin-products__modal-body">
          {phase === 'confirm' || phase === 'error' ? (
            <>
              <p className="admin-products__confirm-lead">
                Export canonical products for external research. Current stored values are read-only columns;
                fill only the empty <code>researched_*</code> columns on re-import. Export does not change product data.
              </p>

              <fieldset className="admin-products__research-scope">
                <legend>Scope</legend>
                <label className="admin-products__research-scope-option">
                  <input
                    type="radio"
                    name="research-export-scope"
                    checked={scope === RESEARCH_EXPORT_SCOPE.ALL_MATCHING}
                    onChange={() => setScope(RESEARCH_EXPORT_SCOPE.ALL_MATCHING)}
                  />
                  <span>
                    All matching products: <strong>{totalMatching.toLocaleString('en-GB')}</strong>
                    <em> Uses active filters; not limited to this page.</em>
                  </span>
                </label>
                <label className="admin-products__research-scope-option">
                  <input
                    type="radio"
                    name="research-export-scope"
                    checked={scope === RESEARCH_EXPORT_SCOPE.SELECTED}
                    onChange={() => setScope(RESEARCH_EXPORT_SCOPE.SELECTED)}
                    disabled={selectedCount === 0}
                  />
                  <span>
                    Selected products: <strong>{selectedCount.toLocaleString('en-GB')}</strong>
                    <em> Only checkbox-selected rows on this page.</em>
                  </span>
                </label>
                <label className="admin-products__research-scope-option">
                  <input
                    type="radio"
                    name="research-export-scope"
                    checked={scope === RESEARCH_EXPORT_SCOPE.CURRENT_PAGE}
                    onChange={() => setScope(RESEARCH_EXPORT_SCOPE.CURRENT_PAGE)}
                    disabled={pageCount === 0}
                  />
                  <span>
                    Current page: <strong>{pageCount.toLocaleString('en-GB')}</strong>
                    <em> This page only — does not mean all matching rows.</em>
                  </span>
                </label>
              </fieldset>

              <pre className="admin-products__research-filter-summary">{filterSummary}</pre>
              <p className="admin-products__confirm-warning" role="status">
                Maximum {RESEARCH_EXPORT_MAX_ROWS.toLocaleString('en-GB')} rows per export. Priority is a research
                helper, not an approval decision.
              </p>
              {error ? <p className="admin-products__confirm-warning" role="alert">{error}</p> : null}

              <div className="admin-products__modal-actions">
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--primary"
                  onClick={handleGenerate}
                >
                  Generate CSV
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={resetAndClose}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : null}

          {phase === 'working' ? (
            <p className="admin-products__confirm-lead" role="status">{workingMessage || 'Working…'}</p>
          ) : null}

          {phase === 'done' && exportResult ? (
            <>
              <p className="admin-products__confirm-lead">
                Export complete — {exportResult.summary.total.toLocaleString('en-GB')} products
                {exportResult.truncated ? ' (truncated at export limit)' : ''}
              </p>
              <dl className="admin-products__confirm-stats">
                <div>
                  <dt>Brands</dt>
                  <dd>{exportResult.summary.brands.join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt>Missing prices</dt>
                  <dd>{exportResult.summary.missingPrices}</dd>
                </div>
                <div>
                  <dt>Missing baselines</dt>
                  <dd>{exportResult.summary.missingBaselines}</dd>
                </div>
                <div>
                  <dt>Identity review</dt>
                  <dd>{exportResult.summary.identityReview}</dd>
                </div>
                <div>
                  <dt>Missing images</dt>
                  <dd>{exportResult.summary.missingImages}</dd>
                </div>
                <div>
                  <dt>Missing content</dt>
                  <dd>{exportResult.summary.missingContent}</dd>
                </div>
              </dl>
              <ul className="admin-products__research-status-list">
                {Object.entries(exportResult.summary.statusCounts).map(([status, count]) => (
                  <li key={status}>{status}: {count}</li>
                ))}
              </ul>
              <div className="admin-products__modal-actions">
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--primary"
                  onClick={handleDownload}
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={handleCopyFilterSummary}
                >
                  Copy filter summary
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button"
                  onClick={resetAndClose}
                >
                  View products
                </button>
              </div>
              <p className="admin-products__research-filename">{filename}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
