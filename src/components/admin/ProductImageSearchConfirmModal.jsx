import {
  formatImageSearchSelectionLabel,
  IMAGE_SEARCH_SELECTION_MODE,
} from '../../lib/equipmentProductImageSearchJobs'

function filterSummary(filters = {}) {
  const parts = []
  if (filters.brand) parts.push(`Brand: ${filters.brand}`)
  if (filters.imageFilter) parts.push(`Image status: ${filters.imageFilter}`)
  if (filters.status) parts.push(`Status: ${filters.status}`)
  if (filters.equipmentType) parts.push(`Type: ${filters.equipmentType}`)
  if (filters.attention && filters.attention !== 'all') parts.push(`Attention: ${filters.attention}`)
  if (filters.search) parts.push(`Search: “${filters.search}”`)
  return parts.length ? parts.join(' · ') : 'No extra filters'
}

export default function ProductImageSearchConfirmModal({
  open,
  busy = false,
  selectionMode,
  selectedCount,
  totalMatching,
  preview,
  filters,
  includeApproved,
  onIncludeApprovedChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null

  const eligible = Number(preview?.eligible_count) || 0
  const skipped = Number(preview?.skipped_approved) || 0
  const alreadyActive = Number(preview?.already_active) || 0
  const estimated = Number(preview?.estimated_searches) || eligible

  return (
    <div className="admin-intelligence__modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-intelligence__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-search-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="image-search-confirm-title" className="admin-intelligence__panel-title">
          Start image search
        </h2>

        <p className="admin-intelligence__lead">
          {formatImageSearchSelectionLabel({ selectionMode, selectedCount, totalMatching })}
        </p>
        <p className="admin-intelligence__count">{filterSummary(filters)}</p>

        <ul className="admin-intelligence-import__result-list">
          <li>{eligible} eligible for search</li>
          <li>{skipped} skipped (approved image already exists)</li>
          {alreadyActive > 0 ? (
            <li>{alreadyActive} already in an active search job</li>
          ) : null}
          <li>~{estimated} searches / jobs</li>
        </ul>

        <label className="admin-products__select-all" style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
          <input
            type="checkbox"
            checked={includeApproved}
            onChange={(event) => onIncludeApprovedChange?.(event.target.checked)}
            disabled={busy}
          />
          <span>Search again for products with approved images</span>
        </label>

        <p className="admin-intelligence__message admin-intelligence__message--warning" role="status">
          All results stay pending for manual review. Approved images are never replaced automatically.
        </p>

        <div className="admin-intelligence__actions">
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-intelligence__button admin-intelligence__button--primary"
            onClick={onConfirm}
            disabled={busy || eligible <= 0}
          >
            {busy ? 'Starting…' : 'Start image search'}
          </button>
        </div>

        {selectionMode === IMAGE_SEARCH_SELECTION_MODE.FILTERED ? (
          <p className="admin-intelligence__count">
            Matching products are resolved server-side from the current filters (not only this page).
          </p>
        ) : null}
      </div>
    </div>
  )
}
