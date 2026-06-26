import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../components/AdminOrders.css'
import '../components/PageStub.css'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import {
  ADMIN_ORDER_FILTERS,
  fetchAdminOrders,
  formatAdminBuyerConfirmed,
  formatAdminOrderWarning,
  formatAdminUserLabel,
  formatOrderFulfilmentStatus,
  formatOrderTimestamp,
  formatPaymentStatus,
  formatPayoutStatus,
  formatPricePence,
  getAdminErrorMessage,
  getAdminOrderWarnings,
} from '../lib/admin'

function AdminOrdersPage() {
  const [filter, setFilter] = useState('all')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await fetchAdminOrders(filter)

    if (fetchError) {
      setError(getAdminErrorMessage(fetchError))
      setOrders([])
      setLoading(false)
      return
    }

    setOrders(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  return (
    <section className="admin-orders">
      <header className="admin-orders__header">
        <p className="admin-orders__back">
          <Link to="/hub">← Back to Hub</Link>
        </p>
        <h1 className="admin-orders__title">Orders</h1>
        <p className="admin-orders__lead">
          Diagnose payment, fulfilment, and payout issues across marketplace orders.
        </p>
      </header>

      <div className="admin-orders__filters" role="tablist" aria-label="Order filters">
        {ADMIN_ORDER_FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={filter === entry.value}
            className={`admin-orders__filter${
              filter === entry.value ? ' admin-orders__filter--active' : ''
            }`}
            onClick={() => setFilter(entry.value)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error ? <ErrorState compact>{error}</ErrorState> : null}

      {loading ? (
        <LoadingState compact>Loading orders…</LoadingState>
      ) : orders.length === 0 ? (
        <EmptyState compact>No orders in this view.</EmptyState>
      ) : (
        <div className="admin-orders__table-wrap">
          <table className="admin-orders__table">
            <thead>
              <tr>
                <th scope="col">Created</th>
                <th scope="col">Warnings</th>
                <th scope="col">Listing</th>
                <th scope="col">Order</th>
                <th scope="col">Buyer</th>
                <th scope="col">Seller</th>
                <th scope="col">Amount</th>
                <th scope="col">Payment</th>
                <th scope="col">Fulfilment</th>
                <th scope="col">Payout</th>
                <th scope="col">Buyer confirmed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const warnings = getAdminOrderWarnings(order)

                return (
                  <tr key={order.id}>
                    <td>{formatOrderTimestamp(order.created_at)}</td>
                    <td>
                      {warnings.length === 0 ? (
                        <span className="admin-orders__badge admin-orders__badge--ok">OK</span>
                      ) : (
                        <ul className="admin-orders__warnings">
                          {warnings.map((warning) => (
                            <li key={warning}>
                              <span
                                className={`admin-orders__badge admin-orders__badge--${warning}`}
                              >
                                {formatAdminOrderWarning(warning)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td>{order.listing_title ?? 'Listing unavailable'}</td>
                    <td>
                      <Link to={`/orders/${order.id}`} className="admin-orders__link">
                        {order.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td>{formatAdminUserLabel(order.buyer_id, order.buyer_display_name)}</td>
                    <td>{formatAdminUserLabel(order.seller_id, order.seller_display_name)}</td>
                    <td>{formatPricePence(order.amount_pence)}</td>
                    <td>{formatPaymentStatus(order.payment_status)}</td>
                    <td>{formatOrderFulfilmentStatus(order.fulfilment_status)}</td>
                    <td>{formatPayoutStatus(order.payout_status)}</td>
                    <td>{formatAdminBuyerConfirmed(order.buyer_confirmed_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default AdminOrdersPage
