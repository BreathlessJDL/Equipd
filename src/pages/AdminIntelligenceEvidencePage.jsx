import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import {
  approveEquipmentResearchRecommendation,
  buildEmptyLifecycleSourceForm,
  buildEmptyPriceSourceForm,
  buildResearchApprovalDiff,
  deleteLifecycleSource,
  deletePriceSource,
  EVIDENCE_SOURCE_TYPES,
  fetchEquipmentEvidenceDetail,
  fetchPriorityEvidenceGroups,
  formatBestOriginalPrice,
  formatBaselineManufactureYear,
  formatEvidenceStatusLabel,
  formatManufactureYearRange,
  deriveBaselineManufactureYearStatus,
  formatBaselineManufactureYearStatus,
  formatResearchOriginalPrice,
  formatResearchOfficialSourcePrice,
  formatResearchSuggestedGbpEquivalent,
  formatResearchProductionPeriod,
  formatResearchSourceTypeLabel,
  formatResearchHitEvidenceSummary,
  getResearchOfficialPriceDetails,
  getResearchPriceCurrencyDebug,
  deriveResearchPriceReviewStatus,
  isNonGbpResearchPrice,
  getResearchAiCitedSources,
  getResearchAiInputSources,
  getResearchPriceInputSources,
  getResearchLifecycleInputSources,
  getResearchStructuredPriceEvidence,
  getResearchStructuredLifecycleEvidence,
  formatLifecycleEvidenceType,
  formatResearchIdentityLevel,
  getResearchSourceIdentityScores,
  getResearchV3Metadata,
  getResearchV3TrustedSourceSummary,
  formatTrustedSourceSummaryEntry,
  getResearchLifecycleQueryDebug,
  getResearchTargetedLifecycleQueries,
  buildResearchTargetPayload,
  isFastResearchMode,
  getResearchFastSourceHits,
  getDefaultConfidenceForSourceType,
  getSourceTypeLabel,
  lifecycleSourceToForm,
  patchPriorityGroupsAfterEquipmentUpdate,
  priceSourceToForm,
  recalculateBestLifecycleSource,
  recalculateBestPriceSource,
  setBestLifecycleSource,
  setBestPriceSource,
  saveManualLifecycleEvidence,
  saveManualPriceEvidence,
} from '../lib/equipmentIntelligenceEvidence'
import { EQUIPMENT_RESEARCH_ENGINE, runEquipmentResearch } from '../lib/intelligenceMarketSearch'
import {
  attachResearchEngineToBatchQueue,
  buildCanonicalGoogleSearchUrls,
  formatResearchEngineLabel,
  resolveClientResearchEngine,
} from '../lib/equipmentResearchEngine.js'
import {
  buildActiveBrandNameSet,
  buildCanonicalProductResearchQueue,
  buildCoreProductResearchQueue,
  CANONICAL_COMPLETION_STATUS,
  deriveCanonicalProductResearchMode,
  deriveEquipmentResearchMode,
  formatCanonicalProductCompletionLabel,
  RESEARCH_QUEUE_MODE_LABELS,
  RESEARCH_QUEUE_MODES,
} from '../lib/equipmentResearchQueue'
import { fetchEquipmentIntelligenceForCoreProducts } from '../lib/equipmentCoreProductGrouping.js'
import { fetchCanonicalProductResearchView, fetchDedupedApprovedCanonicalProducts, fetchApprovedEquipmentProducts, fetchBrandNames, buildEquipmentProductPagePath, PRODUCT_STATUS, buildCanonicalProductResearchImportPlanFromFile, applyCanonicalProductResearchImport } from '../lib/equipmentProducts.js'
import {
  formatCanonicalResearchSavedMessage,
  patchCanonicalProductGroupsAfterResearchApprove,
  resolveBatchResearchAdvanceAfterApprove,
} from '../lib/equipmentCanonicalResearchApprove.js'
import {
  applyManualPriceFieldChange,
  applyConfirmManualPriceEntry,
  applyMarkUsedRefurbCandidate,
  applyRejectPriceCandidate,
  applySelectPriceCandidate,
  applySelectYearCandidate,
  buildValidatedApprovalRecommendation,
  buildValidatedManualProductSave,
  canApproveResearchPriceSelection,
  canSaveManualProductData,
  createEmptyManualProductRecommendation,
  createEmptyResearchPriceSelectionState,
  createPriceSelectionFromCanonicalProduct,
  formatEffectiveApprovalPrice,
  formatManualSelectionRequiredMessage,
  getAiAdvisoryConfidence,
  getAiAdvisoryPrice,
  getCandidateAdminStatus,
  hasManualPriceEntryDraft,
  isResearchManualSelectionRequired,
  mergeEvidenceIntoManualPriceSelection,
  resolveEffectiveApprovalPrice,
} from '../lib/equipmentResearchPriceSelection.js'
import { exportCanonicalProductListSpreadsheet } from '../lib/canonicalProductListExport.js'
import CanonicalProductCompletionDashboard from '../components/admin/CanonicalProductCompletionDashboard.jsx'
import {
  COMPLETION_DASHBOARD_FILTER,
  exportCanonicalProductsSpreadsheet,
  fetchCanonicalProductCompletionStats,
} from '../lib/canonicalProductCompletionStats.js'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceEvidencePage.css'

function EvidenceStatusBadge({ status }) {
  return (
    <span className={`admin-intelligence-evidence__status admin-intelligence-evidence__status--${status}`}>
      {formatEvidenceStatusLabel(status)}
    </span>
  )
}

function BaselineStatusBadge({ equipment }) {
  const status = deriveBaselineManufactureYearStatus(equipment)
  const className = status === 'verified'
    ? 'verified'
    : status === 'estimated'
      ? 'needs_review'
      : 'missing'
  return (
    <span className={`admin-intelligence-evidence__status admin-intelligence-evidence__status--${className}`}>
      {formatBaselineManufactureYearStatus(status)}
    </span>
  )
}

function CompletionBadge({ status }) {
  const className = [
    'admin-intelligence-evidence__completion-badge',
    status === CANONICAL_COMPLETION_STATUS.COMPLETE ? 'admin-intelligence-evidence__completion-badge--complete' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_PRICE ? 'admin-intelligence-evidence__completion-badge--missing-price' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_BASELINE ? 'admin-intelligence-evidence__completion-badge--missing-baseline' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_BOTH ? 'admin-intelligence-evidence__completion-badge--missing-both' : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={className}>
      {formatCanonicalProductCompletionLabel(status)}
    </span>
  )
}

function SourceTypeSelect({ id, value, onChange, disabled = false }) {
  return (
    <select
      id={id}
      className="admin-intelligence__select"
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {EVIDENCE_SOURCE_TYPES.map((entry) => (
        <option key={entry.id} value={entry.id}>
          {entry.label} ({entry.defaultConfidence})
        </option>
      ))}
    </select>
  )
}

function PriceSourceForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
}) {
  function handleSourceTypeChange(event) {
    const sourceType = event.target.value
    setForm((current) => ({
      ...current,
      source_type: sourceType,
      confidence: String(getDefaultConfidenceForSourceType(sourceType)),
    }))
  }

  return (
    <form className="admin-intelligence-evidence__source-form" onSubmit={onSubmit}>
      <div className="admin-intelligence-evidence__form-grid">
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="price-source-price">Price</label>
          <input
            id="price-source-price"
            type="number"
            min="0"
            step="0.01"
            className="admin-intelligence__input"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            required
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="price-source-currency">Currency</label>
          <input
            id="price-source-currency"
            className="admin-intelligence__input"
            value={form.currency}
            onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="price-source-year">Price year</label>
          <input
            id="price-source-year"
            type="number"
            className="admin-intelligence__input"
            value={form.price_year}
            onChange={(event) => setForm((current) => ({ ...current, price_year: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="price-source-type">Source type</label>
          <SourceTypeSelect
            id="price-source-type"
            value={form.source_type}
            onChange={handleSourceTypeChange}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="price-source-confidence">Confidence</label>
          <input
            id="price-source-confidence"
            type="number"
            min="0"
            max="100"
            className="admin-intelligence__input"
            value={form.confidence}
            onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="price-source-name">Source name</label>
          <input
            id="price-source-name"
            className="admin-intelligence__input"
            value={form.source_name}
            onChange={(event) => setForm((current) => ({ ...current, source_name: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field admin-intelligence-evidence__field-wide">
          <label className="admin-intelligence__label" htmlFor="price-source-url">Source URL</label>
          <input
            id="price-source-url"
            type="url"
            className="admin-intelligence__input"
            value={form.source_url}
            onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field admin-intelligence-evidence__field-wide">
          <label className="admin-intelligence__label" htmlFor="price-source-notes">Notes</label>
          <textarea
            id="price-source-notes"
            className="admin-intelligence__textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field admin-intelligence-evidence__field-wide">
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(form.mark_as_best)}
              onChange={(event) => setForm((current) => ({
                ...current,
                mark_as_best: event.target.checked,
              }))}
            />
            Mark as best / verified after save
          </label>
        </div>
      </div>
      <div className="admin-intelligence__actions">
        <button
          type="submit"
          className="admin-intelligence__button admin-intelligence__button--primary"
          disabled={saving}
        >
          {saving ? 'Saving…' : form.id ? 'Update price source' : 'Add price source'}
        </button>
        <button
          type="button"
          className="admin-intelligence__button admin-intelligence__button--secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function LifecycleSourceForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
}) {
  function handleSourceTypeChange(event) {
    const sourceType = event.target.value
    setForm((current) => ({
      ...current,
      source_type: sourceType,
      confidence: String(getDefaultConfidenceForSourceType(sourceType)),
    }))
  }

  return (
    <form className="admin-intelligence-evidence__source-form" onSubmit={onSubmit}>
      <div className="admin-intelligence-evidence__form-grid">
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="lifecycle-baseline-year">Baseline manufacture year</label>
          <input
            id="lifecycle-baseline-year"
            type="number"
            className="admin-intelligence__input"
            value={form.baseline_manufacture_year}
            onChange={(event) => setForm((current) => ({
              ...current,
              baseline_manufacture_year: event.target.value,
            }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="lifecycle-start-year">Production start year</label>
          <input
            id="lifecycle-start-year"
            type="number"
            className="admin-intelligence__input"
            value={form.manufacture_start_year}
            onChange={(event) => setForm((current) => ({
              ...current,
              manufacture_start_year: event.target.value,
            }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="lifecycle-end-year">Production end year</label>
          <input
            id="lifecycle-end-year"
            type="number"
            className="admin-intelligence__input"
            value={form.manufacture_end_year}
            onChange={(event) => setForm((current) => ({
              ...current,
              manufacture_end_year: event.target.value,
            }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="lifecycle-source-type">Source type</label>
          <SourceTypeSelect
            id="lifecycle-source-type"
            value={form.source_type}
            onChange={handleSourceTypeChange}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="lifecycle-confidence">Confidence</label>
          <input
            id="lifecycle-confidence"
            type="number"
            min="0"
            max="100"
            className="admin-intelligence__input"
            value={form.confidence}
            onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field">
          <label className="admin-intelligence__label" htmlFor="lifecycle-source-name">Source name</label>
          <input
            id="lifecycle-source-name"
            className="admin-intelligence__input"
            value={form.source_name}
            onChange={(event) => setForm((current) => ({ ...current, source_name: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field admin-intelligence-evidence__field-wide">
          <label className="admin-intelligence__label" htmlFor="lifecycle-source-url">Source URL</label>
          <input
            id="lifecycle-source-url"
            type="url"
            className="admin-intelligence__input"
            value={form.source_url}
            onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field admin-intelligence-evidence__field-wide">
          <label className="admin-intelligence__label" htmlFor="lifecycle-notes">Notes</label>
          <textarea
            id="lifecycle-notes"
            className="admin-intelligence__textarea"
            rows={3}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
        <div className="admin-intelligence__field admin-intelligence-evidence__field-wide">
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(form.mark_as_best)}
              onChange={(event) => setForm((current) => ({
                ...current,
                mark_as_best: event.target.checked,
              }))}
            />
            Mark production source as best / verified after save
          </label>
        </div>
      </div>
      <div className="admin-intelligence__actions">
        <button
          type="submit"
          className="admin-intelligence__button admin-intelligence__button--primary"
          disabled={saving}
        >
          {saving ? 'Saving…' : form.id ? 'Update lifecycle source' : 'Add lifecycle source'}
        </button>
        <button
          type="button"
          className="admin-intelligence__button admin-intelligence__button--secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function BatchResearchConfirmModal({
  open,
  summary,
  queuePreview,
  skipCompleted,
  forceReResearch,
  researchEngineMode,
  onSkipCompletedChange,
  onForceReResearchChange,
  onResearchEngineModeChange,
  onConfirm,
  onCancel,
}) {
  if (!open || !summary) return null

  const isCanonical = summary.queueType === 'canonical_products'
  const queuedPreview = (queuePreview ?? []).filter((item) => item.queued).slice(0, 12)

  return (
    <div className="admin-intelligence__modal-backdrop" role="presentation">
      <div
        className="admin-intelligence__modal admin-intelligence-evidence__batch-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-research-confirm-title"
      >
        <h2 id="batch-research-confirm-title" className="admin-intelligence__modal-title">
          {isCanonical ? 'Canonical product research queue' : 'Research queue summary'}
        </h2>
        <p className="admin-intelligence-evidence__panel-lead">
          {isCanonical
            ? 'Researching canonical products (one run per physical machine). Console variants are merged — source row counts show how many intelligence rows each product represents. Excluded products are skipped.'
            : 'Top 100 incomplete core product groups (legacy). Skipped rows will not use SerpAPI or OpenAI.'}
        </p>

        <div className="admin-intelligence__stats admin-intelligence-evidence__batch-summary">
          <div className="admin-intelligence__stat">
            <span>{isCanonical ? 'Products scanned' : 'Core products scanned'}</span>
            <strong>{summary.scanned}</strong>
          </div>
          {isCanonical && summary.excluded != null ? (
            <div className="admin-intelligence__stat">
              <span>Excluded (skipped)</span>
              <strong>{summary.excluded}</strong>
            </div>
          ) : null}
          {isCanonical && summary.completedSkipped != null ? (
            <div className="admin-intelligence__stat admin-intelligence__stat--ok">
              <span>Completed (skipped)</span>
              <strong>{summary.completedSkipped}</strong>
            </div>
          ) : null}
          <div className="admin-intelligence__stat">
            <span>Skipped (complete)</span>
            <strong>{summary.skipped}</strong>
          </div>
          <div className="admin-intelligence__stat">
            <span>Price only</span>
            <strong>{summary.priceOnly}</strong>
          </div>
          <div className="admin-intelligence__stat">
            <span>Lifecycle only</span>
            <strong>{summary.lifecycleOnly}</strong>
          </div>
          <div className="admin-intelligence__stat">
            <span>Full research</span>
            <strong>{summary.full}</strong>
          </div>
          <div className="admin-intelligence__stat admin-intelligence__stat--ok">
            <span>{isCanonical ? 'Products to research' : 'Rows to research'}</span>
            <strong>{summary.toResearch}</strong>
          </div>
        </div>

        {queuedPreview.length > 0 ? (
          <div className="admin-intelligence-evidence__batch-preview">
            <h3 className="admin-intelligence-evidence__section-title">Queue preview</h3>
            <div className="admin-intelligence__table-wrap">
              <table className="admin-intelligence__table admin-intelligence-evidence__batch-preview-table">
                <thead>
                  <tr>
                    <th>Canonical product</th>
                    <th>Completion</th>
                    <th>Status</th>
                    <th>Sources</th>
                    <th>Base price</th>
                    <th>Baseline year</th>
                    <th>Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {queuedPreview.map((item) => (
                    <tr key={`${item.productId ?? item.equipmentId}-${item.label}`}>
                      <td>{item.canonicalProductName || item.label}</td>
                      <td>
                        <CompletionBadge status={item.completionStatus} />
                        {item.completionReason ? (
                          <div className="admin-intelligence-evidence__completion-reason">
                            {item.completionReason}
                          </div>
                        ) : null}
                      </td>
                      <td>{item.productStatus ?? '—'}</td>
                      <td>{item.sourceRowCount ?? 1}</td>
                      <td>
                        {item.originalBasePrice != null
                          ? `${item.originalBasePriceCurrency || 'GBP'} ${Number(item.originalBasePrice).toLocaleString('en-GB')}`
                          : '—'}
                      </td>
                      <td>{item.baselineManufactureYear ?? '—'}</td>
                      <td>{RESEARCH_QUEUE_MODE_LABELS[item.mode] ?? item.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.toResearch > queuedPreview.length ? (
              <p className="admin-intelligence-evidence__research-text">
                …and {summary.toResearch - queuedPreview.length} more
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="admin-intelligence-evidence__batch-options">
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={skipCompleted}
              disabled={forceReResearch}
              onChange={(event) => onSkipCompletedChange(event.target.checked)}
            />
            Skip completed rows
          </label>
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={forceReResearch}
              onChange={(event) => onForceReResearchChange(event.target.checked)}
            />
            Force re-research (full mode for every queued row)
          </label>
          <fieldset className="admin-intelligence-evidence__research-engine-fieldset">
            <legend className="admin-intelligence-evidence__research-engine-legend">Research mode</legend>
            <label className="admin-intelligence-evidence__checkbox-label">
              <input
                type="radio"
                name="batch-research-engine"
                checked={researchEngineMode === EQUIPMENT_RESEARCH_ENGINE.FAST}
                onChange={() => onResearchEngineModeChange(EQUIPMENT_RESEARCH_ENGINE.FAST)}
              />
              Fast trusted-source research (default)
            </label>
            <label className="admin-intelligence-evidence__checkbox-label">
              <input
                type="radio"
                name="batch-research-engine"
                checked={researchEngineMode === EQUIPMENT_RESEARCH_ENGINE.V3}
                onChange={() => onResearchEngineModeChange(EQUIPMENT_RESEARCH_ENGINE.V3)}
              />
              Deep research (V3 — pages + AI)
            </label>
          </fieldset>
        </div>

        <div className="admin-intelligence__actions admin-intelligence-evidence__batch-confirm-actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={onConfirm}
            disabled={summary.toResearch === 0}
          >
            Start batch entry ({summary.toResearch})
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function CanonicalProductImportModal({
  open,
  file,
  force,
  plan,
  applyResult,
  loading,
  error,
  onFileChange,
  onForceChange,
  onPreview,
  onApply,
  onClose,
}) {
  if (!open) return null

  return (
    <div className="admin-intelligence__modal-backdrop" role="presentation">
      <div
        className="admin-intelligence__modal admin-intelligence-evidence__import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="canonical-import-title"
      >
        <h2 id="canonical-import-title" className="admin-intelligence__modal-title">
          Import canonical product research
        </h2>
        <p className="admin-intelligence-evidence__panel-lead">
          Upload a completed spreadsheet (.xlsx or .csv). Imports update equipment_products only;
          linked equipment_intelligence rows are updated via safe propagation when allowed.
        </p>

        <div className="admin-intelligence-evidence__import-controls">
          <label className="admin-intelligence__label" htmlFor="canonical-import-file">
            Spreadsheet file
          </label>
          <input
            id="canonical-import-file"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={force}
              onChange={(event) => onForceChange(event.target.checked)}
            />
            Force overwrite verified/manual values
          </label>
        </div>

        {error ? <ErrorState compact>{error}</ErrorState> : null}

        {plan ? (
          <div className="admin-intelligence-evidence__import-summary">
            <h3 className="admin-intelligence-evidence__section-title">Import preview</h3>
            <div className="admin-intelligence__stats">
              <div className="admin-intelligence__stat">
                <span>Rows read</span>
                <strong>{plan.summary.rowsRead}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Matched</span>
                <strong>{plan.summary.matched}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Updated</span>
                <strong>{plan.summary.updated}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Skipped</span>
                <strong>{plan.summary.skipped}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Conflicts</span>
                <strong>{plan.summary.conflicts}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>No matches</span>
                <strong>{plan.summary.noMatches}</strong>
              </div>
            </div>

            <div className="admin-intelligence__table-wrap admin-intelligence-evidence__import-table-wrap">
              <table className="admin-intelligence__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current RRP</th>
                    <th>New RRP</th>
                    <th>Current baseline</th>
                    <th>New baseline</th>
                    <th>Action</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.results.slice(0, 40).map((result) => (
                    <tr key={`${result.rowNumber}-${result.matchedProductId ?? 'none'}`}>
                      <td>{result.matchedProductName || '—'}</td>
                      <td>{result.currentRrp ?? '—'}</td>
                      <td>{result.newRrp ?? '—'}</td>
                      <td>{result.currentBaseline ?? '—'}</td>
                      <td>{result.newBaseline ?? '—'}</td>
                      <td>{result.action}</td>
                      <td>{result.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plan.results.length > 40 ? (
              <p className="admin-intelligence-evidence__panel-lead">
                Showing first 40 rows. {plan.results.length - 40} more in CLI output.
              </p>
            ) : null}
          </div>
        ) : null}

        {applyResult ? (
          <div className="admin-intelligence-evidence__import-apply-summary" role="status">
            <h3 className="admin-intelligence-evidence__section-title">Import completed</h3>
            <p>
              Applied {applyResult.appliedProducts} product update(s) and{' '}
              {applyResult.appliedIntelligenceRows} linked intelligence row update(s).
              {applyResult.failures?.length
                ? ` ${applyResult.failures.length} failure(s) logged.`
                : ''}
            </p>
          </div>
        ) : null}

        <div className="admin-intelligence__actions admin-intelligence-evidence__batch-confirm-actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onPreview}
            disabled={loading || !file}
          >
            {loading ? 'Loading…' : 'Preview import'}
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={onApply}
            disabled={loading || !plan || plan.summary.updated === 0}
          >
            Apply import
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onClose}
            disabled={loading}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ResearchAccordion({
  title,
  status,
  defaultOpen = false,
  children,
}) {
  return (
    <details
      className="admin-intelligence-evidence__research-accordion"
      open={defaultOpen}
    >
      <summary className="admin-intelligence-evidence__research-accordion-summary">
        <span className="admin-intelligence-evidence__research-accordion-title">{title}</span>
        {status ? (
          <span className="admin-intelligence-evidence__research-accordion-status">{status}</span>
        ) : null}
      </summary>
      <div className="admin-intelligence-evidence__research-accordion-content">
        {children}
      </div>
    </details>
  )
}

function ResearchApprovalActions({
  loading,
  approving,
  recommendation,
  approveReady,
  saveReady,
  saveLabel = 'Approve',
  manualFirst = false,
  onApprove,
  onReject,
  onRetry,
  className = '',
}) {
  const ready = saveReady ?? approveReady

  return (
    <div className={`admin-intelligence__actions admin-intelligence-evidence__research-actions${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="admin-intelligence__button admin-intelligence__button--primary"
        onClick={onApprove}
        disabled={loading || approving || !ready}
      >
        {approving ? 'Saving…' : saveLabel}
      </button>
      <button
        type="button"
        className="admin-intelligence__button admin-intelligence__button--secondary"
        onClick={onReject}
        disabled={loading || approving}
      >
        {manualFirst ? 'Skip' : 'Skip / reject'}
      </button>
      {!manualFirst ? (
        <button
          type="button"
          className="admin-intelligence__button admin-intelligence__button--secondary"
          onClick={onRetry}
          disabled={loading || approving}
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

function getAutoSelectedPriceDisplay(recommendation) {
  if (!recommendation) return null

  const price = Number(recommendation.original_new_price ?? recommendation.source_original_price)
  if (!Number.isFinite(price) || price <= 0) return null

  return {
    source: 'auto',
    value: price,
    currency: recommendation.currency || 'GBP',
    confidence: recommendation.price_confidence ?? recommendation.confidence ?? null,
    label: recommendation.v3_metadata?.price_label_detected || 'RRP',
    sourceUrl: recommendation.price_sources_used?.[0] ?? null,
    sourceDomain: recommendation.v3_metadata?.price_source_domain ?? null,
    surroundingText: null,
  }
}

function formatResearchSelectionStatusLabel(recommendation, effectiveApprovalPrice, manualSelectionRequired) {
  if (effectiveApprovalPrice?.source === 'manual_entry') return 'Manual selection'
  if (effectiveApprovalPrice?.source === 'candidate') return 'Admin selected'
  if (manualSelectionRequired) return 'Manual selection required'
  if (recommendation?.v3_metadata?.price_selection_status === 'auto_selected') return 'Auto-selected'
  if (getAutoSelectedPriceDisplay(recommendation)) return 'Auto-selected'
  return 'Missing evidence'
}

function formatResearchSelectionStatusClass(statusLabel) {
  if (statusLabel === 'Auto-selected' || statusLabel === 'Admin selected') return 'ok'
  if (statusLabel === 'Manual selection required' || statusLabel === 'Missing evidence') return 'warning'
  return 'neutral'
}

function renderResearchIdentityCell(item) {
  if (item?.identityScore == null) return '—'
  return (
    <span className={`admin-intelligence-evidence__identity-score admin-intelligence-evidence__identity-score--${item.identityLevel || 'neutral'}`}>
      {item.identityLabel || formatResearchIdentityLevel(item.identityLevel)}
      {' '}
      ({item.identityScore})
    </span>
  )
}

function buildResearchEvidenceLinkRows(structuredPriceEvidence, structuredLifecycleEvidence, priceSelectionState) {
  const priceRows = structuredPriceEvidence
    .filter((item) => getCandidateAdminStatus(item.id, priceSelectionState) !== 'rejected')
    .map((item) => ({
      id: `price-${item.id}`,
      domain: item.sourceDomain || '—',
      evidenceType: item.label || 'Price',
      value: item.value != null ? Number(item.value).toLocaleString('en-GB') : '—',
      confidence: item.confidence,
      identityScore: item.identityScore,
      identityLevel: item.identityLevel,
      identityLabel: item.identityLabel,
      url: item.sourceUrl,
      snippet: item.surroundingText || item.selectionNote || '—',
    }))

  const lifecycleRows = structuredLifecycleEvidence.map((item) => ({
    id: `lifecycle-${item.id}`,
    domain: item.sourceDomain || '—',
    evidenceType: formatLifecycleEvidenceType(item.type) || 'Lifecycle',
    value: item.year != null
      ? `${item.year}${item.yearEnd ? `–${item.yearEnd}` : ''}`
      : '—',
    confidence: item.confidence,
    identityScore: item.identityScore,
    identityLevel: item.identityLevel,
    identityLabel: item.identityLabel,
    url: item.sourceUrl,
    snippet: item.snippet || item.label || '—',
  }))

  return [...priceRows, ...lifecycleRows]
}

function buildFastResearchEvidenceRows(
  structuredPriceEvidence,
  structuredLifecycleEvidence,
  fastSourceHits,
  priceSelectionState,
) {
  const priceRows = structuredPriceEvidence
    .filter((item) => getCandidateAdminStatus(item.id, priceSelectionState) !== 'rejected')
    .map((item) => ({
      id: `price-${item.id}`,
      kind: 'price',
      title: item.surroundingText?.split('\n')[0] || item.label || 'Price',
      domain: item.sourceDomain || '—',
      evidenceType: item.label || 'Price',
      value: item.value != null ? `£${Number(item.value).toLocaleString('en-GB')}` : '—',
      confidence: item.confidence,
      identityScore: item.identityScore,
      identityLevel: item.identityLevel,
      identityLabel: item.identityLabel,
      url: item.sourceUrl,
      snippet: item.surroundingText || item.selectionNote || '—',
      candidateId: item.id,
      lifecycleItem: null,
    }))

  const lifecycleRows = structuredLifecycleEvidence.map((item) => ({
    id: `lifecycle-${item.id}`,
    kind: 'lifecycle',
    title: item.snippet?.split('\n')[0] || item.label || 'Year',
    domain: item.sourceDomain || '—',
    evidenceType: formatLifecycleEvidenceType(item.type) || item.label || 'Year',
    value: item.year != null
      ? `${item.year}${item.yearEnd ? `–${item.yearEnd}` : ''}`
      : '—',
    confidence: item.confidence,
    identityScore: item.identityScore,
    identityLevel: item.identityLevel,
    identityLabel: item.identityLabel,
    url: item.sourceUrl,
    snippet: item.snippet || item.label || '—',
    candidateId: null,
    lifecycleItem: item,
  }))

  const seenUrls = new Set([
    ...priceRows.map((row) => row.url).filter(Boolean),
    ...lifecycleRows.map((row) => row.url).filter(Boolean),
  ])

  const snippetRows = (fastSourceHits ?? [])
    .filter((hit) => hit.url && !seenUrls.has(hit.url))
    .map((hit) => ({
      id: `snippet-${hit.url}`,
      kind: 'snippet',
      title: hit.title || '—',
      domain: hit.domain || '—',
      evidenceType: 'Snippet',
      value: '—',
      confidence: null,
      identityScore: hit.identityScore,
      identityLevel: hit.identityLevel,
      identityLabel: hit.identityLabel,
      url: hit.url,
      snippet: hit.snippet || '—',
      candidateId: null,
      lifecycleItem: null,
    }))

  return [...priceRows, ...lifecycleRows, ...snippetRows]
}

function renderEditableResearchFields(
  priceSelectionState,
  onPriceSelectionFieldChange,
  onApplyManualValues,
  { manualFirst = false } = {},
) {
  const manualValuesReady = hasManualPriceEntryDraft(priceSelectionState)

  return (
    <div className="admin-intelligence-evidence__manual-price-grid admin-intelligence-evidence__manual-price-grid--fast">
      <label className="admin-intelligence-evidence__manual-field">
        <span>RRP</span>
        <input
          type="text"
          inputMode="decimal"
          value={priceSelectionState?.manualPrice ?? ''}
          onChange={(event) => onPriceSelectionFieldChange('manualPrice', event.target.value)}
          placeholder="e.g. 6996"
        />
      </label>
      <label className="admin-intelligence-evidence__manual-field">
        <span>Currency</span>
        <select
          value={priceSelectionState?.manualCurrency ?? 'GBP'}
          onChange={(event) => onPriceSelectionFieldChange('manualCurrency', event.target.value)}
        >
          <option value="GBP">GBP</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label className="admin-intelligence-evidence__manual-field">
        <span>Baseline manufacture year</span>
        <input
          type="number"
          value={priceSelectionState?.manualBaselineYear ?? ''}
          onChange={(event) => onPriceSelectionFieldChange('manualBaselineYear', event.target.value)}
        />
      </label>
      <label className="admin-intelligence-evidence__manual-field">
        <span>Production start year</span>
        <input
          type="number"
          value={priceSelectionState?.manualProductionStart ?? ''}
          onChange={(event) => onPriceSelectionFieldChange('manualProductionStart', event.target.value)}
        />
      </label>
      <label className="admin-intelligence-evidence__manual-field">
        <span>Production end year</span>
        <input
          type="number"
          value={priceSelectionState?.manualProductionEnd ?? ''}
          onChange={(event) => onPriceSelectionFieldChange('manualProductionEnd', event.target.value)}
        />
      </label>
      <label className="admin-intelligence-evidence__manual-field admin-intelligence-evidence__manual-field--wide">
        <span>Source URL</span>
        <input
          type="text"
          value={priceSelectionState?.manualSourceUrl ?? ''}
          onChange={(event) => onPriceSelectionFieldChange('manualSourceUrl', event.target.value)}
          placeholder="https://dealer.example/product"
        />
      </label>
      <label className="admin-intelligence-evidence__manual-field admin-intelligence-evidence__manual-field--wide">
        <span>Notes</span>
        <input
          type="text"
          value={priceSelectionState?.manualNotes ?? ''}
          onChange={(event) => onPriceSelectionFieldChange('manualNotes', event.target.value)}
          placeholder="Why this RRP/year was chosen"
        />
      </label>
      {!manualFirst && manualValuesReady ? (
        <div className="admin-intelligence-evidence__manual-actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onApplyManualValues}
          >
            Use manual values
          </button>
        </div>
      ) : null}
    </div>
  )
}

function renderResearchSourceTable(sources) {
  if (!sources.length) {
    return <p className="admin-intelligence-evidence__research-text">No sources were passed to OpenAI.</p>
  }

  return (
    <div className="admin-intelligence__table-wrap">
      <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Domain</th>
            <th>Source type</th>
            <th>Evidence</th>
            <th>URL</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.url}>
              <td>{source.title}</td>
              <td>{source.domain || '—'}</td>
              <td>{formatResearchSourceTypeLabel(source.source_type)}</td>
              <td>{formatResearchHitEvidenceSummary(source)}</td>
              <td>
                <a href={source.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResearchRecommendationModal({
  open,
  loading,
  error,
  equipmentLabel,
  researchMeta,
  recommendation,
  currentEquipment,
  batchLabel,
  canonicalContext,
  manualFirst = false,
  canonicalProductName = '',
  approving,
  saveMessage,
  priceSelectionState,
  researchEngineMode,
  requestEngine,
  onSelectPriceCandidate,
  onSelectYearCandidate,
  onRejectPriceCandidate,
  onMarkUsedRefurbCandidate,
  onPriceSelectionFieldChange,
  canApprove,
  onApprove,
  onReject,
  onRetry,
  onApplyManualValues,
  onFindEvidenceLinks,
}) {
  if (!open) return null

  const approvalDiff = recommendation
    ? buildResearchApprovalDiff(currentEquipment, recommendation)
    : null

  const priceInputSources = getResearchPriceInputSources(researchMeta)
  const lifecycleInputSources = getResearchLifecycleInputSources(researchMeta)
  const aiInputSources = getResearchAiInputSources(researchMeta)
  const aiCitedSources = getResearchAiCitedSources(recommendation)
  const hasAiCitations = aiCitedSources.length > 0
  const priceCurrencyDebug = getResearchPriceCurrencyDebug(researchMeta)
  const structuredPriceEvidence = getResearchStructuredPriceEvidence(researchMeta)
  const structuredLifecycleEvidence = getResearchStructuredLifecycleEvidence(researchMeta)
  const fastSourceHits = getResearchFastSourceHits(researchMeta)
  const isFastMode = manualFirst
    || researchEngineMode === EQUIPMENT_RESEARCH_ENGINE.FAST
    || isFastResearchMode(researchMeta, recommendation)
  const v3Metadata = getResearchV3Metadata(researchMeta, recommendation)
  const trustedSourceSummary = getResearchV3TrustedSourceSummary(researchMeta)
  const lifecycleQueryDebug = getResearchLifecycleQueryDebug(researchMeta)
  const targetedLifecycleQueries = getResearchTargetedLifecycleQueries(researchMeta)
  const officialPriceDetails = recommendation
    ? getResearchOfficialPriceDetails(recommendation)
    : null
  const nonGbpCurrencyWarning = officialPriceDetails?.usdReviewWarning
    || (isNonGbpResearchPrice(recommendation)
      ? 'Non-GBP price detected — review before saving.'
      : null)
  const researchPriceReviewStatus = deriveResearchPriceReviewStatus(recommendation)
  const manualSelectionRequired = isResearchManualSelectionRequired(recommendation) || isFastMode
  const aiAdvisoryPrice = getAiAdvisoryPrice(recommendation)
  const aiAdvisoryConfidence = getAiAdvisoryConfidence(recommendation)
  const effectiveApprovalPrice = resolveEffectiveApprovalPrice(priceSelectionState, structuredPriceEvidence)
  const saveReady = canApprove
  const googleSearchUrls = manualFirst
    ? buildCanonicalGoogleSearchUrls(canonicalProductName || equipmentLabel)
    : null
  const showResearchBody = !loading && !error && (manualFirst || recommendation)

  const rejectedPriceCandidates = structuredPriceEvidence.filter((item) => (
    getCandidateAdminStatus(item.id, priceSelectionState) === 'rejected'
  ))
  const usedRefurbCandidates = structuredPriceEvidence.filter((item) => (
    getCandidateAdminStatus(item.id, priceSelectionState) === 'used_refurb'
  ))
  const visiblePriceCandidates = structuredPriceEvidence.filter((item) => {
    const status = getCandidateAdminStatus(item.id, priceSelectionState)
    return status !== 'rejected'
  })
  const fastEvidenceRows = isFastMode
    ? buildFastResearchEvidenceRows(
      structuredPriceEvidence,
      structuredLifecycleEvidence,
      fastSourceHits,
      priceSelectionState,
    )
    : []
  const evidenceLinkRows = isFastMode
    ? []
    : buildResearchEvidenceLinkRows(
      structuredPriceEvidence,
      structuredLifecycleEvidence,
      priceSelectionState,
    )
  const sourceIdentityScores = getResearchSourceIdentityScores(researchMeta)
  const summaryPrice = effectiveApprovalPrice ?? getAutoSelectedPriceDisplay(recommendation)
  const selectionStatusLabel = formatResearchSelectionStatusLabel(
    recommendation,
    effectiveApprovalPrice,
    manualSelectionRequired,
  )
  const selectionStatusClass = formatResearchSelectionStatusClass(selectionStatusLabel)
  const summaryBaselineYear = priceSelectionState?.manualBaselineYear
    || recommendation?.baseline_manufacture_year
  const summaryProductionStart = priceSelectionState?.manualProductionStart
    || recommendation?.production_start_year
  const summaryProductionEnd = priceSelectionState?.manualProductionEnd
    || recommendation?.production_end_year
  const summarySourceUrl = summaryPrice?.sourceUrl
    || recommendation?.price_sources_used?.[0]
    || null
  const summarySourceDomain = summaryPrice?.sourceDomain
    || (summarySourceUrl ? (() => {
      try {
        return new URL(summarySourceUrl).hostname
      } catch {
        return null
      }
    })() : null)
  const showManualEntry = manualSelectionRequired || hasManualPriceEntryDraft(priceSelectionState)
  const manualValuesReady = hasManualPriceEntryDraft(priceSelectionState)

  return (
    <div
      className="admin-intelligence__modal-backdrop"
      role="presentation"
      onClick={onReject}
    >
      <div
        className="admin-intelligence__modal admin-intelligence-evidence__research-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-research-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="equipment-research-modal-title" className="admin-intelligence__modal-title">
          {manualFirst ? 'Canonical product data' : (canonicalContext ? 'Canonical product research' : 'Research recommendation')}
        </h2>
        {!manualFirst ? (
          <>
            <p className="admin-intelligence-evidence__research-engine-label">
              Engine: {formatResearchEngineLabel(requestEngine || researchEngineMode)}
            </p>
            <p className="admin-intelligence-evidence__research-engine-debug" role="status">
              Request engine: {requestEngine || researchEngineMode || EQUIPMENT_RESEARCH_ENGINE.FAST}
            </p>
          </>
        ) : null}
        <p className="admin-intelligence__modal-lead">
          {equipmentLabel}
          {batchLabel ? ` · ${batchLabel}` : ''}
        </p>
        {canonicalContext ? (
          <div className="admin-intelligence-evidence__canonical-context">
            <span className="admin-intelligence-evidence__canonical-context-label">Canonical product</span>
            <div className="admin-intelligence-evidence__canonical-context-meta">
              <span>Status: <strong>{canonicalContext.productStatus}</strong></span>
              <span>Source rows: <strong>{canonicalContext.sourceRowCount}</strong></span>
              {canonicalContext.completionStatus ? (
                <span>
                  Completion: <CompletionBadge status={canonicalContext.completionStatus} />
                </span>
              ) : null}
              {canonicalContext.productStatus === PRODUCT_STATUS.APPROVED ? (
                <span className="admin-intelligence-evidence__canonical-protected">Approved — manual/verified fields protected on approve</span>
              ) : null}
            </div>
            {canonicalContext.completionReason ? (
              <p className="admin-intelligence-evidence__completion-reason">{canonicalContext.completionReason}</p>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <LoadingState compact>
            {manualFirst
              ? 'Searching trusted UK sources for evidence links…'
              : (isFastMode
                ? 'Searching trusted UK sources (snippet only)…'
                : 'Running SerpAPI searches, reading pages, and extracting with AI…')}
          </LoadingState>
        ) : null}

        {error ? <ErrorState compact>{error}</ErrorState> : null}
        {saveMessage ? (
          <p className="admin-intelligence-evidence__research-saved" role="status">{saveMessage}</p>
        ) : null}

        <div className="admin-intelligence-evidence__research-modal-body">
        {manualFirst && !loading ? (
          <section className="admin-intelligence-evidence__research-manual-panel admin-intelligence-evidence__research-manual-panel--primary">
            <h3 className="admin-intelligence-evidence__section-title">Product data</h3>
            <p className="admin-intelligence-evidence__research-meta-line">
              Enter RRP and baseline year manually, paste a source link, then save. Research is optional.
            </p>
            {renderEditableResearchFields(
              priceSelectionState,
              onPriceSelectionFieldChange,
              onApplyManualValues,
              { manualFirst: true },
            )}
            {googleSearchUrls ? (
              <div className="admin-intelligence__actions admin-intelligence-evidence__google-search-actions">
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={() => window.open(googleSearchUrls.rrp, '_blank', 'noopener,noreferrer')}
                >
                  Open Google search (RRP)
                </button>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={() => window.open(googleSearchUrls.year, '_blank', 'noopener,noreferrer')}
                >
                  Open Google search (year)
                </button>
              </div>
            ) : null}
            <ResearchApprovalActions
              loading={loading}
              approving={approving}
              recommendation={recommendation}
              saveReady={saveReady}
              saveLabel="Save product data"
              manualFirst
              onApprove={onApprove}
              onReject={onReject}
              onRetry={onRetry}
              className="admin-intelligence-evidence__research-actions--summary"
            />
            {onFindEvidenceLinks ? (
              <div className="admin-intelligence-evidence__manual-actions">
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={onFindEvidenceLinks}
                  disabled={loading || approving}
                >
                  Find evidence links
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {showResearchBody ? (
          <>
            {!manualFirst ? (
            <section className="admin-intelligence-evidence__research-summary-panel">
              <div className="admin-intelligence-evidence__summary-grid">
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Product</span>
                  <strong>{equipmentLabel}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Suggested / selected RRP</span>
                  <strong className="admin-intelligence-evidence__research-value admin-intelligence-evidence__research-value--summary">
                    {summaryPrice
                      ? formatEffectiveApprovalPrice(summaryPrice)
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Currency</span>
                  <strong>{summaryPrice?.currency || recommendation.currency || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Confidence</span>
                  <strong>
                    {summaryPrice?.confidence != null
                      ? `${summaryPrice.confidence}%`
                      : '—'}
                  </strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Baseline manufacture year</span>
                  <strong>{summaryBaselineYear || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Production start</span>
                  <strong>{summaryProductionStart || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Production end</span>
                  <strong>{summaryProductionEnd || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Source domain</span>
                  <strong>{summarySourceDomain || '—'}</strong>
                </div>
                <div className="admin-intelligence-evidence__summary-field-wide">
                  <span className="admin-intelligence-evidence__summary-label">Source URL</span>
                  {summarySourceUrl ? (
                    <a href={summarySourceUrl} target="_blank" rel="noreferrer">
                      {summarySourceUrl}
                    </a>
                  ) : (
                    <strong>—</strong>
                  )}
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Selection status</span>
                  <span className={`admin-intelligence-evidence__selection-status admin-intelligence-evidence__selection-status--${selectionStatusClass}`}>
                    {selectionStatusLabel}
                  </span>
                </div>
              </div>

              {isFastMode ? (
                <>
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Fast trusted-source research — SerpAPI snippets only. Choose RRP/year evidence or enter values manually.
                  </p>
                  {renderEditableResearchFields(
                    priceSelectionState,
                    onPriceSelectionFieldChange,
                    onApplyManualValues,
                  )}
                </>
              ) : null}

              {nonGbpCurrencyWarning ? (
                <p className="admin-intelligence-evidence__research-warning" role="status">
                  {nonGbpCurrencyWarning}
                </p>
              ) : null}

              {officialPriceDetails?.isOfficialUsd && !manualSelectionRequired ? (
                <p className="admin-intelligence-evidence__research-meta-line">
                  Official {formatResearchOfficialSourcePrice(recommendation)}
                  {' → '}
                  GBP {formatResearchSuggestedGbpEquivalent(recommendation)}
                </p>
              ) : null}

              <ResearchApprovalActions
                loading={loading}
                approving={approving}
                recommendation={recommendation}
                saveReady={saveReady}
                onApprove={onApprove}
                onReject={onReject}
                onRetry={onRetry}
                className="admin-intelligence-evidence__research-actions--summary"
              />
            </section>
            ) : null}

            {!manualFirst && manualSelectionRequired && !isFastMode ? (
              <section className="admin-intelligence-evidence__research-manual-panel">
                <h3 className="admin-intelligence-evidence__section-title">Manual RRP selection required</h3>
                <p className="admin-intelligence-evidence__research-warning" role="status">
                  {formatManualSelectionRequiredMessage(recommendation, structuredPriceEvidence)}
                </p>

                <div className="admin-intelligence-evidence__research-section">
                  <h4 className="admin-intelligence-evidence__subsection-title">AI suggestion (advisory only)</h4>
                  <p className="admin-intelligence-evidence__research-meta-line">
                    {aiAdvisoryPrice != null
                      ? `£${Number(aiAdvisoryPrice).toLocaleString('en-GB')}`
                      : 'No AI price suggestion'}
                    {aiAdvisoryConfidence != null ? ` · AI confidence ${aiAdvisoryConfidence}%` : ''}
                  </p>
                </div>

                {visiblePriceCandidates.length > 0 ? (
                  <div className="admin-intelligence__table-wrap">
                    <table className="admin-intelligence__table admin-intelligence-evidence__sources-table admin-intelligence-evidence__candidate-table">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>Source</th>
                          <th>Value</th>
                          <th>Confidence</th>
                          <th>Identity</th>
                          <th>Snippet</th>
                          <th>URL</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiblePriceCandidates.map((item) => {
                          const adminStatus = getCandidateAdminStatus(item.id, priceSelectionState)
                          return (
                            <tr
                              key={item.id}
                              className={adminStatus === 'selected'
                                ? 'admin-intelligence-evidence__price-row--selected'
                                : adminStatus === 'used_refurb'
                                  ? 'admin-intelligence-evidence__price-row--used'
                                  : undefined}
                            >
                              <td>{item.label}</td>
                              <td>{item.sourceDomain}</td>
                              <td>{item.value?.toLocaleString?.('en-GB') ?? item.value}</td>
                              <td>{item.confidence}%</td>
                              <td>{renderResearchIdentityCell(item)}</td>
                              <td className="admin-intelligence-evidence__snippet-cell">
                                {item.surroundingText || item.selectionNote || '—'}
                              </td>
                              <td>
                                {item.sourceUrl ? (
                                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open</a>
                                ) : '—'}
                              </td>
                              <td className="admin-intelligence-evidence__candidate-actions">
                                <button
                                  type="button"
                                  className="admin-intelligence__button admin-intelligence__button--secondary"
                                  disabled={adminStatus === 'used_refurb' || item.confidence <= 0}
                                  onClick={() => onSelectPriceCandidate(item.id)}
                                >
                                  {adminStatus === 'selected' ? 'Selected' : 'Select as original RRP'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-intelligence__button admin-intelligence__button--secondary"
                                  onClick={() => onRejectPriceCandidate(item.id)}
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="admin-intelligence__button admin-intelligence__button--secondary"
                                  onClick={() => onMarkUsedRefurbCandidate(item.id)}
                                >
                                  Used/refurbished
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-intelligence-evidence__research-text">No structured price candidates captured.</p>
                )}

                <div className="admin-intelligence-evidence__manual-price-grid">
                  <label className="admin-intelligence-evidence__manual-field">
                    <span>Original RRP</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceSelectionState?.manualPrice ?? ''}
                      onChange={(event) => onPriceSelectionFieldChange('manualPrice', event.target.value)}
                      placeholder="e.g. 6996"
                    />
                  </label>
                  <label className="admin-intelligence-evidence__manual-field">
                    <span>Currency</span>
                    <select
                      value={priceSelectionState?.manualCurrency ?? 'GBP'}
                      onChange={(event) => onPriceSelectionFieldChange('manualCurrency', event.target.value)}
                    >
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <label className="admin-intelligence-evidence__manual-field">
                    <span>Baseline year</span>
                    <input
                      type="number"
                      value={priceSelectionState?.manualBaselineYear ?? ''}
                      onChange={(event) => onPriceSelectionFieldChange('manualBaselineYear', event.target.value)}
                    />
                  </label>
                  <label className="admin-intelligence-evidence__manual-field">
                    <span>Production start</span>
                    <input
                      type="number"
                      value={priceSelectionState?.manualProductionStart ?? ''}
                      onChange={(event) => onPriceSelectionFieldChange('manualProductionStart', event.target.value)}
                    />
                  </label>
                  <label className="admin-intelligence-evidence__manual-field">
                    <span>Production end</span>
                    <input
                      type="number"
                      value={priceSelectionState?.manualProductionEnd ?? ''}
                      onChange={(event) => onPriceSelectionFieldChange('manualProductionEnd', event.target.value)}
                    />
                  </label>
                  <label className="admin-intelligence-evidence__manual-field admin-intelligence-evidence__manual-field--wide">
                    <span>Source URL / notes</span>
                    <input
                      type="text"
                      value={priceSelectionState?.manualSourceUrl ?? ''}
                      onChange={(event) => onPriceSelectionFieldChange('manualSourceUrl', event.target.value)}
                      placeholder="https://dealer.example/product"
                    />
                  </label>
                  <label className="admin-intelligence-evidence__manual-field admin-intelligence-evidence__manual-field--wide">
                    <span>Notes</span>
                    <input
                      type="text"
                      value={priceSelectionState?.manualNotes ?? ''}
                      onChange={(event) => onPriceSelectionFieldChange('manualNotes', event.target.value)}
                      placeholder="Why this RRP was chosen"
                    />
                  </label>
                </div>

                {showManualEntry ? (
                  <div className="admin-intelligence-evidence__manual-actions">
                    <button
                      type="button"
                      className="admin-intelligence__button admin-intelligence__button--secondary"
                      disabled={!manualValuesReady}
                      onClick={onApplyManualValues}
                    >
                      Use manual values
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {(manualFirst && researchMeta) || !manualFirst ? (
            <section className="admin-intelligence-evidence__research-evidence-links">
              <h3 className="admin-intelligence-evidence__section-title">
                {manualFirst ? 'Evidence links (optional)' : (isFastMode ? 'Trusted-source evidence' : 'Evidence links')}
              </h3>
              {manualFirst && !researchMeta ? (
                <p className="admin-intelligence-evidence__research-text">
                  No evidence links loaded yet. Use Find evidence links if you want trusted-source snippets.
                </p>
              ) : null}
              {isFastMode ? (
                fastEvidenceRows.length > 0 ? (
                  <div className="admin-intelligence__table-wrap">
                    <table className="admin-intelligence__table admin-intelligence-evidence__sources-table admin-intelligence-evidence__evidence-links-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Domain</th>
                          <th>Type</th>
                          <th>Value</th>
                          <th>Identity</th>
                          <th>Snippet</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fastEvidenceRows.map((row) => (
                          <tr key={row.id}>
                            <td>{row.title}</td>
                            <td>{row.domain}</td>
                            <td>{row.evidenceType}</td>
                            <td>{row.value}</td>
                            <td>
                              {row.identityScore != null ? (
                                <span className={`admin-intelligence-evidence__identity-score admin-intelligence-evidence__identity-score--${row.identityLevel || 'neutral'}`}>
                                  {row.identityLabel || formatResearchIdentityLevel(row.identityLevel)}
                                  {' '}
                                  ({row.identityScore})
                                </span>
                              ) : '—'}
                            </td>
                            <td className="admin-intelligence-evidence__snippet-cell">{row.snippet}</td>
                            <td className="admin-intelligence-evidence__candidate-actions">
                              {row.kind === 'price' && row.candidateId ? (
                                <button
                                  type="button"
                                  className="admin-intelligence__button admin-intelligence__button--secondary"
                                  onClick={() => onSelectPriceCandidate(row.candidateId)}
                                >
                                  Use price
                                </button>
                              ) : null}
                              {row.kind === 'lifecycle' && row.lifecycleItem ? (
                                <button
                                  type="button"
                                  className="admin-intelligence__button admin-intelligence__button--secondary"
                                  onClick={() => onSelectYearCandidate(row.lifecycleItem)}
                                >
                                  Use year
                                </button>
                              ) : null}
                              {row.url ? (
                                <a
                                  href={row.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="admin-intelligence-evidence__open-link"
                                >
                                  Open link
                                </a>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-intelligence-evidence__research-text">No trusted-source snippet evidence returned.</p>
                )
              ) : evidenceLinkRows.length > 0 ? (
                <div className="admin-intelligence__table-wrap">
                  <table className="admin-intelligence__table admin-intelligence-evidence__sources-table admin-intelligence-evidence__evidence-links-table">
                    <thead>
                      <tr>
                        <th>Domain</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Confidence</th>
                        <th>Identity</th>
                        <th>Link</th>
                        <th>Snippet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidenceLinkRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.domain}</td>
                          <td>{row.evidenceType}</td>
                          <td>{row.value}</td>
                          <td>{row.confidence != null ? `${row.confidence}%` : '—'}</td>
                          <td>
                            {row.identityScore != null ? (
                              <span className={`admin-intelligence-evidence__identity-score admin-intelligence-evidence__identity-score--${row.identityLevel || 'neutral'}`}>
                                {row.identityLabel || formatResearchIdentityLevel(row.identityLevel)}
                                {' '}
                                ({row.identityScore})
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            {row.url ? (
                              <a href={row.url} target="_blank" rel="noreferrer">Open</a>
                            ) : '—'}
                          </td>
                          <td className="admin-intelligence-evidence__snippet-cell">{row.snippet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-intelligence-evidence__research-text">No structured evidence links captured.</p>
              )}
            </section>
            ) : null}

            {!manualFirst && !isFastMode ? (
            <div className="admin-intelligence-evidence__research-accordions">
              {sourceIdentityScores.length > 0 ? (
                <ResearchAccordion
                  title="Source identity scores"
                  status={`${sourceIdentityScores.length} sources`}
                >
                  <div className="admin-intelligence__table-wrap">
                    <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
                      <thead>
                        <tr>
                          <th>Domain</th>
                          <th>Title</th>
                          <th>Identity</th>
                          <th>Accepted</th>
                          <th>URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceIdentityScores.map((entry) => (
                          <tr key={entry.url}>
                            <td>{entry.domain || '—'}</td>
                            <td>{entry.title || '—'}</td>
                            <td>
                              <span className={`admin-intelligence-evidence__identity-score admin-intelligence-evidence__identity-score--${entry.level || 'neutral'}`}>
                                {entry.label || formatResearchIdentityLevel(entry.level)}
                              </span>
                            </td>
                            <td>{entry.accepted ? 'Yes' : 'No'}</td>
                            <td>
                              {entry.url ? (
                                <a href={entry.url} target="_blank" rel="noreferrer">Open</a>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ResearchAccordion>
              ) : null}
              {approvalDiff?.showDiff ? (
                <ResearchAccordion title="Changes from current values" status="Review">
                  <div className="admin-intelligence-evidence__approval-diff admin-intelligence-evidence__approval-diff--inline">
                    {approvalDiff.priceChanged || approvalDiff.current.hasOriginalPrice ? (
                      <div className="admin-intelligence-evidence__diff-block">
                        <div className="admin-intelligence-evidence__diff-label">Original new price</div>
                        <div className="admin-intelligence-evidence__diff-row">
                          <span>Current</span>
                          <strong>{approvalDiff.current.originalPriceLabel}</strong>
                        </div>
                        <div className="admin-intelligence-evidence__diff-arrow">↓</div>
                        <div className="admin-intelligence-evidence__diff-row">
                          <span>Suggested</span>
                          <strong>{approvalDiff.suggested.originalPriceLabel}</strong>
                        </div>
                        {approvalDiff.priceDifferenceLabel ? (
                          <p className="admin-intelligence-evidence__research-meta-line">
                            Difference: {approvalDiff.priceDifferenceLabel}
                          </p>
                        ) : (
                          <p className="admin-intelligence-evidence__research-meta-line">No price change</p>
                        )}
                      </div>
                    ) : null}
                    {approvalDiff.productionChanged
                      || (approvalDiff.current.hasProductionPeriod
                        && (recommendation?.production_start_year != null
                          || recommendation?.production_end_year != null)) ? (
                      <div className="admin-intelligence-evidence__diff-block">
                        <div className="admin-intelligence-evidence__diff-label">Production period</div>
                        <div className="admin-intelligence-evidence__diff-row">
                          <span>Current</span>
                          <strong>{approvalDiff.current.productionPeriodLabel}</strong>
                        </div>
                        <div className="admin-intelligence-evidence__diff-arrow">↓</div>
                        <div className="admin-intelligence-evidence__diff-row">
                          <span>Suggested</span>
                          <strong>{approvalDiff.suggested.productionPeriodLabel}</strong>
                        </div>
                        {approvalDiff.productionDifferenceLabel ? (
                          <p className="admin-intelligence-evidence__research-meta-line">
                            Difference: {approvalDiff.productionDifferenceLabel}
                          </p>
                        ) : (
                          <p className="admin-intelligence-evidence__research-meta-line">No production change</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </ResearchAccordion>
              ) : null}

              {trustedSourceSummary.length > 0 ? (
                <ResearchAccordion
                  title="Trusted dealer summary"
                  status={`${trustedSourceSummary.length} domains`}
                >
                  <ul className="admin-intelligence-evidence__trusted-source-list">
                    {trustedSourceSummary.map((entry) => (
                      <li key={entry.domain}>
                        <strong>{entry.domain}</strong>
                        {' — '}
                        {formatTrustedSourceSummaryEntry(entry)}
                      </li>
                    ))}
                  </ul>
                </ResearchAccordion>
              ) : null}

              <ResearchAccordion
                title="Structured price evidence details"
                status={`${structuredPriceEvidence.length} items`}
              >
                {v3Metadata ? (
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Engine V3 ·
                    {' '}
                    {v3Metadata.price_inference_method === 'structured_extraction'
                      ? 'Structured extraction'
                      : 'AI inference'}
                    {' · '}
                    {manualSelectionRequired ? 'Manual selection required' : `Label ${v3Metadata.price_label_detected || '—'}`}
                  </p>
                ) : (
                  <p className="admin-intelligence-evidence__research-meta-line">Legacy V2 research path.</p>
                )}
                {structuredPriceEvidence.length > 0 ? (
                  <div className="admin-intelligence__table-wrap">
                    <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>Source</th>
                          <th>Value</th>
                          <th>Confidence</th>
                          <th>Identity</th>
                          <th>Snippet</th>
                          <th>URL</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {structuredPriceEvidence.map((item) => (
                          <tr key={item.id}>
                            <td>{item.label}</td>
                            <td>{item.sourceDomain}</td>
                            <td>{item.value?.toLocaleString?.('en-GB') ?? item.value}</td>
                            <td>{item.confidence}%</td>
                            <td>{renderResearchIdentityCell(item)}</td>
                            <td className="admin-intelligence-evidence__snippet-cell">
                              {item.surroundingText || item.selectionNote || '—'}
                            </td>
                            <td>
                              {item.sourceUrl ? (
                                <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open</a>
                              ) : '—'}
                            </td>
                            <td>{getCandidateAdminStatus(item.id, priceSelectionState) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-intelligence-evidence__research-text">No structured price evidence captured.</p>
                )}
              </ResearchAccordion>

              <ResearchAccordion
                title="Structured lifecycle evidence details"
                status={`${structuredLifecycleEvidence.length} items`}
              >
                {structuredLifecycleEvidence.length > 0 ? (
                  <div className="admin-intelligence__table-wrap">
                    <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Type</th>
                          <th>Domain</th>
                          <th>Snippet</th>
                          <th>Confidence</th>
                          <th>Baseline?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {structuredLifecycleEvidence.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {item.year ?? '—'}
                              {item.yearEnd ? `–${item.yearEnd}` : ''}
                            </td>
                            <td>{formatLifecycleEvidenceType(item.type)}</td>
                            <td>{item.sourceDomain}</td>
                            <td>{item.snippet || item.label || '—'}</td>
                            <td>{item.confidence}%</td>
                            <td>{item.affectsBaseline ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-intelligence-evidence__research-text">No structured lifecycle evidence captured.</p>
                )}
                {recommendation?.lifecycle_notes ? (
                  <p className="admin-intelligence-evidence__research-text">{recommendation.lifecycle_notes}</p>
                ) : null}
              </ResearchAccordion>

              {lifecycleQueryDebug.length > 0 ? (
                <ResearchAccordion
                  title="Lifecycle search debug"
                  status={`${targetedLifecycleQueries.length} queries`}
                >
                  <ul className="admin-intelligence-evidence__trusted-source-list">
                    {lifecycleQueryDebug.map((entry) => (
                      <li key={entry.query}>
                        <strong>{entry.query}</strong>
                        {' — '}
                        {entry.result_count} result{entry.result_count === 1 ? '' : 's'}
                        {entry.snippets?.length ? (
                          <ul className="admin-intelligence-evidence__lifecycle-snippet-list">
                            {entry.snippets.map((snippet) => (
                              <li key={snippet.url}>
                                [{snippet.domain}] {snippet.title}
                                {snippet.snippet ? ` — ${snippet.snippet}` : ''}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </ResearchAccordion>
              ) : null}

              {(rejectedPriceCandidates.length > 0 || usedRefurbCandidates.length > 0) ? (
                <ResearchAccordion
                  title="Rejected / used-refurb candidates"
                  status={`${rejectedPriceCandidates.length + usedRefurbCandidates.length} items`}
                >
                  <div className="admin-intelligence__table-wrap">
                    <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>Source</th>
                          <th>Value</th>
                          <th>Status</th>
                          <th>Snippet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...rejectedPriceCandidates, ...usedRefurbCandidates].map((item) => (
                          <tr key={item.id}>
                            <td>{item.label}</td>
                            <td>{item.sourceDomain}</td>
                            <td>{item.value?.toLocaleString?.('en-GB') ?? item.value}</td>
                            <td>{getCandidateAdminStatus(item.id, priceSelectionState)}</td>
                            <td className="admin-intelligence-evidence__snippet-cell">
                              {item.surroundingText || item.selectionNote || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ResearchAccordion>
              ) : null}

              <ResearchAccordion title="Diagnostics and debug logs">
                {researchMeta?.debug_log?.serp_warning ? (
                  <p className="admin-intelligence-evidence__research-warning" role="status">
                    {researchMeta.debug_log.serp_warning}
                  </p>
                ) : null}
                {priceCurrencyDebug ? (
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Currency debug:
                    {' '}
                    detected {priceCurrencyDebug.detected_currencies?.length
                      ? priceCurrencyDebug.detected_currencies.join(', ')
                      : '—'}
                    {' · '}
                    selected {priceCurrencyDebug.selected_currency || recommendation?.currency || '—'}
                    {' · '}
                    GBP sources {priceCurrencyDebug.gbp_source_count ?? 0}
                    {' · '}
                    non-GBP sources {priceCurrencyDebug.non_gbp_source_count ?? 0}
                  </p>
                ) : null}
                {researchMeta?.debug_log ? (
                  <p className="admin-intelligence-evidence__research-meta">
                    {researchMeta.research_engine === 'v3' || researchMeta.debug_log.research_engine === 'v3'
                      ? 'V3 structured'
                      : (researchMeta.debug_log.research_stage === 'stage_2' ? 'V2 Stage 2' : 'V2 Stage 1')}
                    {' · '}
                    {researchMeta.debug_log.timings?.total_execution_ms ?? researchMeta.debug_log.duration_ms ?? 0}ms total
                    {' · '}
                    Serp {researchMeta.debug_log.timings?.serp_total_ms ?? 0}ms
                    {' · '}
                    {researchMeta.debug_log.searches_executed?.length ?? 0} searches ·
                    {' '}
                    {researchMeta.debug_log.sources_sent_to_ai ?? researchMeta.ai_input_sources?.length ?? 0} sent to AI ·
                    {' '}
                    {researchMeta.debug_log.sources_returned ?? 0} found ·
                    {' '}
                    {researchMeta.debug_log.sources_successfully_read ?? 0} pages read
                  </p>
                ) : researchMeta ? (
                  <p className="admin-intelligence-evidence__research-meta">
                    {researchMeta.queries_run?.length ?? 0} searches · {researchMeta.deduped_result_count ?? 0} results analysed
                  </p>
                ) : null}
                <div className="admin-intelligence-evidence__research-section">
                  <h4 className="admin-intelligence-evidence__subsection-title">Overall confidence</h4>
                  <p className="admin-intelligence-evidence__research-meta-line">
                    {recommendation.confidence ?? 0}%
                    {recommendation.confidence_reasoning || recommendation.reasoning
                      ? ` — ${recommendation.confidence_reasoning || recommendation.reasoning}`
                      : ''}
                  </p>
                </div>
                <div className="admin-intelligence-evidence__research-section">
                  <h4 className="admin-intelligence-evidence__subsection-title">Price reasoning</h4>
                  <p className="admin-intelligence-evidence__research-text">
                    {recommendation.price_reasoning || recommendation.reasoning || '—'}
                  </p>
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Review status: {formatEvidenceStatusLabel(researchPriceReviewStatus)}
                  </p>
                </div>
                <div className="admin-intelligence-evidence__research-section">
                  <h4 className="admin-intelligence-evidence__subsection-title">Production reasoning</h4>
                  <p className="admin-intelligence-evidence__research-text">
                    {recommendation.production_reasoning || recommendation.reasoning || '—'}
                  </p>
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Production confidence: {recommendation.production_confidence ?? recommendation.confidence ?? 0}%
                  </p>
                </div>
              </ResearchAccordion>

              <ResearchAccordion
                title="Raw source summaries"
                status={`${priceInputSources.length + lifecycleInputSources.length} sources`}
              >
                <div className="admin-intelligence-evidence__research-block">
                  <h4 className="admin-intelligence-evidence__subsection-title">Sources used for price</h4>
                  {hasAiCitations ? (
                    <p className="admin-intelligence-evidence__research-meta-line">
                      AI cited {aiCitedSources.length} source{aiCitedSources.length === 1 ? '' : 's'} overall.
                    </p>
                  ) : (
                    <p className="admin-intelligence-evidence__research-meta-line">
                      AI returned no citations; showing the price evidence sent for analysis.
                    </p>
                  )}
                  {renderResearchSourceTable(priceInputSources.length ? priceInputSources : aiInputSources)}
                </div>
                <div className="admin-intelligence-evidence__research-block">
                  <h4 className="admin-intelligence-evidence__subsection-title">Sources used for production/lifecycle</h4>
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Lifecycle searches:
                    {' '}
                    {researchMeta?.debug_log?.lifecycle_search_queries?.length
                      ?? researchMeta?.lifecycle_search_queries?.length
                      ?? 0}
                    {' '}
                    · Specialist support:
                    {' '}
                    {researchMeta?.debug_log?.specialist_support_queries?.length ?? 0}
                    {' '}
                    ·
                    {' '}
                    {researchMeta?.debug_log?.lifecycle_sources_returned
                      ?? researchMeta?.lifecycle_sources_returned
                      ?? lifecycleInputSources.length}
                    {' '}
                    lifecycle sources
                  </p>
                  {renderResearchSourceTable(lifecycleInputSources)}
                </div>
              </ResearchAccordion>

              {!manualSelectionRequired ? (
                <ResearchAccordion title="Manual price override">
                  <p className="admin-intelligence-evidence__research-meta-line">
                    Override the auto-selected RRP or lifecycle years before approving.
                  </p>
                  <div className="admin-intelligence-evidence__manual-price-grid">
                    <label className="admin-intelligence-evidence__manual-field">
                      <span>Original RRP</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={priceSelectionState?.manualPrice ?? ''}
                        onChange={(event) => onPriceSelectionFieldChange('manualPrice', event.target.value)}
                        placeholder="e.g. 6996"
                      />
                    </label>
                    <label className="admin-intelligence-evidence__manual-field">
                      <span>Currency</span>
                      <select
                        value={priceSelectionState?.manualCurrency ?? 'GBP'}
                        onChange={(event) => onPriceSelectionFieldChange('manualCurrency', event.target.value)}
                      >
                        <option value="GBP">GBP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </label>
                    <label className="admin-intelligence-evidence__manual-field">
                      <span>Baseline year</span>
                      <input
                        type="number"
                        value={priceSelectionState?.manualBaselineYear ?? ''}
                        onChange={(event) => onPriceSelectionFieldChange('manualBaselineYear', event.target.value)}
                      />
                    </label>
                    <label className="admin-intelligence-evidence__manual-field">
                      <span>Production start</span>
                      <input
                        type="number"
                        value={priceSelectionState?.manualProductionStart ?? ''}
                        onChange={(event) => onPriceSelectionFieldChange('manualProductionStart', event.target.value)}
                      />
                    </label>
                    <label className="admin-intelligence-evidence__manual-field">
                      <span>Production end</span>
                      <input
                        type="number"
                        value={priceSelectionState?.manualProductionEnd ?? ''}
                        onChange={(event) => onPriceSelectionFieldChange('manualProductionEnd', event.target.value)}
                      />
                    </label>
                    <label className="admin-intelligence-evidence__manual-field admin-intelligence-evidence__manual-field--wide">
                      <span>Source URL / notes</span>
                      <input
                        type="text"
                        value={priceSelectionState?.manualSourceUrl ?? ''}
                        onChange={(event) => onPriceSelectionFieldChange('manualSourceUrl', event.target.value)}
                      />
                    </label>
                  </div>
                  {manualValuesReady ? (
                    <div className="admin-intelligence-evidence__manual-actions">
                      <button
                        type="button"
                        className="admin-intelligence__button admin-intelligence__button--secondary"
                        onClick={onApplyManualValues}
                      >
                        Use manual values
                      </button>
                    </div>
                  ) : null}
                </ResearchAccordion>
              ) : null}
            </div>
            ) : null}

            {!manualFirst ? (
            <ResearchApprovalActions
              loading={loading}
              approving={approving}
              recommendation={recommendation}
              saveReady={saveReady}
              onApprove={onApprove}
              onReject={onReject}
              onRetry={onRetry}
              className="admin-intelligence-evidence__research-actions--footer"
            />
            ) : null}
          </>
        ) : null}
        </div>

        {!manualFirst && (loading || error) && !recommendation ? (
          <ResearchApprovalActions
            loading={loading}
            approving={approving}
            recommendation={recommendation}
            saveReady={false}
            onApprove={onApprove}
            onReject={onReject}
            onRetry={onRetry}
            className="admin-intelligence-evidence__research-actions--footer"
          />
        ) : null}
      </div>
    </div>
  )
}

function EvidenceManageModal({
  open,
  loading,
  error,
  actionError,
  selectedGroup,
  detail,
  selectedEquipmentId,
  priceForm,
  lifecycleForm,
  setPriceForm,
  setLifecycleForm,
  savingPrice,
  savingLifecycle,
  researchLoading,
  onClose,
  onSelectMember,
  onSavePrice,
  onSaveLifecycle,
  onSaveBoth,
  onDeletePriceSource,
  onDeleteLifecycleSource,
  onMarkBestPrice,
  onMarkBestLifecycle,
  onRecalculatePrice,
  onRecalculateLifecycle,
  onFastResearch,
  onDeepResearch,
  onResetPriceForm,
  onResetLifecycleForm,
}) {
  if (!open || !selectedGroup) return null

  const equipment = detail?.equipment

  return (
    <div
      className="admin-intelligence__modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="admin-intelligence__modal admin-intelligence-evidence__manage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-manage-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-intelligence-evidence__manage-header">
          <div>
            <h2 id="evidence-manage-modal-title" className="admin-intelligence__modal-title">
              Manage evidence
            </h2>
            <p className="admin-intelligence-evidence__panel-lead">
              {selectedGroup.primary_keyword}
              {' · '}
              {selectedGroup.member_count} catalogue row{selectedGroup.member_count === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading ? <LoadingState compact>Loading evidence…</LoadingState> : null}
        {error ? <ErrorState compact>{error}</ErrorState> : null}
        {actionError ? <ErrorState compact>{actionError}</ErrorState> : null}

        {!loading && !error && equipment ? (
          <>
            {selectedGroup.member_count > 1 ? (
              <div className="admin-intelligence-evidence__member-tabs">
                <span className="admin-intelligence-evidence__member-label">Equipment row:</span>
                {(selectedGroup.equipment_ids ?? []).map((equipmentId) => (
                  <button
                    key={equipmentId}
                    type="button"
                    className={`admin-intelligence-evidence__member-tab${
                      selectedEquipmentId === equipmentId
                        ? ' admin-intelligence-evidence__member-tab--active'
                        : ''
                    }`}
                    onClick={() => onSelectMember(equipmentId)}
                  >
                    {equipmentId.slice(0, 8)}…
                  </button>
                ))}
              </div>
            ) : null}

            <section className="admin-intelligence-evidence__manage-summary">
              <h3 className="admin-intelligence-evidence__section-title">Equipment summary</h3>
              <div className="admin-intelligence-evidence__summary-grid">
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Brand</span>
                  <strong>{equipment.brand || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Series</span>
                  <strong>{equipment.series || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Model</span>
                  <strong>{equipment.model || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Equipment type</span>
                  <strong>{equipment.equipment_type || '—'}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Current original price</span>
                  <strong>{formatBestOriginalPrice(equipment)}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Price status</span>
                  <strong><EvidenceStatusBadge status={detail.priceStatus} /></strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Baseline manufacture year</span>
                  <strong>{formatBaselineManufactureYear(equipment)}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Baseline status</span>
                  <strong><BaselineStatusBadge equipment={equipment} /></strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Production period</span>
                  <strong>{formatManufactureYearRange(equipment)}</strong>
                </div>
                <div>
                  <span className="admin-intelligence-evidence__summary-label">Lifecycle status</span>
                  <strong><EvidenceStatusBadge status={detail.lifecycleStatus} /></strong>
                </div>
              </div>
            </section>

            <div className="admin-intelligence-evidence__manage-forms">
              <section className="admin-intelligence-evidence__manage-form-section">
                <div className="admin-intelligence-evidence__sources-header">
                  <h3 className="admin-intelligence-evidence__section-title">Manual original price</h3>
                  <button
                    type="button"
                    className="admin-intelligence__button admin-intelligence__button--secondary"
                    onClick={onResetPriceForm}
                  >
                    Clear form
                  </button>
                </div>
                {priceForm ? (
                  <PriceSourceForm
                    form={priceForm}
                    setForm={setPriceForm}
                    saving={savingPrice}
                    onSubmit={onSavePrice}
                    onCancel={onResetPriceForm}
                  />
                ) : null}
              </section>

              <section className="admin-intelligence-evidence__manage-form-section">
                <div className="admin-intelligence-evidence__sources-header">
                  <h3 className="admin-intelligence-evidence__section-title">Manual lifecycle / baseline</h3>
                  <button
                    type="button"
                    className="admin-intelligence__button admin-intelligence__button--secondary"
                    onClick={onResetLifecycleForm}
                  >
                    Clear form
                  </button>
                </div>
                {lifecycleForm ? (
                  <LifecycleSourceForm
                    form={lifecycleForm}
                    setForm={setLifecycleForm}
                    saving={savingLifecycle}
                    onSubmit={onSaveLifecycle}
                    onCancel={onResetLifecycleForm}
                  />
                ) : null}
              </section>
            </div>

            <section className="admin-intelligence-evidence__sources-section">
              <div className="admin-intelligence-evidence__sources-header">
                <h3 className="admin-intelligence-evidence__section-title">Existing price sources</h3>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={onRecalculatePrice}
                >
                  Recalculate best
                </button>
              </div>
              {detail.priceSources.length === 0 ? (
                <p className="admin-intelligence-evidence__empty-sources">No price sources yet.</p>
              ) : (
                <div className="admin-intelligence__table-wrap">
                  <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
                    <thead>
                      <tr>
                        <th>Price</th>
                        <th>Year</th>
                        <th>Source</th>
                        <th>Confidence</th>
                        <th>Best</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.priceSources.map((source) => (
                        <tr key={source.id}>
                          <td>
                            {new Intl.NumberFormat('en-GB', {
                              style: 'currency',
                              currency: source.currency || 'GBP',
                              maximumFractionDigits: 0,
                            }).format(Number(source.price))}
                          </td>
                          <td>{source.price_year ?? '—'}</td>
                          <td>
                            <div>{getSourceTypeLabel(source.source_type)}</div>
                            {source.source_name ? (
                              <div className="admin-intelligence-evidence__source-meta">{source.source_name}</div>
                            ) : null}
                            {source.source_url ? (
                              <a
                                href={source.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="admin-intelligence-evidence__source-link"
                              >
                                Source link
                              </a>
                            ) : null}
                          </td>
                          <td>{source.confidence}</td>
                          <td>
                            {equipment.best_original_price_source_id === source.id ? 'Yes' : '—'}
                          </td>
                          <td>
                            <div className="admin-intelligence-evidence__row-actions">
                              <button
                                type="button"
                                className="admin-intelligence__button admin-intelligence__button--secondary"
                                onClick={() => setPriceForm(priceSourceToForm(source))}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="admin-intelligence__button admin-intelligence__button--secondary"
                                onClick={() => onMarkBestPrice(source.id)}
                              >
                                Mark best
                              </button>
                              <button
                                type="button"
                                className="admin-intelligence__button admin-intelligence__button--secondary"
                                onClick={() => onDeletePriceSource(source.id)}
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
              )}
            </section>

            <section className="admin-intelligence-evidence__sources-section">
              <div className="admin-intelligence-evidence__sources-header">
                <h3 className="admin-intelligence-evidence__section-title">Existing lifecycle sources</h3>
                <button
                  type="button"
                  className="admin-intelligence__button admin-intelligence__button--secondary"
                  onClick={onRecalculateLifecycle}
                >
                  Recalculate best
                </button>
              </div>
              {detail.lifecycleSources.length === 0 ? (
                <p className="admin-intelligence-evidence__empty-sources">No lifecycle sources yet.</p>
              ) : (
                <div className="admin-intelligence__table-wrap">
                  <table className="admin-intelligence__table admin-intelligence-evidence__sources-table">
                    <thead>
                      <tr>
                        <th>Years</th>
                        <th>Source</th>
                        <th>Confidence</th>
                        <th>Best</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lifecycleSources.map((source) => (
                        <tr key={source.id}>
                          <td>
                            {formatManufactureYearRange({
                              manufacture_start_year: source.manufacture_start_year,
                              manufacture_end_year: source.manufacture_end_year,
                            })}
                          </td>
                          <td>
                            <div>{getSourceTypeLabel(source.source_type)}</div>
                            {source.source_name ? (
                              <div className="admin-intelligence-evidence__source-meta">{source.source_name}</div>
                            ) : null}
                            {source.source_url ? (
                              <a
                                href={source.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="admin-intelligence-evidence__source-link"
                              >
                                Source link
                              </a>
                            ) : null}
                          </td>
                          <td>{source.confidence}</td>
                          <td>
                            {equipment.manufacture_year_source_id === source.id ? 'Yes' : '—'}
                          </td>
                          <td>
                            <div className="admin-intelligence-evidence__row-actions">
                              <button
                                type="button"
                                className="admin-intelligence__button admin-intelligence__button--secondary"
                                onClick={() => setLifecycleForm(lifecycleSourceToForm(source, equipment))}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="admin-intelligence__button admin-intelligence__button--secondary"
                                onClick={() => onMarkBestLifecycle(source.id)}
                              >
                                Mark best
                              </button>
                              <button
                                type="button"
                                className="admin-intelligence__button admin-intelligence__button--secondary"
                                onClick={() => onDeleteLifecycleSource(source.id)}
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
              )}
            </section>

            <div className="admin-intelligence-evidence__manage-footer">
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={onSavePrice}
                disabled={savingPrice || savingLifecycle || !priceForm}
              >
                {savingPrice ? 'Saving…' : 'Save price'}
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={onSaveLifecycle}
                disabled={savingPrice || savingLifecycle || !lifecycleForm}
              >
                {savingLifecycle ? 'Saving…' : 'Save lifecycle'}
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={onSaveBoth}
                disabled={savingPrice || savingLifecycle}
              >
                Save both
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={onFastResearch}
                disabled={researchLoading}
              >
                {researchLoading ? 'Researching…' : 'Fast trusted-source research'}
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={onDeepResearch}
                disabled={researchLoading}
              >
                Deep research
              </button>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AdminIntelligenceEvidencePage() {
  usePageTitle('Original Prices & Lifecycle')

  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState('')
  const [groups, setGroups] = useState([])
  const [allRankedGroups, setAllRankedGroups] = useState([])
  const [totalScored, setTotalScored] = useState(0)
  const [selectedGroupKey, setSelectedGroupKey] = useState(null)
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false)

  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null)

  const [priceForm, setPriceForm] = useState(null)
  const [lifecycleForm, setLifecycleForm] = useState(null)
  const [savingPrice, setSavingPrice] = useState(false)
  const [savingLifecycle, setSavingLifecycle] = useState(false)
  const [actionError, setActionError] = useState('')

  const [researchOpen, setResearchOpen] = useState(false)
  const [researchLoading, setResearchLoading] = useState(false)
  const [researchError, setResearchError] = useState('')
  const [researchEquipmentId, setResearchEquipmentId] = useState(null)
  const [researchEquipmentLabel, setResearchEquipmentLabel] = useState('')
  const [researchMeta, setResearchMeta] = useState(null)
  const [researchRecommendation, setResearchRecommendation] = useState(null)
  const [researchCurrentEquipment, setResearchCurrentEquipment] = useState(null)
  const [researchApproving, setResearchApproving] = useState(false)
  const [batchResearchActive, setBatchResearchActive] = useState(false)
  const [batchResearchIndex, setBatchResearchIndex] = useState(0)
  const [batchResearchQueue, setBatchResearchQueue] = useState([])
  const [skipCompletedRows, setSkipCompletedRows] = useState(true)
  const [forceReResearch, setForceReResearch] = useState(false)
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchQueueSummary, setBatchQueueSummary] = useState(null)
  const [pendingBatchQueue, setPendingBatchQueue] = useState([])
  const [pendingBatchPreview, setPendingBatchPreview] = useState([])
  const [batchQueueLoading, setBatchQueueLoading] = useState(false)
  const [researchEngineMode, setResearchEngineMode] = useState(EQUIPMENT_RESEARCH_ENGINE.FAST)
  const [researchRequestEngine, setResearchRequestEngine] = useState(EQUIPMENT_RESEARCH_ENGINE.FAST)
  const [researchQueueEntry, setResearchQueueEntry] = useState(null)
  const [researchSaveMessage, setResearchSaveMessage] = useState('')
  const [researchPriceSelection, setResearchPriceSelection] = useState(
    () => createEmptyResearchPriceSelectionState(),
  )
  const [groupsRefreshWarning, setGroupsRefreshWarning] = useState('')
  const [usesCanonicalProducts, setUsesCanonicalProducts] = useState(false)
  const [exportingCanonicalList, setExportingCanonicalList] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importForce, setImportForce] = useState(false)
  const [importPlan, setImportPlan] = useState(null)
  const [importApplyResult, setImportApplyResult] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [completionProducts, setCompletionProducts] = useState([])
  const [completionFilters, setCompletionFilters] = useState({
    brand: '',
    equipmentType: '',
    completionFilter: COMPLETION_DASHBOARD_FILTER.ALL,
  })
  const [completionExporting, setCompletionExporting] = useState(false)
  const [top100Debug, setTop100Debug] = useState(null)

  const selectedGroup = useMemo(
    () => groups.find((group) => group.keyword_key === selectedGroupKey) ?? null,
    [groups, selectedGroupKey],
  )

  const structuredResearchPriceEvidence = useMemo(
    () => getResearchStructuredPriceEvidence(researchMeta),
    [researchMeta],
  )

  const researchApproveReady = useMemo(() => {
    const isCanonicalManual = Boolean(researchQueueEntry?.productId)
    if (isCanonicalManual) {
      return canSaveManualProductData(researchPriceSelection, structuredResearchPriceEvidence)
    }
    return canApproveResearchPriceSelection(researchPriceSelection, structuredResearchPriceEvidence)
  }, [researchPriceSelection, structuredResearchPriceEvidence, researchQueueEntry?.productId])

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true)
    setGroupsError('')

    try {
      const canonicalResult = await fetchCanonicalProductResearchView({ limit: 100 })
      if (!canonicalResult.error && canonicalResult.usesCanonicalProducts) {
        if (import.meta.env.DEV) {
          const brands = canonicalResult.groups.map((group) => group.product?.brand).filter(Boolean)
          const woodwayPresent = brands.some((brand) => brand.toLowerCase() === 'woodway')
          const wattbikePresent = brands.some((brand) => brand.toLowerCase() === 'wattbike')
          console.log('[Top100] loader: canonical product research view')
          console.log('[Top100] total rows returned:', canonicalResult.groups.length)
          console.log('[Top100] incomplete candidates:', canonicalResult.totalScored)
          console.log('[Top100] first 50 brands:', brands.slice(0, 50))
          console.log('[Top100] Woodway present before render:', woodwayPresent)
          console.log('[Top100] Wattbike present before render:', wattbikePresent)
          console.log('[Top100] debug summary:', canonicalResult.top100Debug)
        }

        setGroups(canonicalResult.groups)
        setAllRankedGroups(canonicalResult.groups)
        setTotalScored(canonicalResult.totalScored)
        setTop100Debug(canonicalResult.top100Debug ?? null)
        setUsesCanonicalProducts(true)
        return
      }

      setTop100Debug(null)
      setUsesCanonicalProducts(false)
      const result = await fetchPriorityEvidenceGroups(100)
      if (result.error) {
        setGroups([])
        setAllRankedGroups([])
        setTotalScored(0)
        setGroupsError(getAdminErrorMessage(result.error))
        return
      }

      setGroups(result.groups)
      setAllRankedGroups(result.allRankedGroups ?? result.groups)
      setTotalScored(result.totalScored)
    } catch (loadError) {
      console.error('[Top100] loadGroups failed', loadError)
      setGroups([])
      setAllRankedGroups([])
      setTotalScored(0)
      setTop100Debug(null)
      setUsesCanonicalProducts(false)
      setGroupsError(getAdminErrorMessage(loadError))
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  const loadCompletionDashboard = useCallback(async () => {
    const result = await fetchCanonicalProductCompletionStats()
    if (!result.error) {
      setCompletionProducts(result.products ?? [])
    }
  }, [])

  const loadDetail = useCallback(async (equipmentId) => {
    if (!equipmentId) {
      setDetail(null)
      return
    }

    setDetailLoading(true)
    setDetailError('')
    setActionError('')

    const result = await fetchEquipmentEvidenceDetail(equipmentId)
    if (result.error) {
      setDetail(null)
      setDetailError(getAdminErrorMessage(result.error))
      setDetailLoading(false)
      return
    }

    setDetail(result)
    setDetailLoading(false)
    if (result.equipment) {
      setPriceForm(buildEmptyPriceSourceForm(equipmentId))
      setLifecycleForm(buildEmptyLifecycleSourceForm(equipmentId, result.equipment))
    }
    return result
  }, [])

  function applyLocalCanonicalProductPatch(product) {
    if (!product?.id) return

    try {
      setGroups((current) => patchCanonicalProductGroupsAfterResearchApprove(current, product))
      setAllRankedGroups((current) => patchCanonicalProductGroupsAfterResearchApprove(current, product))
      setGroupsRefreshWarning('')
    } catch (error) {
      console.warn('applyLocalCanonicalProductPatch failed', error)
      setGroupsRefreshWarning(
        'Changes saved, but the table row could not be updated locally. Use Refresh groups to reload.',
      )
    }
  }

  function applyLocalGroupPatch(equipmentId, equipmentPatch) {
    if (!equipmentId || !equipmentPatch) return

    try {
      setGroups((current) => patchPriorityGroupsAfterEquipmentUpdate(
        current,
        equipmentId,
        equipmentPatch,
      ))
      setAllRankedGroups((current) => patchPriorityGroupsAfterEquipmentUpdate(
        current,
        equipmentId,
        equipmentPatch,
      ))
      setGroupsRefreshWarning('')
    } catch (error) {
      console.warn('applyLocalGroupPatch failed', error)
      setGroupsRefreshWarning(
        'Changes saved, but the table row could not be updated locally. Use Refresh groups to reload.',
      )
    }
  }

  async function refreshAfterMutation(equipmentId, { equipmentPatch = null, patchFromDetail = true } = {}) {
    if (equipmentPatch) {
      applyLocalGroupPatch(equipmentId, equipmentPatch)
    }

    const result = await loadDetail(equipmentId)

    if (patchFromDetail && !equipmentPatch && result?.equipment) {
      applyLocalGroupPatch(equipmentId, result.equipment)
    }
  }

  useEffect(() => {
    loadGroups()
    loadCompletionDashboard()
  }, [loadGroups, loadCompletionDashboard])

  useEffect(() => {
    if (!evidenceModalOpen || !selectedGroup?.representative_equipment_id) {
      return
    }

    setSelectedEquipmentId(selectedGroup.representative_equipment_id)
    loadDetail(selectedGroup.representative_equipment_id)
  }, [evidenceModalOpen, selectedGroup, loadDetail])

  function buildEquipmentLabelFromGroup(group) {
    if (group?.isCanonicalProduct) {
      return group.primary_keyword || group.label || 'Canonical product'
    }
    return group?.primary_keyword || group?.label || 'Selected equipment'
  }

  function buildEquipmentLabelFromDetail(equipment) {
    return [equipment?.brand, equipment?.series, equipment?.model].filter(Boolean).join(' ')
  }

  async function openCanonicalProductEditor(group, { queueEntry = null } = {}) {
    const equipmentId = group.representative_equipment_id
    if (!equipmentId) {
      setActionError('No linked intelligence row for this canonical product.')
      return
    }

    const detailResult = await fetchEquipmentEvidenceDetail(equipmentId)
    const currentEquipment = detailResult.equipment ?? null

    const entry = queueEntry ?? {
      productId: group.productId,
      product: group.product,
      productStatus: group.productStatus,
      sourceRowCount: group.member_count,
      dedupeEligible: true,
      canonicalProductKey: group.product?.canonical_product_key,
      canonicalProductName: group.primary_keyword,
      completionStatus: group.completionStatus,
      completionReason: group.completionReason,
      equipmentId,
      mode: deriveCanonicalProductResearchMode(group.product, {
        forceReResearch,
        skipCompleted: skipCompletedRows,
      }),
    }

    setSelectedGroupKey(group.keyword_key)
    setResearchOpen(true)
    setResearchLoading(false)
    setResearchError('')
    setResearchSaveMessage('')
    setResearchRecommendation(createEmptyManualProductRecommendation())
    setResearchMeta(null)
    setResearchEquipmentId(equipmentId)
    setResearchEquipmentLabel(buildEquipmentLabelFromGroup(group))
    setResearchCurrentEquipment(currentEquipment)
    setResearchQueueEntry(entry)
    setResearchRequestEngine(EQUIPMENT_RESEARCH_ENGINE.FAST)
    setResearchEngineMode(EQUIPMENT_RESEARCH_ENGINE.FAST)
    setResearchPriceSelection(createPriceSelectionFromCanonicalProduct(group.product))
  }

  async function openCanonicalProductEditorFromQueue(queueEntry, currentEquipment = null) {
    const product = queueEntry.product
    const group = {
      keyword_key: queueEntry.productId,
      productId: queueEntry.productId,
      primary_keyword: queueEntry.canonicalProductName || queueEntry.label,
      label: queueEntry.canonicalProductName || queueEntry.label,
      member_count: queueEntry.sourceRowCount ?? 1,
      representative_equipment_id: queueEntry.equipmentId,
      product,
      productStatus: queueEntry.productStatus,
      completionStatus: queueEntry.completionStatus,
      completionReason: queueEntry.completionReason,
      isCanonicalProduct: true,
    }

    await openCanonicalProductEditor(group, {
      queueEntry: {
        ...queueEntry,
        equipmentId: queueEntry.equipmentId,
      },
    })

    if (currentEquipment) {
      setResearchCurrentEquipment(currentEquipment)
    }
  }

  async function runFindEvidenceLinks() {
    if (!researchEquipmentId) return

    const preservedSelection = { ...researchPriceSelection }
    const resolvedEngine = EQUIPMENT_RESEARCH_ENGINE.FAST
    const mode = researchQueueEntry?.mode ?? RESEARCH_QUEUE_MODES.FULL

    setResearchLoading(true)
    setResearchError('')
    setResearchSaveMessage('')
    setResearchRequestEngine(resolvedEngine)

    const result = await runEquipmentResearch(researchEquipmentId, {
      researchMode: mode === RESEARCH_QUEUE_MODES.SKIP ? RESEARCH_QUEUE_MODES.FULL : mode,
      researchEngine: resolvedEngine,
      researchTarget: buildResearchTargetPayload(researchQueueEntry),
    })

    if (result.error) {
      setResearchError(getAdminErrorMessage(result.error))
      setResearchLoading(false)
      return
    }

    const candidates = getResearchStructuredPriceEvidence(result.data)
    setResearchMeta(result.data)
    setResearchPriceSelection(mergeEvidenceIntoManualPriceSelection(
      preservedSelection,
      result.data?.recommendation,
      candidates,
    ))
    setResearchLoading(false)
  }

  async function runResearchForEquipment(
    equipmentId,
    equipmentLabel,
    currentEquipment = null,
    researchMode = RESEARCH_QUEUE_MODES.FULL,
    queueEntry = null,
    researchEngine = null,
  ) {
    if (!equipmentId) return

    const resolvedEngine = resolveClientResearchEngine(
      researchEngine ?? queueEntry?.researchEngine,
      researchEngineMode,
    )

    setResearchOpen(true)
    setResearchLoading(true)
    setResearchError('')
    setResearchSaveMessage('')
    setResearchRecommendation(null)
    setResearchPriceSelection(createEmptyResearchPriceSelectionState())
    setResearchMeta(null)
    setResearchEquipmentId(equipmentId)
    setResearchEquipmentLabel(equipmentLabel)
    setResearchCurrentEquipment(currentEquipment)
    setResearchQueueEntry(queueEntry)
    setResearchRequestEngine(resolvedEngine)
    setResearchEngineMode(resolvedEngine)

    const result = await runEquipmentResearch(equipmentId, {
      researchMode,
      researchEngine: resolvedEngine,
      researchTarget: buildResearchTargetPayload(queueEntry),
    })
    if (result.error) {
      setResearchError(getAdminErrorMessage(result.error))
      setResearchLoading(false)
      return
    }

    if (result.data?.debug_log) {
      console.info('equipment_research_debug', result.data.debug_log)
      if (result.data.debug_log.timings) {
        console.info('equipment_research_timings', result.data.debug_log.timings)
      }
      if (result.data.debug_log.openai_request_payload) {
        console.info('equipment_research_openai_payload', result.data.debug_log.openai_request_payload)
      }
    }

    if (result.data?.ai_input_sources) {
      console.info('equipment_research_ai_input_sources', result.data.ai_input_sources)
    }

    setResearchMeta(result.data)
    setResearchRecommendation(result.data?.recommendation ?? null)
    setResearchPriceSelection(createEmptyResearchPriceSelectionState(
      result.data?.recommendation,
      getResearchStructuredPriceEvidence(result.data),
    ))
    setResearchLoading(false)
  }

  async function handleResearchEquipment(researchEngine = EQUIPMENT_RESEARCH_ENGINE.FAST) {
    if (!selectedEquipmentId || !detail?.equipment) return
    setResearchEngineMode(researchEngine)
    setBatchResearchActive(false)
    setBatchResearchQueue([])
    const mode = deriveEquipmentResearchModeFromDetail(detail)
    const queueEntry = selectedGroup?.isCanonicalProduct
      ? {
        productId: selectedGroup.productId,
        product: selectedGroup.product,
        productStatus: selectedGroup.productStatus,
        sourceRowCount: selectedGroup.member_count,
        dedupeEligible: true,
        canonicalProductKey: selectedGroup.product?.canonical_product_key,
        canonicalProductName: selectedGroup.primary_keyword,
      }
      : null
    await runResearchForEquipment(
      selectedEquipmentId,
      buildEquipmentLabelFromDetail(detail.equipment),
      detail.equipment,
      mode === RESEARCH_QUEUE_MODES.SKIP ? RESEARCH_QUEUE_MODES.FULL : mode,
      queueEntry,
      researchEngine,
    )
  }

  function handleSelectYearCandidate(lifecycleItem) {
    setResearchPriceSelection((current) => applySelectYearCandidate(current, lifecycleItem))
  }

  function deriveEquipmentResearchModeFromDetail(detailRecord) {
    if (!detailRecord?.equipment) return RESEARCH_QUEUE_MODES.FULL
    const equipment = {
      best_original_price: detailRecord.equipment.best_original_price,
      best_original_price_confidence: detailRecord.equipment.best_original_price_confidence,
      baseline_manufacture_year: detailRecord.equipment.baseline_manufacture_year,
      baseline_manufacture_year_source: detailRecord.equipment.baseline_manufacture_year_source,
    }
    return deriveEquipmentResearchMode(equipment, {
      forceReResearch,
      skipCompleted: false,
    })
  }

  async function openBatchResearchConfirm() {
    setResearchEngineMode(EQUIPMENT_RESEARCH_ENGINE.FAST)
    setBatchQueueLoading(true)
    setActionError('')

    const productsResult = await fetchApprovedEquipmentProducts()
    if (!productsResult.error && productsResult.products.length > 0) {
      const dedupedResult = await fetchDedupedApprovedCanonicalProducts(productsResult.products)
      if (dedupedResult.error) {
        setActionError(getAdminErrorMessage(dedupedResult.error))
        setBatchQueueLoading(false)
        return
      }
      const brandsResult = await fetchBrandNames()
      const activeBrands = buildActiveBrandNameSet({
        brands: brandsResult.brands ?? [],
        products: productsResult.products,
      })
      const { queue, summary, preview } = buildCanonicalProductResearchQueue(dedupedResult.products, {
        targetCount: 100,
        skipCompleted: skipCompletedRows,
        forceReResearch,
        activeBrands,
      })
      setPendingBatchQueue(queue)
      setPendingBatchPreview(preview)
      setBatchQueueSummary({ ...summary, queueType: 'canonical_products' })
      setBatchConfirmOpen(true)
      setBatchQueueLoading(false)
      return
    }

    const result = await fetchEquipmentIntelligenceForCoreProducts()
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      setBatchQueueLoading(false)
      return
    }

    const { queue, summary } = buildCoreProductResearchQueue(result.rows, {
      targetCount: 100,
      skipCompleted: skipCompletedRows,
      forceReResearch,
    })

    setPendingBatchQueue(queue)
    setPendingBatchPreview([])
    setBatchQueueSummary({ ...summary, queueType: 'core_products_legacy' })
    setBatchConfirmOpen(true)
    setBatchQueueLoading(false)
  }

  async function startBatchResearch() {
    setBatchConfirmOpen(false)

    if (pendingBatchQueue.length === 0) {
      setActionError('No incomplete models to research with the current queue settings.')
      return
    }

    const batchEngine = resolveClientResearchEngine(researchEngineMode)
    const queuedWithEngine = attachResearchEngineToBatchQueue(pendingBatchQueue, batchEngine)

    setBatchResearchActive(true)
    setBatchResearchQueue(queuedWithEngine)
    setBatchResearchIndex(0)

    const first = queuedWithEngine[0]
    const firstDetail = await fetchEquipmentEvidenceDetail(first.equipmentId)
    if (first.productId) {
      await openCanonicalProductEditorFromQueue(first, firstDetail.equipment)
      return
    }
    await runResearchForEquipment(
      first.equipmentId,
      first.canonicalProductName || first.label,
      firstDetail.equipment,
      first.mode,
      first,
      batchEngine,
    )
  }

  function handleResearchTop100() {
    openBatchResearchConfirm()
  }

  async function advanceBatchResearch(nextIndex) {
    if (!batchResearchActive) {
      setResearchOpen(false)
      return
    }

    if (nextIndex >= batchResearchQueue.length) {
      setBatchResearchActive(false)
      setResearchOpen(false)
      setBatchResearchQueue([])
      setBatchResearchIndex(0)
      return
    }

    setBatchResearchIndex(nextIndex)
    const next = batchResearchQueue[nextIndex]
    const nextDetail = await fetchEquipmentEvidenceDetail(next.equipmentId)
    if (next.productId) {
      await openCanonicalProductEditorFromQueue(next, nextDetail.equipment)
      return
    }
    await runResearchForEquipment(
      next.equipmentId,
      next.canonicalProductName || next.label,
      nextDetail.equipment,
      next.mode,
      next,
      next.researchEngine ?? researchEngineMode,
    )
  }

  function closeResearchModal() {
    setResearchOpen(false)
    setResearchLoading(false)
    setResearchError('')
    setResearchRecommendation(null)
    setResearchMeta(null)
    setResearchCurrentEquipment(null)
    setResearchQueueEntry(null)
    setResearchSaveMessage('')
    setResearchPriceSelection(createEmptyResearchPriceSelectionState())
    setBatchResearchActive(false)
    setBatchResearchQueue([])
    setBatchResearchIndex(0)
  }

  function handlePriceSelectionFieldChange(field, value) {
    setResearchPriceSelection((current) => applyManualPriceFieldChange(current, field, value))
  }

  function handleApplyManualValues() {
    setResearchPriceSelection((current) => {
      const result = applyConfirmManualPriceEntry(current)
      if (result.error) {
        setResearchError(result.error)
        return current
      }
      setResearchError('')
      return result.state
    })
  }

  function handleSelectPriceCandidate(candidateId) {
    setResearchPriceSelection((current) => applySelectPriceCandidate(
      current,
      candidateId,
      structuredResearchPriceEvidence,
    ))
  }

  function handleRejectPriceCandidate(candidateId) {
    setResearchPriceSelection((current) => applyRejectPriceCandidate(current, candidateId))
  }

  function handleMarkUsedRefurbCandidate(candidateId) {
    setResearchPriceSelection((current) => applyMarkUsedRefurbCandidate(current, candidateId))
  }

  async function handleApproveResearch() {
    if (!researchEquipmentId) return

    const isCanonicalManual = Boolean(
      researchQueueEntry?.productId
      ?? (selectedGroup?.isCanonicalProduct ? selectedGroup.productId : null),
    )

    let approvalRecommendation
    let buildError

    if (isCanonicalManual) {
      const manualResult = buildValidatedManualProductSave(
        researchRecommendation ?? createEmptyManualProductRecommendation(),
        researchPriceSelection,
        structuredResearchPriceEvidence,
      )
      approvalRecommendation = manualResult.recommendation
      buildError = manualResult.error
    } else {
      if (!researchRecommendation) return
      const researchResult = buildValidatedApprovalRecommendation(
        researchRecommendation,
        researchPriceSelection,
        structuredResearchPriceEvidence,
      )
      approvalRecommendation = researchResult.recommendation
      buildError = researchResult.error
    }

    if (buildError || !approvalRecommendation) {
      setResearchError(buildError?.message || 'Enter an RRP or year fields before saving.')
      return
    }

    if (isCanonicalManual) {
      if (!canSaveManualProductData(researchPriceSelection, structuredResearchPriceEvidence)) {
        setResearchError('Enter an RRP or at least one year field before saving.')
        return
      }
    } else if (!canApproveResearchPriceSelection(researchPriceSelection, structuredResearchPriceEvidence)) {
      setResearchError('Select a valid RRP candidate or enter a manual price before approving.')
      return
    }

    setResearchApproving(true)
    setActionError('')
    setResearchError('')
    setResearchSaveMessage('')

    const canonicalProductId = researchQueueEntry?.productId
      ?? researchQueueEntry?.product?.id
      ?? (selectedGroup?.isCanonicalProduct ? selectedGroup.productId : null)

    const groupWriteback = researchQueueEntry?.product?.source_intelligence_row_ids?.length > 1
      ? {
        dedupeEligible: true,
        memberIds: researchQueueEntry.product.source_intelligence_row_ids,
      }
      : researchQueueEntry?.dedupeEligible && researchQueueEntry?.group?.members?.length
        ? {
          dedupeEligible: true,
          memberIds: researchQueueEntry.group.members.map((member) => member.id),
        }
        : null

    const result = await approveEquipmentResearchRecommendation(
      researchEquipmentId,
      approvalRecommendation,
      {
        groupWriteback,
        canonicalProductId,
        researchMeta,
      },
    )

    if (result.error) {
      setResearchError(getAdminErrorMessage(result.error))
      setResearchApproving(false)
      return
    }

    if (result.product) {
      applyLocalCanonicalProductPatch(result.product)
    }

    if (result.data) {
      await refreshAfterMutation(researchEquipmentId, {
        equipmentPatch: result.data,
        patchFromDetail: false,
      })
    }

    const savedMessage = result.product
      ? formatCanonicalResearchSavedMessage(result.product)
      : 'Research recommendation saved.'
    setResearchSaveMessage(savedMessage)
    setResearchApproving(false)

    if (batchResearchActive) {
      const advance = resolveBatchResearchAdvanceAfterApprove({
        batchResearchActive: true,
        saveError: null,
        batchResearchQueue,
        batchResearchIndex,
        canonicalProductId,
        savedProduct: result.product ?? null,
      })

      setBatchResearchQueue(advance.nextQueue)

      if (advance.batchComplete || advance.nextQueue.length === 0) {
        setBatchResearchActive(false)
        setBatchResearchIndex(0)
        setResearchOpen(false)
        return
      }

      setBatchResearchIndex(advance.nextIndex)
      const next = advance.nextQueue[advance.nextIndex]
      const nextDetail = await fetchEquipmentEvidenceDetail(next.equipmentId)
      if (next.productId) {
        await openCanonicalProductEditorFromQueue(next, nextDetail.equipment)
        return
      }
      await runResearchForEquipment(
        next.equipmentId,
        next.canonicalProductName || next.label,
        nextDetail.equipment,
        next.mode,
        next,
        next.researchEngine ?? researchRequestEngine,
      )
      return
    }

    closeResearchModal()
  }

  async function handleRejectResearch() {
    if (batchResearchActive) {
      await advanceBatchResearch(batchResearchIndex + 1)
      return
    }

    closeResearchModal()
  }

  async function handleRetryResearch() {
    if (!researchEquipmentId) return
    const mode = batchResearchActive
      ? batchResearchQueue[batchResearchIndex]?.mode ?? RESEARCH_QUEUE_MODES.FULL
      : deriveEquipmentResearchModeFromDetail({ equipment: researchCurrentEquipment })
    await runResearchForEquipment(
      researchEquipmentId,
      researchEquipmentLabel,
      researchCurrentEquipment,
      mode === RESEARCH_QUEUE_MODES.SKIP ? RESEARCH_QUEUE_MODES.FULL : mode,
      researchQueueEntry,
      researchRequestEngine,
    )
  }

  async function handleSelectGroup(group) {
    setSelectedGroupKey(group.keyword_key)
    setActionError('')
    if (usesCanonicalProducts && group.isCanonicalProduct) {
      await openCanonicalProductEditor(group)
      return
    }
    setEvidenceModalOpen(true)
  }

  function closeEvidenceModal() {
    setEvidenceModalOpen(false)
    setPriceForm(null)
    setLifecycleForm(null)
    setDetail(null)
    setDetailError('')
    setActionError('')
  }

  function resetPriceForm() {
    if (!selectedEquipmentId) return
    setPriceForm(buildEmptyPriceSourceForm(selectedEquipmentId))
  }

  function resetLifecycleForm() {
    if (!selectedEquipmentId) return
    setLifecycleForm(buildEmptyLifecycleSourceForm(selectedEquipmentId, detail?.equipment))
  }

  async function handleSelectMember(equipmentId) {
    setSelectedEquipmentId(equipmentId)
    setActionError('')
    await loadDetail(equipmentId)
  }

  async function handleSavePriceSource(event) {
    event?.preventDefault?.()
    if (!priceForm) return

    setSavingPrice(true)
    setActionError('')

    const result = await saveManualPriceEvidence(priceForm, {
      markAsBest: priceForm.mark_as_best,
    })
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      setSavingPrice(false)
      return
    }

    setSavingPrice(false)
    resetPriceForm()
    await refreshAfterMutation(priceForm.equipment_id)
  }

  async function handleSaveLifecycleSource(event) {
    event?.preventDefault?.()
    if (!lifecycleForm) return

    setSavingLifecycle(true)
    setActionError('')

    const result = await saveManualLifecycleEvidence(lifecycleForm, {
      markAsBest: lifecycleForm.mark_as_best,
    })
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      setSavingLifecycle(false)
      return
    }

    setSavingLifecycle(false)
    resetLifecycleForm()
    await refreshAfterMutation(lifecycleForm.equipment_id)
  }

  async function handleSaveBothEvidence() {
    if (!priceForm || !lifecycleForm) return

    setSavingPrice(true)
    setSavingLifecycle(true)
    setActionError('')

    const priceResult = await saveManualPriceEvidence(priceForm, {
      markAsBest: priceForm.mark_as_best,
    })
    if (priceResult.error) {
      setActionError(getAdminErrorMessage(priceResult.error))
      setSavingPrice(false)
      setSavingLifecycle(false)
      return
    }

    const lifecycleResult = await saveManualLifecycleEvidence(lifecycleForm, {
      markAsBest: lifecycleForm.mark_as_best,
    })
    if (lifecycleResult.error) {
      setActionError(getAdminErrorMessage(lifecycleResult.error))
      setSavingPrice(false)
      setSavingLifecycle(false)
      await refreshAfterMutation(priceForm.equipment_id)
      return
    }

    setSavingPrice(false)
    setSavingLifecycle(false)
    resetPriceForm()
    resetLifecycleForm()
    await refreshAfterMutation(priceForm.equipment_id)
  }

  async function handleDeletePriceSource(sourceId) {
    setActionError('')
    const result = await deletePriceSource(sourceId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await refreshAfterMutation(selectedEquipmentId)
  }

  async function handleDeleteLifecycleSource(sourceId) {
    setActionError('')
    const result = await deleteLifecycleSource(sourceId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await refreshAfterMutation(selectedEquipmentId)
  }

  async function handleMarkBestPrice(sourceId) {
    setActionError('')
    const result = await setBestPriceSource(selectedEquipmentId, sourceId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await refreshAfterMutation(selectedEquipmentId)
  }

  async function handleMarkBestLifecycle(sourceId) {
    setActionError('')
    const result = await setBestLifecycleSource(selectedEquipmentId, sourceId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await refreshAfterMutation(selectedEquipmentId)
  }

  async function handleRecalculatePrice() {
    setActionError('')
    const result = await recalculateBestPriceSource(selectedEquipmentId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await refreshAfterMutation(selectedEquipmentId)
  }

  async function handleRecalculateLifecycle() {
    setActionError('')
    const result = await recalculateBestLifecycleSource(selectedEquipmentId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await refreshAfterMutation(selectedEquipmentId)
  }

  async function handleExportCanonicalList() {
    if (!usesCanonicalProducts || !groups.length) return

    setExportingCanonicalList(true)
    setActionError('')
    try {
      await exportCanonicalProductListSpreadsheet(groups, {
        origin: window.location.origin,
      })
    } catch (error) {
      setActionError(getAdminErrorMessage(error))
    } finally {
      setExportingCanonicalList(false)
    }
  }

  async function handlePreviewCanonicalImport() {
    if (!importFile) return
    setImportLoading(true)
    setImportError('')
    setImportApplyResult(null)
    try {
      const { plan, error } = await buildCanonicalProductResearchImportPlanFromFile(importFile, {
        force: importForce,
      })
      if (error) throw error
      setImportPlan(plan)
    } catch (error) {
      setImportPlan(null)
      setImportError(getAdminErrorMessage(error))
    } finally {
      setImportLoading(false)
    }
  }

  async function handleApplyCanonicalImport() {
    if (!importPlan) return
    setImportLoading(true)
    setImportError('')
    try {
      const result = await applyCanonicalProductResearchImport(importPlan)
      if (result.error) throw result.error
      setImportApplyResult(result)
      await loadGroups()
      await loadCompletionDashboard()
    } catch (error) {
      setImportError(getAdminErrorMessage(error))
    } finally {
      setImportLoading(false)
    }
  }

  function handleCloseCanonicalImport() {
    setImportModalOpen(false)
    setImportFile(null)
    setImportForce(false)
    setImportPlan(null)
    setImportApplyResult(null)
    setImportError('')
  }

  function handleCompletionFiltersChange(patch) {
    setCompletionFilters((current) => ({ ...current, ...patch }))
  }

  async function handleExportCompletionProducts(products, label) {
    if (!products.length) return
    setCompletionExporting(true)
    setActionError('')
    try {
      await exportCanonicalProductsSpreadsheet(products, {
        label,
        origin: window.location.origin,
      })
    } catch (error) {
      setActionError(getAdminErrorMessage(error))
    } finally {
      setCompletionExporting(false)
    }
  }

  function handleOpenTop100IncompleteQueue() {
    const target = document.getElementById('canonical-research-queue')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const summaryStats = useMemo(() => {
    const priceVerified = groups.filter((group) => group.priceStatus === 'verified').length
    const lifecycleVerified = groups.filter((group) => group.lifecycleStatus === 'verified').length
    const priceMissing = groups.filter((group) => group.priceStatus === 'missing').length
    const lifecycleMissing = groups.filter((group) => group.lifecycleStatus === 'missing').length
    const researchComplete = groups.filter((group) => group.isResearchComplete).length

    return {
      priceVerified,
      lifecycleVerified,
      priceMissing,
      lifecycleMissing,
      researchComplete,
    }
  }, [groups])

  return (
    <section className="admin-intelligence admin-intelligence-evidence">
      <header className="admin-intelligence__header">
        <p className="admin-intelligence__back">
          <Link to="/admin/intelligence">← Back to Equipment Intelligence</Link>
          {' · '}
          <Link to="/admin/intelligence/core-products">Core products</Link>
          {' · '}
          <Link to="/admin/intelligence/products">Canonical products</Link>
        </p>
        <h1 className="admin-intelligence__title">Original Prices &amp; Lifecycle</h1>
        <p className="admin-intelligence__lead">
          Enter RRP and baseline year manually for each canonical product. Optional fast research can
          suggest evidence links — it never blocks saving. Completed products (RRP + baseline year) are
          skipped when &quot;Skip completed rows&quot; is enabled.
        </p>
        <div className="admin-intelligence-evidence__batch-controls">
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={skipCompletedRows}
              disabled={forceReResearch || researchLoading}
              onChange={(event) => setSkipCompletedRows(event.target.checked)}
            />
            Skip completed rows
          </label>
          <label className="admin-intelligence-evidence__checkbox-label">
            <input
              type="checkbox"
              checked={forceReResearch}
              disabled={researchLoading}
              onChange={(event) => setForceReResearch(event.target.checked)}
            />
            Force re-research
          </label>
        </div>
        <div className="admin-intelligence__actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={handleResearchTop100}
            disabled={groupsLoading || researchLoading || batchQueueLoading}
          >
            Research Top 100 Canonical
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={loadGroups}
            disabled={groupsLoading || researchLoading}
          >
            Refresh groups
          </button>
          {usesCanonicalProducts ? (
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={handleExportCanonicalList}
              disabled={groupsLoading || exportingCanonicalList || groups.length === 0}
            >
              {exportingCanonicalList ? 'Exporting…' : 'Export top 100 (.xlsx)'}
            </button>
          ) : null}
          {usesCanonicalProducts ? (
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={() => setImportModalOpen(true)}
              disabled={groupsLoading || researchLoading}
            >
              Import spreadsheet
            </button>
          ) : null}
        </div>
      </header>

      {groupsRefreshWarning ? (
        <p className="admin-intelligence-evidence__refresh-warning" role="status">
          {groupsRefreshWarning}
        </p>
      ) : null}

      {usesCanonicalProducts && completionProducts.length > 0 ? (
        <CanonicalProductCompletionDashboard
          products={completionProducts}
          variant="full"
          filters={completionFilters}
          onFiltersChange={handleCompletionFiltersChange}
          exporting={completionExporting}
          onExportIncomplete={(products) => handleExportCompletionProducts(products, 'incomplete')}
          onExportCompleted={(products) => handleExportCompletionProducts(products, 'complete')}
          onOpenTop100={handleOpenTop100IncompleteQueue}
        />
      ) : null}

      {groupsLoading ? (
        <LoadingState compact>
          {usesCanonicalProducts ? 'Loading canonical products…' : 'Loading priority search groups…'}
        </LoadingState>
      ) : null}
      {groupsError ? <ErrorState compact>{groupsError}</ErrorState> : null}

      {!groupsLoading && !groupsError ? (
        <>
          <section className="admin-intelligence__panel" id="canonical-research-queue">
            <h2 className="admin-intelligence__panel-title">
              {usesCanonicalProducts ? 'Top 100 canonical products' : 'Top 100 priority search groups'}
            </h2>
            <p className="admin-intelligence-evidence__panel-lead">
              {usesCanonicalProducts ? (
                <>
                  Approved canonical products from equipment_products. Click a row to enter RRP, baseline
                  year, and source URL manually. Use Find evidence links for optional trusted-source snippets.
                </>
              ) : (
                <>
                  Ranked across {totalScored > 0 ? `${totalScored.toLocaleString('en-GB')} equipment rows` : 'the catalogue'}.
                  Batch research scans up to 200 priority groups to find the top 100 incomplete models.
                  Click a row to open the evidence manager modal.
                </>
              )}
            </p>

            {import.meta.env.DEV && usesCanonicalProducts && top100Debug ? (
              <p className="admin-intelligence-evidence__top100-debug" role="status">
                Top 100 candidates loaded: {top100Debug.incompleteCandidates}
                {' — '}
                Woodway: {top100Debug.woodway}
                {' — '}
                Wattbike: {top100Debug.wattbike}
              </p>
            ) : null}

            <div className="admin-intelligence__stats">
              {usesCanonicalProducts ? (
                <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                  <span>Research complete</span>
                  <strong>{summaryStats.researchComplete}</strong>
                </div>
              ) : null}
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Price verified</span>
                <strong>{summaryStats.priceVerified}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Price missing</span>
                <strong>{summaryStats.priceMissing}</strong>
              </div>
              <div className="admin-intelligence__stat admin-intelligence__stat--ok">
                <span>Lifecycle verified</span>
                <strong>{summaryStats.lifecycleVerified}</strong>
              </div>
              <div className="admin-intelligence__stat">
                <span>Lifecycle missing</span>
                <strong>{summaryStats.lifecycleMissing}</strong>
              </div>
            </div>

            {groups.length === 0 ? (
              <EmptyState compact>
                {usesCanonicalProducts ? 'No approved canonical products found.' : 'No priority groups found.'}
              </EmptyState>
            ) : (
              <div className="admin-intelligence__table-wrap">
                <table className="admin-intelligence__table admin-intelligence-evidence__groups-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>{usesCanonicalProducts ? 'Canonical product' : 'Search group'}</th>
                      <th>{usesCanonicalProducts ? 'Source rows' : 'Rows'}</th>
                      <th>{usesCanonicalProducts ? 'Base price' : 'Best original price'}</th>
                      <th>Price status</th>
                      <th>Baseline year</th>
                      {!usesCanonicalProducts ? <th>Production period</th> : null}
                      <th>Lifecycle status</th>
                      {usesCanonicalProducts ? (
                        <>
                          <th>Completion</th>
                          <th>Status</th>
                        </>
                      ) : (
                        <th>Score</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr
                        key={group.keyword_key}
                        className={selectedGroupKey === group.keyword_key
                          ? 'admin-intelligence-evidence__row-selected'
                          : ''}
                        onClick={() => handleSelectGroup(group)}
                      >
                        <td>{group.rank}</td>
                        <td className="admin-intelligence-evidence__keyword-cell">
                          {usesCanonicalProducts
                            && group.completionStatus === CANONICAL_COMPLETION_STATUS.COMPLETE
                            && group.product?.canonical_product_key ? (
                              <Link
                                to={buildEquipmentProductPagePath(group.product.canonical_product_key)}
                                className="admin-intelligence-evidence__product-link"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {group.primary_keyword || group.label}
                              </Link>
                            ) : (
                              group.primary_keyword || group.label
                            )}
                        </td>
                        <td>{group.member_count}</td>
                        <td>
                          {group.best_original_price != null
                            ? (usesCanonicalProducts
                              ? `${(group.best_original_price_currency || 'GBP').toUpperCase()} ${Number(group.best_original_price).toLocaleString('en-GB')}`
                              : formatBestOriginalPrice(group))
                            : '—'}
                        </td>
                        <td><EvidenceStatusBadge status={group.priceStatus} /></td>
                        <td>
                          {group.baseline_manufacture_year != null
                            ? formatBaselineManufactureYear(group)
                            : '—'}
                        </td>
                        {!usesCanonicalProducts ? (
                          <td>
                            {formatManufactureYearRange({
                              manufacture_start_year: group.manufacture_start_year,
                              manufacture_end_year: group.manufacture_end_year,
                            })}
                          </td>
                        ) : null}
                        <td><EvidenceStatusBadge status={group.lifecycleStatus} /></td>
                        <td>
                          {usesCanonicalProducts ? (
                            <>
                              <CompletionBadge status={group.completionStatus} />
                              {group.completionReason ? (
                                <div className="admin-intelligence-evidence__completion-reason">
                                  {group.completionReason}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <strong>{group.popularity_score}</strong>
                          )}
                        </td>
                        {usesCanonicalProducts ? (
                          <td>{group.productStatus ?? '—'}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <EvidenceManageModal
            open={evidenceModalOpen}
            loading={detailLoading}
            error={detailError}
            actionError={actionError}
            selectedGroup={selectedGroup}
            detail={detail}
            selectedEquipmentId={selectedEquipmentId}
            priceForm={priceForm}
            lifecycleForm={lifecycleForm}
            setPriceForm={setPriceForm}
            setLifecycleForm={setLifecycleForm}
            savingPrice={savingPrice}
            savingLifecycle={savingLifecycle}
            researchLoading={researchLoading}
            onClose={closeEvidenceModal}
            onSelectMember={handleSelectMember}
            onSavePrice={handleSavePriceSource}
            onSaveLifecycle={handleSaveLifecycleSource}
            onSaveBoth={handleSaveBothEvidence}
            onDeletePriceSource={handleDeletePriceSource}
            onDeleteLifecycleSource={handleDeleteLifecycleSource}
            onMarkBestPrice={handleMarkBestPrice}
            onMarkBestLifecycle={handleMarkBestLifecycle}
            onRecalculatePrice={handleRecalculatePrice}
            onRecalculateLifecycle={handleRecalculateLifecycle}
            onFastResearch={() => handleResearchEquipment(EQUIPMENT_RESEARCH_ENGINE.FAST)}
            onDeepResearch={() => handleResearchEquipment(EQUIPMENT_RESEARCH_ENGINE.V3)}
            onResetPriceForm={resetPriceForm}
            onResetLifecycleForm={resetLifecycleForm}
          />

          <ResearchRecommendationModal
            open={researchOpen}
            loading={researchLoading}
            error={researchError}
            equipmentLabel={researchEquipmentLabel}
            researchMeta={researchMeta}
            recommendation={researchRecommendation}
            currentEquipment={researchCurrentEquipment}
            batchLabel={
              batchResearchActive
                ? [
                  researchQueueEntry?.productId
                    ? `Product ${batchResearchIndex + 1} of ${batchResearchQueue.length}`
                    : `Group ${batchResearchIndex + 1} of ${batchResearchQueue.length}`,
                  batchResearchQueue[batchResearchIndex]?.mode
                    ? RESEARCH_QUEUE_MODE_LABELS[batchResearchQueue[batchResearchIndex].mode]
                    : null,
                  batchResearchQueue[batchResearchIndex]?.sourceRowCount
                    ? `${batchResearchQueue[batchResearchIndex].sourceRowCount} source rows`
                    : null,
                ].filter(Boolean).join(' · ')
                : ''
            }
            manualFirst={usesCanonicalProducts && Boolean(
              researchQueueEntry?.productId || selectedGroup?.isCanonicalProduct,
            )}
            canonicalProductName={
              researchQueueEntry?.canonicalProductName
              ?? selectedGroup?.primary_keyword
              ?? researchEquipmentLabel
            }
            canonicalContext={
              (researchQueueEntry?.productId || selectedGroup?.isCanonicalProduct)
                ? {
                  productStatus: researchQueueEntry?.productStatus
                    ?? researchQueueEntry?.product?.status
                    ?? selectedGroup?.productStatus
                    ?? 'pending',
                  sourceRowCount: researchQueueEntry?.sourceRowCount
                    ?? selectedGroup?.member_count
                    ?? 1,
                  completionStatus: researchQueueEntry?.completionStatus
                    ?? selectedGroup?.completionStatus
                    ?? null,
                  completionReason: researchQueueEntry?.completionReason
                    ?? selectedGroup?.completionReason
                    ?? null,
                }
                : null
            }
            approving={researchApproving}
            saveMessage={researchSaveMessage}
            priceSelectionState={researchPriceSelection}
            researchEngineMode={researchEngineMode}
            requestEngine={researchRequestEngine}
            onSelectPriceCandidate={handleSelectPriceCandidate}
            onSelectYearCandidate={handleSelectYearCandidate}
            onRejectPriceCandidate={handleRejectPriceCandidate}
            onMarkUsedRefurbCandidate={handleMarkUsedRefurbCandidate}
            onPriceSelectionFieldChange={handlePriceSelectionFieldChange}
            onApplyManualValues={handleApplyManualValues}
            canApprove={researchApproveReady}
            onApprove={handleApproveResearch}
            onReject={handleRejectResearch}
            onRetry={handleRetryResearch}
            onFindEvidenceLinks={
              usesCanonicalProducts && (researchQueueEntry?.productId || selectedGroup?.isCanonicalProduct)
                ? runFindEvidenceLinks
                : null
            }
          />

          <BatchResearchConfirmModal
            open={batchConfirmOpen}
            summary={batchQueueSummary}
            queuePreview={pendingBatchPreview}
            skipCompleted={skipCompletedRows}
            forceReResearch={forceReResearch}
            researchEngineMode={researchEngineMode}
            onSkipCompletedChange={setSkipCompletedRows}
            onForceReResearchChange={setForceReResearch}
            onResearchEngineModeChange={setResearchEngineMode}
            onConfirm={startBatchResearch}
            onCancel={() => setBatchConfirmOpen(false)}
          />
        </>
      ) : null}

      <CanonicalProductImportModal
        open={importModalOpen}
        file={importFile}
        force={importForce}
        plan={importPlan}
        applyResult={importApplyResult}
        loading={importLoading}
        error={importError}
        onFileChange={setImportFile}
        onForceChange={setImportForce}
        onPreview={handlePreviewCanonicalImport}
        onApply={handleApplyCanonicalImport}
        onClose={handleCloseCanonicalImport}
      />
    </section>
  )
}

export default AdminIntelligenceEvidencePage
