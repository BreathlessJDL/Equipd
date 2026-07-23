import { formatImageSearchSelectionLabel, IMAGE_SEARCH_SELECTION_MODE } from '../../lib/equipmentProductImageSearchJobs.js'

function filterSummary(filters = {}) {
  const parts = []
  if (filters.brand) parts.push(`Brand: ${filters.brand}`)
  if (filters.imageFilter) parts.push(`Image status: ${filters.imageFilter}`)
  if (filters.imageSearchJobId) parts.push(`Search job: ${filters.imageSearchJobId}`)
  if (filters.equipmentType) parts.push(`Type: ${filters.equipmentType}`)
  if (filters.imageSourceDomain) parts.push(`Source domain: ${filters.imageSourceDomain}`)
  if (filters.minImageConfidence) parts.push(`Confidence >= ${filters.minImageConfidence}`)
  if (filters.minCandidateScore) parts.push(`Candidate score >= ${filters.minCandidateScore}`)
  if (filters.search) parts.push(`Search: "${filters.search}"`)
  return parts.length ? parts.join(' · ') : 'No extra filters'
}

export default function BulkImageApprovalModal({
  open,
  busy = false,
  selectionMode = IMAGE_SEARCH_SELECTION_MODE.PAGE,
  selectedCount = 0,
  totalMatching = 0,
  filters = {},
  preview = null,
  truncated = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null

  const pending = Number(preview?.pendingCount) || 0
  const selected = Number(preview?.selectedCount ?? preview?.approveCount) || selectedCount
  const approveCount = Number(preview?.approveCount ?? preview?.selectedCount) || selectedCount
  const advisoryReasons = Array.isArray(preview?.advisoryReasons) ? preview.advisoryReasons : []

  return (
    <div className="admin-intelligence__modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-intelligence__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-image-approval-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="bulk-image-approval-title" className="admin-intelligence__panel-title">
          Approve pending images
        </h2>

        <p className="admin-intelligence__lead">
          {formatImageSearchSelectionLabel({ selectionMode, selectedCount, totalMatching })}
        </p>
        <p className="admin-intelligence__count">{filterSummary(filters)}</p>

        <ul className="admin-intelligence-import__result-list">
          <li>Selected: {selected}</li>
          <li>Pending images: {pending}</li>
          <li>Will approve: {approveCount}</li>
        </ul>

        {advisoryReasons.length > 0 ? (
          <>
            <p className="admin-intelligence__count">Advisory notes (approval still proceeds)</p>
            <ul className="admin-intelligence-import__result-list">
              {advisoryReasons.map((entry) => (
                <li key={entry.reason}>{entry.label}: {entry.count}</li>
              ))}
            </ul>
          </>
        ) : null}

        {truncated ? (
          <p className="admin-intelligence__message admin-intelligence__message--warning" role="status">
            Selection exceeded the bulk review cap and was truncated to the first 10,000 matching products.
          </p>
        ) : null}

        <p className="admin-intelligence__message" role="status">
          Every selected product will be approved. Products without an image may fail at approval time.
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
            disabled={busy || approveCount <= 0}
          >
            {busy ? 'Approving…' : `Approve ${approveCount} image${approveCount === 1 ? '' : 's'}`}
          </button>
        </div>

        {selectionMode === IMAGE_SEARCH_SELECTION_MODE.FILTERED ? (
          <p className="admin-intelligence__count">
            Matching products are resolved server-side from the current filters, not just the current page.
          </p>
        ) : null}
      </div>
    </div>
  )
}
