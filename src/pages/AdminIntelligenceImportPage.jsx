import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  EQUIPMENT_INTELLIGENCE_CSV_YEAR_GUIDANCE,
  SAMPLE_EQUIPMENT_INTELLIGENCE_CSV,
  formatTradeInValue,
  parseEquipmentIntelligenceCsv,
  validateEquipmentIntelligenceRows,
} from '../lib/equipmentIntelligence'
import {
  importEquipmentIntelligenceAndPromote,
  retryCanonicalPromotionForBrands,
} from '../lib/equipmentIntelligenceImportPromote'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceImportPage.css'

function formatPreviewTradeIn(row) {
  if (!row.valid) return '—'
  const value = row.normalised.estimated_trade_in_value
  if (value == null) return '—'
  return formatTradeInValue({
    estimated_trade_in_value: value,
    currency: row.normalised.currency,
  })
}

function resultHeadline(result) {
  if (!result) return ''
  if (result.stage === 'import') return 'Import failed'
  if (result.stage === 'promote') {
    return result.importResult && !result.importResult.error
      ? 'Import complete, product promotion failed'
      : 'Product promotion failed'
  }
  if (result.promotion?.hasWarnings) return 'Import complete (with promotion warnings)'
  return 'Import and promotion complete'
}

function AdminIntelligenceImportPage() {
  usePageTitle('Admin Intelligence Import')

  const [method, setMethod] = useState('paste')
  const [csvText, setCsvText] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [previewActive, setPreviewActive] = useState(false)
  const fileInputRef = useRef(null)

  const [importing, setImporting] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [importError, setImportError] = useState('')
  const [workflowResult, setWorkflowResult] = useState(null)

  const validation = useMemo(
    () => validateEquipmentIntelligenceRows(parsedRows),
    [parsedRows],
  )

  const busy = importing || promoting

  function resetImportForm({ clearResult = true } = {}) {
    setParsedRows([])
    setParseError('')
    setCsvText('')
    setPreviewActive(false)
    setImportError('')
    setProgressLabel('')
    if (clearResult) {
      setWorkflowResult(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function applyCsvText(text) {
    setImportError('')
    setWorkflowResult(null)
    const parsed = parseEquipmentIntelligenceCsv(text)
    if (parsed.error) {
      setParseError(parsed.error)
      setParsedRows([])
      setPreviewActive(false)
      return
    }
    setParseError('')
    setParsedRows(parsed.rows)
    setPreviewActive(parsed.rows.length > 0)
  }

  function handleParsePaste() {
    applyCsvText(csvText)
  }

  function handleLoadSample() {
    setCsvText(SAMPLE_EQUIPMENT_INTELLIGENCE_CSV)
    applyCsvText(SAMPLE_EQUIPMENT_INTELLIGENCE_CSV)
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setCsvText(text)
      applyCsvText(text)
    }
    reader.readAsText(file)
  }

  function handleProgress(event) {
    if (event.stage === 'import') {
      setProgressLabel('Importing source rows…')
      return
    }
    if (event.phase === 'brand-start') {
      setProgressLabel(
        `Promoting products for ${event.brand} (${(event.brandsCompleted ?? 0) + 1} of ${event.brandsTotal ?? '?'})…`,
      )
      return
    }
    if (event.phase === 'upserting') {
      setProgressLabel(
        `Updating ${event.brand}: ${event.completed ?? 0} of ${event.total ?? 0} products…`,
      )
      return
    }
    if (event.stage === 'promote') {
      setProgressLabel('Promoting products to the catalogue…')
    }
  }

  async function handleImport() {
    setImportError('')
    setWorkflowResult(null)

    if (parsedRows.length === 0) {
      setImportError('Parse a CSV before importing.')
      return
    }

    if (validation.validCount === 0) {
      setImportError('No valid rows to import. Fix validation errors and try again.')
      return
    }

    setImporting(true)
    setProgressLabel('Importing source rows…')

    const result = await importEquipmentIntelligenceAndPromote(validation.validRows, {
      onProgress: handleProgress,
    })

    setImporting(false)
    setProgressLabel('')
    setWorkflowResult(result)

    if (result.stage === 'import' && result.error) {
      setImportError(getAdminErrorMessage(result.error))
      return
    }

    // Clear the form after a successful source import (even if promotion failed)
    // so the result panel stays visible with brands retained for retry.
    setParsedRows([])
    setParseError('')
    setCsvText('')
    setPreviewActive(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (result.error && result.stage === 'promote') {
      setImportError(getAdminErrorMessage(result.error))
    }
  }

  async function handleRetryPromotion() {
    const brands = workflowResult?.brands ?? []
    if (!brands.length) {
      setImportError('No imported brands are available to retry. Import the CSV again or use manual promotion.')
      return
    }

    setImportError('')
    setPromoting(true)
    setProgressLabel('Retrying product promotion…')

    const retry = await retryCanonicalPromotionForBrands(brands, {
      onProgress: (event) => handleProgress({ stage: 'promote', ...event }),
    })

    setPromoting(false)
    setProgressLabel('')

    setWorkflowResult((previous) => ({
      ...(previous ?? {}),
      ok: retry.ok,
      stage: retry.ok ? 'complete' : 'promote',
      promotion: retry.promotion,
      brands: retry.brands,
      productsPath: retry.productsPath,
      error: retry.error,
      importResult: previous?.importResult ?? null,
    }))

    if (retry.error) {
      setImportError(getAdminErrorMessage(retry.error))
    }
  }

  function handleImportAnother() {
    resetImportForm({ clearResult: true })
  }

  const importResult = workflowResult?.importResult
  const promotion = workflowResult?.promotion
  const showResultPanel = Boolean(workflowResult) && !previewActive
  const canRetryPromotion = workflowResult?.stage === 'promote'
    && Boolean(importResult)
    && !importResult.error
    && (workflowResult.brands?.length ?? 0) > 0

  return (
    <section className="admin-intelligence">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Intelligence</Link>
        </p>
        <h1 className="admin-intelligence__title">Import intelligence CSV</h1>
        <p className="admin-intelligence__lead">
          Upload or paste a cleaned master CSV. Rows upsert by slug; blank market observations do not
          overwrite existing data. After a successful import, affected brands are promoted into Products
          as pending or needs review — nothing is auto-approved.
        </p>
        <p className="admin-intelligence__count">
          {EQUIPMENT_INTELLIGENCE_CSV_YEAR_GUIDANCE}
        </p>
      </header>

      <section className="admin-intelligence__panel">
        <h2 className="admin-intelligence__panel-title">1. CSV input</h2>

        <div className="admin-intelligence-import__methods" role="tablist" aria-label="Import method">
          <button
            type="button"
            role="tab"
            aria-selected={method === 'upload'}
            className={`admin-intelligence-import__method${
              method === 'upload' ? ' admin-intelligence-import__method--active' : ''
            }`}
            onClick={() => setMethod('upload')}
            disabled={busy}
          >
            Upload CSV
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === 'paste'}
            className={`admin-intelligence-import__method${
              method === 'paste' ? ' admin-intelligence-import__method--active' : ''
            }`}
            onClick={() => setMethod('paste')}
            disabled={busy}
          >
            Paste CSV
          </button>
        </div>

        {method === 'upload' ? (
          <div className="admin-intelligence-import__upload">
            <label className="admin-intelligence__label" htmlFor="intelligence-csv-upload">
              Choose CSV file
            </label>
            <input
              id="intelligence-csv-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="admin-intelligence-import__file-input"
              onChange={handleFileChange}
              disabled={busy}
            />
            <p className="admin-intelligence__count">
              File contents are previewed automatically after selection.
            </p>
          </div>
        ) : (
          <>
            <label className="admin-intelligence__label" htmlFor="intelligence-csv-paste">
              Paste CSV
            </label>
            <textarea
              id="intelligence-csv-paste"
              className="admin-intelligence-import__textarea"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value)
                setParseError('')
              }}
              disabled={busy}
            />
            <div className="admin-intelligence__actions">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={handleParsePaste}
                disabled={busy}
              >
                Preview CSV
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={handleLoadSample}
                disabled={busy}
              >
                Load sample CSV
              </button>
            </div>
          </>
        )}

        {parseError ? (
          <p className="admin-intelligence__message admin-intelligence__message--error" role="alert">
            {parseError}
          </p>
        ) : null}

        <div>
          <p className="admin-intelligence__label">Sample CSV</p>
          <p className="admin-intelligence__count">
            Sample uses manufacture_year as source metadata only. It does not set a verified first-release
            baseline for automatic promotion.
          </p>
          <pre className="admin-intelligence-import__sample">{SAMPLE_EQUIPMENT_INTELLIGENCE_CSV}</pre>
        </div>
      </section>

      {showResultPanel ? (
        <section className="admin-intelligence__panel admin-intelligence-import__result">
          <h2 className="admin-intelligence__panel-title">{resultHeadline(workflowResult)}</h2>

          {importResult && !importResult.error ? (
            <div className="admin-intelligence-import__result-block">
              <h3 className="admin-intelligence-import__result-heading">Source rows</h3>
              <ul className="admin-intelligence-import__result-list">
                <li>{importResult.insertedCount} inserted</li>
                <li>{importResult.updatedCount} updated</li>
              </ul>
            </div>
          ) : null}

          {promotion ? (
            <div className="admin-intelligence-import__result-block">
              <h3 className="admin-intelligence-import__result-heading">Canonical promotion</h3>
              <ul className="admin-intelligence-import__result-list">
                <li>
                  Brands processed: {promotion.brandsProcessed}
                  {promotion.brandsSkipped
                    ? ` (${promotion.brandsSkipped} skipped)`
                    : ''}
                </li>
                <li>Products inserted: {promotion.productsInserted}</li>
                <li>Products updated: {promotion.productsUpdated}</li>
                <li>Pending: {promotion.pending}</li>
                <li>Needs review: {promotion.needsReview}</li>
                <li>Approved: {promotion.approved}</li>
                <li>Duplicates collapsed: {promotion.duplicateRowsCollapsed}</li>
                <li>Ambiguous: {promotion.ambiguous}</li>
                {promotion.canonicalProductCount != null ? (
                  <li>
                    Canonical products (affected brands): {promotion.canonicalProductCount}
                    {' · '}
                    Source rows loaded: {promotion.sourceRowCount}
                  </li>
                ) : null}
              </ul>

              {workflowResult.brands?.length ? (
                <p className="admin-intelligence__count">
                  Brands: {workflowResult.brands.join(', ')}
                </p>
              ) : null}

              {promotion.countNotes?.length ? (
                <ul className="admin-intelligence-import__result-notes">
                  {promotion.countNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}

              {promotion.warnings?.length ? (
                <div className="admin-intelligence__message admin-intelligence__message--warning" role="status">
                  <p>Promotion warnings:</p>
                  <ul>
                    {promotion.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {promotion.yearStats ? (
                <div className="admin-intelligence-import__result-block">
                  <h3 className="admin-intelligence-import__result-heading">Manufacture years</h3>
                  <ul className="admin-intelligence-import__result-list">
                    <li>
                      Source rows with manufacture year: {promotion.yearStats.sourceRowsWithManufactureYear}
                    </li>
                    <li>
                      Source rows with verified first-release year:{' '}
                      {promotion.yearStats.sourceRowsWithVerifiedBaseline}
                    </li>
                    <li>
                      Canonical baselines newly populated:{' '}
                      {promotion.yearStats.canonicalBaselinesPopulated}
                    </li>
                    <li>
                      Canonical baselines left blank: {promotion.yearStats.canonicalBaselinesLeftBlank}
                    </li>
                    <li>
                      Existing baselines preserved: {promotion.yearStats.existingBaselinesPreserved}
                    </li>
                  </ul>
                  <p className="admin-intelligence__count">
                    Import manufacture year is source metadata only. It is not treated as a verified
                    first-release baseline unless researched and stored on the intelligence row.
                  </p>
                </div>
              ) : null}

              {workflowResult.ok && !promotion.hasWarnings ? (
                <p className="admin-intelligence__message admin-intelligence__message--success" role="status">
                  Products are now available in the Products dashboard.
                </p>
              ) : null}

              {workflowResult.ok && promotion.hasWarnings ? (
                <p className="admin-intelligence__message admin-intelligence__message--warning" role="status">
                  Source import succeeded. Review skipped brands before relying on the Products dashboard.
                </p>
              ) : null}
            </div>
          ) : null}

          {workflowResult.stage === 'promote' && !promotion ? (
            <p className="admin-intelligence__message admin-intelligence__message--error" role="alert">
              Source rows were saved, but product promotion did not complete.
              {workflowResult.brands?.length
                ? ' You can retry promotion without re-uploading the CSV.'
                : ' Refreshing may require re-import or manual promotion.'}
            </p>
          ) : null}

          {importError ? (
            <ErrorState compact>{importError}</ErrorState>
          ) : null}

          <div className="admin-intelligence__actions">
            {canRetryPromotion ? (
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={handleRetryPromotion}
                disabled={busy}
              >
                {promoting ? 'Retrying…' : 'Retry product promotion'}
              </button>
            ) : null}
            {workflowResult.ok || (importResult && !importResult.error) ? (
              <Link
                to={workflowResult.productsPath || '/admin/intelligence/products'}
                className="admin-intelligence__button admin-intelligence__button--primary"
              >
                View products
              </Link>
            ) : null}
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={handleImportAnother}
              disabled={busy}
            >
              Import another CSV
            </button>
            <Link
              to="/admin/intelligence"
              className="admin-intelligence__button admin-intelligence__button--secondary"
            >
              Back to browser
            </Link>
          </div>
        </section>
      ) : null}

      {previewActive ? (
      <section className="admin-intelligence__panel">
        <h2 className="admin-intelligence__panel-title">2. Validation preview</h2>

        <div className="admin-intelligence__stats">
          <div className="admin-intelligence__stat">
            <span>Total rows</span>
            <strong>{validation.results.length}</strong>
          </div>
          <div className="admin-intelligence__stat admin-intelligence__stat--ok">
            <span>Valid</span>
            <strong>{validation.validCount}</strong>
          </div>
          <div className="admin-intelligence__stat admin-intelligence__stat--bad">
            <span>Invalid</span>
            <strong>{validation.invalidCount}</strong>
          </div>
        </div>

        {validation.results.length === 0 ? (
          <EmptyState compact>Parse a CSV to preview rows.</EmptyState>
        ) : (
          <div className="admin-intelligence__table-wrap">
            <table className="admin-intelligence__table admin-intelligence-import__table">
              <thead>
                <tr>
                  <th scope="col">Brand</th>
                  <th scope="col">Series</th>
                  <th scope="col">Model</th>
                  <th scope="col">Category</th>
                  <th scope="col">Type</th>
                  <th scope="col">Trade in</th>
                  <th scope="col">Observations</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Slug</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {validation.results.map((row) => (
                  <tr key={`preview-${row.rowNumber}`} data-invalid={row.valid ? 'false' : 'true'}>
                    <td>{row.normalised.brand || '—'}</td>
                    <td>{row.normalised.series || '—'}</td>
                    <td>{row.normalised.model || '—'}</td>
                    <td>{row.normalised.category || '—'}</td>
                    <td>{row.normalised.equipment_type || '—'}</td>
                    <td>{formatPreviewTradeIn(row)}</td>
                    <td>{row.observationCount}</td>
                    <td>{row.normalised.confidence || '—'}</td>
                    <td>{row.normalised.slug || '—'}</td>
                    <td>
                      {row.valid ? (
                        'Valid'
                      ) : (
                        <ul className="admin-intelligence-import__errors">
                          {row.errors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {importError ? (
          <ErrorState compact>{importError}</ErrorState>
        ) : null}

        {progressLabel ? (
          <p className="admin-intelligence__count" role="status">{progressLabel}</p>
        ) : null}

        <div className="admin-intelligence__actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={handleImport}
            disabled={busy || validation.validCount === 0}
          >
            {busy
              ? (progressLabel || 'Working…')
              : `Import ${validation.validCount} valid row${validation.validCount === 1 ? '' : 's'}`}
          </button>
          <Link
            to="/admin/intelligence"
            className="admin-intelligence__button admin-intelligence__button--secondary"
          >
            Back to browser
          </Link>
        </div>
      </section>
      ) : null}
    </section>
  )
}

export default AdminIntelligenceImportPage
