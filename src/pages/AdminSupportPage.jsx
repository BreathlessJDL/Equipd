import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminSupportRequestPanel from '../components/AdminSupportRequestPanel'
import '../components/AdminSupport.css'
import '../components/PageStub.css'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import {
  ADMIN_SUPPORT_STATUS_FILTERS,
  fetchAdminSupportRequests,
  formatAdminUserLabel,
  formatSupportRequestReason,
  formatSupportRequestStatus,
  formatSupportRequestTimestamp,
  getAdminErrorMessage,
  getSupportRequestErrorMessage,
  updateAdminSupportRequest,
} from '../lib/admin'
import { usePageTitle } from '../hooks/usePageTitle'

function AdminSupportPage() {
  usePageTitle('Admin Support')
  const [statusFilter, setStatusFilter] = useState('all')
  const [requests, setRequests] = useState([])
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await fetchAdminSupportRequests(statusFilter)

    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
      setRequests([])
      setLoading(false)
      return
    }

    setRequests(data ?? [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    setSelectedRequestId(null)
    loadRequests()
  }, [loadRequests])

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) ?? null

  async function handleSaveRequest(update) {
    if (!update?.requestId || savingId) return

    setSavingId(update.requestId)
    setError('')

    const { error: updateError } = await updateAdminSupportRequest(update)

    if (updateError) {
      setError(getSupportRequestErrorMessage(updateError))
      setSavingId(null)
      return
    }

    setSavingId(null)
    await loadRequests()
  }

  return (
    <section className="admin-support">
      <header className="admin-support__header">
        <p className="admin-support__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>
        <h1 className="admin-support__title">Support requests</h1>
        <p className="admin-support__lead">
          Review support requests, add internal notes, and record resolutions.
        </p>
      </header>

      <div className="admin-support__filters" role="tablist" aria-label="Support request status">
        {ADMIN_SUPPORT_STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === filter.value}
            className={`admin-support__filter${
              statusFilter === filter.value ? ' admin-support__filter--active' : ''
            }`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {loading ? (
        <LoadingState compact>Loading support requests…</LoadingState>
      ) : requests.length === 0 ? (
        <EmptyState compact>No support requests in this view.</EmptyState>
      ) : (
        <div className="admin-support__table-wrap">
          <table className="admin-support__table">
            <thead>
              <tr>
                <th scope="col">Created</th>
                <th scope="col">Status</th>
                <th scope="col">Listing</th>
                <th scope="col">Order</th>
                <th scope="col">Buyer</th>
                <th scope="col">Seller</th>
                <th scope="col">Opened by</th>
                <th scope="col">Reason</th>
                <th scope="col">Message</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className={
                    selectedRequestId === request.id ? 'admin-support__row--selected' : undefined
                  }
                >
                  <td>{formatSupportRequestTimestamp(request.created_at)}</td>
                  <td>{formatSupportRequestStatus(request.status)}</td>
                  <td>{request.listing_title ?? 'Listing unavailable'}</td>
                  <td>
                    <Link to={`/orders/${request.order_id}`} className="admin-support__link">
                      {request.order_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td>{formatAdminUserLabel(request.buyer_id, request.buyer_display_name)}</td>
                  <td>{formatAdminUserLabel(request.seller_id, request.seller_display_name)}</td>
                  <td>
                    {formatAdminUserLabel(request.opened_by, request.opened_by_display_name)}
                  </td>
                  <td>{formatSupportRequestReason(request.reason)}</td>
                  <td className="admin-support__message-cell">{request.message}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-support__review-button"
                      onClick={() => setSelectedRequestId(request.id)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest ? (
        <AdminSupportRequestPanel
          request={selectedRequest}
          saving={savingId === selectedRequest.id}
          onSave={handleSaveRequest}
          onClose={() => setSelectedRequestId(null)}
        />
      ) : null}
    </section>
  )
}

export default AdminSupportPage
