/**
 * Import researched product updates — preview then explicit apply.
 */

import { useRef, useState } from 'react'
import {
  RESEARCH_IMPORT_MAX_ROWS,
  buildResearchImportErrorCsv,
  downloadResearchCsv,
} from '../../lib/equipmentProductResearchCsv.js'
import {
  applyResearchImportPlan,
  buildResearchImportPlanFromCsvText,
} from '../../lib/equipmentProductResearchImport.js'
import { getAdminErrorMessage } from '../../lib/admin'
import { deriveResearchMissingFields } from '../../lib/equipmentProductResearchCsv.js'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export default function EquipmentProductResearchImportModal({
  open,
  onClose,
  onApplied = null,
}) {
  const fileInputRef = useRef(null)
  const [phase, setPhase] = useState('pick') // pick | preview | applying | result | error
  const [filename, setFilename] = useState('')
  const [error, setError] = useState('')
  const [planBundle, setPlanBundle] = useState(null)
  const [applyResult, setApplyResult] = useState(null)
  const [progress, setProgress] = useState(null)

  if (!open) return null

  function resetAndClose() {
    setPhase('pick')
    setFilename('')
    setError('')
    setPlanBundle(null)
    setApplyResult(null)
    setProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose?.()
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setPlanBundle(null)
    setApplyResult(null)

    if (file.size > MAX_FILE_BYTES) {
      setError(`File exceeds ${MAX_FILE_BYTES / (1024 * 1024)} MB limit.`)
      setPhase('error')
      return
    }

    setFilename(file.name)
    setPhase('preview')
    try {
      const text = await file.text()
      const { plan, error: planError } = await buildResearchImportPlanFromCsvText(text, {
        filename: file.name,
      })
      if (planError) throw planError
      setPlanBundle(plan)
    } catch (err) {
      setError(getAdminErrorMessage(err))
      setPhase('error')
    }
  }

  async function handleApply() {
    if (!planBundle) return
    if (planBundle.summary.validUpdates === 0) {
      setError('No valid updates to apply.')
      return
    }
    setPhase('applying')
    setError('')
    try {
      const result = await applyResearchImportPlan(planBundle, {
        onProgress: setProgress,
      })
      if (result.error) throw result.error
      setApplyResult(result)
      setPhase('result')
      onApplied?.(result)
    } catch (err) {
      setError(getAdminErrorMessage(err))
      setPhase('error')
    }
  }

  function handleDownloadErrors() {
    if (planBundle?.rejectionCsv) {
      downloadResearchCsv(
        planBundle.rejectionCsv,
        `equipd-product-research-rejections-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      return
    }
    const errors = [
      ...(planBundle?.errors || []),
      ...(applyResult?.failed || []).map((entry) => ({
        line: entry.line,
        product_id: entry.product_id,
        message: entry.error,
        rawRow: entry.rawRow,
      })),
    ]
    if (!errors.length) return
    const content = buildResearchImportErrorCsv(errors, planBundle?.plans || [])
    downloadResearchCsv(content, `equipd-product-research-errors-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function handleDownloadClassificationReport() {
    const text = planBundle?.classificationSummary?.text
    if (!text) return
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `equipd-product-research-validation-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const updatePlans = (planBundle?.plans || []).filter((p) => p.action === 'update').slice(0, 40)
  const classificationSummary = planBundle?.classificationSummary
  const stillIncomplete = (applyResult?.updated || []).filter((entry) => {
    const product = entry.product
    return product && deriveResearchMissingFields(product).length > 0
  }).length
  const nowComplete = (applyResult?.updated || []).length - stillIncomplete

  return (
    <div className="admin-products__modal-backdrop" role="presentation" onClick={resetAndClose}>
      <div
        className="admin-products__modal admin-products__modal--research admin-products__modal--research-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-products__modal-header">
          <h2 id="research-import-title">Import researched product updates</h2>
          <button type="button" className="admin-intelligence__button" onClick={resetAndClose}>
            Close
          </button>
        </header>

        <div className="admin-products__modal-body">
          {phase === 'pick' || phase === 'error' ? (
            <>
              <p className="admin-products__confirm-lead">
                Import only values from <code>researched_*</code> columns. Blank cells mean no change;
                use <code>__CLEAR__</code> to clear a field. Matches by <code>product_id</code> and verifies
                <code>canonical_product_key</code>. Does not approve products or rebuild keys.
              </p>
              <label className="admin-products__research-file">
                <span className="admin-intelligence__label">CSV file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                />
              </label>
              <p className="admin-products__confirm-warning">
                Max {RESEARCH_IMPORT_MAX_ROWS.toLocaleString('en-GB')} rows / {MAX_FILE_BYTES / (1024 * 1024)} MB.
                Separate from the raw equipment_intelligence importer.
              </p>
              {error ? <p className="admin-products__confirm-warning" role="alert">{error}</p> : null}
            </>
          ) : null}

          {(phase === 'preview' || phase === 'applying') && planBundle ? (
            <>
              <p className="admin-products__confirm-lead">
                Preview — {filename || 'CSV'}
              </p>
              <dl className="admin-products__confirm-stats">
                <div>
                  <dt>Rows read</dt>
                  <dd>{planBundle.summary.rowsRead}</dd>
                </div>
                <div>
                  <dt>Valid updates</dt>
                  <dd>{planBundle.summary.validUpdates}</dd>
                </div>
                <div>
                  <dt>Unchanged</dt>
                  <dd>{planBundle.summary.unchanged}</dd>
                </div>
                <div>
                  <dt>Warnings</dt>
                  <dd>{planBundle.summary.warnings}</dd>
                </div>
                <div>
                  <dt>Errors</dt>
                  <dd>{planBundle.summary.errors}</dd>
                </div>
                <div>
                  <dt>Identity conflicts</dt>
                  <dd>{planBundle.summary.identityConflicts}</dd>
                </div>
              </dl>

              {classificationSummary ? (
                <div className="admin-products__research-classification">
                  <strong>Validation report (why rows were excluded)</strong>
                  <pre className="admin-products__research-filter-summary">{classificationSummary.text}</pre>
                  <p className="admin-products__confirm-warning" role="status">
                    Report-only instrumentation — import decisions are unchanged.
                    Download the rejection CSV for every row that is not a valid update.
                  </p>
                </div>
              ) : null}

              {planBundle.errors?.length ? (
                <div className="admin-products__research-errors">
                  <strong>Validation errors</strong>
                  <ul>
                    {planBundle.errors.slice(0, 20).map((err, index) => (
                      <li key={`${err.line}-${index}`}>
                        Line {err.line}: {err.product_id || '—'} — {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {updatePlans.length ? (
                <div className="admin-products__research-preview-table-wrap">
                  <table className="admin-intelligence__table admin-products__research-preview-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Field</th>
                        <th>Current</th>
                        <th>Imported</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {updatePlans.flatMap((plan) => plan.fieldChanges.map((change) => (
                        <tr key={`${plan.product_id}-${change.field}`}>
                          <td>{plan.brand} · {plan.canonical_product_key}</td>
                          <td>{change.field}</td>
                          <td>{formatCell(change.current)}</td>
                          <td>{formatCell(change.next)}</td>
                          <td>{change.action}</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No field changes to apply.</p>
              )}

              <p className="admin-products__confirm-warning" role="status">
                Status is never auto-approved. Critical changes on approved products stay approved and are flagged
                in review notes.
              </p>

              {phase === 'applying' ? (
                <p role="status">
                  Applying…
                  {progress ? ` ${progress.completed}/${progress.total}` : ''}
                </p>
              ) : (
                <div className="admin-products__modal-actions">
                  <button
                    type="button"
                    className="admin-intelligence__button admin-intelligence__button--primary"
                    disabled={planBundle.summary.validUpdates === 0}
                    onClick={handleApply}
                  >
                    Apply researched updates
                  </button>
                  {classificationSummary?.rejected > 0 || planBundle.errors?.length ? (
                    <button
                      type="button"
                      className="admin-intelligence__button admin-intelligence__button--secondary"
                      onClick={handleDownloadErrors}
                    >
                      Download rejection CSV
                    </button>
                  ) : null}
                  {classificationSummary ? (
                    <button
                      type="button"
                      className="admin-intelligence__button admin-intelligence__button--secondary"
                      onClick={handleDownloadClassificationReport}
                    >
                      Download validation report
                    </button>
                  ) : null}
                  <button type="button" className="admin-intelligence__button" onClick={resetAndClose}>
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : null}

          {phase === 'result' && applyResult ? (
            <>
              <p className="admin-products__confirm-lead">
                Import complete — batch {applyResult.batchId}
              </p>
              <dl className="admin-products__confirm-stats">
                <div>
                  <dt>Updated</dt>
                  <dd>{applyResult.updated.length}</dd>
                </div>
                <div>
                  <dt>Unchanged</dt>
                  <dd>{applyResult.unchanged.length}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{applyResult.failed.length}</dd>
                </div>
                <div>
                  <dt>Fields updated</dt>
                  <dd>{applyResult.fieldUpdateCount}</dd>
                </div>
                <div>
                  <dt>Brands</dt>
                  <dd>{applyResult.brandsAffected.join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt>Still incomplete</dt>
                  <dd>{stillIncomplete}</dd>
                </div>
                <div>
                  <dt>Now complete (among updated)</dt>
                  <dd>{Math.max(0, nowComplete)}</dd>
                </div>
              </dl>
              <div className="admin-products__modal-actions">
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--primary"
                  onClick={resetAndClose}
                >
                  View updated products
                </button>
                {(planBundle?.errors?.length || applyResult.failed.length) ? (
                  <button
                    type="button"
                    className="admin-intelligence__button admin-intelligence__button--secondary"
                    onClick={handleDownloadErrors}
                  >
                    Download error CSV
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function formatCell(value) {
  if (value == null || value === '') return '∅'
  return String(value)
}
