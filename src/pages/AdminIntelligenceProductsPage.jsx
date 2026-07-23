import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import EquipmentCatalogueNav from '../components/admin/EquipmentCatalogueNav.jsx'
import BulkImageApprovalModal from '../components/admin/BulkImageApprovalModal.jsx'
import ProductImageSearchConfirmModal from '../components/admin/ProductImageSearchConfirmModal.jsx'
import ProductImageSearchJobPanel from '../components/admin/ProductImageSearchJobPanel.jsx'
import { getAdminErrorMessage } from '../lib/admin'
import {
  CATALOGUE_ATTENTION,
  CATALOGUE_ATTENTION_LABELS,
  getCatalogueContentStatusLabel,
  getCatalogueImageStatusLabel,
  getCatalogueStatusLabel,
} from '../lib/equipmentCatalogueAdmin.js'
import {
  approveEquipmentProduct,
  approveEquipmentProductImage,
  buildEquipmentProductImageUpdateFields,
  buildEquipmentProductPagePath,
  bulkApproveEquipmentProductImages,
  bulkApproveHighConfidenceProducts,
  bulkExcludeEquipmentProducts,
  bulkRejectEquipmentProductImages,
  bulkRejectBlockedEquipmentProductImages,
  evaluateHighConfidenceApprovalCandidates,
  excludeEquipmentProduct,
  fetchEquipmentIntelligenceByIds,
  mergeEquipmentProducts,
  productHasBaselineYear,
  productHasRrp,
  PRODUCT_STATUS,
  previewBulkEquipmentProductImageApproval,
  rejectEquipmentProductImage,
  replaceEquipmentProductImage,
  suggestEquipmentProductImageFromSearch,
  updateEquipmentProduct,
  uploadAndReplaceEquipmentProductImageFile,
} from '../lib/equipmentProducts.js'
import { getEquipmentProductDisplayName } from '../lib/equipmentValuation.js'
import {
  applyEquipmentProductListQueryPatch,
  buildContentStatusMapFromListRows,
  clampEquipmentProductListPage,
  clampEquipmentProductListPageSize,
  EQUIPMENT_PRODUCT_LIST_PAGE_SIZES,
  fetchAdminEquipmentProductById,
  fetchAdminEquipmentProductByKey,
  fetchAdminEquipmentProductFilterOptions,
  fetchAdminEquipmentProductsDashboardMeta,
  fetchAdminEquipmentProductsForExport,
  fetchAdminEquipmentProductsPage,
  normalizeFilterOptionList,
  parseEquipmentProductListQueryParams,
} from '../lib/equipmentProductsAdminList.js'
import {
  cancelEquipmentProductImageSearchJob,
  clearCompletedEquipmentProductImageSearchJobs,
  createEquipmentProductImageSearchJob,
  deleteEquipmentProductImageSearchJob,
  fetchJobItemStatusesForProducts,
  formatImageSearchSelectionLabel,
  IMAGE_SEARCH_JOB_MAX_PRODUCTS,
  IMAGE_SEARCH_SELECTION_MODE,
  IMAGE_STATUS_FILTER_OPTIONS,
  listEquipmentProductImageSearchJobs,
  previewEquipmentProductImageSearchJob,
  productRowImageSearchLabel,
  rerunEquipmentProductImageSearchJob,
  retryEquipmentProductImageSearchJob,
  runEquipmentProductImageSearchJobStep,
} from '../lib/equipmentProductImageSearchJobs.js'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  appendEquipmentProductImageCacheBuster,
  buildEquipmentProductImagePublicUrl,
  normalizeEquipmentProductImageStoragePath,
  productHasDisplayableImage,
  resolveEquipmentProductImageDisplayUrl,
} from '../lib/equipmentProductImages.js'
import {
  isBulkImageApprovalShortcutVisible,
} from '../lib/equipmentProductImageReview.js'
import { supabase } from '../lib/supabase.js'
import {
  assessEquipmentProductImageRisk,
  IMAGE_AUDIT_RISK,
} from '../lib/equipmentProductImageAudit.js'
import { getDetectedConsoleFromRow } from '../lib/intelligenceCanonicalProducts.js'
import {
  COMPLETION_DASHBOARD_FILTER,
  exportCanonicalProductsSpreadsheet,
} from '../lib/canonicalProductCompletionStats.js'
import CanonicalProductCompletionDashboard from '../components/admin/CanonicalProductCompletionDashboard.jsx'
import EquipmentProductResearchExportModal from '../components/admin/EquipmentProductResearchExportModal.jsx'
import EquipmentProductResearchImportModal from '../components/admin/EquipmentProductResearchImportModal.jsx'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminIntelligenceProductsPage.css'
import '../components/admin/EquipmentCatalogueNav.css'

const ALL_FILTER = ''
const SEARCH_DEBOUNCE_MS = 300
const META_CACHE_MS = 60_000
const HIGH_CONFIDENCE_MIN_SCORE = 90

function ensureSelectedFilterOption(options, selected) {
  const value = String(selected ?? '').trim()
  if (!value) return options
  if (options.includes(value)) return options
  return [value, ...options]
}

function deriveConsoleFromRow(row) {
  return getDetectedConsoleFromRow(row) ?? null
}

function formatPrice(product) {
  const price = product?.original_base_price
  if (price == null) return '—'
  const currency = (product.original_base_price_currency || 'GBP').toUpperCase()
  return `${currency} ${Number(price).toLocaleString('en-GB')}`
}

function ProductImageCell({ product, thumbUrl, onImageAudit }) {
  return (
    <div className="admin-products__image-cell">
      <div className="admin-products__image-thumb-wrap">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={getEquipmentProductDisplayName(product)}
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
            <p className="admin-products__modal-subtitle">{getEquipmentProductDisplayName(product)}</p>
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
  return Boolean(product.image_url || product.image_storage_path)
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
            <p className="admin-products__modal-subtitle">{getEquipmentProductDisplayName(product)}</p>
          </div>
          <button type="button" className="admin-intelligence__button" onClick={onClose}>Close</button>
        </header>
        <div className="admin-products__modal-body admin-products__image-modal-body">
          <div className="admin-products__image-preview-wrap">
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                alt={getEquipmentProductDisplayName(product)}
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
          <h2>Edit — {getEquipmentProductDisplayName(product)}</h2>
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

  const primaryLabel = summary.excluded != null ? 'Excluded' : 'Approved'
  const primaryCount = summary.excluded ?? summary.approved ?? 0
  const failureMessage = summary.excluded != null
    ? `${summary.failures.length} product(s) could not be excluded. Check admin permissions or product state.`
    : `${summary.failures.length} product(s) could not be approved. Check admin permissions or product state.`

  return (
    <div className="admin-products__approval-summary" role="status">
      <div className="admin-products__approval-summary-header">
        <strong>{summary.title || 'Bulk approval complete'}</strong>
        <button type="button" className="admin-intelligence__button" onClick={onDismiss}>Dismiss</button>
      </div>
      <p>
        {primaryLabel} <strong>{primaryCount}</strong>
        {summary.skipped > 0 ? (
          <>
            {' · '}
            Skipped <strong>{summary.skipped}</strong>
          </>
        ) : null}
        {summary.failures?.length ? (
          <>
            {' · '}
            Failed <strong>{summary.failures.length}</strong>
          </>
        ) : null}
      </p>
      {summary.failures?.length ? (
        <p className="admin-products__confirm-warning">
          {failureMessage}
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
  const listRequestIdRef = useRef(0)
  const metaCacheRef = useRef({ at: 0, meta: null })
  const detailCacheRef = useRef(new Map())
  const hasLoadedRowsRef = useRef(false)
  const filterOptionsCacheRef = useRef({ brands: [], equipmentTypes: [], at: 0 })

  const listQuery = useMemo(
    () => parseEquipmentProductListQueryParams(searchParams),
    [searchParams],
  )

  const {
    page,
    pageSize,
    search: debouncedSearch,
    brand: brandFilter,
    status: statusFilter,
    equipmentType: equipmentTypeFilter,
    completion: completionFilter,
    attention: attentionFilter,
    imageFilter: imageFilterValue,
    imageSearchJobId,
    imageSourceDomain,
    minImageConfidence,
    minCandidateScore,
    sort,
    sortDir,
  } = listQuery

  const [loading, setLoading] = useState(true)
  const [listRefreshing, setListRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [contentByProductId, setContentByProductId] = useState({})
  const [catalogueSummary, setCatalogueSummary] = useState(null)
  const [completionStats, setCompletionStats] = useState(null)
  const [brandOptions, setBrandOptions] = useState([])
  const [equipmentTypeOptions, setEquipmentTypeOptions] = useState([])
  const [searchInput, setSearchInput] = useState(() => listQuery.search)
  const pendingSearchWriteRef = useRef(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectionMode, setSelectionMode] = useState(IMAGE_SEARCH_SELECTION_MODE.PAGE)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [editProductId, setEditProductId] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [imageProductId, setImageProductId] = useState(null)
  const [imageProductDetail, setImageProductDetail] = useState(null)
  const [mergeSourceId, setMergeSourceId] = useState(null)
  const [sourceRows, setSourceRows] = useState([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [highConfidenceModalOpen, setHighConfidenceModalOpen] = useState(false)
  const [highConfidencePreview, setHighConfidencePreview] = useState(null)
  const [highConfidenceLoading, setHighConfidenceLoading] = useState(false)
  const [approvalSummary, setApprovalSummary] = useState(null)
  const [bulkImageApprovalOpen, setBulkImageApprovalOpen] = useState(false)
  const [bulkImageApprovalPreview, setBulkImageApprovalPreview] = useState(null)
  const [bulkImageApprovalBusy, setBulkImageApprovalBusy] = useState(false)
  const [bulkImageApprovalTruncated, setBulkImageApprovalTruncated] = useState(false)
  const [bulkImageApprovalMode, setBulkImageApprovalMode] = useState(IMAGE_SEARCH_SELECTION_MODE.PAGE)
  const [completionExporting, setCompletionExporting] = useState(false)
  const [researchExportOpen, setResearchExportOpen] = useState(false)
  const [researchImportOpen, setResearchImportOpen] = useState(false)
  const [openActionsMenuId, setOpenActionsMenuId] = useState(null)
  const [imageActionMessage, setImageActionMessage] = useState('')
  const [imageSearchModalOpen, setImageSearchModalOpen] = useState(false)
  const [imageSearchPreview, setImageSearchPreview] = useState(null)
  const [imageSearchIncludeApproved, setImageSearchIncludeApproved] = useState(false)
  const [imageSearchBusy, setImageSearchBusy] = useState(false)
  const [imageSearchJobs, setImageSearchJobs] = useState([])
  const [imageSearchActiveJobs, setImageSearchActiveJobs] = useState([])
  const [imageSearchCompletedJobs, setImageSearchCompletedJobs] = useState([])
  const [activeImageSearchJobId, setActiveImageSearchJobId] = useState(null)
  const [jobItemStatusByProductId, setJobItemStatusByProductId] = useState(() => new Map())
  const imageSearchWorkerRef = useRef(false)

  const updateListQuery = useCallback((patch, options = {}) => {
    setSearchParams((previous) => (
      applyEquipmentProductListQueryPatch(previous, patch, options)
    ), { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchInput.trim()
      if (nextSearch === debouncedSearch) return
      pendingSearchWriteRef.current = nextSearch
      updateListQuery({ search: nextSearch })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [searchInput, debouncedSearch, updateListQuery])

  // Sync the text box from the URL only for external navigation (back/forward/shared link).
  useEffect(() => {
    if (pendingSearchWriteRef.current === debouncedSearch) {
      pendingSearchWriteRef.current = null
      return
    }
    setSearchInput(debouncedSearch)
  }, [debouncedSearch])

  const prevFilterIdentityRef = useRef(`${brandFilter}|${statusFilter}|${equipmentTypeFilter}|${completionFilter}|${attentionFilter}|${imageFilterValue}|${imageSearchJobId}|${imageSourceDomain}|${minImageConfidence}|${minCandidateScore}|${debouncedSearch}|${sort}|${sortDir}|${pageSize}`)
  useEffect(() => {
    const identity = `${brandFilter}|${statusFilter}|${equipmentTypeFilter}|${completionFilter}|${attentionFilter}|${imageFilterValue}|${imageSearchJobId}|${imageSourceDomain}|${minImageConfidence}|${minCandidateScore}|${debouncedSearch}|${sort}|${sortDir}|${pageSize}`
    if (prevFilterIdentityRef.current === identity) return
    prevFilterIdentityRef.current = identity
    setSelectedIds(new Set())
    setSelectionMode(IMAGE_SEARCH_SELECTION_MODE.PAGE)
  }, [
    brandFilter,
    statusFilter,
    equipmentTypeFilter,
    completionFilter,
    attentionFilter,
    imageFilterValue,
    imageSearchJobId,
    imageSourceDomain,
    minImageConfidence,
    minCandidateScore,
    debouncedSearch,
    sort,
    sortDir,
    pageSize,
  ])

  const loadDashboardMeta = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    if (
      !force
      && metaCacheRef.current.meta
      && now - metaCacheRef.current.at < META_CACHE_MS
    ) {
      return metaCacheRef.current.meta
    }

    const result = await fetchAdminEquipmentProductsDashboardMeta()
    if (result.error) throw result.error
    metaCacheRef.current = { at: Date.now(), meta: result.meta }
    return result.meta
  }, [])

  const loadFilterOptions = useCallback(async ({ force = false } = {}) => {
    const cached = filterOptionsCacheRef.current
    const cacheFresh = cached.at > 0 && Date.now() - cached.at < META_CACHE_MS
    if (
      !force
      && cacheFresh
      && (cached.brands.length > 0 || cached.equipmentTypes.length > 0)
    ) {
      return {
        brands: cached.brands,
        equipmentTypes: cached.equipmentTypes,
        meta: metaCacheRef.current.meta,
      }
    }

    const [options, meta] = await Promise.all([
      fetchAdminEquipmentProductFilterOptions(),
      loadDashboardMeta({ force }).catch(() => metaCacheRef.current.meta),
    ])

    if (options.error) throw options.error

    let brands = options.brands
    let equipmentTypes = options.equipmentTypes

    // Merge any extra values meta may know about (should match).
    if (meta?.filterOptions?.brands?.length) {
      brands = normalizeFilterOptionList([...brands, ...meta.filterOptions.brands])
    }
    if (meta?.filterOptions?.equipmentTypes?.length) {
      equipmentTypes = normalizeFilterOptionList([
        ...equipmentTypes,
        ...meta.filterOptions.equipmentTypes,
      ])
    }

    filterOptionsCacheRef.current = { brands, equipmentTypes, at: Date.now() }
    return { brands, equipmentTypes, meta }
  }, [loadDashboardMeta])

  const applyFilterOptions = useCallback((brands, equipmentTypes) => {
    if (Array.isArray(brands) && brands.length) setBrandOptions(brands)
    if (Array.isArray(equipmentTypes) && equipmentTypes.length) {
      setEquipmentTypeOptions(equipmentTypes)
    }
  }, [])

  const loadProducts = useCallback(async ({
    showLoading = true,
    refreshMeta = false,
  } = {}) => {
    const requestId = ++listRequestIdRef.current
    const isInitial = !hasLoadedRowsRef.current
    if (showLoading && isInitial) setLoading(true)
    else setListRefreshing(true)
    setError('')

    try {
      const [listResult, optionsResult] = await Promise.all([
        fetchAdminEquipmentProductsPage({
          search: debouncedSearch,
          brand: brandFilter,
          status: statusFilter,
          equipmentType: equipmentTypeFilter,
          completion: completionFilter,
          attention: attentionFilter,
          imageFilter: imageFilterValue,
          imageSearchJobId,
          imageSourceDomain,
          minImageConfidence,
          minCandidateScore,
          page,
          pageSize,
          sort,
          sortDir,
        }),
        loadFilterOptions({ force: refreshMeta }).catch((optionsError) => {
          console.warn('Filter options failed', optionsError)
          return {
            brands: filterOptionsCacheRef.current.brands,
            equipmentTypes: filterOptionsCacheRef.current.equipmentTypes,
            meta: metaCacheRef.current.meta,
          }
        }),
      ])

      if (requestId !== listRequestIdRef.current) return

      applyFilterOptions(optionsResult?.brands, optionsResult?.equipmentTypes)

      const meta = optionsResult?.meta ?? metaCacheRef.current.meta
      if (meta?.summary) setCatalogueSummary(meta.summary)
      if (meta?.completion) {
        setCompletionStats({
          overall: meta.completion.overall ?? {
            totalApproved: 0,
            completed: 0,
            incomplete: 0,
            completionPercentage: 0,
            breakdown: {
              missingPriceOnly: 0,
              missingBaselineOnly: 0,
              missingBoth: 0,
            },
          },
          byBrand: meta.completion.byBrand ?? [],
          filterOptions: {
            brands: optionsResult?.brands ?? meta.filterOptions?.brands ?? [],
            equipmentTypes: optionsResult?.equipmentTypes
              ?? meta.filterOptions?.equipmentTypes
              ?? [],
          },
          scopeProducts: [],
        })
      }

      if (listResult.error) {
        setProducts([])
        setTotalCount(0)
        setContentByProductId({})
        setError(getAdminErrorMessage(listResult.error))
        return
      }

      const safePage = clampEquipmentProductListPage(
        page,
        listResult.totalCount,
        pageSize,
      )
      if (safePage !== page) {
        setTotalCount(listResult.totalCount)
        updateListQuery({ page: safePage }, { resetPage: false })
        return
      }

      hasLoadedRowsRef.current = true
      setProducts(listResult.products)
      setTotalCount(listResult.totalCount)
      setContentByProductId(buildContentStatusMapFromListRows(listResult.products))
      setSelectedIds((current) => {
        if (selectionMode === IMAGE_SEARCH_SELECTION_MODE.FILTERED) return current
        if (!current.size) return current
        const visible = new Set(listResult.products.map((product) => product.id))
        const next = new Set([...current].filter((id) => visible.has(id)))
        return next.size === current.size ? current : next
      })
    } catch (loadError) {
      if (requestId !== listRequestIdRef.current) return
      setError(getAdminErrorMessage(loadError))
    } finally {
      if (requestId === listRequestIdRef.current) {
        setLoading(false)
        setListRefreshing(false)
      }
    }
  }, [
    debouncedSearch,
    brandFilter,
    statusFilter,
    equipmentTypeFilter,
    completionFilter,
    attentionFilter,
    imageFilterValue,
    imageSearchJobId,
    imageSourceDomain,
    minImageConfidence,
    minCandidateScore,
    selectionMode,
    page,
    pageSize,
    sort,
    sortDir,
    loadFilterOptions,
    applyFilterOptions,
    updateListQuery,
  ])

  useEffect(() => {
    // Catalogue list fetch — intentional data sync on filter/page changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async list load
    void loadProducts({ showLoading: true })
  }, [loadProducts])

  useEffect(() => {
    const editKey = searchParams.get('edit')
    if (!editKey) return undefined
    let cancelled = false
    ;(async () => {
      const cached = [...detailCacheRef.current.values()]
        .find((product) => product.canonical_product_key === editKey)
      if (cached) {
        if (!cancelled) {
          setEditProductId(cached.id)
          setEditProduct(cached)
        }
        return
      }
      const result = await fetchAdminEquipmentProductByKey(editKey)
      if (cancelled || result.error || !result.product) return
      detailCacheRef.current.set(result.product.id, result.product)
      setEditProductId(result.product.id)
      setEditProduct(result.product)
    })()
    return () => { cancelled = true }
  }, [searchParams])

  const applyProductRowUpdate = useCallback((updatedProduct) => {
    if (!updatedProduct?.id) return
    detailCacheRef.current.set(updatedProduct.id, {
      ...(detailCacheRef.current.get(updatedProduct.id) ?? {}),
      ...updatedProduct,
    })
    setProducts((current) => current.map((product) => (
      product.id === updatedProduct.id ? { ...product, ...updatedProduct } : product
    )))
    setEditProduct((current) => (
      current?.id === updatedProduct.id ? { ...current, ...updatedProduct } : current
    ))
    setImageProductDetail((current) => (
      current?.id === updatedProduct.id ? { ...current, ...updatedProduct } : current
    ))
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

  const openEditProduct = useCallback(async (productId) => {
    setEditProductId(productId)
    setEditLoading(true)
    setActionError('')
    const cached = detailCacheRef.current.get(productId)
    if (cached?.__detailLoaded) {
      setEditProduct(cached)
      setEditLoading(false)
      return
    }
    const listRow = products.find((product) => product.id === productId) ?? null
    if (listRow) setEditProduct(listRow)

    const result = await fetchAdminEquipmentProductById(productId)
    setEditLoading(false)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    if (!result.product) {
      setActionError('Product not found.')
      setEditProductId(null)
      setEditProduct(null)
      return
    }
    const detailed = { ...result.product, __detailLoaded: true }
    detailCacheRef.current.set(result.product.id, detailed)
    setEditProduct(detailed)
  }, [products])

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  )

  const imageProduct = useMemo(
    () => products.find((product) => product.id === imageProductId)
      ?? (imageProductDetail?.id === imageProductId ? imageProductDetail : null),
    [products, imageProductId, imageProductDetail],
  )

  const openImageAudit = useCallback((product) => {
    if (!product?.id) return
    setImageProductId(product.id)
    setImageProductDetail(product)
  }, [])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1)
  const allPageSelected = products.length > 0
    && products.every((product) => selectedIds.has(product.id))
  const allFilteredSelected = selectionMode === IMAGE_SEARCH_SELECTION_MODE.FILTERED
  const imageSearchSelectionCount = allFilteredSelected
    ? totalCount
    : selectedIds.size
  const bulkImageApproveSelectionCount = allFilteredSelected
    ? totalCount
    : selectedIds.size
  const imageSearchSelectionLabel = formatImageSearchSelectionLabel({
    selectionMode: allFilteredSelected
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : IMAGE_SEARCH_SELECTION_MODE.PAGE,
    selectedCount: imageSearchSelectionCount,
    totalMatching: totalCount,
  })
  const bulkImageShortcutVisible = isBulkImageApprovalShortcutVisible({
    brand: brandFilter,
    imageFilter: imageFilterValue,
  })
  const brandSelectOptions = ensureSelectedFilterOption(brandOptions, brandFilter)
  const equipmentTypeSelectOptions = ensureSelectedFilterOption(
    equipmentTypeOptions,
    equipmentTypeFilter,
  )

  const currentListFilters = useMemo(() => ({
    search: debouncedSearch,
    brand: brandFilter,
    status: statusFilter,
    equipmentType: equipmentTypeFilter,
    completion: completionFilter,
    attention: attentionFilter,
    imageFilter: imageFilterValue,
    imageSearchJobId,
    imageSourceDomain,
    minImageConfidence,
    minCandidateScore,
  }), [
    debouncedSearch,
    brandFilter,
    statusFilter,
    equipmentTypeFilter,
    completionFilter,
    attentionFilter,
    imageFilterValue,
    imageSearchJobId,
    imageSourceDomain,
    minImageConfidence,
    minCandidateScore,
  ])

  function setAttentionFilter(nextAttention) {
    updateListQuery({ attention: nextAttention || CATALOGUE_ATTENTION.ALL })
  }

  function setCompletionFilter(nextCompletion) {
    updateListQuery({ completion: nextCompletion || ALL_FILTER })
  }

  function toggleSelectAll() {
    if (allPageSelected && !allFilteredSelected) {
      setSelectedIds(new Set())
      setSelectionMode(IMAGE_SEARCH_SELECTION_MODE.PAGE)
      return
    }
    setSelectionMode(IMAGE_SEARCH_SELECTION_MODE.PAGE)
    setSelectedIds(new Set(products.map((product) => product.id)))
  }

  function selectAllMatchingFiltered() {
    setSelectionMode(IMAGE_SEARCH_SELECTION_MODE.FILTERED)
    setSelectedIds(new Set(products.map((product) => product.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelectionMode(IMAGE_SEARCH_SELECTION_MODE.PAGE)
  }

  function toggleSelect(productId) {
    setSelectionMode(IMAGE_SEARCH_SELECTION_MODE.PAGE)
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  async function refreshImageSearchJobs() {
    const {
      active,
      completed,
      error: jobsError,
    } = await listEquipmentProductImageSearchJobs({
      activeLimit: 20,
      completedLimit: 20,
    })
    if (jobsError) {
      console.warn('Image search jobs refresh failed', jobsError)
      return
    }
    setImageSearchActiveJobs(active)
    setImageSearchCompletedJobs(completed)
    setImageSearchJobs([...active, ...completed])
  }

  async function refreshJobItemStatuses(productList = products) {
    const ids = productList.map((product) => product.id).filter(Boolean)
    const { byProductId } = await fetchJobItemStatusesForProducts(ids)
    setJobItemStatusByProductId(byProductId)
  }

  async function processImageSearchJob(jobId) {
    if (!jobId || imageSearchWorkerRef.current) return
    imageSearchWorkerRef.current = true
    setImageSearchBusy(true)
    setActiveImageSearchJobId(jobId)
    try {
      let done = false
      while (!done) {
        const { data, error: stepError } = await runEquipmentProductImageSearchJobStep(jobId)
        if (stepError) {
          setActionError(getAdminErrorMessage(stepError))
          break
        }
        if (data?.job) {
          setImageSearchActiveJobs((current) => {
            const others = current.filter((job) => job.id !== data.job.id)
            if (['queued', 'running', 'paused', 'failed'].includes(data.job.status)) {
              return [data.job, ...others]
            }
            return others
          })
          if (['completed', 'cancelled'].includes(data.job.status)) {
            setImageSearchCompletedJobs((current) => [
              data.job,
              ...current.filter((job) => job.id !== data.job.id),
            ])
          }
          setImageSearchJobs((current) => {
            const others = current.filter((job) => job.id !== data.job.id)
            return [data.job, ...others]
          })
        }
        done = Boolean(data?.done) || Number(data?.remaining) === 0
        await refreshJobItemStatuses()
        await loadProducts({ showLoading: false })
        if (!done) {
          await new Promise((resolve) => window.setTimeout(resolve, 400))
        }
      }
    } finally {
      imageSearchWorkerRef.current = false
      setImageSearchBusy(false)
      await refreshImageSearchJobs()
      await refreshJobItemStatuses()
    }
  }

  async function openImageSearchModal() {
    setActionError('')
    setImageSearchBusy(true)
    const mode = allFilteredSelected
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : IMAGE_SEARCH_SELECTION_MODE.PAGE
    const { preview, error: previewError } = await previewEquipmentProductImageSearchJob({
      selectionMode: mode,
      productIds: [...selectedIds],
      filters: currentListFilters,
      includeApproved: imageSearchIncludeApproved,
      maxProducts: IMAGE_SEARCH_JOB_MAX_PRODUCTS,
    })
    setImageSearchBusy(false)
    if (previewError) {
      setActionError(getAdminErrorMessage(previewError))
      return
    }
    setImageSearchPreview(preview)
    setImageSearchModalOpen(true)
  }

  async function startImageSearchJob() {
    setImageSearchBusy(true)
    setActionError('')
    const mode = allFilteredSelected
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : IMAGE_SEARCH_SELECTION_MODE.PAGE
    const { result, error: createError } = await createEquipmentProductImageSearchJob({
      selectionMode: mode,
      productIds: [...selectedIds],
      filters: currentListFilters,
      includeApproved: imageSearchIncludeApproved,
      maxProducts: IMAGE_SEARCH_JOB_MAX_PRODUCTS,
    })
    setImageSearchBusy(false)
    if (createError) {
      setActionError(getAdminErrorMessage(createError))
      return
    }
    setImageSearchModalOpen(false)
    const job = result?.job
    if (job?.id) {
      setImageSearchActiveJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)])
      setImageSearchJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)])
      setActiveImageSearchJobId(job.id)
      clearSelection()
      await processImageSearchJob(job.id)
    }
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

  async function reloadAfterMutation() {
    detailCacheRef.current.clear()
    metaCacheRef.current = { at: 0, meta: null }
    await loadProducts({ showLoading: false, refreshMeta: true })
  }

  async function handleApprove(productId) {
    const result = await approveEquipmentProduct(productId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await reloadAfterMutation()
  }

  async function handleExclude(productId) {
    const result = await excludeEquipmentProduct(productId)
    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    await reloadAfterMutation()
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
    await reloadAfterMutation()
  }

  async function openBulkImageApprovalModal({
    forceFiltered = false,
  } = {}) {
    const mode = (forceFiltered || allFilteredSelected)
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : IMAGE_SEARCH_SELECTION_MODE.PAGE
    setBulkImageApprovalMode(mode)

    if (mode === IMAGE_SEARCH_SELECTION_MODE.PAGE && selectedIds.size === 0) {
      setActionError('Select at least one product first.')
      return
    }

    setBulkImageApprovalBusy(true)
    setActionError('')
    const result = await previewBulkEquipmentProductImageApproval({
      selectionMode: mode,
      productIds: [...selectedIds],
      filters: currentListFilters,
    })
    setBulkImageApprovalBusy(false)

    if (result.error) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }

    setBulkImageApprovalPreview(result.preview)
    setBulkImageApprovalTruncated(Boolean(result.truncated))
    setBulkImageApprovalOpen(true)
  }

  async function confirmBulkImageApproval({
    forceFiltered = false,
  } = {}) {
    const mode = forceFiltered
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : (bulkImageApprovalMode || (
        allFilteredSelected
          ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
          : IMAGE_SEARCH_SELECTION_MODE.PAGE
      ))
    setBulkImageApprovalBusy(true)
    setActionError('')
    setApprovalSummary(null)

    const result = await bulkApproveEquipmentProductImages({
      selectionMode: mode,
      productIds: [...selectedIds],
      filters: currentListFilters,
    })

    setBulkImageApprovalBusy(false)
    setBulkImageApprovalOpen(false)

    if (result.error && result.approved === 0) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }

    if (result.approved === 0 && !result.failures?.length) {
      setActionError('No images were approved from the selection.')
      return
    }

    if (result.updatedProducts?.length) {
      for (const product of result.updatedProducts) {
        applyProductRowUpdate(product)
      }
    }

    setApprovalSummary({
      title: mode === IMAGE_SEARCH_SELECTION_MODE.FILTERED
        ? 'Bulk image approval complete (all filtered)'
        : 'Bulk image approval complete',
      approved: result.approved,
      skipped: result.skipped,
      skippedReasons: result.skippedReasons,
      failures: result.failures,
    })
    clearSelection()
    await reloadAfterMutation()
  }

  async function handleBulkRejectImages() {
    const mode = allFilteredSelected
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : IMAGE_SEARCH_SELECTION_MODE.PAGE
    if (mode === IMAGE_SEARCH_SELECTION_MODE.PAGE && selectedIds.size === 0) {
      setActionError('Select at least one product first.')
      return
    }
    const scopeLabel = mode === IMAGE_SEARCH_SELECTION_MODE.FILTERED
      ? `all ${totalCount.toLocaleString('en-GB')} matching filtered`
      : `${selectedIds.size} selected`
    if (!window.confirm(`Reject pending images for ${scopeLabel} product(s)?`)) return

    setBulkLoading(true)
    setActionError('')
    const result = await bulkRejectEquipmentProductImages({
      selectionMode: mode,
      productIds: [...selectedIds],
      filters: currentListFilters,
    })
    setBulkLoading(false)

    if (result.error && result.rejected === 0) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    if (result.updatedProducts?.length) {
      for (const product of result.updatedProducts) {
        applyProductRowUpdate(product)
      }
    }
    if (result.rejected === 0 && !result.failures?.length) {
      setActionError('No pending images were rejected from the selection.')
      return
    }

    setApprovalSummary({
      title: mode === IMAGE_SEARCH_SELECTION_MODE.FILTERED
        ? 'Bulk image rejection complete (all filtered)'
        : 'Bulk image rejection complete',
      approved: result.rejected,
      skipped: result.skipped,
      failures: result.failures,
    })
    clearSelection()
    await reloadAfterMutation()
  }

  async function handleBulkExcludeProducts() {
    const mode = allFilteredSelected
      ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
      : IMAGE_SEARCH_SELECTION_MODE.PAGE
    if (mode === IMAGE_SEARCH_SELECTION_MODE.PAGE && selectedIds.size === 0) {
      setActionError('Select at least one product first.')
      return
    }
    const scopeLabel = mode === IMAGE_SEARCH_SELECTION_MODE.FILTERED
      ? `all ${totalCount.toLocaleString('en-GB')} matching filtered`
      : `${selectedIds.size} selected`
    if (!window.confirm(
      `Exclude ${scopeLabel} product(s) from the catalogue? Excluded products are hidden from public views.`,
    )) return

    setBulkLoading(true)
    setActionError('')
    setApprovalSummary(null)
    const result = await bulkExcludeEquipmentProducts({
      selectionMode: mode,
      productIds: [...selectedIds],
      filters: currentListFilters,
    })
    setBulkLoading(false)

    if (result.error && result.excluded === 0) {
      setActionError(getAdminErrorMessage(result.error))
      return
    }
    if (result.excluded === 0 && !result.failures?.length) {
      setActionError('No products were excluded from the selection.')
      return
    }

    setApprovalSummary({
      title: mode === IMAGE_SEARCH_SELECTION_MODE.FILTERED
        ? 'Bulk exclusion complete (all filtered)'
        : 'Bulk exclusion complete',
      excluded: result.excluded,
      skipped: 0,
      failures: result.failures,
    })
    clearSelection()
    await reloadAfterMutation()
  }

  async function openHighConfidenceApproveModal() {
    setHighConfidenceLoading(true)
    setActionError('')
    const evaluation = await evaluateHighConfidenceApprovalCandidates(
      products,
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
      products,
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
      title: 'High-confidence approval complete (this page)',
      approved: result.approved,
      skipped: result.skipped,
      skippedReasons: result.skippedReasons,
    })
    await reloadAfterMutation()
  }

  async function handleBulkRejectBlockedImages() {
    setBulkLoading(true)
    setActionError('')
    const result = await bulkRejectBlockedEquipmentProductImages(products)
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
        title: 'Blocked image cleanup complete (this page)',
        approved: result.rejected,
        skipped: 0,
      })
      setImageActionMessage(`${result.rejected} image(s) rejected`)
    } else if (!result.failures.length) {
      setActionError('No suggested images from blocked domains matched this page.')
    }
  }

  async function handleExportCompletionProducts(mode) {
    setCompletionExporting(true)
    setActionError('')
    try {
      const result = await fetchAdminEquipmentProductsForExport({
        brand: brandFilter,
        equipmentType: equipmentTypeFilter,
        completion: mode === 'complete'
          ? COMPLETION_DASHBOARD_FILTER.COMPLETE
          : COMPLETION_DASHBOARD_FILTER.INCOMPLETE,
        status: PRODUCT_STATUS.APPROVED,
      })
      if (result.error) throw result.error
      if (!result.products.length) {
        setActionError(`No ${mode} approved products to export for the current brand/type filters.`)
        return
      }
      await exportCanonicalProductsSpreadsheet(result.products, {
        label: mode,
        origin: window.location.origin,
      })
    } catch (exportError) {
      setActionError(getAdminErrorMessage(exportError))
    } finally {
      setCompletionExporting(false)
    }
  }

  function handleResearchImportApplied(result) {
    const updatedById = new Map(
      (result?.updated || [])
        .filter((entry) => entry.product?.id)
        .map((entry) => [entry.product.id, entry.product]),
    )
    if (updatedById.size) {
      setProducts((current) => current.map((product) => {
        const next = updatedById.get(product.id)
        return next ? { ...product, ...next } : product
      }))
    }
    metaCacheRef.current = { at: 0, meta: null }
    void loadDashboardMeta({ force: true }).then((meta) => {
      if (!meta) return
      if (meta.summary) setCatalogueSummary(meta.summary)
      if (meta.completion) {
        setCompletionStats({
          overall: meta.completion.overall ?? {
            totalApproved: 0,
            completed: 0,
            incomplete: 0,
            completionPercentage: 0,
            breakdown: {
              missingPriceOnly: 0,
              missingBaselineOnly: 0,
              missingBoth: 0,
            },
          },
          byBrand: meta.completion.byBrand ?? [],
          filterOptions: {
            brands: meta.filterOptions?.brands ?? [],
            equipmentTypes: meta.filterOptions?.equipmentTypes ?? [],
          },
          scopeProducts: [],
        })
      }
    }).catch(() => {})
    // Reload current page so completion / attention filters reflect DB state.
    void loadProducts({ showLoading: false, refreshMeta: true })
    setApprovalSummary({
      title: 'Research import complete',
      approved: result?.updated?.length ?? 0,
      skipped: result?.unchanged?.length ?? 0,
    })
  }

  const completionDashboardFilters = useMemo(() => ({
    brand: brandFilter,
    equipmentType: equipmentTypeFilter,
    completionFilter: completionFilter === ALL_FILTER
      ? COMPLETION_DASHBOARD_FILTER.ALL
      : completionFilter,
  }), [brandFilter, equipmentTypeFilter, completionFilter])

  const pageNumbers = useMemo(() => {
    const windowSize = 5
    const start = Math.max(1, Math.min(page - 2, totalPages - windowSize + 1))
    const end = Math.min(totalPages, start + windowSize - 1)
    const items = []
    for (let n = Math.max(1, start); n <= end; n += 1) items.push(n)
    return items
  }, [page, totalPages])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { active, completed } = await listEquipmentProductImageSearchJobs({
        activeLimit: 20,
        completedLimit: 20,
      })
      if (cancelled) return
      setImageSearchActiveJobs(active)
      setImageSearchCompletedJobs(completed)
      setImageSearchJobs([...active, ...completed])
      const running = active.find((job) => ['queued', 'running'].includes(job.status))
      if (running?.id) {
        setActiveImageSearchJobId(running.id)
        processImageSearchJob(running.id)
      }
    })()
    return () => {
      cancelled = true
    }
  // Resume active jobs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!products.length) return
    refreshJobItemStatuses(products)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const activeImageSearchJob = imageSearchActiveJobs.find((job) => (
    ['queued', 'running', 'paused'].includes(job.status)
  ))
  const imageSearchActionDisabled = bulkLoading
    || imageSearchBusy
    || (selectedIds.size === 0 && !allFilteredSelected)
    || Boolean(activeImageSearchJob)

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
              onClick={() => loadProducts({ showLoading: true, refreshMeta: true })}
              disabled={loading || listRefreshing}
            >
              Refresh
            </button>
          </>
        )}
      />

      {error ? (
        <ErrorState compact>
          {error}
          {' '}
          <button
            type="button"
            className="admin-intelligence__button"
            onClick={() => loadProducts({ showLoading: true, refreshMeta: true })}
          >
            Retry
          </button>
        </ErrorState>
      ) : null}
      {actionError ? <ErrorState compact>{actionError}</ErrorState> : null}
      <ImageActionToast
        message={imageActionMessage}
        onDismiss={() => setImageActionMessage('')}
      />
      <BulkApprovalSummary summary={approvalSummary} onDismiss={() => setApprovalSummary(null)} />

      <ProductImageSearchJobPanel
        activeJobs={imageSearchActiveJobs}
        completedJobs={imageSearchCompletedJobs}
        activeJobId={activeImageSearchJobId}
        working={imageSearchBusy}
        onRefresh={refreshImageSearchJobs}
        onCancel={async (jobId) => {
          setImageSearchBusy(true)
          const { error: cancelError } = await cancelEquipmentProductImageSearchJob(jobId)
          setImageSearchBusy(false)
          if (cancelError) setActionError(getAdminErrorMessage(cancelError))
          await refreshImageSearchJobs()
          await loadProducts({ showLoading: false })
        }}
        onRetryFailed={async (jobId) => {
          setImageSearchBusy(true)
          const { error: retryError } = await retryEquipmentProductImageSearchJob(jobId, ['failed'])
          setImageSearchBusy(false)
          if (retryError) {
            setActionError(getAdminErrorMessage(retryError))
            return
          }
          await processImageSearchJob(jobId)
        }}
        onRetryNoResult={async (jobId) => {
          setImageSearchBusy(true)
          const { error: retryError } = await retryEquipmentProductImageSearchJob(jobId, ['no_result'])
          setImageSearchBusy(false)
          if (retryError) {
            setActionError(getAdminErrorMessage(retryError))
            return
          }
          await processImageSearchJob(jobId)
        }}
        onDelete={async (jobId) => {
          setImageSearchBusy(true)
          const { error: deleteError } = await deleteEquipmentProductImageSearchJob(jobId)
          setImageSearchBusy(false)
          if (deleteError) {
            setActionError(getAdminErrorMessage(deleteError))
            return
          }
          await refreshImageSearchJobs()
        }}
        onRunAgain={async (jobId) => {
          setImageSearchBusy(true)
          const { result, error: rerunError } = await rerunEquipmentProductImageSearchJob(jobId)
          setImageSearchBusy(false)
          if (rerunError) {
            setActionError(getAdminErrorMessage(rerunError))
            return
          }
          const job = result?.job
          if (job?.id) {
            setImageSearchActiveJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)])
            setImageSearchJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)])
            setActiveImageSearchJobId(job.id)
            await processImageSearchJob(job.id)
          } else {
            await refreshImageSearchJobs()
          }
        }}
        onClearCompleted={async () => {
          setImageSearchBusy(true)
          const { error: clearError } = await clearCompletedEquipmentProductImageSearchJobs()
          setImageSearchBusy(false)
          if (clearError) {
            setActionError(getAdminErrorMessage(clearError))
            return
          }
          await refreshImageSearchJobs()
        }}
      />

      {catalogueSummary ? (
        <section className="equipment-catalogue-summary" aria-label="Catalogue summary">
          <button type="button" className="equipment-catalogue-summary__card" onClick={() => setAttentionFilter(CATALOGUE_ATTENTION.ALL)}>
            <span>Total</span>
            <strong>{catalogueSummary.total}</strong>
          </button>
          <button type="button" className="equipment-catalogue-summary__card" onClick={() => setAttentionFilter(CATALOGUE_ATTENTION.READY)}>
            <span>Ready</span>
            <strong>{catalogueSummary.ready}</strong>
          </button>
          <button type="button" className="equipment-catalogue-summary__card" onClick={() => setAttentionFilter(CATALOGUE_ATTENTION.ATTENTION)}>
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

      {completionStats ? (
        <CanonicalProductCompletionDashboard
          statsOverride={completionStats}
          variant="compact"
          filters={completionDashboardFilters}
          onFiltersChange={() => {}}
          exporting={completionExporting}
          onExportIncomplete={() => handleExportCompletionProducts('incomplete')}
          onExportCompleted={() => handleExportCompletionProducts('complete')}
        />
      ) : null}

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
                onClick={() => setAttentionFilter(key)}
            >
              {CATALOGUE_ATTENTION_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="admin-intelligence__filters admin-products__filters">
          <div className="admin-intelligence__field admin-products__search-field">
            <label className="admin-intelligence__label" htmlFor="product-search">Search</label>
            <input
              id="product-search"
              type="search"
              className="admin-intelligence__input"
              placeholder="Brand, model, family, type…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Brand</span>
            <select
              className="admin-intelligence__select"
              value={brandFilter}
              onChange={(e) => updateListQuery({ brand: e.target.value })}
            >
              <option value={ALL_FILTER}>All brands</option>
              {brandSelectOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Category</span>
            <select
              className="admin-intelligence__select"
              value={equipmentTypeFilter}
              onChange={(e) => updateListQuery({ equipmentType: e.target.value })}
            >
              <option value={ALL_FILTER}>All categories</option>
              {equipmentTypeSelectOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Status</span>
            <select
              className="admin-intelligence__select"
              value={statusFilter}
              onChange={(e) => updateListQuery({ status: e.target.value })}
            >
              <option value={ALL_FILTER}>All statuses</option>
              <option value="pending">Pending</option>
              <option value="needs_review">Needs review</option>
              <option value="approved">Approved</option>
              <option value="excluded">Excluded</option>
            </select>
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Image status</span>
            <select
              className="admin-intelligence__select"
              value={imageFilterValue}
              onChange={(e) => updateListQuery({ imageFilter: e.target.value })}
            >
              {IMAGE_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Completion</span>
            <select
              className="admin-intelligence__select"
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
            >
              <option value={ALL_FILTER}>All</option>
              <option value={COMPLETION_DASHBOARD_FILTER.COMPLETE}>Complete</option>
              <option value={COMPLETION_DASHBOARD_FILTER.INCOMPLETE}>Incomplete</option>
              <option value={COMPLETION_DASHBOARD_FILTER.MISSING_PRICE}>Missing price</option>
              <option value={COMPLETION_DASHBOARD_FILTER.MISSING_BASELINE}>Missing baseline</option>
              <option value={COMPLETION_DASHBOARD_FILTER.MISSING_BOTH}>Missing both</option>
            </select>
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Search job</span>
            <input
              className="admin-intelligence__input"
              value={imageSearchJobId}
              onChange={(e) => updateListQuery({ imageSearchJobId: e.target.value })}
              placeholder="Job id"
            />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Source domain</span>
            <input
              className="admin-intelligence__input"
              value={imageSourceDomain}
              onChange={(e) => updateListQuery({ imageSourceDomain: e.target.value })}
              placeholder="example.com"
            />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Confidence</span>
            <input
              type="number"
              min="0"
              max="100"
              className="admin-intelligence__input"
              value={minImageConfidence}
              onChange={(e) => updateListQuery({ minImageConfidence: e.target.value })}
              placeholder="70"
            />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Candidate score</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="admin-intelligence__input"
              value={minCandidateScore}
              onChange={(e) => updateListQuery({ minCandidateScore: e.target.value })}
              placeholder="70"
            />
          </label>
          <label className="admin-intelligence__field">
            <span className="admin-intelligence__label">Page size</span>
            <select
              className="admin-intelligence__select"
              value={pageSize}
              onChange={(e) => {
                updateListQuery({
                  pageSize: clampEquipmentProductListPageSize(e.target.value),
                })
              }}
            >
              {EQUIPMENT_PRODUCT_LIST_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-products__summary-bar">
          <span>
            {loading && !products.length
              ? 'Loading products…'
              : `${totalCount.toLocaleString('en-GB')} matching products`}
            {listRefreshing ? ' · Updating…' : ''}
          </span>
          <span className="admin-products__page-meta">
            Page {page} of {totalPages}
          </span>
        </div>

        <div className="admin-products__bulk-bar">
          <label className="admin-products__select-all">
            <input
              type="checkbox"
              checked={allPageSelected || allFilteredSelected}
              onChange={toggleSelectAll}
              disabled={!products.length}
            />
            Select page
          </label>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={selectAllMatchingFiltered}
            disabled={!totalCount}
          >
            Select all {totalCount.toLocaleString('en-GB')} matching
          </button>
          {(selectedIds.size > 0 || allFilteredSelected) ? (
            <span className="admin-products__selection-label">{imageSearchSelectionLabel}</span>
          ) : null}
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            disabled={imageSearchActionDisabled}
            onClick={openImageSearchModal}
            title={activeImageSearchJob ? 'An image search job is already running' : undefined}
          >
            Retry search
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            disabled={
              bulkLoading
              || bulkImageApprovalBusy
              || (
                !allFilteredSelected
                && selectedIds.size === 0
              )
            }
            onClick={() => openBulkImageApprovalModal()}
          >
            Approve selected ({bulkImageApproveSelectionCount})
          </button>
          <button
            type="button"
            className="admin-intelligence__button"
            disabled={bulkLoading || (selectedIds.size === 0 && !allFilteredSelected)}
            onClick={handleBulkRejectImages}
          >
            Reject selected ({bulkImageApproveSelectionCount})
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-products__actions-menu-item--danger"
            disabled={bulkLoading || (selectedIds.size === 0 && !allFilteredSelected)}
            onClick={handleBulkExcludeProducts}
          >
            Exclude selected ({bulkImageApproveSelectionCount})
          </button>
          {bulkImageShortcutVisible ? (
            <button
              type="button"
              className="admin-intelligence__button admin-intelligence__button--secondary"
              disabled={bulkLoading || bulkImageApprovalBusy || !totalCount}
              onClick={() => openBulkImageApprovalModal({ forceFiltered: true })}
            >
              Approve pending images
            </button>
          ) : null}
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            disabled={bulkLoading || highConfidenceLoading || !products.length}
            onClick={openHighConfidenceApproveModal}
          >
            Approve high confidence 90+ (page)
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            disabled={bulkLoading || !products.length}
            onClick={handleBulkRejectBlockedImages}
          >
            Reject blocked images (page)
          </button>
          <Link
            to="/admin/intelligence/product-content"
            className="admin-intelligence__button admin-intelligence__button--secondary"
          >
            Publish content
          </Link>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            disabled={loading}
            onClick={() => setResearchExportOpen(true)}
          >
            Export research list
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={() => setResearchImportOpen(true)}
          >
            Import researched product updates
          </button>
        </div>

        {loading && !products.length ? (
          <div className="admin-products__table-skeleton" aria-busy="true" aria-label="Loading products">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="admin-products__skeleton-row" />
            ))}
          </div>
        ) : null}

        {!loading && !error && products.length === 0 ? (
          <EmptyState compact>
            No products match these filters.
          </EmptyState>
        ) : null}

        {products.length > 0 ? (
          <div className={`admin-intelligence__table-wrap admin-products__table-wrap${listRefreshing ? ' admin-products__table-wrap--refreshing' : ''}`}>
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
                {products.map((product) => {
                  const thumbUrl = getAdminProductImageThumbUrl(product)
                  const catalogueStatus = getCatalogueStatusLabel(product, contentByProductId)
                  return (
                    <tr
                      key={product.id}
                      className={mergeSourceId === product.id ? 'admin-products__row-merge-source' : undefined}
                      onDoubleClick={() => openEditProduct(product.id)}
                    >
                      <td className="admin-products__col-select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          aria-label={`Select ${getEquipmentProductDisplayName(product)}`}
                        />
                      </td>
                      <td className="admin-products__col-image">
                        <ProductImageCell
                          product={product}
                          thumbUrl={thumbUrl}
                          onImageAudit={() => openImageAudit(product)}
                        />
                      </td>
                      <td className="admin-products__col-product">
                        <button
                          type="button"
                          className="admin-products__identity-button"
                          onClick={() => openEditProduct(product.id)}
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
                          <strong>{getEquipmentProductDisplayName(product)}</strong>
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
                      <td>
                        <div className="admin-products__image-status-cell">
                          <span>{getCatalogueImageStatusLabel(product)}</span>
                          {productRowImageSearchLabel(
                            product,
                            jobItemStatusByProductId.get(product.id)?.status,
                          ) ? (
                            <span className="admin-products__image-search-state">
                              {productRowImageSearchLabel(
                                product,
                                jobItemStatusByProductId.get(product.id)?.status,
                              )}
                            </span>
                          ) : null}
                        </div>
                      </td>
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
                          onImageAudit={() => openImageAudit(product)}
                          onEdit={() => openEditProduct(product.id)}
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
        ) : null}

        {totalCount > 0 ? (
          <div className="admin-products__pagination" aria-label="Pagination">
            <button
              type="button"
              className="admin-intelligence__button"
              disabled={loading || listRefreshing || page <= 1}
              onClick={() => updateListQuery({ page: Math.max(1, page - 1) }, { resetPage: false })}
            >
              Previous
            </button>
            <div className="admin-products__page-numbers">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`admin-products__page-number${pageNumber === page ? ' admin-products__page-number--active' : ''}`}
                  disabled={loading || listRefreshing}
                  onClick={() => updateListQuery({ page: pageNumber }, { resetPage: false })}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="admin-intelligence__button"
              disabled={loading || listRefreshing || page >= totalPages}
              onClick={() => updateListQuery({ page: Math.min(totalPages, page + 1) }, { resetPage: false })}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      {selectedProduct ? (
        <ProductSourceRowsModal
          product={selectedProduct}
          sourceRows={sourceRows}
          loading={sourceLoading}
          onClose={() => { setSelectedProductId(null); setSourceRows([]) }}
        />
      ) : null}

      {editProductId ? (
        editLoading && !editProduct ? (
          <div className="admin-products__modal-backdrop" role="dialog" aria-modal="true" aria-label="Loading product">
            <div className="admin-products__modal">
              <LoadingState compact>Loading product…</LoadingState>
            </div>
          </div>
        ) : editProduct ? (
          <ProductEditModal
            product={editProduct}
            onClose={() => {
              setEditProductId(null)
              setEditProduct(null)
            }}
            onSaved={reloadAfterMutation}
            onOpenImage={(productId) => {
              const match = (editProduct?.id === productId ? editProduct : null)
                || products.find((product) => product.id === productId)
                || { id: productId }
              openImageAudit(match)
            }}
          />
        ) : null
      ) : null}

      {imageProduct ? (
        <ProductImageAuditModal
          product={imageProduct}
          onClose={() => {
            setImageProductId(null)
            setImageProductDetail(null)
          }}
          onProductUpdated={handleImageProductUpdated}
        />
      ) : null}

      <BulkImageApprovalModal
        open={bulkImageApprovalOpen}
        busy={bulkImageApprovalBusy}
        selectionMode={bulkImageApprovalMode}
        selectedCount={bulkImageApproveSelectionCount}
        totalMatching={totalCount}
        filters={currentListFilters}
        preview={bulkImageApprovalPreview}
        truncated={bulkImageApprovalTruncated}
        onCancel={() => {
          setBulkImageApprovalOpen(false)
          setBulkImageApprovalPreview(null)
          setBulkImageApprovalTruncated(false)
          setBulkImageApprovalMode(IMAGE_SEARCH_SELECTION_MODE.PAGE)
        }}
        onConfirm={() => confirmBulkImageApproval()}
      />

      <ProductImageSearchConfirmModal
        open={imageSearchModalOpen}
        busy={imageSearchBusy}
        selectionMode={allFilteredSelected
          ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
          : IMAGE_SEARCH_SELECTION_MODE.PAGE}
        selectedCount={imageSearchSelectionCount}
        totalMatching={totalCount}
        preview={imageSearchPreview}
        filters={currentListFilters}
        includeApproved={imageSearchIncludeApproved}
        onIncludeApprovedChange={async (checked) => {
          setImageSearchIncludeApproved(checked)
          const mode = allFilteredSelected
            ? IMAGE_SEARCH_SELECTION_MODE.FILTERED
            : IMAGE_SEARCH_SELECTION_MODE.PAGE
          const { preview } = await previewEquipmentProductImageSearchJob({
            selectionMode: mode,
            productIds: [...selectedIds],
            filters: currentListFilters,
            includeApproved: checked,
            maxProducts: IMAGE_SEARCH_JOB_MAX_PRODUCTS,
          })
          setImageSearchPreview(preview)
        }}
        onCancel={() => setImageSearchModalOpen(false)}
        onConfirm={startImageSearchJob}
      />

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

      <EquipmentProductResearchExportModal
        open={researchExportOpen}
        onClose={() => setResearchExportOpen(false)}
        filters={{
          brand: brandFilter,
          status: statusFilter,
          completion: completionFilter,
          attention: attentionFilter,
          equipmentType: equipmentTypeFilter,
          search: debouncedSearch,
          sort,
          sortDir,
        }}
        totalMatching={totalCount}
        selectedIds={[...selectedIds]}
        currentPageProducts={products}
      />

      <EquipmentProductResearchImportModal
        open={researchImportOpen}
        onClose={() => setResearchImportOpen(false)}
        onApplied={handleResearchImportApplied}
      />
    </div>
  )
}
