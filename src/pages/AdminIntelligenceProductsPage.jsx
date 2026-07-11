import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import EquipmentCatalogueNav from '../components/admin/EquipmentCatalogueNav.jsx'
import { getAdminErrorMessage } from '../lib/admin'
import {
  buildCatalogueSummary,
  CATALOGUE_ATTENTION,
  CATALOGUE_ATTENTION_LABELS,
  getCatalogueContentStatusLabel,
  getCatalogueImageStatusLabel,
  getCatalogueStatusLabel,
  matchesCatalogueAttentionFilter,
} from '../lib/equipmentCatalogueAdmin.js'
import { fetchEquipmentProductContentAdminRows } from '../lib/equipmentProductContentAdmin.js'
import {
  approveEquipmentProduct,
  approveEquipmentProductImage,
  buildEquipmentProductImageUpdateFields,
  buildEquipmentProductPagePath,
  bulkApproveEquipmentProducts,
  bulkApproveHighConfidenceProducts,
  bulkApproveSingleSourceNeedsReviewProducts,
  bulkExcludeEquipmentProducts,
  bulkRejectBlockedEquipmentProductImages,
  evaluateHighConfidenceApprovalCandidates,
  evaluateSafeApprovalCandidates,
  excludeEquipmentProduct,
  fetchEquipmentIntelligenceByIds,
  fetchEquipmentProducts,
  mergeEquipmentProducts,
  productHasBaselineYear,
  productHasRrp,
  PRODUCT_STATUS,
  rejectEquipmentProductImage,
  replaceEquipmentProductImage,
  suggestEquipmentProductImageFromSearch,
  updateEquipmentProduct,
  uploadAndReplaceEquipmentProductImageFile,
} from '../lib/equipmentProducts.js'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  appendEquipmentProductImageCacheBuster,
  buildEquipmentProductImagePublicUrl,
  normalizeEquipmentProductImageStoragePath,
  productHasDisplayableImage,
  resolveEquipmentProductImageDisplayUrl,
} from '../lib/equipmentProductImages.js'
import { supabase } from '../lib/supabase.js'
import {
  assessEquipmentProductImageRisk,
  IMAGE_ADMIN_FILTER,
  IMAGE_AUDIT_RISK,
  matchesImageAdminFilter,
} from '../lib/equipmentProductImageAudit.js'
import { deriveEquipmentProductBaselineSource } from '../lib/lifeFitnessSeriesBaselines.js'
import { getDetectedConsoleFromRow } from '../lib/intelligenceCanonicalProducts.js'
import {
  CANONICAL_COMPLETION_STATUS,
  deriveCanonicalProductCompletionStatus,
  formatCanonicalProductCompletionLabel,
} from '../lib/equipmentResearchQueue.js'
import {
  COMPLETION_DASHBOARD_FILTER,
  exportCanonicalProductsSpreadsheet,
} from '../lib/canonicalProductCompletionStats.js'
import CanonicalProductCompletionDashboard from '../components/admin/CanonicalProductCompletionDashboard.jsx'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceProductsPage.css'
import '../components/admin/EquipmentCatalogueNav.css'

const ALL_FILTER = ''
const VIEW_ALL = 'all'
const VIEW_SAFE_CANDIDATES = 'safe_candidates'
const HIGH_CONFIDENCE_MIN_SCORE = 90

function deriveConsoleFromRow(row) {
  return getDetectedConsoleFromRow(row) ?? null
}

function formatPrice(product) {
  const price = product?.original_base_price
  if (price == null) return '—'
  const currency = (product.original_base_price_currency || 'GBP').toUpperCase()
  return `${currency} ${Number(price).toLocaleString('en-GB')}`
}

function formatProductionYears(product) {
  const start = product?.production_start_year
  const end = product?.production_end_year
  if (start && end) return `${start}–${end}`
  if (start) return `${start}–present`
  if (end) return `Until ${end}`
  return null
}

function ProductIdentityCell({ product }) {
  return (
    <div className="admin-products__product-stack">
      <div className="admin-products__product-brand">{product.brand}</div>
      {product.product_family ? (
        <div className="admin-products__product-family">{product.product_family}</div>
      ) : null}
      <div className="admin-products__product-model">{product.model}</div>
      <div className="admin-products__product-type">{product.equipment_type ?? '—'}</div>
      <div className="admin-products__subtle admin-products__product-canonical">{product.canonical_product_name}</div>
    </div>
  )
}

function PricingBaselineCell({ product }) {
  const productionYears = formatProductionYears(product)
  const priceConfidence = product?.original_price_confidence

  return (
    <div className="admin-products__pricing-cell">
      <div className="admin-products__pricing-rrp">
        <span className="admin-products__pricing-label">RRP</span>
        <strong>{formatPrice(product)}</strong>
      </div>
      <div className="admin-products__pricing-meta">
        <span className="admin-products__pricing-label">Manufactured from</span>
        <span>{product.baseline_manufacture_year ?? '—'}</span>
      </div>
      {productionYears ? (
        <div className="admin-products__pricing-meta">
          <span className="admin-products__pricing-label">Production</span>
          <span>{productionYears}</span>
        </div>
      ) : null}
      <div className="admin-products__pricing-badges">
        <BaselineSourceBadge product={product} />
        {priceConfidence != null ? (
          <span className="admin-products__price-confidence-badge">
            {priceConfidence}% confidence
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ProductStatusCell({
  product,
  isSafeCandidate,
  reviewMeta,
}) {
  const reviewReasonLabels = reviewMeta?.reviewReasonLabels ?? []

  return (
    <div className="admin-products__status-cell">
      <CompletionBadge product={product} />
      <div className="admin-products__status-badges">
        <StatusBadge status={product.status} />
        {isSafeCandidate ? (
          <span className="admin-products__safe-candidate-badge">safe candidate</span>
        ) : null}
        {product.status === PRODUCT_STATUS.NEEDS_REVIEW ? (
          <span className="admin-products__needs-review-badge">needs review</span>
        ) : null}
      </div>
      {reviewReasonLabels.length > 0 ? (
        <div className="admin-products__review-reasons">
          {reviewReasonLabels.map((label) => (
            <span key={label} className="admin-products__review-reason-badge">{label}</span>
          ))}
        </div>
      ) : null}
      {reviewMeta?.isSingleSourceNeedsReviewSafe ? (
        <span className="admin-products__safe-candidate-badge">single-source safe</span>
      ) : null}
    </div>
  )
}

function ProductSourcesCell({ sourceCount, onViewSources }) {
  return (
    <div className="admin-products__sources-cell">
      <div className="admin-products__sources-count">
        <strong>{sourceCount}</strong>
        <span>{sourceCount === 1 ? 'source' : 'sources'}</span>
      </div>
      <button
        type="button"
        className="admin-products__action-pill"
        onClick={onViewSources}
      >
        View sources
      </button>
    </div>
  )
}

function ProductImageCell({ product, thumbUrl, onImageAudit }) {
  return (
    <div className="admin-products__image-cell">
      <div className="admin-products__image-thumb-wrap">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={product.canonical_product_name}
            className="admin-products__image-thumb"
          />
        ) : (
          <div className="admin-products__image-thumb admin-products__image-thumb--empty" aria-hidden="true">
            No image
          </div>
        )}
      </div>
      <ImageStatusBadge status={product.image_status} />
      <button
        type="button"
        className="admin-products__action-pill"
        onClick={onImageAudit}
      >
        Image audit
      </button>
    </div>
  )
}

function ProductRowActions({
  product,
  mergeSourceId,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onViewSources,
  onImageAudit,
  onEdit,
  onApprove,
  onMergeSource,
  onMergeInto,
  onExclude,
}) {
  const showPublicPage = product.status === PRODUCT_STATUS.APPROVED && product.canonical_product_key
  const showApprove = product.status !== PRODUCT_STATUS.APPROVED
  const showExclude = product.status !== PRODUCT_STATUS.EXCLUDED
  const showMergeInto = mergeSourceId && mergeSourceId !== product.id

  return (
    <div className="admin-products__actions-cell">
      <div className="admin-products__actions-primary">
        {showPublicPage ? (
          <Link
            to={buildEquipmentProductPagePath(product.canonical_product_key)}
            className="admin-products__action-pill admin-products__action-pill--primary"
          >
            Public page
          </Link>
        ) : null}
        <button type="button" className="admin-products__action-pill" onClick={onEdit}>Edit</button>
        <button type="button" className="admin-products__action-pill" onClick={onImageAudit}>Image audit</button>
      </div>

      <div className="admin-products__actions-menu-wrap">
        <button
          type="button"
          className="admin-products__actions-menu-trigger"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={onToggleMenu}
        >
          More
        </button>
        {menuOpen ? (
          <>
            <button
              type="button"
              className="admin-products__actions-menu-backdrop"
              aria-label="Close actions menu"
              onClick={onCloseMenu}
            />
            <div className="admin-products__actions-menu" role="menu">
              <button type="button" role="menuitem" className="admin-products__actions-menu-item" onClick={() => { onViewSources(); onCloseMenu() }}>
                View sources
              </button>
              {showApprove ? (
                <button type="button" role="menuitem" className="admin-products__actions-menu-item" onClick={() => { onApprove(); onCloseMenu() }}>
                  Approve
                </button>
              ) : null}
              <button type="button" role="menuitem" className="admin-products__actions-menu-item" onClick={() => { onMergeSource(); onCloseMenu() }}>
                Merge
              </button>
              {showMergeInto ? (
                <button type="button" role="menuitem" className="admin-products__actions-menu-item admin-products__actions-menu-item--primary" onClick={() => { onMergeInto(); onCloseMenu() }}>
                  Merge into this
                </button>
              ) : null}
              {showExclude ? (
                <button type="button" role="menuitem" className="admin-products__actions-menu-item admin-products__actions-menu-item--danger" onClick={() => { onExclude(); onCloseMenu() }}>
                  Exclude
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const className = [
    'admin-products__status-badge',
    status === PRODUCT_STATUS.NEEDS_REVIEW ? 'admin-products__status-badge--review' : '',
    status === PRODUCT_STATUS.APPROVED ? 'admin-products__status-badge--approved' : '',
    status === PRODUCT_STATUS.EXCLUDED ? 'admin-products__status-badge--excluded' : '',
  ].filter(Boolean).join(' ')

  return <span className={className}>{status.replace('_', ' ')}</span>
}

function CompletionBadge({ product }) {
  const status = deriveCanonicalProductCompletionStatus(product)
  const className = [
    'admin-products__completion-badge',
    status === CANONICAL_COMPLETION_STATUS.COMPLETE ? 'admin-products__completion-badge--complete' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_PRICE ? 'admin-products__completion-badge--missing-price' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_BASELINE ? 'admin-products__completion-badge--missing-baseline' : '',
    status === CANONICAL_COMPLETION_STATUS.MISSING_BOTH ? 'admin-products__completion-badge--missing-both' : '',
  ].filter(Boolean).join(' ')

  return (
    <span className={className}>
      {formatCanonicalProductCompletionLabel(status)}
    </span>
  )
}

function BaselineSourceBadge({ product }) {
  const source = deriveEquipmentProductBaselineSource(product)
  const className = [
    'admin-products__baseline-source-badge',
    source.type === 'series_default' ? 'admin-products__baseline-source-badge--series' : '',
    source.type === 'product_research' ? 'admin-products__baseline-source-badge--research' : '',
    source.type === 'manual_admin' ? 'admin-products__baseline-source-badge--manual' : '',
    source.type === 'missing' ? 'admin-products__baseline-source-badge--missing' : '',
  ].filter(Boolean).join(' ')

  if (source.type === 'missing') return null

  return <span className={className}>{source.label}</span>
}

function DataFlag({ present, label }) {
  return (
    <span className={`admin-products__data-flag${present ? ' admin-products__data-flag--yes' : ''}`}>
      {label}
    </span>
  )
}

function ProductSourceRowsModal({
  product,
  sourceRows,
  loading,
  onClose,
}) {
  const consoleVariants = useMemo(() => {
    const consoles = new Set()
    for (const row of sourceRows) {
      const consoleName = deriveConsoleFromRow(row)
      if (consoleName) consoles.add(consoleName)
    }
    return [...consoles]
  }, [sourceRows])

  if (!product) return null

  return (
    <div className="admin-products__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-products__modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-products__modal-header">
          <div>
            <h2>Source rows</h2>
            <p className="admin-products__modal-subtitle">{product.canonical_product_name}</p>
          </div>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>
        <div className="admin-products__modal-body">
          <div className="admin-products__modal-meta">
            <div><strong>{sourceRows.length}</strong> linked intelligence rows</div>
            <div className="admin-products__modal-flags">
              <DataFlag present={productHasRrp(product)} label="RRP" />
              <DataFlag present={productHasBaselineYear(product)} label="Baseline year" />
              <StatusBadge status={product.status} />
            </div>
          </div>

          {consoleVariants.length > 0 ? (
            <div className="admin-products__console-variants">
              <span className="admin-intelligence__label">Detected console variants</span>
              <div className="admin-products__console-chips">
                {consoleVariants.map((consoleName) => (
                  <span key={consoleName} className="admin-products__console-chip">{consoleName}</span>
                ))}
              </div>
            </div>
          ) : (
            <p className="admin-products__subtle">No console variants detected — base machine only.</p>
          )}

          {loading ? <LoadingState compact>Loading source rows…</LoadingState> : null}
          {!loading && sourceRows.length === 0 ? (
            <EmptyState compact>No linked intelligence rows.</EmptyState>
          ) : null}
          {!loading && sourceRows.length > 0 ? (
            <div className="admin-intelligence__table-wrap">
              <table className="admin-intelligence__table admin-products__source-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Series</th>
                    <th>Model</th>
                    <th>Type</th>
                    <th>Console</th>
                    <th>Baseline year</th>
                    <th>Original price</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.brand}</td>
                      <td>{row.series ?? '—'}</td>
                      <td>{row.model}</td>
                      <td>{row.equipment_type ?? '—'}</td>
                      <td>{deriveConsoleFromRow(row) ?? '—'}</td>
                      <td>{row.baseline_manufacture_year ?? '—'}</td>
                      <td>
                        {row.best_original_price ?? row.original_rrp ?? '—'}
                        {row.currency ? ` ${row.currency}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ImageStatusBadge({ status }) {
  const className = [
    'admin-products__image-status-badge',
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED ? 'admin-products__image-status-badge--approved' : '',
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED ? 'admin-products__image-status-badge--suggested' : '',
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED ? 'admin-products__image-status-badge--rejected' : '',
    status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED ? 'admin-products__image-status-badge--failed' : '',
  ].filter(Boolean).join(' ')

  return <span className={className}>{status || 'missing'}</span>
}

function ImageRiskBadge({ riskLevel }) {
  const className = [
    'admin-products__image-risk-badge',
    riskLevel === IMAGE_AUDIT_RISK.SAFE ? 'admin-products__image-risk-badge--safe' : '',
    riskLevel === IMAGE_AUDIT_RISK.REVIEW ? 'admin-products__image-risk-badge--review' : '',
    riskLevel === IMAGE_AUDIT_RISK.BLOCKED ? 'admin-products__image-risk-badge--blocked' : '',
  ].filter(Boolean).join(' ')

  if (!riskLevel) return null
  return <span className={className}>{riskLevel}</span>
}

function getAdminProductImageThumbUrl(product) {
  if (!product) return null
  if (productHasDisplayableImage(product)) {
    return resolveEquipmentProductImageDisplayUrl(product, supabase)
  }

  const storagePath = normalizeEquipmentProductImageStoragePath(product.image_storage_path)
  if (storagePath) {
    const publicUrl = buildEquipmentProductImagePublicUrl(supabase, storagePath)
    if (publicUrl) return appendEquipmentProductImageCacheBuster(publicUrl, product)
  }

  if (product.image_url) {
    return appendEquipmentProductImageCacheBuster(product.image_url, product)
  }

  return null
}

function productHasPendingImageApproval(product) {
  if (!product) return false
  return product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
    && Boolean(product.image_url || product.image_storage_path)
}

function resolveUpdatedProductFromImageAction(result, fallbackProduct) {
  if (!result) return null
  if (result.data?.product?.id) return result.data.product
  if (result.data?.id) return result.data
  if (result.data?.status === 'failed' && fallbackProduct?.id) {
    return {
      ...fallbackProduct,
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED,
      image_failure_reason: result.data.reason ?? 'Image search failed',
    }
  }
  return null
}

function resolveImageActionSuccessMessage(result) {
  const status = result?.data?.status
  const imageStatus = result?.data?.image_status ?? result?.data?.product?.image_status
  const domain = result?.data?.candidate?.domain

  if (status === 'approved' || imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
    return domain ? `Image approved from ${domain}` : 'Image approved'
  }
  if (status === 'suggested' || imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) {
    return domain ? `Image suggested from ${domain}` : 'Image suggested'
  }
  if (status === 'failed' || imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED) {
    return 'Image search failed'
  }
  if (imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED) {
    return 'Image rejected'
  }
  return 'Image updated'
}

function ImageActionToast({ message, onDismiss }) {
  if (!message) return null

  return (
    <div className="admin-products__toast" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="admin-products__toast-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

function ProductImageAuditModal({
  product,
  onClose,
  onProductUpdated,
}) {
  const [manualUrl, setManualUrl] = useState(product?.image_source_url ?? product?.image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchMessage, setSearchMessage] = useState('')

  const risk = useMemo(
    () => (product ? assessEquipmentProductImageRisk(product) : null),
    [product],
  )

  const previewImageUrl = useMemo(() => getAdminProductImageThumbUrl(product), [product])

  if (!product) return null

  async function runAction(action) {
    setSaving(true)
    setError('')
    setSearchMessage('')
    try {
      const result = await action()
      if (import.meta.env.DEV && result?.data) {
        console.debug('[equipment-product-image] Admin image action saved product image fields', {
          canonical_product_key: result.data.canonical_product_key ?? result.data.product?.canonical_product_key,
          image_status: result.data.image_status ?? result.data.product?.image_status ?? result.data.status,
          image_url: result.data.image_url ?? result.data.product?.image_url,
          image_storage_path: result.data.image_storage_path ?? result.data.product?.image_storage_path,
          image_updated_at: result.data.image_updated_at ?? result.data.product?.image_updated_at,
        })
      }

      const updatedProduct = resolveUpdatedProductFromImageAction(result, product)
      if (updatedProduct) {
        onProductUpdated(updatedProduct, resolveImageActionSuccessMessage(result))
      }

      return result
    } catch (actionError) {
      setError(actionError?.message || 'Image action failed.')
      return null
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-products__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-products__modal admin-products__modal--image"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-image-audit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-products__modal-header">
          <div>
            <h2 id="product-image-audit-title">Image audit</h2>
            <p className="admin-products__modal-subtitle">{product.canonical_product_name}</p>
          </div>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>
        <div className="admin-products__modal-body admin-products__image-modal-body">
          <div className="admin-products__image-preview-wrap">
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={product.canonical_product_name}
                className="admin-products__image-preview"
              />
            ) : (
              <div className="admin-products__image-preview admin-products__image-preview--empty">
                No public image
              </div>
            )}
          </div>

          <div className="admin-products__image-meta">
            <div><strong>Status:</strong> <ImageStatusBadge status={product.image_status} /></div>
            {product.image_storage_path ? (
              <div className="admin-products__subtle"><strong>Storage path:</strong> {product.image_storage_path}</div>
            ) : null}
            {risk?.riskLevel ? (
              <div><strong>Risk:</strong> <ImageRiskBadge riskLevel={risk.riskLevel} /></div>
            ) : null}
            {risk?.reasons?.length ? (
              <p className="admin-products__subtle">{risk.reasons.join('; ')}</p>
            ) : null}
            {risk?.identityEvidence ? (
              <div className="admin-products__image-identity">
                <div><strong>Expected identity:</strong> {[
                  risk.identityEvidence.expectedIdentity?.family,
                  risk.identityEvidence.expectedIdentity?.modelCodes?.join(', '),
                  product.product_family,
                  product.model,
                ].filter(Boolean).join(' / ') || '—'}</div>
                <div><strong>Detected candidate identity:</strong> {[
                  risk.identityEvidence.detectedCandidateIdentity?.family,
                  risk.identityEvidence.detectedCandidateIdentity?.modelCodes?.join(', '),
                ].filter(Boolean).join(' / ') || 'brand/type only'}</div>
                <div><strong>Matched tokens:</strong> {(risk.identityEvidence.matchedTokens || []).join(', ') || '—'}</div>
                <div><strong>Conflicting tokens:</strong> {(risk.identityEvidence.conflictingTokens || []).join(', ') || '—'}</div>
                <div><strong>Identity result:</strong> {risk.identityEvidence.identityResult}</div>
                <div><strong>Approval permitted:</strong> {risk.identityEvidence.approvalPermitted ? 'Yes' : 'No'}</div>
                <div><strong>Decision reason:</strong> {risk.identityEvidence.decisionReason}</div>
              </div>
            ) : null}
            {product.image_source_domain ? (
              <div><strong>Source domain:</strong> {product.image_source_domain}</div>
            ) : null}
            {product.image_confidence != null ? (
              <div><strong>Confidence:</strong> {product.image_confidence}</div>
            ) : null}
            {product.image_source_url ? (
              <div>
                <a href={product.image_source_url} target="_blank" rel="noreferrer">
                  View source page
                </a>
              </div>
            ) : null}
            {product.image_failure_reason ? (
              <p className="admin-products__subtle">{product.image_failure_reason}</p>
            ) : null}
          </div>

          <label className="admin-intelligence__field admin-products__field-full">
            <span className="admin-intelligence__label">Replace with image URL</span>
            <input
              type="url"
              className="admin-intelligence__input"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>

          <label className="admin-intelligence__field admin-products__field-full">
            <span className="admin-intelligence__label">Upload image file</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={saving}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                runAction(async () => {
                  const result = await uploadAndReplaceEquipmentProductImageFile(product, file, {
                    sourceUrl: manualUrl.trim() || undefined,
                    imageConfidence: 90,
                  })
                  if (result.error) throw result.error
                  if (import.meta.env.DEV) {
                    console.debug('[equipment-product-image] Manual upload completed', {
                      storagePath: result.uploadResult?.storagePath ?? null,
                      publicUrl: result.uploadResult?.publicUrl ?? null,
                      image_status: result.data?.image_status ?? null,
                    })
                  }
                  return result
                })
              }}
            />
          </label>

          {error ? <p className="admin-intelligence__error" role="alert">{error}</p> : null}
          {searchMessage ? <p className="admin-products__subtle" role="status">{searchMessage}</p> : null}

          <div className="admin-products__modal-actions">
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              disabled={saving}
              onClick={() => runAction(async () => {
                const result = await suggestEquipmentProductImageFromSearch(product.id)
                if (result.error) throw result.error
                if (result.data?.status === 'approved') {
                  setSearchMessage(`Auto-approved image from ${result.data?.candidate?.domain ?? 'manufacturer source'}.`)
                } else if (result.data?.status === 'suggested') {
                  setSearchMessage(`Suggested new image from ${result.data?.candidate?.domain ?? 'allowlisted source'}.`)
                } else if (result.data?.status === 'failed') {
                  setSearchMessage(result.data?.reason ?? 'Image search failed.')
                }
                return result
              })}
            >
              Re-run image search
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              disabled={saving}
              onClick={() => runAction(async () => {
                const trimmed = manualUrl.trim()
                if (!trimmed) throw new Error('Enter an image URL first.')
                const fields = buildEquipmentProductImageUpdateFields({
                  imageUrl: trimmed,
                  imageStoragePath: null,
                  imageSourceUrl: trimmed,
                  imageConfidence: 75,
                })
                const updateResult = await replaceEquipmentProductImage(product.id, {
                  imageUrl: fields.imageUrl,
                  imageStoragePath: null,
                  imageSourceUrl: fields.imageSourceUrl,
                  imageSourceDomain: fields.imageSourceDomain,
                  imageConfidence: fields.imageConfidence,
                  imageStatus: fields.imageStatus,
                  imageFailureReason: fields.imageFailureReason,
                })
                if (updateResult.error) throw updateResult.error
                return updateResult
              })}
            >
              Replace image
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              disabled={saving || (!product.image_url && !product.image_storage_path)}
              onClick={() => runAction(async () => {
                const result = await rejectEquipmentProductImage(product.id, 'Rejected in admin image audit')
                if (result.error) throw result.error
                return result
              })}
            >
              Reject image
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--primary"
              disabled={saving || !productHasPendingImageApproval(product)}
              onClick={() => runAction(async () => {
                const result = await approveEquipmentProductImage(product.id)
                if (result.error) throw result.error
                return result
              })}
            >
              Approve image
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductEditModal({
  product,
  onClose,
  onSaved,
  onOpenImage,
}) {
  const [section, setSection] = useState('overview')
  const [form, setForm] = useState({
    canonicalProductName: product?.canonical_product_name ?? '',
    productFamily: product?.product_family ?? '',
    model: product?.model ?? '',
    equipmentType: product?.equipment_type ?? '',
    baselineManufactureYear: product?.baseline_manufacture_year ?? '',
    productionStartYear: product?.production_start_year ?? '',
    productionEndYear: product?.production_end_year ?? '',
    originalBasePrice: product?.original_base_price ?? '',
    originalPriceConfidence: product?.original_price_confidence ?? '',
    status: product?.status ?? 'pending',
    reviewNotes: product?.review_notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    const result = await updateEquipmentProduct(product.id, {
      canonicalProductName: form.canonicalProductName,
      productFamily: form.productFamily || null,
      model: form.model,
      equipmentType: form.equipmentType || null,
      baselineManufactureYear: form.baselineManufactureYear ? Number(form.baselineManufactureYear) : null,
      productionStartYear: form.productionStartYear ? Number(form.productionStartYear) : null,
      productionEndYear: form.productionEndYear ? Number(form.productionEndYear) : null,
      originalBasePrice: form.originalBasePrice ? Number(form.originalBasePrice) : null,
      originalPriceConfidence: form.originalPriceConfidence ? Number(form.originalPriceConfidence) : null,
      status: form.status,
      reviewNotes: form.reviewNotes || null,
    })
    setSaving(false)
    if (result.error) {
      setError(getAdminErrorMessage(result.error))
      return
    }
    onSaved()
    onClose()
  }

  if (!product) return null

  return (
    <div className="admin-products__modal-backdrop" role="presentation" onClick={onClose}>
      <div className="admin-products__modal admin-products__modal--edit" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="admin-products__modal-header">
          <h2>Edit — {product.canonical_product_name}</h2>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>
        <div className="equipment-catalogue-quick-filters" style={{ padding: '0 1.25rem' }}>
          {[
            ['overview', 'Overview'],
            ['valuation', 'Valuation data'],
            ['image', 'Image'],
            ['content', 'Content'],
            ['history', 'History'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`equipment-catalogue-quick-filters__chip${section === id ? ' equipment-catalogue-quick-filters__chip--active' : ''}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="admin-products__modal-body admin-products__form-grid">
          {section === 'overview' ? (
            <>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Canonical name</span>
                <input className="admin-intelligence__input" value={form.canonicalProductName} onChange={(e) => setForm({ ...form, canonicalProductName: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Product family</span>
                <input className="admin-intelligence__input" value={form.productFamily} onChange={(e) => setForm({ ...form, productFamily: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Model</span>
                <input className="admin-intelligence__input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Equipment type</span>
                <input className="admin-intelligence__input" value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Status</span>
                <select className="admin-intelligence__select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">pending</option>
                  <option value="needs_review">needs_review</option>
                  <option value="approved">approved</option>
                  <option value="excluded">excluded</option>
                </select>
              </label>
              <label className="admin-intelligence__field admin-products__field-full">
                <span className="admin-intelligence__label">Review notes</span>
                <textarea className="admin-intelligence__input" rows={3} value={form.reviewNotes} onChange={(e) => setForm({ ...form, reviewNotes: e.target.value })} />
              </label>
            </>
          ) : null}

          {section === 'valuation' ? (
            <>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Estimated original RRP</span>
                <input className="admin-intelligence__input" value={form.originalBasePrice} onChange={(e) => setForm({ ...form, originalBasePrice: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Price confidence</span>
                <input className="admin-intelligence__input" value={form.originalPriceConfidence} onChange={(e) => setForm({ ...form, originalPriceConfidence: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Manufactured from</span>
                <input className="admin-intelligence__input" value={form.baselineManufactureYear} onChange={(e) => setForm({ ...form, baselineManufactureYear: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Production start</span>
                <input className="admin-intelligence__input" value={form.productionStartYear} onChange={(e) => setForm({ ...form, productionStartYear: e.target.value })} />
              </label>
              <label className="admin-intelligence__field">
                <span className="admin-intelligence__label">Production end</span>
                <input className="admin-intelligence__input" value={form.productionEndYear} onChange={(e) => setForm({ ...form, productionEndYear: e.target.value })} />
              </label>
            </>
          ) : null}

          {section === 'image' ? (
            <div className="admin-products__field-full">
              <p className="admin-intelligence__lead">
                Image status: {product.image_status || 'none'}
              </p>
              <button
                type="button"
                className="admin-intelligence__button admin-intelligence__button--primary"
                onClick={() => {
                  onOpenImage?.(product.id)
                  onClose()
                }}
              >
                Open image tools
              </button>
            </div>
          ) : null}

          {section === 'content' ? (
            <div className="admin-products__field-full">
              <p className="admin-intelligence__lead">
                Generate and publish product descriptions from the content tools.
                Use bulk publish from Legacy tools → Content publish when reviewing drafts.
              </p>
              <Link
                to="/admin/intelligence/product-content"
                className="admin-intelligence__button admin-intelligence__button--secondary"
              >
                Open content publish
              </Link>
            </div>
          ) : null}

          {section === 'history' ? (
            <dl className="admin-products__confirm-stats admin-products__field-full">
              <div>
                <dt>Created</dt>
                <dd>{product.created_at ? new Date(product.created_at).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{product.updated_at ? new Date(product.updated_at).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt>Image reviewed</dt>
                <dd>{product.image_reviewed_at ? new Date(product.image_reviewed_at).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt>Canonical key</dt>
                <dd><code>{product.canonical_product_key}</code></dd>
              </div>
            </dl>
          ) : null}

          {error ? <ErrorState compact>{error}</ErrorState> : null}
          {section === 'overview' || section === 'valuation' ? (
            <div className="admin-products__modal-actions">
              <button type="button" className="admin-intelligence__button admin-intelligence__button--primary" disabled={saving} onClick={handleSave}>Save</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HighConfidenceApproveModal({
  open,
  preview,
  brandFilter,
  minScore,
  loading,
  onConfirm,
  onClose,
}) {
  if (!open || !preview) return null

  return (
    <div className="admin-products__modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-products__modal admin-products__modal--confirm"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-products__modal-header">
          <h2>Approve high confidence {minScore}+</h2>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>
        <div className="admin-products__modal-body">
          <p className="admin-products__confirm-lead">
            Approve canonical products matching your current filters with grouping score {minScore} or higher.
          </p>
          <dl className="admin-products__confirm-stats">
            <div>
              <dt>Products to approve</dt>
              <dd><strong>{preview.summary.eligibleCount}</strong></dd>
            </div>
            <div>
              <dt>Brand filter</dt>
              <dd>{brandFilter || 'All brands'}</dd>
            </div>
            <div>
              <dt>Pending</dt>
              <dd>{preview.summary.pendingCount}</dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd>{preview.summary.needsReviewCount}</dd>
            </div>
          </dl>
          <p className="admin-products__confirm-warning" role="status">
            No equipment_intelligence source rows will be deleted. Approved canonical prices and baseline years are not overwritten.
          </p>
          <div className="admin-products__modal-actions">
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--primary"
              disabled={loading || preview.summary.eligibleCount === 0}
              onClick={onConfirm}
            >
              Approve {preview.summary.eligibleCount} product(s)
            </button>
            <button type="button" className="admin-intelligence__button admin-intelligence__button--secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BulkApprovalSummary({ summary, onDismiss }) {
  if (!summary) return null

  return (
    <div className="admin-products__approval-summary" role="status">
      <div className="admin-products__approval-summary-header">
        <strong>{summary.title || 'Bulk approval complete'}</strong>
        <button type="button" className="admin-intelligence__button" onClick={onDismiss}>Dismiss</button>
      </div>
      <p>
        Approved <strong>{summary.approved}</strong>
        {' · '}
        Skipped <strong>{summary.skipped}</strong>
        {summary.failures?.length ? (
          <>
            {' · '}
            Failed <strong>{summary.failures.length}</strong>
          </>
        ) : null}
      </p>
      {summary.failures?.length ? (
        <p className="admin-products__confirm-warning">
          {summary.failures.length} product(s) could not be approved. Check admin permissions or product state.
        </p>
      ) : null}
      {summary.skippedReasons?.length ? (
        <ul className="admin-products__approval-summary-reasons">
          {summary.skippedReasons.map((entry) => (
            <li key={entry.reason}>{entry.label}: {entry.count}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function AdminIntelligenceProductsPage() {
  usePageTitle('Products — Equipment Catalogue')
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [contentByProductId, setContentByProductId] = useState({})
  const [searchInput, setSearchInput] = useState('')
  const [brandFilter, setBrandFilter] = useState(() => searchParams.get('brand') || ALL_FILTER)
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || ALL_FILTER)
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState(() => searchParams.get('equipmentType') || ALL_FILTER)
  const [completionFilter, setCompletionFilter] = useState(() => searchParams.get('completion') || ALL_FILTER)
  const [attentionFilter, setAttentionFilter] = useState(() => searchParams.get('attention') || CATALOGUE_ATTENTION.ALL)
  const [imageAdminFilter, setImageAdminFilter] = useState(ALL_FILTER)
  const [viewFilter, setViewFilter] = useState(VIEW_ALL)
  const [safeCandidateIds, setSafeCandidateIds] = useState(new Set())
  const [singleSourceNeedsReviewIds, setSingleSourceNeedsReviewIds] = useState(new Set())
  const [reviewReasonsByProductId, setReviewReasonsByProductId] = useState({})
  const [safeEvalLoading, setSafeEvalLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [editProductId, setEditProductId] = useState(null)
  const [imageProductId, setImageProductId] = useState(null)
  const [mergeSourceId, setMergeSourceId] = useState(null)
  const [sourceRows, setSourceRows] = useState([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [highConfidenceModalOpen, setHighConfidenceModalOpen] = useState(false)
  const [highConfidencePreview, setHighConfidencePreview] = useState(null)
  const [highConfidenceLoading, setHighConfidenceLoading] = useState(false)
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [completionExporting, setCompletionExporting] = useState(false)
  const [openActionsMenuId, setOpenActionsMenuId] = useState(null)
  const [imageActionMessage, setImageActionMessage] = useState('')

  const applyProductRowUpdate = useCallback((updatedProduct) => {
    if (!updatedProduct?.id) return
    setProducts((current) => current.map((product) => (
      product.id === updatedProduct.id ? { ...product, ...updatedProduct } : product
    )))
  }, [])

  const handleImageProductUpdated = useCallback((updatedProduct, message) => {
    applyProductRowUpdate(updatedProduct)
    if (message) setImageActionMessage(message)
  }, [applyProductRowUpdate])

  useEffect(() => {
    if (!imageActionMessage) return undefined
    const timer = window.setTimeout(() => setImageActionMessage(''), 4500)
    return () => window.clearTimeout(timer)
  }, [imageActionMessage])

  const loadProducts = useCallback(async ({ showLoading = true } = {}) => {
    const scrollY = window.scrollY
    if (showLoading) {
      setLoading(true)
      setSafeEvalLoading(true)
    }
    setError('')
    const result = await fetchEquipmentProducts()
    if (result.error) {
      setProducts([])
      setSafeCandidateIds(new Set())
      setSingleSourceNeedsReviewIds(new Set())
      setReviewReasonsByProductId({})
      setError(getAdminErrorMessage(result.error))
      if (showLoading) {
        setLoading(false)
        setSafeEvalLoading(false)
      }
      return
    }
    setProducts(result.products)

    const contentResult = await fetchEquipmentProductContentAdminRows()
    if (!contentResult.error) {
      const contentMap = {}
      for (const row of contentResult.rows ?? []) {
        if (row?.equipment_product_id) contentMap[row.equipment_product_id] = row
      }
      setContentByProductId(contentMap)
    }

    const evaluation = await evaluateSafeApprovalCandidates(result.products)
    if (evaluation.error) {
      setSafeCandidateIds(new Set())
      setSingleSourceNeedsReviewIds(new Set())
      setReviewReasonsByProductId({})
      setActionError(getAdminErrorMessage(evaluation.error))
    } else {
      setSafeCandidateIds(evaluation.safeIdSet)
      setSingleSourceNeedsReviewIds(evaluation.singleSourceNeedsReviewIdSet)
      setReviewReasonsByProductId(evaluation.reviewReasonsByProductId)
    }

    if (showLoading) {
      setLoading(false)
      setSafeEvalLoading(false)
    }

    if (!showLoading) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY)
      })
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    const nextAttention = searchParams.get('attention') || CATALOGUE_ATTENTION.ALL
    setAttentionFilter(nextAttention)
  }, [searchParams])

  useEffect(() => {
    const editKey = searchParams.get('edit')
    if (!editKey || !products.length) return
    const match = products.find((product) => product.canonical_product_key === editKey)
    if (match) setEditProductId(match.id)
  }, [searchParams, products])

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )

  const selectedApprovableIds = useMemo(() => (
    [...selectedIds].filter((id) => {
      const product = productsById.get(id)
      return product && (
        product.status === PRODUCT_STATUS.PENDING
        || product.status === PRODUCT_STATUS.NEEDS_REVIEW
      )
    })
  ), [selectedIds, productsById])

  const selectedSafeApprovableIds = useMemo(() => (
    selectedApprovableIds.filter((id) => safeCandidateIds.has(id))
  ), [selectedApprovableIds, safeCandidateIds])

  const brandOptions = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort(),
    [products],
  )

  const equipmentTypeOptions = useMemo(
    () => [...new Set(products.map((product) => product.equipment_type).filter(Boolean))].sort(),
    [products],
  )

  const scopeProducts = useMemo(() => {
    const query = searchInput.trim().toLowerCase()
    return products.filter((product) => {
      if (brandFilter && product.brand !== brandFilter) return false
      if (equipmentTypeFilter && product.equipment_type !== equipmentTypeFilter) return false
      if (!query) return true
      const haystack = [
        product.brand,
        product.product_family,
        product.model,
        product.canonical_product_name,
        product.equipment_type,
      ].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [products, searchInput, brandFilter, equipmentTypeFilter])

  const statusCounts = useMemo(() => ({
    safeToApprove: scopeProducts.filter((product) => safeCandidateIds.has(product.id)).length,
    singleSourceNeedsReview: scopeProducts.filter((product) => singleSourceNeedsReviewIds.has(product.id)).length,
    needsReview: scopeProducts.filter((product) => product.status === PRODUCT_STATUS.NEEDS_REVIEW).length,
    approved: scopeProducts.filter((product) => product.status === PRODUCT_STATUS.APPROVED).length,
    excluded: scopeProducts.filter((product) => product.status === PRODUCT_STATUS.EXCLUDED).length,
  }), [scopeProducts, safeCandidateIds, singleSourceNeedsReviewIds])

  const imageAdminCounts = useMemo(() => ({
    hasImage: scopeProducts.filter((product) => matchesImageAdminFilter(product, IMAGE_ADMIN_FILTER.HAS_IMAGE)).length,
    suggested: scopeProducts.filter((product) => matchesImageAdminFilter(product, IMAGE_ADMIN_FILTER.SUGGESTED)).length,
    approved: scopeProducts.filter((product) => matchesImageAdminFilter(product, IMAGE_ADMIN_FILTER.APPROVED)).length,
    needsReview: scopeProducts.filter((product) => matchesImageAdminFilter(product, IMAGE_ADMIN_FILTER.NEEDS_REVIEW)).length,
    blockedRejected: scopeProducts.filter((product) => matchesImageAdminFilter(product, IMAGE_ADMIN_FILTER.BLOCKED_REJECTED)).length,
    blockedSuggested: scopeProducts.filter((product) => (
      product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
      && assessEquipmentProductImageRisk(product).riskLevel === IMAGE_AUDIT_RISK.BLOCKED
    )).length,
  }), [scopeProducts])

  const filteredProducts = useMemo(() => {
    return scopeProducts.filter((product) => {
      if (statusFilter && product.status !== statusFilter) return false
      if (viewFilter === VIEW_SAFE_CANDIDATES && !safeCandidateIds.has(product.id)) return false
      if (completionFilter && completionFilter !== ALL_FILTER) {
        const completionStatus = deriveCanonicalProductCompletionStatus(product)
        if (completionFilter === COMPLETION_DASHBOARD_FILTER.INCOMPLETE) {
          if (!completionStatus || completionStatus === CANONICAL_COMPLETION_STATUS.COMPLETE) return false
        } else if (completionFilter === COMPLETION_DASHBOARD_FILTER.COMPLETE) {
          if (completionStatus !== CANONICAL_COMPLETION_STATUS.COMPLETE) return false
        } else if (completionStatus !== completionFilter) {
          return false
        }
      }
      if (imageAdminFilter && imageAdminFilter !== ALL_FILTER) {
        if (!matchesImageAdminFilter(product, imageAdminFilter)) return false
      }
      if (!matchesCatalogueAttentionFilter(product, attentionFilter, contentByProductId)) {
        return false
      }
      return true
    })
  }, [
    scopeProducts,
    statusFilter,
    viewFilter,
    safeCandidateIds,
    completionFilter,
    imageAdminFilter,
    attentionFilter,
    contentByProductId,
  ])

  const catalogueSummary = useMemo(
    () => buildCatalogueSummary(scopeProducts, contentByProductId),
    [scopeProducts, contentByProductId],
  )

  function setAttentionAndUrl(nextAttention) {
    setAttentionFilter(nextAttention)
    const next = new URLSearchParams(searchParams)
    if (!nextAttention || nextAttention === CATALOGUE_ATTENTION.ALL) next.delete('attention')
    else next.set('attention', nextAttention)
    setSearchParams(next, { replace: true })
  }

  const productsMatchingActionFilters = filteredProducts

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const editProduct = useMemo(
    () => products.find((product) => product.id === editProductId) ?? null,
    [products, editProductId],
  )

  const imageProduct = useMemo(
    () => products.find((product) => product.id === imageProductId) ?? null,
    [products, imageProductId],
  )

  const allFilteredSelected = filteredProducts.length > 0
    && filteredProducts.every((product) => selectedIds.has(product.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(filteredProducts.map((product) => product.id)))
  }

  function toggleSelect(productId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  async function openSourceRows(product) {
    setSelectedProductId(product.id)
    setSourceLoading(true)
    setSourceRows([])
    const result = await fetchEquipmentIntelligenceByIds(product.source_intelligence_row_ids ?? [])
    setSourceLoading(false)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    setSourceRows(result.rows)
  }

  async function handleApprove(productId) {
    const result = await approveEquipmentProduct(productId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await loadProducts()
  }

  async function handleExclude(productId) {
    const result = await excludeEquipmentProduct(productId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await loadProducts()
  }

  async function handleMerge(targetProductId) {
    if (!mergeSourceId || mergeSourceId === targetProductId) {
      setActionError('Select a different product to merge from the Merge action first.')
      return
    }
    const result = await mergeEquipmentProducts(targetProductId, [mergeSourceId])
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    setMergeSourceId(null)
    await loadProducts()
  }

  async function runBulkApproval(ids, {
    safeCandidatesOnly = false,
    title = 'Bulk approval complete',
    emptyMessage = 'Select products to approve.',
    confirmMessage,
  }) {
    if (!ids.length) {
      setActionError(emptyMessage)
      return
    }

    const message = confirmMessage
      ?? `You are about to approve ${ids.length} selected canonical product(s). This will make them eligible for public/catalogue workflows. Continue?`
    if (!window.confirm(message)) return

    setBulkLoading(true)
    setActionError('')
    setApprovalSummary(null)
    const result = await bulkApproveEquipmentProducts(ids, { safeCandidatesOnly })
    setBulkLoading(false)

    if (result.error && result.approved === 0) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }

    if (result.approved === 0 && !result.failures?.length) {
      setActionError('No pending or needs_review products were approved from the selection.')
      return
    }

    setApprovalSummary({
      title,
      approved: result.approved,
      skipped: result.skipped,
      failures: result.failures,
    })
    setSelectedIds(new Set())
    await loadProducts()
  }

  async function handleBulkApproveSelected() {
    await runBulkApproval(selectedApprovableIds, {
      safeCandidatesOnly: false,
      title: 'Bulk approval complete',
      emptyMessage: 'Select pending or needs_review products to approve.',
    })
  }

  async function handleBulkApproveSafe() {
    await runBulkApproval(selectedSafeApprovableIds, {
      safeCandidatesOnly: true,
      title: 'Safe bulk approval complete',
      emptyMessage: 'No safe approval candidates selected. Use "Bulk approve selected" to approve pending products regardless of safe status.',
      confirmMessage: `You are about to approve ${selectedSafeApprovableIds.length} selected safe canonical product(s). This will make them eligible for public/catalogue workflows. Continue?`,
    })
  }

  async function handleBulkExclude() {
    const ids = [...selectedIds]
    if (!ids.length) {
      setActionError('Select products to exclude.')
      return
    }

    if (!window.confirm(`Exclude ${ids.length} product(s)? They will be skipped from research.`)) return

    setBulkLoading(true)
    setActionError('')
    const result = await bulkExcludeEquipmentProducts(ids)
    setBulkLoading(false)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    setSelectedIds(new Set())
    await loadProducts()
  }

  async function handleBulkApproveFilteredSafe() {
    const ids = filteredProducts
      .filter((product) => safeCandidateIds.has(product.id))
      .map((product) => product.id)
    if (!ids.length) {
      setActionError('No safe approval candidates in the current filters.')
      return
    }
    if (!window.confirm(`Approve ${ids.length} safe approval candidate(s) for the current filters?`)) return

    setBulkLoading(true)
    setActionError('')
    setApprovalSummary(null)
    const result = await bulkApproveEquipmentProducts(ids, { safeCandidatesOnly: true })
    setBulkLoading(false)
    if (result.error && result.approved === 0) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    setApprovalSummary({
      title: 'Filtered safe approval complete',
      approved: result.approved,
      skipped: result.skipped,
      failures: result.failures,
    })
    await loadProducts()
  }

  async function handleBulkApproveSingleSourceNeedsReviewFiltered() {
    const targets = productsMatchingActionFilters.filter((product) => (
      singleSourceNeedsReviewIds.has(product.id)
    ))
    if (!targets.length) {
      setActionError('No single-source needs_review products eligible in the current filters.')
      return
    }
    if (!window.confirm(`Approve ${targets.length} single-source needs_review product(s) for the current filters?`)) return

    setBulkLoading(true)
    setActionError('')
    const result = await bulkApproveSingleSourceNeedsReviewProducts(targets)
    setBulkLoading(false)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    setApprovalSummary({
      title: 'Single-source needs review approval complete',
      approved: result.approved,
      skipped: result.skipped,
    })
    await loadProducts()
  }

  async function openHighConfidenceApproveModal() {
    setHighConfidenceLoading(true)
    setActionError('')
    const evaluation = await evaluateHighConfidenceApprovalCandidates(
      productsMatchingActionFilters,
      { minScore: HIGH_CONFIDENCE_MIN_SCORE },
    )
    setHighConfidenceLoading(false)
    if (evaluation.error) {
      setActionError(getAdminErrorMessage(evaluation.error))
      return
    }
    setHighConfidencePreview(evaluation)
    setHighConfidenceModalOpen(true)
  }

  async function handleConfirmHighConfidenceApprove() {
    setHighConfidenceLoading(true)
    setActionError('')
    const result = await bulkApproveHighConfidenceProducts(
      productsMatchingActionFilters,
      { minScore: HIGH_CONFIDENCE_MIN_SCORE },
    )
    setHighConfidenceLoading(false)
    setHighConfidenceModalOpen(false)
    setHighConfidencePreview(null)

    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }

    setApprovalSummary({
      title: 'High-confidence approval complete',
      approved: result.approved,
      skipped: result.skipped,
      skippedReasons: result.skippedReasons,
    })
    await loadProducts()
  }

  async function handleBulkRejectBlockedImages() {
    setBulkLoading(true)
    setActionError('')
    const result = await bulkRejectBlockedEquipmentProductImages(productsMatchingActionFilters)
    setBulkLoading(false)
    if (result.failures.length) {
      setActionError(getAdminErrorMessage(result.failures[0].error))
    }
    if (result.rejected > 0) {
      const rejectedIds = new Set(
        result.targets
          .filter((target) => !result.failures.some((failure) => failure.productId === target.id))
          .map((target) => target.id),
      )
      setProducts((current) => current.map((product) => (
        rejectedIds.has(product.id)
          ? {
              ...product,
              image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
              image_url: null,
              image_storage_path: null,
              image_failure_reason: product.image_failure_reason ?? 'Blocked dealer/watermarked source',
            }
          : product
      )))
      setApprovalSummary({
        title: 'Blocked image cleanup complete',
        approved: result.rejected,
        skipped: 0,
      })
      setImageActionMessage(`${result.rejected} image(s) rejected`)
    } else if (!result.failures.length) {
      setActionError('No suggested images from blocked domains matched the current filters.')
    }
  }

  async function handleExportCompletionProducts(exportProducts, label) {
    if (!exportProducts.length) return
    setCompletionExporting(true)
    setActionError('')
    try {
      await exportCanonicalProductsSpreadsheet(exportProducts, {
        label,
        origin: window.location.origin,
      })
    } catch (exportError) {
      setActionError(getAdminErrorMessage(exportError))
    } finally {
      setCompletionExporting(false)
    }
  }

  const completionDashboardFilters = useMemo(() => ({
    brand: brandFilter,
    equipmentType: equipmentTypeFilter,
    completionFilter: completionFilter === ALL_FILTER
      ? COMPLETION_DASHBOARD_FILTER.ALL
      : completionFilter,
  }), [brandFilter, equipmentTypeFilter, completionFilter])

  return (
    <div className="admin-intelligence admin-products">
      <EquipmentCatalogueNav
        title="Products"
        subtitle="Manage products, images, valuation data and catalogue content."
        actions={(
          <>
            <Link to="/admin/intelligence/add-product" className="admin-intelligence__button admin-intelligence__button--primary">
              Add product
            </Link>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              onClick={() => loadProducts({ showLoading: true })}
              disabled={loading}
            >
              Refresh
            </button>
          </>
        )}
      />

      {loading ? <LoadingState compact>Loading products…</LoadingState> : null}
      {error ? <ErrorState compact>{error}</ErrorState> : null}
      {actionError ? <ErrorState compact>{actionError}</ErrorState> : null}
      <ImageActionToast
        message={imageActionMessage}
        onDismiss={() => setImageActionMessage('')}
      />
      <BulkApprovalSummary summary={approvalSummary} onDismiss={() => setApprovalSummary(null)} />

      {!loading && !error ? (
        <section className="equipment-catalogue-summary" aria-label="Catalogue summary">
          <button type="button" className="equipment-catalogue-summary__card" onClick={() => setAttentionAndUrl(CATALOGUE_ATTENTION.ALL)}>
            <span>Total</span>
            <strong>{catalogueSummary.total}</strong>
          </button>
          <button type="button" className="equipment-catalogue-summary__card" onClick={() => setAttentionAndUrl(CATALOGUE_ATTENTION.READY)}>
            <span>Ready</span>
            <strong>{catalogueSummary.ready}</strong>
          </button>
          <button type="button" className="equipment-catalogue-summary__card" onClick={() => setAttentionAndUrl(CATALOGUE_ATTENTION.ATTENTION)}>
            <span>Needs attention</span>
            <strong>{catalogueSummary.needsAttention}</strong>
          </button>
          <div className="equipment-catalogue-summary__card">
            <span>Image coverage</span>
            <strong>{catalogueSummary.imageCoveragePct}%</strong>
          </div>
          <div className="equipment-catalogue-summary__card">
            <span>RRP coverage</span>
            <strong>{catalogueSummary.rrpCoveragePct}%</strong>
          </div>
          <div className="equipment-catalogue-summary__card">
            <span>Year coverage</span>
            <strong>{catalogueSummary.yearCoveragePct}%</strong>
          </div>
          <div className="equipment-catalogue-summary__card">
            <span>Content coverage</span>
            <strong>{catalogueSummary.contentCoveragePct}%</strong>
          </div>
        </section>
      ) : null}

      {!loading && !error ? (
        <CanonicalProductCompletionDashboard
          products={products}
          variant="compact"
          filters={completionDashboardFilters}
          onFiltersChange={() => {}}
          exporting={completionExporting}
          onExportIncomplete={(exportProducts) => handleExportCompletionProducts(exportProducts, 'incomplete')}
          onExportCompleted={(exportProducts) => handleExportCompletionProducts(exportProducts, 'complete')}
        />
      ) : null}

      {!loading && !error ? (
        <section className="admin-intelligence__panel">
          <div className="equipment-catalogue-quick-filters" aria-label="Quick status filters">
            {[
              CATALOGUE_ATTENTION.ALL,
              CATALOGUE_ATTENTION.READY,
              CATALOGUE_ATTENTION.NEEDS_IMAGE,
              CATALOGUE_ATTENTION.NEEDS_PRICE,
              CATALOGUE_ATTENTION.NEEDS_YEAR,
              CATALOGUE_ATTENTION.NEEDS_CONTENT,
              CATALOGUE_ATTENTION.NEEDS_REVIEW,
            ].map((key) => (
              <button
                key={key}
                type="button"
                className={`equipment-catalogue-quick-filters__chip${attentionFilter === key ? ' equipment-catalogue-quick-filters__chip--active' : ''}`}
                onClick={() => setAttentionAndUrl(key)}
              >
                {CATALOGUE_ATTENTION_LABELS[key]}
              </button>
            ))}
          </div>

          <div className="admin-intelligence__filters admin-products__filters">
            <div className="admin-intelligence__field admin-products__search-field">
              <label className="admin-intelligence__label" htmlFor="product-search">Search</label>
              <input id="product-search" type="search" className="admin-intelligence__input" placeholder="Brand, model, family, type…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Brand</span>
              <select className="admin-intelligence__select" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                <option value={ALL_FILTER}>All brands</option>
                {brandOptions.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
              </select>
            </label>
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Category</span>
              <select className="admin-intelligence__select" value={equipmentTypeFilter} onChange={(e) => setEquipmentTypeFilter(e.target.value)}>
                <option value={ALL_FILTER}>All categories</option>
                {equipmentTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="admin-intelligence__field">
              <span className="admin-intelligence__label">Status</span>
              <select className="admin-intelligence__select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value={ALL_FILTER}>All statuses</option>
                <option value="pending">Pending</option>
                <option value="needs_review">Needs review</option>
                <option value="approved">Approved</option>
                <option value="excluded">Excluded</option>
              </select>
            </label>
          </div>

          <div className="admin-products__summary-bar">
            <span>{filteredProducts.length} matching products</span>
          </div>

          <div className="admin-products__bulk-bar">
            <label className="admin-products__select-all">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} />
              Select filtered
            </label>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--primary"
              disabled={bulkLoading || selectedApprovableIds.length === 0}
              onClick={handleBulkApproveSelected}
            >
              Approve selected ({selectedApprovableIds.length})
            </button>
            <button
              type="button"
              className="admin-intelligence__button"
              disabled={bulkLoading || selectedIds.size === 0}
              onClick={handleBulkExclude}
            >
              Delete / exclude ({selectedIds.size})
            </button>
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              disabled={bulkLoading || highConfidenceLoading}
              onClick={openHighConfidenceApproveModal}
            >
              Approve high confidence 90+
            </button>
            <Link
              to="/admin/intelligence/product-content"
              className="admin-intelligence__button admin-intelligence__button--secondary"
            >
              Publish content
            </Link>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState compact>
              No products match these filters.
            </EmptyState>
          ) : (
            <div className="admin-intelligence__table-wrap admin-products__table-wrap">
              <table className="admin-intelligence__table admin-products__table">
                <thead>
                  <tr>
                    <th className="admin-products__col-select" aria-label="Select" />
                    <th className="admin-products__col-image">Image</th>
                    <th className="admin-products__col-product">Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>RRP</th>
                    <th>From</th>
                    <th>Image</th>
                    <th>Content</th>
                    <th>Status</th>
                    <th className="admin-products__col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const thumbUrl = getAdminProductImageThumbUrl(product)
                    const catalogueStatus = getCatalogueStatusLabel(product, contentByProductId)
                    return (
                      <tr
                        key={product.id}
                        className={mergeSourceId === product.id ? 'admin-products__row-merge-source' : undefined}
                        onDoubleClick={() => setEditProductId(product.id)}
                      >
                        <td className="admin-products__col-select">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            aria-label={`Select ${product.canonical_product_name}`}
                          />
                        </td>
                        <td className="admin-products__col-image">
                          <ProductImageCell
                            product={product}
                            thumbUrl={thumbUrl}
                            onImageAudit={() => setImageProductId(product.id)}
                          />
                        </td>
                        <td className="admin-products__col-product">
                          <button
                            type="button"
                            className="admin-products__identity-button"
                            onClick={() => setEditProductId(product.id)}
                            style={{
                              display: 'grid',
                              gap: '0.15rem',
                              padding: 0,
                              border: 0,
                              background: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: 'inherit',
                              font: 'inherit',
                            }}
                          >
                            <strong>{product.canonical_product_name}</strong>
                            {product.product_family || product.model ? (
                              <span style={{ color: 'var(--color-muted)', fontSize: '0.8125rem' }}>
                                {[product.product_family, product.model].filter(Boolean).join(' · ')}
                              </span>
                            ) : null}
                          </button>
                        </td>
                        <td>{product.brand}</td>
                        <td>{product.equipment_type || '—'}</td>
                        <td>{formatPrice(product)}</td>
                        <td>{product.baseline_manufacture_year || '—'}</td>
                        <td>{getCatalogueImageStatusLabel(product)}</td>
                        <td>{getCatalogueContentStatusLabel(product, contentByProductId)}</td>
                        <td>
                          <span className={`equipment-catalogue-status${catalogueStatus === 'Ready' ? ' equipment-catalogue-status--ready' : ' equipment-catalogue-status--attention'}`}>
                            {catalogueStatus}
                          </span>
                        </td>
                        <td className="admin-products__col-actions">
                          <ProductRowActions
                            product={product}
                            mergeSourceId={mergeSourceId}
                            menuOpen={openActionsMenuId === product.id}
                            onToggleMenu={() => setOpenActionsMenuId((current) => (
                              current === product.id ? null : product.id
                            ))}
                            onCloseMenu={() => setOpenActionsMenuId(null)}
                            onViewSources={() => openSourceRows(product)}
                            onImageAudit={() => setImageProductId(product.id)}
                            onEdit={() => setEditProductId(product.id)}
                            onApprove={() => handleApprove(product.id)}
                            onMergeSource={() => setMergeSourceId(product.id)}
                            onMergeInto={() => handleMerge(product.id)}
                            onExclude={() => handleExclude(product.id)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {selectedProduct ? (
        <ProductSourceRowsModal
          product={selectedProduct}
          sourceRows={sourceRows}
          loading={sourceLoading}
          onClose={() => { setSelectedProductId(null); setSourceRows([]) }}
        />
      ) : null}

      {editProduct ? (
        <ProductEditModal
          product={editProduct}
          onClose={() => setEditProductId(null)}
          onSaved={loadProducts}
          onOpenImage={setImageProductId}
        />
      ) : null}

      {imageProduct ? (
        <ProductImageAuditModal
          product={imageProduct}
          onClose={() => setImageProductId(null)}
          onProductUpdated={handleImageProductUpdated}
        />
      ) : null}

      <HighConfidenceApproveModal
        open={highConfidenceModalOpen}
        preview={highConfidencePreview}
        brandFilter={brandFilter}
        minScore={HIGH_CONFIDENCE_MIN_SCORE}
        loading={highConfidenceLoading}
        onConfirm={handleConfirmHighConfidenceApprove}
        onClose={() => {
          setHighConfidenceModalOpen(false)
          setHighConfidencePreview(null)
        }}
      />
    </div>
  )
}
