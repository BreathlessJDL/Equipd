import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  CANONICAL_CSV_GUIDANCE,
  CANONICAL_CSV_ROW_ACTION,
  SAMPLE_CANONICAL_PRODUCT_CSV,
  applyCanonicalProductCsvImport,
  prepareCanonicalProductCsvImport,
} from '../lib/canonicalProductCsvImport'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceImportPage.css'

function actionLabel(action) {
  switch (action) {
    case CANONICAL_CSV_ROW_ACTION.CREATE:
      return 'Create'
    case CANONICAL_CSV_ROW_ACTION.UPDATE:
      return 'Update'
    case CANONICAL_CSV_ROW_ACTION.UNCHANGED:
      return 'Remain unchanged'
    case CANONICAL_CSV_ROW_ACTION.FAIL:
      return 'Fail validation'
    default:
      return action || '—'
  }
}

function resultHeadline(result) {
  if (!result) return ''
  if (result.error && !result.created?.length && !result.updated?.length) {
    return 'Import failed'
  }
  if (result.failed?.length) return 'Import complete (with row failures)'
  return 'Canonical import complete'
}

function AdminIntelligenceImportPage() {
  usePageTitle('Admin Canonical Product Import')

  const [method, setMethod] = useState('paste')
  const [csvText, setCsvText] = useState('')
  const [parseError, setParseError] = useState('')
  const [parseWarnings, setParseWarnings] = useState([])
  const [plan, setPlan] = useState(null)
  const [previewActive, setPreviewActive] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileInputRef = useRef(null)

  const [importing, setImporting] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [importError, setImportError] = useState('')
  const [workflowResult, setWorkflowResult] = useState(null)

  const busy = importing || previewLoading
  const actionableCount = (plan?.createCount ?? 0) + (plan?.updateCount ?? 0)

  function resetImportForm({ clearResult = true } = {}) {
    setPlan(null)
    setParseError('')
    setParseWarnings([])
    setCsvText('')
    setPreviewActive(false)
    setImportError('')
    setProgressLabel('')
    if (clearResult) setWorkflowResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function applyCsvText(text) {
    setImportError('')
    setWorkflowResult(null)
    setPreviewLoading(true)
    setProgressLabel('Preparing preview…')

    const prepared = await prepareCanonicalProductCsvImport(text)
    setPreviewLoading(false)
    setProgressLabel('')

    if (prepared.error) {
      setParseError(prepared.error)
      setParseWarnings(prepared.parseWarnings || [])
      setPlan(null)
      setPreviewActive(false)
      return
    }

    setParseError('')
    setParseWarnings(prepared.parseWarnings || prepared.plan?.warnings || [])
    setPlan(prepared.plan)
    setPreviewActive((prepared.plan?.rows?.length ?? 0) > 0)
  }

  function handleParsePaste() {
    applyCsvText(csvText)
  }

  function handleLoadSample() {
    setCsvText(SAMPLE_CANONICAL_PRODUCT_CSV)
    applyCsvText(SAMPLE_CANONICAL_PRODUCT_CSV)
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

  async function handleImport() {
    setImportError('')
    setWorkflowResult(null)

    if (!plan?.rows?.length) {
      setImportError('Parse a CSV before importing.')
      return
    }

    if (actionableCount === 0) {
      setImportError('No create or update rows to import. Fix validation errors and try again.')
      return
    }

    setImporting(true)
    setProgressLabel('Importing canonical products…')

    const result = await applyCanonicalProductCsvImport(plan, {
      onProgress: ({ completed, total, slug }) => {
        if (total > 0) {
          setProgressLabel(
            slug
              ? `Importing ${completed + 1} of ${total}: ${slug}…`
              : `Imported ${completed} of ${total}…`,
          )
        }
      },
    })

    setImporting(false)
    setProgressLabel('')
    setWorkflowResult(result)

    if (result.error) {
      setImportError(getAdminErrorMessage(result.error))
      return
    }

    setPlan(null)
    setParseError('')
    setParseWarnings([])
    setCsvText('')
    setPreviewActive(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleImportAnother() {
    resetImportForm({ clearResult: true })
  }

  const showResultPanel = Boolean(workflowResult) && !previewActive
  const createdCount = workflowResult?.created?.length ?? 0
  const updatedCount = workflowResult?.updated?.length ?? 0
  const unchangedCount = workflowResult?.unchanged?.length ?? 0
  const failedCount = workflowResult?.failed?.length ?? 0

  return (
    <section className="admin-intelligence">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Intelligence</Link>
        </p>
        <h1 className="admin-intelligence__title">Import canonical product CSV</h1>
        <p className="admin-intelligence__lead">{CANONICAL_CSV_GUIDANCE}</p>
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

        {parseWarnings.length > 0 ? (
          <div className="admin-intelligence__message admin-intelligence__message--warning" role="status">
            <ul>
              {parseWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="admin-intelligence__label">Sample CSV</p>
          <p className="admin-intelligence__count">
            Prefer baseline_manufacture_year. Older manufacture_year columns are accepted temporarily as an
            alias and shown as deprecated in preview.
          </p>
          <pre className="admin-intelligence-import__sample">{SAMPLE_CANONICAL_PRODUCT_CSV}</pre>
        </div>
      </section>

      {showResultPanel ? (
        <section className="admin-intelligence__panel admin-intelligence-import__result">
          <h2 className="admin-intelligence__panel-title">{resultHeadline(workflowResult)}</h2>

          <div className="admin-intelligence-import__result-block">
            <h3 className="admin-intelligence-import__result-heading">Canonical products</h3>
            <ul className="admin-intelligence-import__result-list">
              <li>{createdCount} created</li>
              <li>{updatedCount} updated</li>
              <li>{unchangedCount} unchanged</li>
              <li>{failedCount} failed</li>
            </ul>
          </div>

          {failedCount > 0 ? (
            <div className="admin-intelligence__message admin-intelligence__message--warning" role="status">
              <p>Failed rows:</p>
              <ul>
                {workflowResult.failed.map((row) => (
                  <li key={`fail-${row.lineNumber}-${row.normalised?.slug || 'row'}`}>
                    Line {row.lineNumber}
                    {row.normalised?.slug ? ` (${row.normalised.slug})` : ''}
                    {': '}
                    {row.error || row.errors?.join('; ') || 'Failed'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {createdCount + updatedCount > 0 && !workflowResult.error ? (
            <p className="admin-intelligence__message admin-intelligence__message--success" role="status">
              Imported products are available in Equipment Intelligence and valuation immediately. Images can
              be added separately.
            </p>
          ) : null}

          {importError ? (
            <ErrorState compact>{importError}</ErrorState>
          ) : null}

          <div className="admin-intelligence__actions">
            {createdCount + updatedCount > 0 ? (
              <Link
                to="/admin/intelligence/products"
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

      {previewActive && plan ? (
        <section className="admin-intelligence__panel">
          <h2 className="admin-intelligence__panel-title">2. Validation preview</h2>

          <div className="admin-intelligence__stats">
            <div className="admin-intelligence__stat">
              <span>Total rows</span>
              <strong>{plan.rows.length}</strong>
            </div>
            <div className="admin-intelligence__stat admin-intelligence__stat--ok">
              <span>Create</span>
              <strong>{plan.createCount}</strong>
            </div>
            <div className="admin-intelligence__stat admin-intelligence__stat--ok">
              <span>Update</span>
              <strong>{plan.updateCount}</strong>
            </div>
            <div className="admin-intelligence__stat">
              <span>Unchanged</span>
              <strong>{plan.unchangedCount}</strong>
            </div>
            <div className="admin-intelligence__stat admin-intelligence__stat--bad">
              <span>Fail</span>
              <strong>{plan.failCount}</strong>
            </div>
          </div>

          {plan.rows.length === 0 ? (
            <EmptyState compact>Parse a CSV to preview rows.</EmptyState>
          ) : (
            <div className="admin-intelligence__table-wrap">
              <table className="admin-intelligence__table admin-intelligence-import__table">
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Product</th>
                    <th scope="col">Action</th>
                    <th scope="col">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((row) => (
                    <tr
                      key={`preview-${row.lineNumber}`}
                      data-invalid={row.action === CANONICAL_CSV_ROW_ACTION.FAIL ? 'true' : 'false'}
                      data-action={row.action}
                    >
                      <td>{row.lineNumber}</td>
                      <td>{row.normalised?.slug || '—'}</td>
                      <td>
                        {row.normalised?.canonical_product_name
                          || [row.normalised?.brand, row.normalised?.model].filter(Boolean).join(' ')
                          || '—'}
                      </td>
                      <td>
                        <span
                          className={`admin-intelligence-import__action admin-intelligence-import__action--${row.action}`}
                        >
                          {actionLabel(row.action)}
                        </span>
                      </td>
                      <td>
                        {row.action === CANONICAL_CSV_ROW_ACTION.FAIL ? (
                          <ul className="admin-intelligence-import__errors">
                            {(row.errors || row.changeSummaries || []).map((error) => (
                              <li key={error}>{error}</li>
                            ))}
                          </ul>
                        ) : row.changeSummaries?.length ? (
                          <ul className="admin-intelligence-import__changes">
                            {row.warnings?.map((warning) => (
                              <li key={warning} className="admin-intelligence-import__change-warn">
                                {warning}
                              </li>
                            ))}
                            {row.changeSummaries.map((summary) => (
                              <li key={summary}>{summary}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="admin-intelligence__count">No field changes</span>
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
              disabled={busy || actionableCount === 0}
            >
              {busy
                ? (progressLabel || 'Working…')
                : `Import ${actionableCount} row${actionableCount === 1 ? '' : 's'}`}
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
