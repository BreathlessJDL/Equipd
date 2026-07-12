import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  fetchEquipmentModels,
  getEquipmentModelDisplayName,
} from '../lib/equipmentModels'
import {
  IMPORT_COLUMNS,
  SAMPLE_MARKET_OBSERVATION_CSV,
  createEmptyObservationRow,
  importMarketObservations,
  parseCsvText,
  validateObservationRows,
} from '../lib/marketObservationImport'
import { searchEquipmentModels } from '../lib/valuationCalculator'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminPriceGuideImportPage.css'

function formatPreviewValue(value) {
  if (value == null || value === '') return '—'
  return String(value)
}

function AdminPriceGuideImportPage() {
  usePageTitle('Admin Price Guide Import')

  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')

  const [modelSearch, setModelSearch] = useState('')
  const [selectedModel, setSelectedModel] = useState(null)

  const [method, setMethod] = useState('manual')
  const [manualRows, setManualRows] = useState([createEmptyObservationRow()])
  const [csvText, setCsvText] = useState(SAMPLE_MARKET_OBSERVATION_CSV)
  const [csvParseError, setCsvParseError] = useState('')
  const [csvRows, setCsvRows] = useState([])

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadModels() {
      setModelsLoading(true)
      setModelsError('')

      const result = await fetchEquipmentModels()
      if (cancelled) return

      if (result.error) {
        setModels([])
        setModelsError(getAdminErrorMessage(result.error))
        setModelsLoading(false)
        return
      }

      setModels(result.data ?? [])
      setModelsLoading(false)
    }

    loadModels()

    return () => {
      cancelled = true
    }
  }, [])

  const modelMatches = useMemo(() => {
    const query = modelSearch.trim()
    if (!query) return models.slice(0, 12)
    return searchEquipmentModels(models, query).matches.slice(0, 20)
  }, [models, modelSearch])

  const activeRows = method === 'manual' ? manualRows : csvRows

  const validation = useMemo(
    () => validateObservationRows(activeRows),
    [activeRows],
  )

  function updateManualRow(index, key, value) {
    setManualRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    )
    setImportSuccess('')
    setImportError('')
  }

  function addManualRow() {
    setManualRows((current) => [...current, createEmptyObservationRow()])
  }

  function removeManualRow(index) {
    setManualRows((current) => {
      if (current.length <= 1) return [createEmptyObservationRow()]
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  function handleParseCsv() {
    setImportSuccess('')
    setImportError('')
    const parsed = parseCsvText(csvText)
    if (parsed.error) {
      setCsvParseError(parsed.error)
      setCsvRows([])
      return
    }
    setCsvParseError('')
    setCsvRows(parsed.rows)
  }

  function handleLoadSampleCsv() {
    setCsvText(SAMPLE_MARKET_OBSERVATION_CSV)
    setCsvParseError('')
    setImportSuccess('')
    setImportError('')
    const parsed = parseCsvText(SAMPLE_MARKET_OBSERVATION_CSV)
    setCsvRows(parsed.rows)
  }

  async function handleImport() {
    setImportSuccess('')
    setImportError('')

    if (!selectedModel) {
      setImportError('Select an equipment model before importing.')
      return
    }

    if (method === 'csv' && csvRows.length === 0) {
      setImportError('Parse the CSV first to preview rows.')
      return
    }

    if (validation.validCount === 0) {
      setImportError('No valid rows to import. Fix validation errors and try again.')
      return
    }

    setImporting(true)

    const result = await importMarketObservations(selectedModel.id, validation.validRows)

    if (result.error) {
      setImportError(getAdminErrorMessage(result.error))
      setImporting(false)
      return
    }

    setImportSuccess(
      `Imported ${result.insertedCount} observation${result.insertedCount === 1 ? '' : 's'} for ${getEquipmentModelDisplayName(selectedModel)}.`,
    )

    if (method === 'manual') {
      setManualRows([createEmptyObservationRow()])
    }

    setImporting(false)
  }

  return (
    <section className="admin-price-guide-import">
      <header className="admin-price-guide-import__header">
        <p className="admin-price-guide-import__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>
        <h1 className="admin-price-guide-import__title">Price Guide import</h1>
        <p className="admin-price-guide-import__lead">
          Import market observations for an equipment model. Valid rows are inserted only; invalid
          rows are skipped.
        </p>
      </header>

      {modelsLoading ? <LoadingState>Loading equipment models…</LoadingState> : null}
      {modelsError ? <ErrorState compact>{modelsError}</ErrorState> : null}

      {!modelsLoading && !modelsError ? (
        <>
          <section className="admin-price-guide-import__panel">
            <h2 className="admin-price-guide-import__panel-title">1. Select equipment model</h2>

            <div className="admin-price-guide-import__field">
              <label className="admin-price-guide-import__label" htmlFor="admin-pg-model-search">
                Search models
              </label>
              <input
                id="admin-pg-model-search"
                type="search"
                className="admin-price-guide-import__input"
                placeholder="Brand, model, category or slug"
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
              />
            </div>

            {selectedModel ? (
              <div className="admin-price-guide-import__selected">
                <strong>{getEquipmentModelDisplayName(selectedModel)}</strong>
                <div className="admin-price-guide-import__meta">
                  {selectedModel.category ? (
                    <span className="admin-price-guide-import__chip">{selectedModel.category}</span>
                  ) : null}
                  <span className="admin-price-guide-import__chip">{selectedModel.slug}</span>
                </div>
                <div className="admin-price-guide-import__links">
                  <Link
                    className="admin-price-guide-import__link"
                    to={`/equipment/${selectedModel.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View public model page
                  </Link>
                  <Link
                    className="admin-price-guide-import__link"
                    to={`/valuation?model=${encodeURIComponent(selectedModel.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open valuation tool
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState compact>Select a model to import observations against.</EmptyState>
            )}

            <div className="admin-price-guide-import__matches">
              {modelMatches.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`admin-price-guide-import__match${
                    selectedModel?.id === model.id
                      ? ' admin-price-guide-import__match--selected'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedModel(model)
                    setImportSuccess('')
                    setImportError('')
                  }}
                >
                  <p className="admin-price-guide-import__match-title">
                    {getEquipmentModelDisplayName(model)}
                  </p>
                  <p className="admin-price-guide-import__match-slug">
                    {[model.category, model.slug].filter(Boolean).join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-price-guide-import__panel">
            <h2 className="admin-price-guide-import__panel-title">2. Import method</h2>

            <div className="admin-price-guide-import__methods" role="tablist" aria-label="Import method">
              <button
                type="button"
                role="tab"
                aria-selected={method === 'manual'}
                className={`admin-price-guide-import__method${
                  method === 'manual' ? ' admin-price-guide-import__method--active' : ''
                }`}
                onClick={() => setMethod('manual')}
              >
                Manual rows
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === 'csv'}
                className={`admin-price-guide-import__method${
                  method === 'csv' ? ' admin-price-guide-import__method--active' : ''
                }`}
                onClick={() => setMethod('csv')}
              >
                CSV paste
              </button>
            </div>

            {method === 'manual' ? (
              <>
                <div className="admin-price-guide-import__table-wrap">
                  <table className="admin-price-guide-import__table">
                    <thead>
                      <tr>
                        {IMPORT_COLUMNS.map((column) => (
                          <th key={column.key} scope="col">
                            {column.label}
                            {column.required ? ' *' : ''}
                          </th>
                        ))}
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualRows.map((row, index) => (
                        <tr key={`manual-row-${index}`}>
                          {IMPORT_COLUMNS.map((column) => (
                            <td key={column.key}>
                              <input
                                className="admin-price-guide-import__cell-input"
                                value={row[column.key]}
                                onChange={(event) =>
                                  updateManualRow(index, column.key, event.target.value)
                                }
                                aria-label={`${column.label} row ${index + 1}`}
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              type="button"
                              className="admin-price-guide-import__button admin-price-guide-import__button--danger"
                              onClick={() => removeManualRow(index)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="admin-price-guide-import__actions">
                  <button
                    type="button"
                    className="admin-price-guide-import__button admin-price-guide-import__button--secondary"
                    onClick={addManualRow}
                  >
                    Add row
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="admin-price-guide-import__field">
                  <label className="admin-price-guide-import__label" htmlFor="admin-pg-csv">
                    Paste CSV
                  </label>
                  <textarea
                    id="admin-pg-csv"
                    className="admin-price-guide-import__textarea"
                    value={csvText}
                    onChange={(event) => {
                      setCsvText(event.target.value)
                      setCsvParseError('')
                      setImportSuccess('')
                      setImportError('')
                    }}
                  />
                </div>
                <div className="admin-price-guide-import__actions">
                  <button
                    type="button"
                    className="admin-price-guide-import__button admin-price-guide-import__button--primary"
                    onClick={handleParseCsv}
                  >
                    Preview CSV
                  </button>
                  <button
                    type="button"
                    className="admin-price-guide-import__button admin-price-guide-import__button--secondary"
                    onClick={handleLoadSampleCsv}
                  >
                    Load sample CSV
                  </button>
                </div>
                {csvParseError ? (
                  <p className="admin-price-guide-import__message admin-price-guide-import__message--error">
                    {csvParseError}
                  </p>
                ) : null}
                <div>
                  <p className="admin-price-guide-import__label">Sample CSV</p>
                  <pre className="admin-price-guide-import__sample">{SAMPLE_MARKET_OBSERVATION_CSV}</pre>
                </div>
              </>
            )}
          </section>

          <section className="admin-price-guide-import__panel">
            <h2 className="admin-price-guide-import__panel-title">3. Validation preview</h2>

            <div className="admin-price-guide-import__stats">
              <div className="admin-price-guide-import__stat">
                <span>Total rows</span>
                <strong>{validation.results.length}</strong>
              </div>
              <div className="admin-price-guide-import__stat admin-price-guide-import__stat--ok">
                <span>Valid</span>
                <strong>{validation.validCount}</strong>
              </div>
              <div className="admin-price-guide-import__stat admin-price-guide-import__stat--bad">
                <span>Invalid</span>
                <strong>{validation.invalidCount}</strong>
              </div>
            </div>

            {validation.results.length === 0 ? (
              <EmptyState compact>
                {method === 'csv'
                  ? 'Parse a CSV to preview rows.'
                  : 'Add at least one observation row.'}
              </EmptyState>
            ) : (
              <div className="admin-price-guide-import__table-wrap">
                <table className="admin-price-guide-import__table">
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      <th scope="col">Status</th>
                      <th scope="col">Price</th>
                      <th scope="col">Age</th>
                      <th scope="col">Condition</th>
                      <th scope="col">Source type</th>
                      <th scope="col">Domain</th>
                      <th scope="col">Confidence</th>
                      <th scope="col">Observed at</th>
                      <th scope="col">Notes</th>
                      <th scope="col">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.results.map((row) => (
                      <tr key={`preview-${row.rowNumber}`} data-invalid={row.valid ? 'false' : 'true'}>
                        <td>{row.rowNumber}</td>
                        <td>{row.valid ? 'Valid' : 'Invalid'}</td>
                        <td>{formatPreviewValue(row.normalised.observed_price)}</td>
                        <td>{formatPreviewValue(row.normalised.estimated_age_years)}</td>
                        <td>{formatPreviewValue(row.normalised.condition)}</td>
                        <td>{formatPreviewValue(row.normalised.source_type)}</td>
                        <td>{formatPreviewValue(row.normalised.source_domain)}</td>
                        <td>{formatPreviewValue(row.normalised.confidence_score)}</td>
                        <td>{formatPreviewValue(row.normalised.observed_at)}</td>
                        <td>{formatPreviewValue(row.normalised.notes)}</td>
                        <td>
                          {row.errors.length > 0 ? (
                            <ul className="admin-price-guide-import__errors">
                              {row.errors.map((error) => (
                                <li key={error}>{error}</li>
                              ))}
                            </ul>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {importError ? (
              <p className="admin-price-guide-import__message admin-price-guide-import__message--error" role="alert">
                {importError}
              </p>
            ) : null}

            {importSuccess ? (
              <p className="admin-price-guide-import__message admin-price-guide-import__message--success" role="status">
                {importSuccess}
              </p>
            ) : null}

            <div className="admin-price-guide-import__actions">
              <button
                type="button"
                className="admin-price-guide-import__button admin-price-guide-import__button--primary"
                onClick={handleImport}
                disabled={importing || !selectedModel || validation.validCount === 0}
              >
                {importing
                  ? 'Importing…'
                  : `Import ${validation.validCount} valid row${validation.validCount === 1 ? '' : 's'}`}
              </button>
            </div>

            {selectedModel ? (
              <div className="admin-price-guide-import__links">
                <Link
                  className="admin-price-guide-import__link"
                  to={`/equipment/${selectedModel.slug}`}
                >
                  View /equipment/{selectedModel.slug}
                </Link>
                <Link
                  className="admin-price-guide-import__link"
                  to={`/valuation?model=${encodeURIComponent(selectedModel.slug)}`}
                >
                  Open /valuation?model={selectedModel.slug}
                </Link>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default AdminPriceGuideImportPage
