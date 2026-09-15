import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { fetchAdminUserStatistics } from '../lib/admin'
import { fetchAdminMarketplaceActivityStatistics } from '../lib/adminUserActivity'
import { ADMIN_HUB_TOOLS } from '../lib/adminNav'
import {
  formatAdminJoinedAt,
  formatAdminSignupName,
} from '../lib/adminUserStatistics'
import { formatOfferStatus } from '../lib/offers'
import { usePageTitle } from '../hooks/usePageTitle'
import './AdminIntelligencePage.css'
import './AdminDashboard.css'

const USER_STAT_CARDS = [
  { key: 'totalUsers', label: 'Total users' },
  { key: 'newToday', label: 'New today' },
  { key: 'last7Days', label: 'Last 7 days' },
  { key: 'last30Days', label: 'Last 30 days' },
  { key: 'usersWhoHaveListed', label: 'Users who have listed' },
]

function AdminDashboardPage() {
  usePageTitle('Equipd Admin')
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityError, setActivityError] = useState('')

  useEffect(() => {
    let active = true

    async function loadStats() {
      const [{ data, error: fetchError }, { data: activityData, error: activityFetchError }] =
        await Promise.all([
          fetchAdminUserStatistics(),
          fetchAdminMarketplaceActivityStatistics(),
        ])
      if (!active) return

      if (fetchError) {
        console.error('[admin-user-stats] failed to load user statistics')
        setError('Unable to load user statistics.')
        setStats(null)
      } else {
        setError('')
        setStats(data)
      }

      if (activityFetchError) {
        console.error('[admin-marketplace-activity] failed to load activity statistics')
        setActivityError('Unable to load marketplace activity.')
        setActivity(null)
      } else {
        setActivityError('')
        setActivity(activityData)
      }

      setLoading(false)
      setActivityLoading(false)
    }

    loadStats()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="admin-intelligence admin-dashboard">
      <header className="admin-intelligence__header">
        <h1 className="admin-intelligence__title">Equipd Admin</h1>
        <p className="admin-intelligence__lead">Manage the Equipd marketplace.</p>
      </header>

      <section className="admin-intelligence__panel" aria-labelledby="admin-user-stats-heading">
        <h2 id="admin-user-stats-heading" className="admin-intelligence__panel-title">
          User statistics
        </h2>

        {loading ? <LoadingState compact>Loading user statistics…</LoadingState> : null}
        {error ? <ErrorState compact>{error}</ErrorState> : null}

        {!loading && !error && stats ? (
          <>
            <div className="admin-intelligence__stats" aria-label="User statistics">
              {USER_STAT_CARDS.map((card) => (
                <div key={card.key} className="admin-intelligence__stat">
                  <span>{card.label}</span>
                  <strong>{stats[card.key]}</strong>
                </div>
              ))}
            </div>

            <div className="admin-dashboard__signups">
              <h3 className="admin-dashboard__signups-title">Latest sign-ups</h3>
              {stats.latestSignups.length === 0 ? (
                <EmptyState compact>No registered users yet.</EmptyState>
              ) : (
                <div className="admin-intelligence__table-wrap">
                  <table className="admin-intelligence__table admin-dashboard__table">
                    <thead>
                      <tr>
                        <th scope="col">User</th>
                        <th scope="col">Email</th>
                        <th scope="col">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.latestSignups.map((signup) => (
                        <tr key={signup.id ?? `${signup.username}-${signup.createdAt}`}>
                          <td>
                            {signup.id ? (
                              <Link to={`/admin/users/${signup.id}`}>
                                {formatAdminSignupName(signup)}
                              </Link>
                            ) : (
                              formatAdminSignupName(signup)
                            )}
                          </td>
                          <td className="admin-dashboard__email">{signup.email || '—'}</td>
                          <td>{formatAdminJoinedAt(signup.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </section>

      <section
        className="admin-intelligence__panel"
        aria-labelledby="admin-marketplace-activity-heading"
      >
        <h2 id="admin-marketplace-activity-heading" className="admin-intelligence__panel-title">
          Marketplace activity
        </h2>
        <p className="admin-dashboard__activity-lead">
          Liquidity signals across saves, offers, and conversations.
        </p>

        {activityLoading ? (
          <LoadingState compact>Loading marketplace activity…</LoadingState>
        ) : null}
        {activityError ? <ErrorState compact>{activityError}</ErrorState> : null}

        {!activityLoading && !activityError && activity ? (
          <div className="admin-dashboard__activity-grid" aria-label="Marketplace activity">
            <div className="admin-intelligence__stat">
              <span>Saved listings</span>
              <strong>{activity.savedListings.total}</strong>
              <em>+{activity.savedListings.last7Days} last 7 days</em>
            </div>
            <div className="admin-intelligence__stat">
              <span>Offers</span>
              <strong>{activity.offers.total}</strong>
              <em>
                {activity.offers.pending} pending · {activity.offers.accepted} accepted · +
                {activity.offers.last7Days} last 7 days
              </em>
              <ul className="admin-dashboard__offer-status">
                {activity.offers.byStatus.map((row) => (
                  <li key={row.status}>
                    <span>{formatOfferStatus(row.status)}</span>
                    <strong>{row.count}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="admin-intelligence__stat">
              <span>Conversations</span>
              <strong>{activity.conversations.total}</strong>
              <em>+{activity.conversations.last7Days} last 7 days</em>
            </div>
          </div>
        ) : null}
      </section>

      <section className="admin-intelligence__panel" aria-labelledby="admin-tools-heading">
        <h2 id="admin-tools-heading" className="admin-intelligence__panel-title">
          Admin tools
        </h2>
        <div className="admin-hub-tools">
          {ADMIN_HUB_TOOLS.map((tool) => (
            <Link key={tool.to} to={tool.to} className="admin-hub-tool">
              <span className="admin-hub-tool__label">{tool.label}</span>
              <p className="admin-hub-tool__description">{tool.description}</p>
              <span className="admin-hub-tool__cta">{tool.cta} →</span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

export default AdminDashboardPage
