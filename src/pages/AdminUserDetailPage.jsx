import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { getAdminErrorMessage } from '../lib/admin'
import { fetchAdminUserMarketplaceActivity } from '../lib/adminUserActivity'
import { formatAdminJoinedAt, formatAdminSignupName } from '../lib/adminUserStatistics'
import { formatOfferStatus } from '../lib/offers'
import { formatPricePence } from '../lib/listings'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminUsersPage.css'
import './AdminUserDetailPage.css'

function StatusBadge({ status }) {
  const label = formatOfferStatus(status) || status || '—'
  const variant = status || 'unknown'
  return (
    <span className={`admin-user-detail__status admin-user-detail__status--${variant}`}>
      {label}
    </span>
  )
}

function MetricGrid({ items }) {
  return (
    <dl className="admin-user-detail__metrics">
      {items.map((item) => (
        <div key={item.label} className="admin-user-detail__metric">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function OfferStatusBreakdown({ title, total, rows }) {
  return (
    <div className="admin-user-detail__breakdown">
      <h3 className="admin-user-detail__subheading">{title}</h3>
      <p className="admin-user-detail__total">Total {total}</p>
      <ul className="admin-user-detail__status-list">
        {rows.map((row) => (
          <li key={row.status}>
            <span>{formatOfferStatus(row.status)}</span>
            <strong>{row.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OfferTable({ rows, emptyLabel }) {
  if (!rows.length) {
    return <EmptyState compact>{emptyLabel}</EmptyState>
  }

  return (
    <div className="admin-users__table-wrap">
      <table className="admin-dashboard__table admin-users__table admin-user-detail__table">
        <thead>
          <tr>
            <th scope="col">Listing</th>
            <th scope="col">Amount</th>
            <th scope="col">Status</th>
            <th scope="col">Other party</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((offer) => {
            const listingLabel = offer.listingTitle || 'Listing unavailable'
            const listingHref = offer.listingSlug ? `/listings/${offer.listingSlug}` : null
            return (
              <tr key={offer.id}>
                <td data-label="Listing">
                  {listingHref ? (
                    <Link to={listingHref} className="admin-users__link">
                      {listingLabel}
                    </Link>
                  ) : (
                    listingLabel
                  )}
                  {offer.listingStatus ? (
                    <span className="admin-user-detail__muted"> · {offer.listingStatus}</span>
                  ) : null}
                </td>
                <td data-label="Amount">{formatPricePence(offer.amountPence)}</td>
                <td data-label="Status">
                  <StatusBadge status={offer.status} />
                </td>
                <td data-label="Other party">{offer.otherParticipant?.label || 'Equipd user'}</td>
                <td data-label="Created">{formatAdminJoinedAt(offer.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AdminUserDetailPage() {
  const { userId } = useParams()
  usePageTitle('Admin user activity')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      const { data: payload, error: fetchError } = await fetchAdminUserMarketplaceActivity(userId)
      if (!active) return
      if (fetchError) {
        setError(getAdminErrorMessage(fetchError))
        setData(null)
      } else {
        setData(payload)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [userId])

  const userLabel = data
    ? data.user.displayName?.trim() ||
      data.user.username?.trim() ||
      formatAdminSignupName(data.user)
    : 'User'

  return (
    <section className="admin-intelligence admin-user-detail">
      <header className="admin-intelligence__header">
        <p className="admin-user-detail__back">
          <Link to="/admin/users">← Users</Link>
        </p>
        <h1 className="admin-intelligence__title">User activity</h1>
        <p className="admin-intelligence__lead">
          Read-only marketplace activity for support and liquidity review.
        </p>
      </header>

      {loading ? <LoadingState compact>Loading user activity…</LoadingState> : null}
      {!loading && error ? <ErrorState compact>{error}</ErrorState> : null}

      {!loading && !error && data ? (
        <>
          <section className="admin-intelligence__panel" aria-labelledby="admin-user-profile-heading">
            <h2 id="admin-user-profile-heading" className="admin-intelligence__panel-title">
              User
            </h2>
            <dl className="admin-user-detail__profile">
              <div>
                <dt>Name</dt>
                <dd>{userLabel}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{data.user.username || '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd className="admin-dashboard__email">{data.user.email || '—'}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{formatAdminJoinedAt(data.user.createdAt)}</dd>
              </div>
              <div>
                <dt>Admin</dt>
                <dd>{data.user.isAdmin ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Activity</dt>
                <dd>{data.summary.activityLabel}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-intelligence__panel" aria-labelledby="admin-user-activity-heading">
            <h2 id="admin-user-activity-heading" className="admin-intelligence__panel-title">
              Marketplace activity
            </h2>
            <MetricGrid
              items={[
                { label: 'Listings', value: data.summary.listingCount },
                { label: 'Saved listings', value: data.summary.savedCount },
                { label: 'Conversations', value: data.summary.conversationCount },
                { label: 'Offers made', value: data.summary.offersMadeCount },
                { label: 'Offers received', value: data.summary.offersReceivedCount },
                { label: 'Purchases', value: data.summary.purchaseCount },
                { label: 'Sales', value: data.summary.saleCount },
              ]}
            />
          </section>

          <section className="admin-intelligence__panel" aria-labelledby="admin-user-offers-heading">
            <h2 id="admin-user-offers-heading" className="admin-intelligence__panel-title">
              Offers
            </h2>
            <div className="admin-user-detail__offer-summaries">
              <OfferStatusBreakdown
                title="Offers made"
                total={data.summary.offersMadeCount}
                rows={data.offersMadeByStatus}
              />
              <OfferStatusBreakdown
                title="Offers received"
                total={data.summary.offersReceivedCount}
                rows={data.offersReceivedByStatus}
              />
            </div>

            <h3 className="admin-user-detail__subheading">Offers made</h3>
            <OfferTable rows={data.offersMade} emptyLabel="No offers made." />

            <h3 className="admin-user-detail__subheading">Offers received</h3>
            <OfferTable rows={data.offersReceived} emptyLabel="No offers received." />
          </section>

          <section className="admin-intelligence__panel" aria-labelledby="admin-user-saved-heading">
            <h2 id="admin-user-saved-heading" className="admin-intelligence__panel-title">
              Saved listings
            </h2>
            {data.savedListings.length === 0 ? (
              <EmptyState compact>No saved listings.</EmptyState>
            ) : (
              <div className="admin-users__table-wrap">
                <table className="admin-dashboard__table admin-users__table admin-user-detail__table">
                  <thead>
                    <tr>
                      <th scope="col">Listing</th>
                      <th scope="col">Price</th>
                      <th scope="col">Seller</th>
                      <th scope="col">Status</th>
                      <th scope="col">Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.savedListings.map((row) => {
                      const href = row.listingSlug ? `/listings/${row.listingSlug}` : null
                      return (
                        <tr key={row.savedId}>
                          <td data-label="Listing">
                            {href ? (
                              <Link to={href} className="admin-users__link">
                                {row.listingTitle}
                              </Link>
                            ) : (
                              row.listingTitle
                            )}
                          </td>
                          <td data-label="Price">
                            {row.pricePence == null ? '—' : formatPricePence(row.pricePence)}
                          </td>
                          <td data-label="Seller">{row.seller?.label || '—'}</td>
                          <td data-label="Status">{row.listingStatus || '—'}</td>
                          <td data-label="Saved">{formatAdminJoinedAt(row.savedAt)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section
            className="admin-intelligence__panel"
            aria-labelledby="admin-user-conversations-heading"
          >
            <h2 id="admin-user-conversations-heading" className="admin-intelligence__panel-title">
              Conversations
            </h2>
            {data.conversations.length === 0 ? (
              <EmptyState compact>No conversations.</EmptyState>
            ) : (
              <div className="admin-users__table-wrap">
                <table className="admin-dashboard__table admin-users__table admin-user-detail__table">
                  <thead>
                    <tr>
                      <th scope="col">Listing</th>
                      <th scope="col">Role</th>
                      <th scope="col">Other party</th>
                      <th scope="col">Updated</th>
                      <th scope="col">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.conversations.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Listing">
                          {row.listingSlug ? (
                            <Link to={`/listings/${row.listingSlug}`} className="admin-users__link">
                              {row.listingTitle}
                            </Link>
                          ) : (
                            row.listingTitle
                          )}
                        </td>
                        <td data-label="Role">{row.role === 'buyer' ? 'Buyer' : 'Seller'}</td>
                        <td data-label="Other party">
                          {row.otherParticipant?.label || 'Equipd user'}
                        </td>
                        <td data-label="Updated">{formatAdminJoinedAt(row.updatedAt)}</td>
                        <td data-label="Open">
                          <Link
                            className="admin-users__link"
                            to={`/admin/messages/${row.id}`}
                          >
                            Open in Messages
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  )
}

export default AdminUserDetailPage
