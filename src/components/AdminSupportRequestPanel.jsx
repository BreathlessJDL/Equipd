import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ADMIN_SUPPORT_STATUS_OPTIONS,
  formatAdminUserLabel,
  formatSupportRequestReason,
  formatSupportRequestTimestamp,
} from '../lib/admin'

function AdminSupportRequestPanel({ request, saving, onSave, onClose }) {
  const [status, setStatus] = useState(request.status)
  const [adminNotes, setAdminNotes] = useState(request.admin_notes ?? '')
  const [resolutionNotes, setResolutionNotes] = useState(request.resolution_notes ?? '')

  useEffect(() => {
    setStatus(request.status)
    setAdminNotes(request.admin_notes ?? '')
    setResolutionNotes(request.resolution_notes ?? '')
  }, [request])

  function handleSubmit(event) {
    event.preventDefault()
    onSave?.({
      requestId: request.id,
      status,
      adminNotes,
      resolutionNotes,
    })
  }

  return (
    <section className="admin-support__panel">
      <div className="admin-support__panel-header">
        <div>
          <h2 className="admin-support__panel-title">Review support request</h2>
          <p className="admin-support__panel-meta">
            {formatSupportRequestReason(request.reason)} ·{' '}
            {formatSupportRequestTimestamp(request.created_at)}
          </p>
        </div>
        <button type="button" className="admin-support__panel-close" onClick={onClose}>
          Close
        </button>
      </div>

      <dl className="admin-support__panel-details">
        <div className="admin-support__panel-row">
          <dt>Listing</dt>
          <dd>{request.listing_title ?? 'Listing unavailable'}</dd>
        </div>
        <div className="admin-support__panel-row">
          <dt>Order</dt>
          <dd>
            <Link to={`/orders/${request.order_id}`} className="admin-support__link">
              {request.order_id}
            </Link>
          </dd>
        </div>
        <div className="admin-support__panel-row">
          <dt>Buyer</dt>
          <dd>{formatAdminUserLabel(request.buyer_id, request.buyer_display_name)}</dd>
        </div>
        <div className="admin-support__panel-row">
          <dt>Seller</dt>
          <dd>{formatAdminUserLabel(request.seller_id, request.seller_display_name)}</dd>
        </div>
        <div className="admin-support__panel-row">
          <dt>Opened by</dt>
          <dd>{formatAdminUserLabel(request.opened_by, request.opened_by_display_name)}</dd>
        </div>
        <div className="admin-support__panel-row">
          <dt>User message</dt>
          <dd className="admin-support__panel-message">{request.message}</dd>
        </div>
        {request.reviewed_at ? (
          <div className="admin-support__panel-row">
            <dt>Reviewed</dt>
            <dd>
              {formatAdminUserLabel(request.reviewed_by, request.reviewed_by_display_name)}
              {' · '}
              {formatSupportRequestTimestamp(request.reviewed_at)}
            </dd>
          </div>
        ) : null}
        {request.resolved_at ? (
          <div className="admin-support__panel-row">
            <dt>Resolved</dt>
            <dd>{formatSupportRequestTimestamp(request.resolved_at)}</dd>
          </div>
        ) : null}
      </dl>

      <form className="admin-support__panel-form" onSubmit={handleSubmit}>
        <label className="admin-support__field">
          <span className="admin-support__field-label">Status</span>
          <select
            className="admin-support__select"
            value={status}
            disabled={saving}
            onChange={(event) => setStatus(event.target.value)}
          >
            {ADMIN_SUPPORT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-support__field">
          <span className="admin-support__field-label">Internal admin notes</span>
          <textarea
            className="admin-support__textarea"
            rows={4}
            value={adminNotes}
            disabled={saving}
            placeholder="Internal notes for Equipd support. Not visible to buyer or seller."
            onChange={(event) => setAdminNotes(event.target.value)}
          />
        </label>

        <label className="admin-support__field">
          <span className="admin-support__field-label">Resolution notes</span>
          <textarea
            className="admin-support__textarea"
            rows={4}
            value={resolutionNotes}
            disabled={saving}
            placeholder="Outcome summary shown to buyer/seller when resolved or closed."
            onChange={(event) => setResolutionNotes(event.target.value)}
          />
        </label>

        <button type="submit" className="admin-support__save-button" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  )
}

export default AdminSupportRequestPanel
