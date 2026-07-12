import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  SAMPLE_EQUIPMENT_INTELLIGENCE_CSV,
  formatTradeInValue,
  importEquipmentIntelligenceRows,
  parseEquipmentIntelligenceCsv,
  validateEquipmentIntelligenceRows,
} from '../lib/equipmentIntelligence'
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

function AdminIntelligenceImportPage() {
  usePageTitle('Admin Intelligence Import')

  const [method, setMethod] = useState('paste')
  const [csvText, setCsvText] = useState('')
  const [parseError, setParseError] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [previewActive, setPreviewActive] = useState(false)
  const fileInputRef = useRef(null)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  const validation = useMemo(
    () => validateEquipmentIntelligenceRows(parsedRows),
    [parsedRows],
  )

  function resetImportForm({ clearSuccess = true } = {}) {
    setParsedRows([])
    setParseError('')
    setCsvText('')
    setPreviewActive(false)
    setImportError('')
    if (clearSuccess) {
      setImportSuccess('')
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function applyCsvText(text) {
    setImportError('')
    setImportSuccess('')
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

  async function handleImport() {
    setImportError('')
    setImportSuccess('')

    if (parsedRows.length === 0) {
      setImportError('Parse a CSV before importing.')
      return
    }

    if (validation.validCount === 0) {
      setImportError('No valid rows to import. Fix validation errors and try again.')
      return
    }

    setImporting(true)

    const result = await importEquipmentIntelligenceRows(validation.validRows)

    if (result.error) {
      setImportError(getAdminErrorMessage(result.error))
      setImporting(false)
      return
    }

    setImportSuccess(
      `Import complete: ${result.insertedCount} inserted, ${result.updatedCount} updated.`,
    )
    setParsedRows([])
    setParseError('')
    setCsvText('')
    setPreviewActive(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setImporting(false)
  }

  function handleImportAnother() {
    resetImportForm({ clearSuccess: true })
  }

  return (
    <section className="admin-intelligence">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Intelligence</Link>
        </p>
        <h1 className="admin-intelligence__title">Import intelligence CSV</h1>
        <p className="admin-intelligence__lead">
          Upload or paste a cleaned master CSV. Rows upsert by slug; blank market observations do not
          overwrite existing data.
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
            />
            <div className="admin-intelligence__actions">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={handleParsePaste}
              >
                Preview CSV
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={handleLoadSample}
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
          <pre className="admin-intelligence-import__sample">{SAMPLE_EQUIPMENT_INTELLIGENCE_CSV}</pre>
        </div>
      </section>

      {importSuccess && !previewActive ? (
        <section className="admin-intelligence__panel">
          <p className="admin-intelligence__message admin-intelligence__message--success" role="status">
            {importSuccess}
          </p>
          <div className="admin-intelligence__actions">
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--primary"
              onClick={handleImportAnother}
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

        <div className="admin-intelligence__actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={handleImport}
            disabled={importing || validation.validCount === 0}
          >
            {importing
              ? 'Importing…'
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
